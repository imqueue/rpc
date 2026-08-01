/*!
 * IMQClient implementation
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
    type IMessageQueue,
    type ILogger,
    type JsonObject,
    type AnyJson,
    IMQ_SHUTDOWN_TIMEOUT,
} from '@imqueue/core';
import {
    DEFAULT_IMQ_CLIENT_OPTIONS,
    type IMQClientOptions,
    type IMQRPCResponse,
    type IMQRPCRequest,
    IMQDelay,
    IMQError,
    remote,
    Description,
    IMQMetadata,
    BEFORE_HOOK_ERROR,
    AFTER_HOOK_ERROR,
} from './index.js';
import {
    pid,
    forgetPid,
    osUuid,
    fileExists,
    mkdir,
    writeFile,
    SIGNALS,
} from './helpers/index.js';
import { EventEmitter } from 'node:events';
import { Script } from 'node:vm';
import { spawnSync } from 'node:child_process';
import {
    mkdtempSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { type IMQBeforeCall, type IMQAfterCall } from './IMQRPCOptions.js';

// CommonJS require scoped to this module: resolves the typescript package
// and loads generated CommonJS client modules from the ESM host
const cjsRequire = createRequire(import.meta.url);

// Read as a file (not a static import) so that consumers which type-check
// this source through a file: link do not need `resolveJsonModule` enabled.
const tsOptions = JSON.parse(
    readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'),
).compilerOptions as Record<string, unknown>;
const RX_SEMICOLON: RegExp = /;+$/g;

/**
 * Base class for service clients.
 *
 * Subclass it and declare every remote method as
 * `@remote() async m(...args) \{ return await this.remoteCall<T>(...arguments); \}`,
 * or let {@link IMQClient.create} generate the subclass from a running service's
 * description.
 *
 * @remarks
 * Abstractness is enforced at runtime as well as by the type system: constructing
 * `IMQClient` directly throws a `TypeError`.
 *
 * Instances are `EventEmitter`s. Besides ordinary calls, any response that no
 * longer has a pending caller is emitted as an event named after the remote
 * method, carrying the raw {@link IMQRPCResponse} — the escape hatch for replies to
 * calls made by a process that has since died.
 *
 * The identity properties pair up as follows: {@link IMQClient.serviceName} is
 * where calls go, {@link IMQClient.queueName} is where answers come back,
 * {@link IMQClient.name} identifies this client, {@link IMQClient.hostName}
 * identifies the machine plus instance, and {@link IMQClient.id} is the per-host
 * instance slot.
 */
export abstract class IMQClient extends EventEmitter {
    /**
     * The effective options for this client: {@link DEFAULT_IMQ_CLIENT_OPTIONS}
     * merged with the values passed to the constructor.
     */
    public readonly options: IMQClientOptions;
    /**
     * Per-host instance slot number — not an OS process id.
     *
     * @remarks
     * Allocated by claiming the lowest free pid file under `$TMPDIR/.imq-rpc`; the
     * file itself contains the real `process.pid`. Ids released by
     * {@link IMQClient.destroy} are not re-issued within the same process.
     */
    public readonly id: number;
    /**
     * This client's unique identity, `"<baseName>-<hostName>"`.
     *
     * @remarks
     * Also used as the name of the dedicated subscription queue in `singleQueue`
     * mode.
     */
    public readonly name: string;
    /**
     * Machine-scoped identity, `"<osUuid>-<id>:client"`, where `osUuid` is a hash of
     * the OS machine id.
     *
     * @remarks
     * This is not a network hostname. The `:client` suffix is what makes the
     * default `cleanupFilter` of `'*:client'` match client queues. In `singleQueue`
     * mode it is inherited from the shared queue's name instead.
     */
    public readonly hostName: string;
    /**
     * The remote side: the queue every request is addressed to, and the pub/sub
     * channel {@link IMQClient.subscribe} listens on.
     *
     * @remarks
     * Defaults to this client's base name with a trailing `Client` removed, so
     * `UserClient` talks to the queue `User`.
     */
    public readonly serviceName: string;
    /**
     * The local side: the queue replies come back on, and the value placed in
     * `request.from`.
     *
     * @remarks
     * Equals {@link IMQClient.name}, or {@link IMQClient.hostName} when
     * `singleQueue` is enabled. Also the channel {@link IMQClient.broadcast}
     * publishes to.
     */
    public readonly queueName: string;

