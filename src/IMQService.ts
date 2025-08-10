/*!
 * IMQService implementation
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */
import IMQ, {
    JsonObject,
    ILogger,
    IMessageQueue,
    profile,
    IMQ_SHUTDOWN_TIMEOUT,
} from '@imqueue/core';
import {
    TypesDescription,
    IMQRPCDescription,
    IMQRPCRequest,
    IMQRPCResponse,
    IMQServiceOptions,
    IMQError,
    expose,
    ICache,
    ServiceClassDescription,
    MethodsCollectionDescription,
    DEFAULT_IMQ_SERVICE_OPTIONS,
    AFTER_HOOK_ERROR,
    BEFORE_HOOK_ERROR,
    SIGNALS,
} from '.';
import * as os from 'os';
import { ArgDescription } from './IMQRPCDescription';
import { IMQBeforeCall, IMQAfterCall } from './IMQRPCOptions';

const cluster: any = require('cluster');

export class Description {
    service: {
        name: string,
        methods: MethodsCollectionDescription
    };
    types: TypesDescription;
}

const serviceDescriptions: Map<string, Description> = new Map<string, Description>();

/**
 * Returns collection of class methods metadata even those are inherited
 * from a chain of parent classes
 *
 * @param {string} className
 * @return {MethodsCollectionDescription}
 */
function getClassMethods(className: string): MethodsCollectionDescription {
    let methods: MethodsCollectionDescription = {};
    let classInfo: ServiceClassDescription =
        IMQRPCDescription.serviceDescription[className];

    if (
        classInfo.inherits &&
        IMQRPCDescription.serviceDescription[classInfo.inherits]
    ) {
        Object.assign(methods, getClassMethods(classInfo.inherits));
    }

    Object.assign(methods, classInfo.methods);

    return methods;
}

/**
 * Checks if given args match given args description at least by args count
 *
 * @param {ArgDescription[]} argsInfo
 * @param {any[]} args
 * @returns {boolean}
 */
function isValidArgsCount(argsInfo: ArgDescription[], args: any[]): boolean {
    // istanbul ignore next
    return (argsInfo.some(argInfo => argInfo.isOptional)
        ? argsInfo.length >= args.length
        : argsInfo.length === args.length
    );
}

/**
 * Class IMQService
 * Basic abstract service (server-side) implementation
 */
export abstract class IMQService {

    [property: string]: any;

    protected imq: IMessageQueue;
    protected logger: ILogger;
    protected cache: ICache;

    public name: string;
    public options: IMQServiceOptions;

    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    /**
     * Class constructor
     *
     * @constructor
     * @param {Partial<IMQServiceOptions>} options
     * @param {string} [name]
     */
    constructor(options?: Partial<IMQServiceOptions>, name?: string) {
        this.name = name || this.constructor.name;

        if (this.name === 'IMQService') {
            throw new TypeError('IMQService class is abstract and cannot ' +
                'be instantiated directly!');
        }

        this.options = { ...DEFAULT_IMQ_SERVICE_OPTIONS, ...options };
        this.logger = this.options.logger || /* istanbul ignore next */ console;
        this.imq = IMQ.create(this.name, this.options);

        this.handleRequest = this.handleRequest.bind(this);

        SIGNALS.forEach((signal: any) => process.on(signal, async () => {
            this.destroy().catch(this.logger.error);
            // istanbul ignore next
            setTimeout(() => process.exit(0), IMQ_SHUTDOWN_TIMEOUT);
        }));

        this.imq.on('message', this.handleRequest);
    }

