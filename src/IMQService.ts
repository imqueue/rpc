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
    type JsonObject,
    type ILogger,
    type IMessageQueue,
    profile,
    IMQ_SHUTDOWN_TIMEOUT,
} from '@imqueue/core';
import {
    type TypesDescription,
    IMQRPCDescription,
    type IMQRPCRequest,
    type IMQRPCResponse,
    type IMQServiceOptions,
    IMQError,
    expose,
    type ICache,
    type ServiceClassDescription,
    type MethodsCollectionDescription,
    DEFAULT_IMQ_SERVICE_OPTIONS,
    AFTER_HOOK_ERROR,
    BEFORE_HOOK_ERROR,
    DEFAULT_IMQ_METRICS_SERVER_OPTIONS,
} from './index.js';
import { SIGNALS } from './helpers/index.js';
import { cpus } from 'node:os';
import cluster, { type Worker } from 'node:cluster';
import { type ArgDescription } from './IMQRPCDescription.js';
import {
    type IMQBeforeCall,
    type IMQAfterCall,
    type IMQWrapCall,
} from './IMQRPCOptions.js';
import { runWithRequest } from './IMQRequestContext.js';
import { createServer, type Server } from 'node:http';

/**
 * The self-description a service serves to its clients, and the input to client
 * generation.
 *
 * @remarks
 * Declared as a class for historical reasons but never instantiated: a service
 * returns a plain object literal, and a client receives its JSON round-trip. So do
 * not use `new Description()` or `instanceof Description`.
 *
 * A service memoizes its description after the first request for it.
 */
export class Description {
    /**
     * The service itself: its name, and every exposed method with the inheritance
     * chain already flattened.
     */
    service!: {
        /**
         * The service name, which is also its queue name.
         */
        name: string;
        /**
         * Every exposed method, keyed by name, with parent-class methods merged in
         * and overridden by same-named subclass methods.
         */
        methods: MethodsCollectionDescription;
    };
    /**
     * Every complex type registered in the service's process.
     *
     * @remarks
     * This is the process-global type registry, embedded by reference and
     * unfiltered — so it includes types this service does not use, and each becomes
     * a generated interface in every client.
     */
    types!: TypesDescription;
}

const serviceDescriptions: Map<string, Description> = new Map<
    string,
    Description
>();

/**
 * Returns collection of class methods metadata even those are inherited
 * from a chain of parent classes
 *
 * @param ctor - constructor of the class to collect exposed methods for
 */
function getClassMethods(ctor: Function): MethodsCollectionDescription {
    const methods: MethodsCollectionDescription = {};

    // Resolve the chain from the runtime prototype chain rather than from the
    // registry's `inherits` links. @expose() only registers the class that
    // *declares* a method, so a class exposing nothing of its own has no
    // registry entry at all — walking `inherits` would either dereference
    // undefined or stop dead at that gap and lose the ancestors' methods.
    const chain: Function[] = [];

    for (
        let current: unknown = ctor;
        typeof current === 'function';
        current = Object.getPrototypeOf(current)
    ) {
        chain.unshift(current as Function);
    }

    // root-first, so a subclass method overrides a same-named parent one
    for (const link of chain) {
        const info: ServiceClassDescription | undefined =
            IMQRPCDescription.serviceDescription[link.name];

        if (info) {
            Object.assign(methods, info.methods);
        }
    }

    return methods;
}

/**
 * Checks if given args match the given args description at least by args count
 *
 * @param argsInfo -
 * @param args -
 */
function isValidArgsCount(argsInfo: ArgDescription[], args: any[]): boolean {
    return argsInfo.some(argInfo => argInfo.isOptional)
        ? argsInfo.length >= args.length
        : argsInfo.length === args.length;
}

/**
 * Class IMQService
 * Basic abstract service (server-side) implementation
 */
export abstract class IMQService {
    /**
     * Allows methods to be dispatched dynamically by name.
     *
     * @remarks
     * A consequence worth knowing: arbitrary property access on a service instance
     * type-checks as `any`, so typos in subclass code are not caught by the
     * compiler.
     */
    [property: string]: any;