    private readonly baseName: string;
    private readonly imq: IMessageQueue;
    private readonly subscriptionImq: IMessageQueue;
    private static singleImq?: IMessageQueue & { name?: string };
    private static singleImqRefs: number = 0;
    private static maxListenersBumped: boolean = false;
    private destroyed: boolean = false;
    private readonly signalHandlers: Array<[string, (...args: any[]) => void]> =
        [];
    private readonly logger: ILogger;
    private resolvers: {
        [id: string]: [
            (data: AnyJson, res: IMQRPCResponse) => void,
            (err: any, res: IMQRPCResponse) => void,
        ];
    } = {};

    /**
     * Constructs a client.
     *
     * @param options - client options, merged over
     *        {@link DEFAULT_IMQ_CLIENT_OPTIONS}
     * @param serviceName - the queue calls are addressed to. Defaults to this
     *        client's own name with a trailing `Client` removed.
     * @param name - this client's base name. Defaults to the constructor's name, so
     *        pass it explicitly if your build renames classes — a minifier would
     *        otherwise silently retarget the RPC.
     * @throws TypeError when {@link IMQClient} is constructed directly rather than
     *         through a subclass
     *
     * @remarks
     * Construction has side effects. It reserves an instance id by creating a pid
     * file under `$TMPDIR/.imq-rpc`, opens its message queue (two in `singleQueue`
     * mode), raises the process max-listener limit once per process, and installs
     * `SIGTERM`/`SIGINT`/`SIGHUP`/`SIGQUIT` handlers that destroy the client and
     * then exit the process after `IMQ_SHUTDOWN_TIMEOUT`. Any library embedding
     * a client inherits that process-terminating behaviour.
     *
     * Only {@link IMQClient.destroy} releases the pid file and removes those
     * handlers.
     */
    public constructor(
        options?: Partial<IMQClientOptions>,
        serviceName?: string,
        name?: string,
    ) {
        super();

        const baseName: string = name || this.constructor.name;

        this.baseName = baseName;

        if (this.constructor.name === 'IMQClient') {
            throw new TypeError(
                'IMQClient class is abstract and cannot ' +
                    'be instantiated directly!',
            );
        }

        this.options = { ...DEFAULT_IMQ_CLIENT_OPTIONS, ...options };
        this.id = pid(baseName);
        this.logger = this.options.logger || /* istanbul ignore next */ console;
        this.hostName =
            IMQClient.singleImq?.name || `${osUuid()}-${this.id}:client`;
        this.name = `${baseName}-${this.hostName}`;
        this.serviceName = serviceName || baseName.replace(/Client$/, '');
        this.queueName = this.options.singleQueue ? this.hostName : this.name;
        this.imq = this.createImq();
        this.subscriptionImq = this.createSubscriptionImq();

        // raise the process listener limit on first use (many clients may
        // coexist, each registering its own signal handlers)
        if (!IMQClient.maxListenersBumped) {
            IMQClient.maxListenersBumped = true;
            process.setMaxListeners(10000);
        }

        SIGNALS.forEach((signal: string) => {
            const handler = (): void => {
                this.destroy().catch(this.logger.error);
                setTimeout(() => process.exit(0), IMQ_SHUTDOWN_TIMEOUT);
            };

            // tracked so destroy() can unregister them (see below)
            this.signalHandlers.push([signal, handler]);
            process.on(signal, handler);
        });
    }

    private createImq(): IMessageQueue {
        if (!this.options.singleQueue) {
            return IMQ.create(this.queueName, this.options);
        }

        if (!IMQClient.singleImq) {
            IMQClient.singleImq = IMQ.create(this.queueName, this.options);
        }

        // the shared queue is reference-counted so that destroying one client
        // does not tear the transport down under the others
        IMQClient.singleImqRefs++;

        return IMQClient.singleImq;
    }

    private createSubscriptionImq(): IMessageQueue {
        if (!this.options.singleQueue) {
            return this.imq;
        }

        return IMQ.create(this.name, this.options);
    }

