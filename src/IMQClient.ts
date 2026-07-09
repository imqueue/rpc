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
 * Class IMQClient - base abstract class for service clients.
 */
export abstract class IMQClient extends EventEmitter {
    public readonly options: IMQClientOptions;
    public readonly id: number;
    public readonly name: string;
    public readonly hostName: string;
    public readonly serviceName: string;
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
     * Class constructor
     *
     * @param {Partial<IMQClientOptions>} options
     * @param {string} serviceName
     * @param {string} name
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
     * Sends call to remote service method
     *
     * @param {...any[]} args
     * @template T
     * @returns {Promise<T>}
     */
    protected async remoteCall<T>(...args: any[]): Promise<T> {
        const logger = this.options.logger || console;
        const method = args.pop();
        const from = this.queueName;
        const to = this.serviceName;
        let delay: number = 0;
        let metadata: IMQMetadata | undefined;

        if (args[args.length - 1] instanceof IMQDelay) {
            delay = args.pop().ms;

            if (!isFinite(delay) || isNaN(delay) || delay < 0) {
                delay = 0;
            }
        }

        if (args[args.length - 1] instanceof IMQMetadata) {
            metadata = args.pop();
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
     * Adds subscription to service event channel
     *
     * @param {(data: JsonObject) => any} handler
     * @return {Promise<void>}
     */
    public async subscribe(handler: (data: JsonObject) => any): Promise<void> {
        return this.subscriptionImq.subscribe(this.serviceName, handler);
    }

    /**
     * Destroys subscription channel to service
     *
     * @return {Promise<void>}
     */
    public async unsubscribe(): Promise<void> {
        return this.subscriptionImq.unsubscribe();
    }

    /**
     * Broadcasts given payload to all other service clients subscribed.
     * So this is like client-to-clients publishing.
     *
     * @param {JsonObject} payload
     * @return {Promise<void>}
     */
    public async broadcast(payload: JsonObject): Promise<void> {
        return this.imq.publish(payload, this.queueName);
    }

    /**
     * Initializes client work
     *
     * @returns {Promise<void>}
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
     *
     * @returns {Promise<void>}
     */
    public async stop(): Promise<void> {
        await this.imq.stop();
    }

    /**
     * Destroys client
     *
     * @returns {Promise<void>}
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
     * @param {IMQDelay} [_delay] - optional delivery delay; forwarded to the
     *  service through `arguments` by the `@remote` decorator
     * @returns {Promise<Description>}
     */
    @remote()
    public async describe(_delay?: IMQDelay): Promise<Description> {
        return await this.remoteCall<Description>(...arguments);
    }

    /**
     * Creates client for a service with the given name
     *
     * @param {string} name
     * @param {Partial<IMQServiceOptions>} options
     * @returns {IMQClient}
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
 * @param {(data: any) => void} resolve - the underlying promise resolver
 * @param {IMQRPCRequest} req - the originating request message
 * @param {IMQClient} client - the client the call belongs to
 * @return {(data: any, res: IMQRPCResponse) => void} - a hook-aware resolver
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
 * @param {(err: any) => void} reject - the underlying promise rejector
 * @param {IMQRPCRequest} req - the originating request message
 * @param {IMQClient} client - the client the call belongs to
 * @return {(err: any, res?: IMQRPCResponse) => void} - a hook-aware rejector
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
 * @param {string} name
 * @param {IMQClientOptions} options
 * @returns {Promise<Description>}
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
 * @param {string} name
 * @param {IMQClientOptions} options
 * @returns {Promise<string>}
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

        for (let i = 1; i <= 2; i++) {
            const arg = args[args.length - i];

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
 * @param {string} typedef
 * @returns {string}
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
 * @param {string} typedef
 * @returns {string}
 */
function cleanType(typedef: string): string {
    return typedef.replace(/^Promise<([\s\S]+?)>$/, '$1');
}

/**
 * Type to comment
 *
 * @param {string} typedef
 * @param {boolean} [promised]
 * @returns {string}
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
 * @param {string} src - generated client source
 * @returns {string} - emitted CommonJS JavaScript
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
 * @param {string} name
 * @param {string} src
 * @param {IMQClientOptions} options
 * @returns {any}
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