    /**
     * The underlying message queue this service consumes requests from.
     */
    protected imq: IMessageQueue;
    /**
     * The effective logger — `options.logger`, defaulting to `console`.
     */
    protected logger: ILogger;
    /**
     * The cache adapter used by cached methods.
     *
     * @remarks
     * Never assigned by the service itself: it is populated lazily by the
     * {@link cache} decorator on first use, so it is `undefined` on a service that
     * has no cached methods.
     */
    protected cache!: ICache;
    /**
     * The metrics HTTP server, present only while
     * {@link IMQMetricsServerOptions.enabled} is set.
     *
     * @remarks
     * {@link IMQService.destroy} does not close it — do that yourself, or the
     * open listener keeps the process alive.
     */
    protected metricsServer?: Server<any, any>;
    private readonly signalHandlers: Array<[string, (...args: any[]) => void]> =
        [];

    /**
     * This service's name, which is also its queue name and the key its description
     * is cached under.
     */
    public name: string;
    /**
     * The effective options for this service: {@link DEFAULT_IMQ_SERVICE_OPTIONS}
     * merged with the values passed to the constructor.
     */
    public options: IMQServiceOptions;

    /**
     * Constructs a service.
     *
     * @param options - service options, shallow-merged over
     *        {@link DEFAULT_IMQ_SERVICE_OPTIONS}, except `metricsServer` which is
     *        merged separately over
     *        {@link DEFAULT_IMQ_METRICS_SERVER_OPTIONS}
     * @param name - overrides the class name as the service/queue name, and as the
     *        description cache key
     * @throws TypeError when {@link IMQService} is instantiated directly. Note the
     *         check is by resolved name, so passing `'IMQService'` as the `name` of a
     *         subclass throws as well.
     *
     * @remarks
     * Constructing a service installs process signal handlers for `SIGTERM`,
     * `SIGINT`, `SIGHUP` and `SIGQUIT`. On any of them the service tears the queue
     * down, closes the metrics server, and then force-exits with code 0 after
     * `IMQ_SHUTDOWN_TIMEOUT` — a fixed timer, not a drain: requests still being
     * processed are not awaited.
     *
     * The merged options are passed straight to the queue factory, so `vendor` and
     * `cluster`/`clusterManagers` select the transport implementation.
     */
    constructor(options?: Partial<IMQServiceOptions>, name?: string) {
        this.name = name || this.constructor.name;

        if (this.name === 'IMQService') {
            throw new TypeError(
                'IMQService class is abstract and cannot ' +
                    'be instantiated directly!',
            );
        }

        this.options = {
            ...DEFAULT_IMQ_SERVICE_OPTIONS,
            ...options,
            metricsServer: {
                ...DEFAULT_IMQ_METRICS_SERVER_OPTIONS,
                ...options?.metricsServer,
            },
        };
        this.logger = this.options.logger || /* istanbul ignore next */ console;
        this.imq = IMQ.create(this.name, this.options);

        this.handleRequest = this.handleRequest.bind(this);

        SIGNALS.forEach((signal: string) => {
            const handler = (): void => {
                this.destroy().catch(this.logger.error);

                if (this.metricsServer) {
                    this.metricsServer.close();
                }

                setTimeout(() => process.exit(0), IMQ_SHUTDOWN_TIMEOUT);
            };

            // tracked so destroy() can unregister them (see below)
            this.signalHandlers.push([signal, handler]);
            process.on(signal, handler);
        });

        // guard the async handler: a failure while processing or publishing
        // the response (e.g. the broker went away mid-reply) must be logged,
        // not surface as an unhandled rejection and crash the process
        this.imq.on(
            'message',
            ((request: IMQRPCRequest, id: string): Promise<string | void> =>
                this.handleRequest(request, id).catch(err =>
                    this.logger.error(
                        `${this.name}: error handling request:`,
                        err,
                    ),
                )) as any,
        );
    }

    /**
     * Handles incoming request and produces corresponding response
     *
     * @param request - request message
     * @param id - message unique identifier
     */
    private async handleRequest(
        request: IMQRPCRequest,
        id: string,
    ): Promise<string> {
        return runWithRequest(request, () => this.processRequest(request, id));
    }