    /**
     * Sends a call to the remote service method.
     *
     * Intended to be invoked as `this.remoteCall<T>(...arguments)` from a method
     * decorated with {@link remote}, which appends the method name for you.
     *
     * @typeParam T - the type the remote method resolves to
     * @param args - the method's own arguments, followed by the remote method
     *        name as the last element. An optional trailing {@link IMQDelay}
     *        (delivery delay) and {@link IMQMetadata} (tracing metadata) are
     *        consumed by the framework and never reach the service; on a delayed
     *        call, trailing `undefined` placeholders are dropped so service-side
     *        defaults still apply.
     * @returns the service's response payload, cast to `T`
     *
     * @remarks
     * {@link IMQClient.start} must have completed first. Otherwise the request is
     * sent but no reply router is installed, so the returned promise never
     * settles.
     *
     * Rejections are plain {@link IMQRPCError} objects, not `Error`
     * instances — `err instanceof Error` is false, and `err.stack` describes the
     * remote process. The code is `IMQ_RPC_CALL_ERROR` for a service-side failure
     * and `IMQ_RPC_CALL_TIMEOUT` once {@link IMQClientOptions.callTimeout} elapses
     * (plus any requested delay). With `callTimeout` unset — the default — a hung
     * service leaves the promise pending indefinitely.
     *
     * `beforeCall` and `afterCall` hook failures are logged as warnings and
     * otherwise ignored.
     */
    protected async remoteCall<T>(...args: any[]): Promise<T> {
        const logger = this.options.logger || console;
        const method = args.pop();
        const from = this.queueName;
        const to = this.serviceName;
        let delay: number = 0;
        let delayed = false;
        let metadata: IMQMetadata | undefined;

        if (args[args.length - 1] instanceof IMQDelay) {
            delay = args.pop().ms;
            delayed = true;

            if (!isFinite(delay) || isNaN(delay) || delay < 0) {
                delay = 0;
            }
        }

        if (args[args.length - 1] instanceof IMQMetadata) {
            metadata = args.pop();
        }

        // On a delayed call a trailing `undefined` is a placeholder, never a
        // value: it is either the skipped metadata slot or a skipped optional
        // argument, both of which the caller has to spell out to reach the delay
        // in the last position. Delivering it would serialize to `null`, defeat
        // a declared default and, for a method whose params are all required,
        // fail the service-side args count check. Both framework slots are gone
        // by now, so this runs the same whether or not metadata was passed.
        if (delayed) {
            while (args.length && args[args.length - 1] === undefined) {
                args.pop();
            }
        }

        const request: IMQRPCRequest = {
            from,
            method,
            args,
            ...(metadata ? { metadata } : {}),
        } as IMQRPCRequest;

        if (typeof this.options.beforeCall === 'function') {
            const beforeCall: IMQBeforeCall<IMQClient> = (
                this.options.beforeCall as IMQBeforeCall<IMQClient>
            ).bind(this);

            try {
                await beforeCall(request);
            } catch (err) {
                logger.warn(BEFORE_HOOK_ERROR, err);
            }
        }

        const callTimeout = this.options.callTimeout;

        return new Promise<T>((resolve, reject) => {
            let timer: NodeJS.Timeout | null = null;
            const clearTimer = (): void => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };
            const doResolve = (data: T): void => {
                clearTimer();
                resolve(data);
            };
            const doReject = (err: any): void => {
                clearTimer();
                reject(err);
            };

            void (async () => {
                try {
                    const id = await this.imq.send(
                        to,
                        request,
                        delay,
                        doReject,
                    );

                    this.resolvers[id] = [
                        imqCallResolver(doResolve, request, this),
                        imqCallRejector(doReject, request, this),
                    ];

                    if (callTimeout && callTimeout > 0) {
                        // reject and release the pending resolver if no
                        // response arrives in time; a requested delivery delay
                        // extends the budget accordingly
                        timer = setTimeout(() => {
                            delete this.resolvers[id];
                            doReject(
                                IMQError(
                                    'IMQ_RPC_CALL_TIMEOUT',
                                    `Call to ${to}.${method}() timed out after ${
                                        callTimeout
                                    } ms.`,
                                    new Error().stack,
                                    method,
                                    args,
                                ),
                            );
                        }, callTimeout + delay);
                        timer.unref?.();
                    }
                } catch (err) {
                    imqCallRejector(doReject, request, this)(err);
                }
            })();
        }) as Promise<T>;
    }

    /**
     * Subscribes to the service's event channel, named after
     * {@link IMQClient.serviceName} — the same channel a service's `publish()`
     * writes to, so every client of that service receives every published payload.
     *
     * @param handler - invoked with the parsed JSON payload of each published
     *        message
     *
     * @remarks
     * This is fan-out, not a private channel. Subscribing uses a dedicated
     * connection and does not require {@link IMQClient.start}. Calling it more
     * than once registers additional handlers rather than replacing the existing
     * one, and the subscription is re-established automatically on reconnect.
     */
    public async subscribe(handler: (data: JsonObject) => any): Promise<void> {
        return this.subscriptionImq.subscribe(this.serviceName, handler);
    }

    /**
     * Stops receiving service events: unsubscribes the channel, discards every
     * handler registered through {@link IMQClient.subscribe}, and closes the
     * dedicated subscription connection.
     *
     * @remarks
     * Safe when not subscribed, and it does not affect remote calls.
     * {@link IMQClient.destroy} performs it automatically; afterwards
     * {@link IMQClient.subscribe} can be used again with a fresh connection.
     */
    public async unsubscribe(): Promise<void> {
        return this.subscriptionImq.unsubscribe();
    }

    /**
     * Publishes the given payload on this client's own queue channel
     * ({@link IMQClient.queueName}).
     *
     * @param payload - data to publish
     * @throws TypeError when the client's queue has no writer connection, i.e. when
     *         called before {@link IMQClient.start}
     *
     * @remarks
     * Note that {@link IMQClient.subscribe} listens on the service channel, so a
     * broadcast is not received by other clients of the same service through the
     * standard client API — a consumer must subscribe to this client's `queueName`
     * channel explicitly.
     */
    public async broadcast(payload: JsonObject): Promise<void> {
        return this.imq.publish(payload, this.queueName);
    }

    /**
     * Initializes client work
     */
    public async start(): Promise<void> {
        this.imq.on('message', (message: any) => {
            // the following condition below is hard to test with the
            // current redis mock, BTW it was tested manually on real
            // redis run
            if (!this.resolvers[message.to]) {
                // when there is no resolvers it means
                // we have message in queue which was initiated
                // by some process which is broken. So we provide an
                // ability to handle enqueued messages via EventEmitter
                // interface
                this.emit(message.request.method, message);
            }

            const [resolve, reject] = this.resolvers[message.to] || [];

            // make sure no memory leaking
            delete this.resolvers[message.to];

            if (message.error) {
                return reject && reject(message.error, message);
            }

            resolve && resolve(message.data, message);
        });

        if (this.imq) {
            await this.imq.start();
        }
    }

    /**
     * Stops client work
     */
    public async stop(): Promise<void> {
        await this.imq.stop();
    }

    /**
     * Destroys client
     */
    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        // unregister this instance's process signal handlers so destroyed
        // clients do not leak process-level listeners
        for (const [signal, handler] of this.signalHandlers) {
            process.removeListener(signal, handler);
        }
        this.signalHandlers.length = 0;

        await this.subscriptionImq.unsubscribe();
        forgetPid(this.baseName, this.id, this.logger);
        this.removeAllListeners();

        // in singleQueue mode the subscription queue is a separate,
        // per-client instance and must be torn down with the client
        if (this.subscriptionImq !== this.imq) {
            await this.subscriptionImq.destroy();
        }

        if (!this.options.singleQueue) {
            await this.imq.destroy();

            return;
        }

        // shared queue: only the last client tears it down
        if (--IMQClient.singleImqRefs <= 0) {
            IMQClient.singleImqRefs = 0;

            const singleImq = IMQClient.singleImq;

            IMQClient.singleImq = undefined;

            await singleImq?.destroy();
        }
    }

    /**
     * Returns service description metadata.
     *
     * @param _delay - optional delivery delay; forwarded to the
     *  service through `arguments` by the `@remote` decorator
     */
    @remote()
    public async describe(_delay?: IMQDelay): Promise<Description> {
        return await this.remoteCall<Description>(...arguments);
    }

    /**
     * Generates a client for the service registered under the given queue name and
     * resolves to the generated namespace object — not to a client instance, and
     * not to an {@link IMQClient}.
     *
     * @param name - name of the queue the target service listens on (its service
     *        name, which is the class name by default). Also used as the base name
     *        of the generated files.
     * @param options - client options, merged over
     *        {@link DEFAULT_IMQ_CLIENT_OPTIONS}
     * @returns the generated namespace object, exposing the generated client class
     *          (`<Service>Client`, with a trailing `Service` replaced by `Client`)
     *          plus one interface per registered service type. It is produced at
     *          runtime, so it is typed `any` — cast it or type the call site
     *          yourself. Resolves to `null` instead when
     *          {@link IMQClientOptions.compile} is false.
     * @throws EvalError when the target service does not answer within
     *         {@link IMQClientOptions.timeout} milliseconds
     *
     * @example
     * ```typescript
     * const ns = await IMQClient.create('UserService');
     * const client = new ns.UserClient();
     *
     * await client.start();
     * ```
     *
     * @remarks
     * Generating a client requires the target service to be running: this sends
     * a live description request over the queue and fails if no answer arrives in
     * time.
     *
     * It always transpiles the generated source by spawning TypeScript
     * synchronously, so the call blocks the event loop, and it rejects if
     * transpilation emits nothing. When {@link IMQClientOptions.write} is set — the
     * default — it writes both `<path>/<name>.ts` and `<path>/<name>.js`, silently
     * overwriting any existing files, and creates `path` only one level deep.
     *
     * The identifiers inside the generated module come from the service's own
     * reported class name, so if that differs from `name` the file name and the
     * namespace/class names differ too.
     */
    public static async create(
        name: string,
        options?: Partial<IMQClientOptions>,
    ): Promise<any> {
        const clientOptions: IMQClientOptions = {
            ...DEFAULT_IMQ_CLIENT_OPTIONS,
            ...options,
        };

        return await generator(name, clientOptions);
    }
}

