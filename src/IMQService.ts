/*!
 * IMQService implementation
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import IMQ, {
    JsonObject,
    ILogger,
    IMessageQueue,
    profile,
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
} from '.';
import * as cluster from 'cluster';
import * as os from 'os';
import { ArgDescription } from "./IMQRPCDescription";

export class Description {
    service: {
        name: string,
        methods: MethodsCollectionDescription
    };
    types: TypesDescription;
}

let serviceDescription: Description | null = null;

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
function isValidArgsCount(argsInfo: ArgDescription[], args: any[]) {
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

        this.imq.on('message', this.handleRequest);
    }

    /**
     * Handles incoming request and produces corresponding response
     *
     * @access private
     * @param {IMQRPCRequest} req - request message
     * @param {string} id - message unique identifier
     * @return {Promise<string>}
     */
    private async handleRequest(req: IMQRPCRequest, id: string) {
        const logger = this.options.logger || console;
        const method = req.method;
        const description = await this.describe();
        const args = req.args;
        let response: IMQRPCResponse = {
            to: id,
            data: null,
            error: null,
            request: req,
        };

        if (typeof this.options.beforeCall === 'function') {
            try {
                await this.options.beforeCall(req, response);
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
            response.error = IMQError(
                'IMQ_RPC_NO_ACCESS',
                `Access to ${this.name}.${method}() denied!`,
                new Error().stack, method, args);
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

            return await imqSend(this.imq, this.options, req.from, response);
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

        return await imqSend(this.imq, this.options, req.from, response);
    }

    /**
     * Initializes this instance of service and starts handling request
     * messages.
     *
     * @return {Promise<IMessageQueue>}
     */
    @profile()
    public async start() {
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
    public async stop() {
        await this.imq.stop();
    }

    /**
     * Destroys this instance of service
     *
     * @return {Promise<void>}
     */
    @profile()
    public async destroy() {
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
        if (!serviceDescription) {
            serviceDescription = {
                service: {
                    name: this.name,
                    methods: getClassMethods(this.constructor.name)
                },
                types: IMQRPCDescription.typesDescription
            };
        }

        return serviceDescription;
    }

}

/**
 * Sends IMQ response with support of after call optional hook
 *
 * @param {IMessageQueue} imq - message queue instance
 * @param {IMQServiceOptions} options - service options
 * @param {string} from - from message identifier
 * @param {IMQRPCResponse} response - response to send
 * @return {Promise<string>} - send result message identifier
 */
export async function imqSend(
    imq: IMessageQueue,
    options: IMQServiceOptions,
    from: string,
    response: IMQRPCResponse,
): Promise<string> {
    const logger = options.logger || console;
    const id = await imq.send(from, response);

    if (typeof options.afterCall === 'function') {
        try {
            await options.afterCall(response.request, response);
        } catch (err) {
            logger.warn(AFTER_HOOK_ERROR, err);
        }
    }

    return id;
}