    private async processRequest(
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
            } catch (err: any) {
                logger.warn(BEFORE_HOOK_ERROR, err);
            }
        }

        if (!this[method]) {
            response.error = IMQError(
                'IMQ_RPC_NO_METHOD',
                `Method ${this.name}.${method}() does not exist.`,
                new Error().stack,
                method,
                args,
            );
        } else if (!description.service.methods[method]) {
            // Allow calling runtime-attached methods (own props) even if
            // they are not present in the exposed service description.
            // Deny access for prototype (class) methods not decorated with @expose.
            const isOwn = Object.prototype.hasOwnProperty.call(this, method);
            const value: any = (this as any)[method];
            const proto = Object.getPrototypeOf(this);
            const protoValue = proto && proto[method];
            const isSameAsProto =
                typeof protoValue === 'function' && value === protoValue;
            // Allow only truly dynamic own-instance functions (not the same as prototype)
            if (!(isOwn && typeof value === 'function' && !isSameAsProto)) {
                response.error = IMQError(
                    'IMQ_RPC_NO_ACCESS',
                    `Access to ${this.name}.${method}() denied!`,
                    new Error().stack,
                    method,
                    args,
                );
            }
        } else if (
            !isValidArgsCount(
                description.service.methods[method].arguments,
                args,
            )
        ) {
            response.error = IMQError(
                'IMQ_RPC_INVALID_ARGS_COUNT',
                `Invalid args count for ${this.name}.${method}().`,
                new Error().stack,
                method,
                args,
            );
        }

        if (response.error) {
            this.logger.warn(response.error);

            return await send(request, response, this);
        }

        try {
            // Run the method through the optional `wrapCall` around-hook so a
            // hook can execute it within its own scope (e.g. an OpenTelemetry
            // context). Without a hook the method is invoked directly, exactly
            // as before.
            const invoke = async (): Promise<any> => {
                const result = this[method].apply(this, args);

                return result && result.then ? await result : result;
            };

            const wrapCall = this.options.wrapCall as
                | IMQWrapCall<IMQService>
                | undefined;

            response.data =
                typeof wrapCall === 'function'
                    ? await wrapCall.call(this, request, response, invoke)
                    : await invoke();
        } catch (err: any) {
            response.error = IMQError(
                err.code || 'IMQ_RPC_CALL_ERROR',
                err.message,
                err.stack,
                method,
                args,
                err,
            );
        }

        return await send(request, response, this);
    }

    /**
     * Initializes this instance of service and starts handling request
     * messages.
     *
     * @returns the started message queue instance
     *
     * @remarks
     * In single-process mode this starts the queue in the current process. With
     * {@link IMQServiceOptions.multiProcess} the cluster primary forks
     * `cpus().length * childrenPerCore` workers, each receiving its index in the
     * `workerId` environment variable, and installs an exit watcher that terminates
     * the process with code 1 as soon as one worker dies — workers are never
     * respawned, so supervision is left to the process manager.
     *
     * Note that the primary also starts its own queue consumer and metrics listener
     * after forking, so a service configured for N workers runs N+1 consumers and
     * N+1 processes attempt to bind the metrics port.
     */
    @profile()
    public async start(): Promise<IMessageQueue | undefined> {
        if (!this.options.multiProcess) {
            this.logger.info(
                '%s: starting single-worker, pid %s',
                this.name,
                process.pid,
            );

            this.describe();

            return this.startWithMetricsServer();
        }

        if (cluster.isMaster) {
            const numCpus = cpus().length;
            const numWorkers = numCpus * this.options.childrenPerCore;

            for (let i = 0; i < numWorkers; i++) {
                this.logger.info('%s: starting worker #%s ...', this.name, i);
                cluster.fork({ workerId: i });
            }

            cluster.on('exit', (worker: Worker) => {
                /* node:coverage disable */
                // exercised by tests, but V8 will not record coverage for an
                // inline listener body that terminates via process.exit()
                this.logger.info(
                    '%s: worker pid %s died, exiting',
                    this.name,
                    worker.process.pid,
                );
                process.exit(1);
                /* node:coverage enable */
            });
        } else {
            this.logger.info(
                '%s: worker #%s started, pid %s',
                this.name,
                process.env['workerId'],
                process.pid,
            );

            this.describe();

            return this.startWithMetricsServer();
        }

        return this.startWithMetricsServer();
    }

    /**
     * Broadcasts data on this service's pub/sub channel, delivering it to every
     * client currently subscribed to this service.
     *
     * @param data - JSON-serializable payload to broadcast
     * @throws TypeError when the service has not been started, so the queue's writer
     *         is not connected
     *
     * @remarks
     * Fire-and-forget: plain pub/sub with no persistence, ordering guarantee or
     * delivery confirmation, so subscribers that are offline lose the message.
     */
    public async publish(data: JsonObject) {
        await this.imq.publish(data);
    }

    /**
     * Stops consuming messages from the queue.
     *
     * @remarks
     * Connections, signal handlers and the metrics server are all left in place —
     * use {@link IMQService.destroy} for full teardown. Calling this first is not a
     * prerequisite for `destroy()`.
     */
    @profile()
    public async stop(): Promise<void> {
        await this.imq.stop();
    }

    /**
     * Removes this instance's signal handlers, then unsubscribes and destroys the
     * underlying queue.
     *
     * @remarks
     * It does not close the metrics server — if
     * {@link IMQMetricsServerOptions.enabled} was set, close
     * `service.metricsServer` yourself, otherwise the open listener keeps the
     * process alive. In-flight requests are not awaited.
     */
    @profile()
    public async destroy(): Promise<void> {
        // unregister this instance's process signal handlers so destroyed
        // services do not leak process-level listeners
        for (const [signal, handler] of this.signalHandlers) {
            process.removeListener(signal, handler);
        }
        this.signalHandlers.length = 0;

        await this.imq.unsubscribe();
        await this.imq.destroy();
    }

    /**
     * Returns this service's description metadata — the exposed method list plus the
     * registered complex types — synchronously.
     *
     * @returns a plain object matching the {@link Description} shape, not a class
     *          instance
     *
     * @remarks
     * This method is itself exposed, so a remote caller invoking it through a
     * generated client receives a `Promise<Description>` — but called locally it is
     * not a promise and must not be awaited as one.
     *
     * The result is built once per service name and cached process-wide for the
     * lifetime of the process, so methods attached after the first call are not
     * reflected. The cache key is the service `name` while the method list is
     * resolved from the concrete class name, so constructing two differently-classed
     * services under the same `name` in one process makes them share a single
     * description.
     */
    @expose()
    public describe(): Description {
        let description = serviceDescriptions.get(this.name) || null;

        if (!description) {
            description = {
                service: {
                    name: this.name,
                    methods: getClassMethods(this.constructor),
                },
                types: IMQRPCDescription.typesDescription,
            };

            serviceDescriptions.set(this.name, description);
        }

        return description;
    }

    private async startWithMetricsServer(): Promise<IMessageQueue | undefined> {
        const service = this.imq.start();
        const metricServerOptions = this.options.metricsServer;

        if (!(metricServerOptions && metricServerOptions.enabled)) {
            return service;
        }

        this.logger.log('Starting metrics server...');

        this.metricsServer = createServer(async (req, res) => {
            if (req.url === '/metrics') {
                const length = await this.imq.queueLength();
                const content =
                    metricServerOptions.queueLengthFormatter?.(
                        length,
                        'queue_length',
                    ) || String(length);

                res.setHeader('Content-Type', 'plain/text');
                res.setHeader('Content-Length', Buffer.byteLength(content));
                res.writeHead(200);
                res.end(content);

                return;
            }

            res.writeHead(404);
            res.end();
        });
        this.metricsServer.listen(metricServerOptions.port, '0.0.0.0', () => {
            this.logger.info(
                '%s: metrics server started on port %s',
                this.name,
                metricServerOptions.port,
            );
        });

        return service;
    }
}

/**
 * Sends IMQ response with support of after call optional hook
 *
 * @param request - from message identifier
 * @param response - response to send
 * @param service - imq service to bind
 * @returns send result message identifier
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
        } catch (err: any) {
            logger.warn(AFTER_HOOK_ERROR, err);
        }
    }

    return id;
}