/**
 * Builds a call resolver that resolves the pending promise and then runs the
 * optional after-call hook.
 *
 * @param resolve - the underlying promise resolver
 * @param req - the originating request message
 * @param client - the client the call belongs to
 * @returns a hook-aware resolver
 */
export function imqCallResolver(
    resolve: (data: any) => void,
    req: IMQRPCRequest,
    client: IMQClient,
): (data: any, res: IMQRPCResponse) => void {
    return async (data: any, res: IMQRPCResponse) => {
        const logger = client.options.logger || console;

        resolve(data);

        if (typeof client.options.afterCall === 'function') {
            const afterCall: IMQAfterCall<IMQClient> = (
                client.options.afterCall as IMQAfterCall<IMQClient>
            ).bind(client);

            try {
                await afterCall(req, res as IMQRPCResponse);
            } catch (err) {
                logger.warn(AFTER_HOOK_ERROR, err);
            }
        }
    };
}

/**
 * Builds a call rejector that rejects the pending promise and then runs the
 * optional after-call hook.
 *
 * @param reject - the underlying promise rejector
 * @param req - the originating request message
 * @param client - the client the call belongs to
 * @returns a hook-aware rejector
 */
export function imqCallRejector(
    reject: (err: any) => void,
    req: IMQRPCRequest,
    client: IMQClient,
): (err: any, res?: IMQRPCResponse) => void {
    return async (err: any, res?: IMQRPCResponse) => {
        const logger = client.options.logger || console;

        reject(err);

        if (typeof client.options.afterCall === 'function') {
            const afterCall: IMQAfterCall<IMQClient> = (
                client.options.afterCall as IMQAfterCall<IMQClient>
            ).bind(client);

            try {
                await afterCall(req, res);
            } catch (err) {
                logger.warn(AFTER_HOOK_ERROR, err);
            }
        }
    };
}