    /**
     * Handles incoming request and produces corresponding response
     *
     * @access private
     * @param {IMQRPCRequest} request - request message
     * @param {string} id - message unique identifier
     * @return {Promise<string>}
     */
    private async handleRequest(
        request: IMQRPCRequest,
        id: string,
    ): Promise<string> {
        const logger = this.options.logger || console;
        const method = request.method;
        const description = await this.describe();
        const args = request.args;
        let response: IMQRPCResponse = {
            to: id,
            data: null,
            error: null,
            request: request,
        };

        if (typeof this.options.beforeCall === 'function') {
            const beforeCall: IMQBeforeCall<IMQService> = (
                this.options.beforeCall as IMQBeforeCall<IMQService>
            ).bind(this);

            try {
                await beforeCall(request, response);
            } catch (err) {
                logger.warn(BEFORE_HOOK_ERROR, err);
            }
        }

        if (!this[method]) {
            response.error = IMQError(
                'IMQ_RPC_NO_METHOD',
                `Method ${this.name}.${method}() does not exist.`,
                new Error().stack, method, args);
        }

        else if (!description.service.methods[method]) {
            // Allow calling runtime-attached methods (own props) even if
            // they are not present in the exposed service description.
            // Deny access for prototype (class) methods not decorated with @expose.
            const isOwn = Object.prototype.hasOwnProperty.call(this, method);
            const value: any = (this as any)[method];
            const proto = Object.getPrototypeOf(this);
            const protoValue = proto && proto[method];
            const isSameAsProto = typeof protoValue === 'function' && value === protoValue;
            // Allow only truly dynamic own-instance functions (not the same as prototype)
            if (!(isOwn && typeof value === 'function' && !isSameAsProto)) {
                response.error = IMQError(
                    'IMQ_RPC_NO_ACCESS',
                    `Access to ${this.name}.${method}() denied!`,
                    new Error().stack, method, args);
            }
        }

        else if (!isValidArgsCount(
            description.service.methods[method].arguments,
            args
        )) {
            response.error = IMQError(
                'IMQ_RPC_INVALID_ARGS_COUNT',
                `Invalid args count for ${this.name}.${method}().`,
                new Error().stack, method, args);
        }

        if (response.error) {
            this.logger.warn(response.error);

            return await send(request, response, this);
        }

        try {
            response.data = this[method].apply(this, args);

            // istanbul ignore next
            if (response.data && response.data.then) {
                response.data = await response.data;
            }
        }

        catch (err) {
            response.error = IMQError(err.code || 'IMQ_RPC_CALL_ERROR',
                err.message, err.stack, method, args, err);
        }

        return await send(request, response, this);
    }

    /**
     * Initializes this instance of service and starts handling request
     * messages.
     *
     * @return {Promise<IMessageQueue | undefined>}
     */
    @profile()
    public async start(): Promise<IMessageQueue | undefined> {
        if (!this.options.multiProcess) {
            this.logger.info(
                '%s: starting single-worker, pid %s',
                this.name, process.pid
            );

            this.describe();

            return this.imq.start();
        }

        if (cluster.isMaster) {
            const numCpus = os.cpus().length;
            const numWorkers = numCpus * this.options.childrenPerCore;

            for (let i = 0; i < numWorkers; i++) {
                this.logger.info('%s: starting worker #%s ...', this.name, i);
                cluster.fork({ workerId: i });
            }

            // istanbul ignore next
            cluster.on('exit', (worker: any) => {
                this.logger.info(
                    '%s: worker pid %s died, exiting',
                    this.name,
                    worker.process.pid,
                );
                process.exit(1);
            });
        }

        else {
            this.logger.info(
                '%s: worker #%s started, pid %s',
                this.name,
                process.env['workerId'],
                process.pid,
            );

            this.describe();

            return this.imq.start();
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Sends given data to service subscription channel
     *
     * @param {JsonObject} data
     */
    public async publish(data: JsonObject) {
        await this.imq.publish(data);
    }

    /**
     * Stops service from handling messages
     *
     * @return {Promise<void>}
     */
    @profile()
    public async stop(): Promise<void> {
        await this.imq.stop();
    }

    /**
     * Destroys this instance of service
     *
     * @return {Promise<void>}
     */
    @profile()
    public async destroy(): Promise<void> {
        await this.imq.unsubscribe();
        await this.imq.destroy();
    }

    /**
     * Returns service description metadata.
     *
     * @returns {Promise<Description>}
     */
    @expose()
    public describe(): Description {
        let description = serviceDescriptions.get(this.name) || null;

        if (!description) {
            description = {
                service: {
                    name: this.name,
                    methods: getClassMethods(this.constructor.name)
                },
                types: IMQRPCDescription.typesDescription
            };

            serviceDescriptions.set(this.name, description);
        }

        return description;
    }

}

/**
 * Sends IMQ response with support of after call optional hook
 *
 * @param {IMQRPCRequest} request - from message identifier
 * @param {IMQRPCResponse} response - response to send
 * @param {IMQService} service - imq service to bind
 * @return {Promise<string>} - send result message identifier
 */
export async function send(
    request: IMQRPCRequest,
    response: IMQRPCResponse,
    service: IMQService,
): Promise<string> {
    const logger = service.options.logger || console;
    const id = await (service as any).imq.send(request.from, response);

    if (typeof service.options.afterCall === 'function') {
        const afterCall: IMQAfterCall<IMQService> = (
            service.options.afterCall as IMQAfterCall<IMQService>
        ).bind(service);

        try {
            await afterCall(request, response);
        } catch (err) {
            logger.warn(AFTER_HOOK_ERROR, err);
        }
    }

    return id;
}