/**
 * Class GeneratorClient - generator helper class implementation
 */
class GeneratorClient extends IMQClient {}

/**
 * Fetches and returns service description using the timeout (to handle
 * situations when the service is not started)
 *
 * @param name -
 * @param options -
 */
async function getDescription(
    name: string,
    options: IMQClientOptions,
): Promise<Description> {
    return new Promise<Description>((resolve, reject) => {
        void (async () => {
            const client: any = new GeneratorClient(
                options,
                name,
                `${name}Client`,
            );
            await client.start();
            const timeout = setTimeout(async () => {
                await client.destroy();
                timeout && clearTimeout(timeout);
                reject(
                    new EvalError(
                        'Generate client error: service remote ' +
                            `call timed-out! Is service "${name}" running?`,
                    ),
                );
            }, options.timeout);
            const description = await client.describe();
            timeout && clearTimeout(timeout);
            await client.destroy();

            resolve(description);
        })();
    }) as Promise<Description>;
}

/**
 * Client generator helper function
 *
 * @param name -
 * @param options -
 */
async function generator(
    name: string,
    options: IMQClientOptions,
): Promise<any> {
    const description: Description = await getDescription(name, options);

    const serviceName = description.service.name;
    const clientName = serviceName.replace(/Service$|$/, 'Client');
    const namespaceName =
        serviceName.charAt(0).toLowerCase() + serviceName.substr(1);

    let src = `/*!
 * IMQ-RPC Service Client: ${description.service.name}
 *
 * I'm Queue Software Project
 * Copyright (C) ${new Date().getFullYear()}  imqueue.com <support@imqueue.com>
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
import {
    IMQClient,
    IMQDelay,
    IMQMetadata,
    remote,
    profile,
} from '@imqueue/rpc';

export namespace ${namespaceName} {\n`;

    for (let typeName of Object.keys(description.types)) {
        src += `    export interface ${typeName} ${
            description.types[typeName].inherits &&
            description.types[description.types[typeName].inherits]
                ? `extends ${description.types[typeName].inherits}`
                : ''
        } {\n`;

        const indexType = description.types[typeName].indexType;

        if (indexType) {
            src += ' '.repeat(8);
            src += `${indexType.trim().replace(RX_SEMICOLON, '').trim()};\n`;
        }

        for (const propertyName of Object.keys(
            description.types[typeName].properties,
        )) {
            const { type, isOptional } =
                description.types[typeName].properties[propertyName];

            src += ' '.repeat(8);
            src += `${propertyName}${isOptional ? '?' : ''}: ${type};\n`;
        }

        src += '    }\n\n';
    }

    src += `    export class ${clientName} extends IMQClient {\n\n`;

    const methods = description.service.methods;

    for (const methodName of Object.keys(methods)) {
        if (methodName === 'describe') {
            continue; // do not create inherited method - no need
        }

        const args = methods[methodName].arguments;
        const description = methods[methodName].description;
        const ret = methods[methodName].returns;
        const addArgs = [
            {
                description:
                    'if passed, will deliver given metadata to ' +
                    'service, and will initiate trace handler calls',
                name: 'imqMetadata',
                type: 'IMQMetadata',
                tsType: 'IMQMetadata',
                isOptional: true,
            },
            {
                description:
                    'if passed the method will be called with ' +
                    'the specified delay over message queue',
                name: 'imqDelay',
                type: 'IMQDelay',
                tsType: 'IMQDelay',
                isOptional: true,
            },
        ];
        let retType = ret.tsType.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');

        // drop framework args the service declared itself, so that they are not
        // duplicated by the canonical pair appended below; the last element is
        // re-read on every pass, as the array shrinks as they are removed
        for (let i = 0; i < addArgs.length; i++) {
            const arg = args[args.length - 1];

            if (arg && ~['IMQDelay', 'IMQMetadata'].indexOf(arg.type)) {
                args.pop(); // remove it
            }
        }

        args.push(...addArgs); // make sure client expect them

        if (retType === 'Promise') {
            retType = 'Promise<any>';
        }

        src += '        /**\n';
        src += description
            ? description
                  .split(/\r?\n/)
                  .map(line => `         * ${line}`)
                  .join('\n') + '\n         *\n'
            : '';

        for (let i = 0, s = args.length; i < s; i++) {
            const arg = args[i];
            src += `         * @param {${toComment(arg.tsType)}} `;
            src += arg.isOptional ? `[${arg.name}]` : arg.name;
            src += arg.description ? ' - ' + arg.description : '';
            src += '\n';
        }

        src += `         * @return {${toComment(ret.tsType, true)}}\n`;
        src += '         */\n';
        src += '        @profile()\n';
        src += '        @remote()\n';
        src += `        public async ${methodName}(`;

        for (let i = 0, s = args.length; i < s; i++) {
            const arg = args[i];
            src +=
                arg.name +
                (arg.isOptional ? '?' : '') +
                ': ' +
                arg.tsType.replace(/\s{2,}/g, ' ') +
                (i === s - 1 ? '' : ', ');
        }

        src += `): ${promisedType(retType)} {\n`;
        src += ' '.repeat(12);
        src += `return await this.remoteCall<${cleanType(
            retType,
        )}>(...arguments);`;
        src += '\n        }\n\n';
    }

    src += '    }\n}\n';

    const module = await compile(name, src, options);

    return module ? module[namespaceName] : /* istanbul ignore next */ null;
}

/**
 * Return the promised typedef of a given type if its missing
 *
 * @param typedef -
 */
function promisedType(typedef: string): string {
    if (!typedef.startsWith('Promise<')) {
        typedef = `Promise<${typedef}>`;
    }

    return typedef;
}

/**
 * Removes Promise from type definition if any
 *
 * @param typedef -
 */
function cleanType(typedef: string): string {
    return typedef.replace(/^Promise<([\s\S]+?)>$/, '$1');
}

/**
 * Type to comment
 *
 * @param typedef -
 * @param promised -
 */
function toComment(typedef: string, promised: boolean = false): string {
    if (promised) {
        typedef = promisedType(typedef);
    }

    return typedef
        .split(/\r?\n/)
        .map((line, lineNum) => (lineNum ? '         * ' : '') + line)
        .join('\n');
}

/**
 * Transpiles generated client TypeScript source to CommonJS JavaScript.
 *
 * TypeScript 7 (native port) removed the in-process `transpile()`/`transpileModule()`
 * API; its `typescript/unstable/*` replacement is not a stable runtime contract.
 * Instead this shells out to the bundled `tsc` CLI in transform-only mode
 * (`noCheck`, `noEmitOnError:false`) — the same "emit regardless of type or
 * module-resolution errors" behaviour the old single-file transpile provided,
 * built on the stable CLI rather than the unstable programmatic API.
 *
 * @param src - generated client source
 * @returns emitted CommonJS JavaScript
 */
function transpileClient(src: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'imq-client-'));

    try {
        const tsFile = join(dir, '__client__.ts');
        const jsFile = join(dir, '__client__.js');
        const cfgFile = join(dir, 'tsconfig.json');

        writeFileSync(tsFile, src);
        writeFileSync(
            cfgFile,
            JSON.stringify({
                compilerOptions: {
                    ...tsOptions,
                    // transform-only: always emit, ignoring type and
                    // module-resolution errors (the generated client references
                    // `@imqueue/rpc` types that need not resolve in this temp
                    // dir)
                    noCheck: true,
                    noEmitOnError: false,
                    skipLibCheck: true,
                    declaration: false,
                    declarationMap: false,
                    sourceMap: false,
                    inlineSources: false,
                    types: [],
                    rootDir: dir,
                    outDir: dir,
                },
                files: ['__client__.ts'],
            }),
        );

        // resolve the compiler entry via the package root (its `exports` map
        // blocks `typescript/lib/*`, so build a raw path that Node runs
        // directly)
        const tscJs = join(
            dirname(cjsRequire.resolve('typescript/package.json')),
            'lib',
            'tsc.js',
        );
        const result = spawnSync(process.execPath, [tscJs, '-p', cfgFile], {
            encoding: 'utf8',
        });

        if (!existsSync(jsFile)) {
            throw new Error(
                'IMQClient: client transpilation produced no output' +
                    (result.stdout ? `\n${result.stdout}` : '') +
                    (result.stderr ? `\n${result.stderr}` : ''),
            );
        }

        return readFileSync(jsFile, 'utf8');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * Compiles client source code and returns loaded module
 *
 * @param name -
 * @param src -
 * @param options -
 */
async function compile(
    name: string,
    src: string,
    options: IMQClientOptions,
): Promise<any> {
    const path = options.path;
    const srcFile = `${path}/${name}.ts`;
    const jsFile = `${path}/${name}.js`;
    const js = transpileClient(src);

    if (options.write) {
        if (!(await fileExists(path))) {
            await mkdir(path);
        }

        await Promise.all([writeFile(srcFile, src), writeFile(jsFile, js)]);
    }

    if (options.compile) {
        const script = new Script(js);
        const context = { exports: {}, require: cjsRequire };

        script.runInNewContext(context, { filename: jsFile });

        return context.exports;
    }

    return null;
}
