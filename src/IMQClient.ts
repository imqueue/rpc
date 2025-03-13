/*!
 * IMQClient implementation
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
    IMessageQueue,
    ILogger,
    JsonObject,
    AnyJson,
    IMQ_SHUTDOWN_TIMEOUT,
} from '@imqueue/core';
import {
    pid,
    forgetPid,
    osUuid,
    DEFAULT_IMQ_CLIENT_OPTIONS,
    IMQClientOptions,
    IMQRPCResponse,
    IMQRPCRequest,
    IMQDelay,
    remote,
    Description,
    fileExists,
    mkdir,
    writeFile,
    IMQMetadata,
    BEFORE_HOOK_ERROR,
    AFTER_HOOK_ERROR,
    SIGNALS,
} from '.';
import * as ts from 'typescript';
import { EventEmitter } from 'events';
import * as vm from 'vm';
import { CompilerOptions } from 'typescript';
import { IMQBeforeCall, IMQAfterCall } from './IMQRPCOptions';

process.setMaxListeners(10000);

const tsOptions = require('../tsconfig.json').compilerOptions;
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
    private imq: IMessageQueue;
    private static singleImq: IMessageQueue;
    private readonly logger: ILogger;
    private resolvers: { [id: string]: [
        (data: AnyJson, res: IMQRPCResponse) => void,
        (err: any, res: IMQRPCResponse) => void],
    } = {};

    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    /**
     * Class constructor
     *
     * @constructor
     * @param {Partial<IMQClientOptions>} options
     * @param {string} serviceName
     * @param {string} name
     */
    public constructor(
        options?: Partial<IMQClientOptions>,
        serviceName?: string,
        name?: string
    ) {
        super();

        const baseName: string = name || this.constructor.name;

        this.baseName = baseName;

        if (this.constructor.name === 'IMQClient') {
            throw new TypeError('IMQClient class is abstract and cannot ' +
                'be instantiated directly!');
        }

        this.options = { ...DEFAULT_IMQ_CLIENT_OPTIONS, ...options };
        this.id = pid(baseName);
        this.logger = this.options.logger || /* istanbul ignore next */ console;
        this.hostName = `${osUuid()}-${this.id}:client`;
        this.name = `${baseName}-${this.hostName}`;
        this.serviceName = serviceName || baseName.replace(/Client$/, '');
        this.queueName = this.options.singleQueue ? this.hostName : this.name;
        this.imq = this.createImq();

        SIGNALS.forEach((signal: any) => process.on(signal, async () => {
            this.destroy().catch(this.logger.error);
            // istanbul ignore next
            setTimeout(() => process.exit(0), IMQ_SHUTDOWN_TIMEOUT);
        }));
    }

    private createImq(): IMessageQueue {
        if (!this.options.singleQueue) {
            return IMQ.create(this.queueName, this.options);
        }

        if (!IMQClient.singleImq) {
            IMQClient.singleImq = IMQ.create(this.queueName, this.options);
        }

        return IMQClient.singleImq;
    }

    /**
     * Sends call to remote service method
     *
     * @access protected
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
            // noinspection TypeScriptUnresolvedVariable
            delay = args.pop().ms;

            // istanbul ignore if
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

        return new Promise<T>(async (resolve, reject) => {
            try {
                const id = await this.imq.send(to, request, delay, reject);

                this.resolvers[id] = [
                    imqCallResolver(resolve, request, this),
                    imqCallRejector(reject, request, this),
                ];
            }

            catch (err) {
                // istanbul ignore next
                imqCallRejector(reject, request, this)(err);
            }
        }) as Promise<T>;
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Adds subscription to service event channel
     *
     * @param {(data: JsonObject) => any} handler
     * @return {Promise<void>}
     */
    public async subscribe(handler: (data: JsonObject) => any): Promise<void> {
        return this.imq.subscribe(this.queueName, handler);
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * Destroys subscription channel to service
     *
     * @return {Promise<void>}
     */
    public async unsubscribe(): Promise<void> {
        return this.imq.unsubscribe();
    }

    // noinspection JSUnusedGlobalSymbols
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
        this.imq.on('message', (message: IMQRPCResponse) => {
            // the following condition below is hard to test with the
            // current redis mock, BTW it was tested manually on real
            // redis run
            // istanbul ignore if
            if (!this.resolvers[message.to]) {
                // when there is no resolvers it means
                // we have message in queue which was initiated
                // by some process which is broken. So we provide an
                // ability to handle enqueued messages via EventEmitter
                // interface
                this.emit(message.request.method, message);
            }

            const [ resolve, reject ] = this.resolvers[message.to] || [];

            // make sure no memory leaking
            delete this.resolvers[message.to];

            if (message.error) {
                return reject && reject(message.error, message);
            }

            resolve && resolve(message.data, message);
        });

        await this.imq.start();
    }

    // noinspection JSUnusedGlobalSymbols
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
        await this.imq.unsubscribe();
        forgetPid(this.baseName, this.id, this.logger);
        this.removeAllListeners();
        await this.imq.destroy();
    }

    /**
     * Returns service description metadata.
     *
     * @param {IMQDelay} delay
     * @returns {Promise<Description>}
     */
    @remote()
    public async describe(delay?: IMQDelay): Promise<Description> {
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
        options?: Partial<IMQClientOptions>
    ): Promise<any> {
        const clientOptions: IMQClientOptions = {
            ...DEFAULT_IMQ_CLIENT_OPTIONS,
            ...options,
        };

        return await generator(name, clientOptions);
    }

}

/**
 * Builds and returns call resolver, which supports after call optional hook
 *
 * @param {(...args: any[]) => void} resolve - source promise like resolver
 * @param {IMQRPCRequest} req  - request message
 * @param {IMQClient} client - imq client
 * @return {(data: any, res: IMQRPCResponse) => void} - hook-supported resolve
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
                await afterCall(req, res);
            } catch (err) {
                logger.warn(AFTER_HOOK_ERROR, err);
            }
        }
    }
}

/**
 * Builds and returns call rejector, which supports after call optional hook
 *
 * @param {(err: any) => void} reject - source promise like rejector
 * @param {IMQRPCRequest} req - call request
 * @param {IMQClient} client - imq client
 * @return {(err: any) => void} - hook-supported reject
 */
export function imqCallRejector(
    reject: (err: any) => void,
    req: IMQRPCRequest,
    client: IMQClient,
): (err: any, res?: IMQRPCResponse) => void {
    return async (err: any, res: IMQRPCResponse) => {
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
    }
}

/**
 * Class GeneratorClient - generator helper class implementation
 * @access private
 */
class GeneratorClient extends IMQClient {}

/**
 * Fetches and returns service description using the timeout (to handle
 * situations when the service is not started)
 *
 * @access private
 * @param {string} name
 * @param {IMQClientOptions} options
 * @returns {Promise<Description>}
 */
async function getDescription(
    name: string,
    options: IMQClientOptions
): Promise<Description> {
    return new Promise<Description>(async (resolve, reject) => {
        const client: any = new GeneratorClient(options, name, `${name}Client`);
        await client.start();
        const timeout = setTimeout(async () => {
            await client.destroy();
            timeout && clearTimeout(timeout);
            reject(new EvalError('Generate client error: service remote ' +
                `call timed-out! Is service "${name}" running?`));
        }, options.timeout);
        const description = await client.describe();
        timeout && clearTimeout(timeout);
        await client.destroy();

        resolve(description);
    }) as Promise<Description>;

}

// codebeat:disable[LOC,ABC]
/**
 * Client generator helper function
 *
 * @access private
 * @param {string} name
 * @param {IMQClientOptions} options
 * @returns {Promise<string>}
 */
async function generator(
    name: string,
    options: IMQClientOptions
): Promise<any> {
    const description: Description = await getDescription(name, options);

    const serviceName = description.service.name;
    const clientName = serviceName.replace(/Service$|$/, 'Client');
    const namespaceName = serviceName.charAt(0).toLowerCase() +
        serviceName.substr(1);

    let src = `/*!
 * IMQ-RPC Service Client: ${description.service.name}
 *
 * Copyright (c) ${new Date().getFullYear()}, imqueue.com <support@imqueue.com>
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
        const addArgs = [{
            description: 'if passed, will deliver given metadata to ' +
                'service, and will initiate trace handler calls',
            name: 'imqMetadata',
            type: 'IMQMetadata',
            tsType: 'IMQMetadata',
            isOptional: true,
        }, {
            description: 'if passed the method will be called with ' +
                'the specified delay over message queue',
            name: 'imqDelay',
            type: 'IMQDelay',
            tsType: 'IMQDelay',
            isOptional: true
        }];
        let retType = ret.tsType.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');

        for (let i = 1; i <= 2; i++) {
            const arg = args[args.length - i];

            if (arg && ~['IMQDelay', 'IMQMetadata'].indexOf(arg.type)) {
                args.pop(); // remove it
            }
        }

        args.push(...addArgs); // make sure client expect them

        // istanbul ignore if
        if (retType === 'Promise') {
            retType = 'Promise<any>';
        }

        src += '        /**\n';
        // istanbul ignore next
        src += description ? description.split(/\r?\n/)
            .map(line => `         * ${line}`)
            .join('\n') + '\n         *\n' : '';

        for (let i = 0, s = args.length; i < s; i++) {
            const arg = args[i];
            src += `         * @param {${
                toComment(arg.tsType)}} `;
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
            src += arg.name + (arg.isOptional ? '?' : '') +
                ': ' + arg.tsType.replace(/\s{2,}/g, ' ') +
                (i === s - 1 ? '': ', ');
        }

        src += `): ${promisedType(retType)} {\n`;
        src += ' '.repeat(12);
        src += `return await this.remoteCall<${
            cleanType(retType)}>(...arguments);`;
        src += '\n        }\n\n';
    }

    src += '    }\n}\n';

    const module = await compile(name, src, options);

    return module ? module[namespaceName] : /* istanbul ignore next */ null;
}
// codebeat:enable[LOC,ABC]

/**
 * Return promised typedef of a given type if its missing
 *
 *c @access private
 * @param {string} typedef
 * @returns {string}
 */
function promisedType(typedef: string) {
    // istanbul ignore next
    if (!/^Promise</.test(typedef)) {
        typedef = `Promise<${typedef}>`;
    }

    return typedef;
}

/**
 * Removes Promise from type definition if any
 *
 * @access private
 * @param {string} typedef
 * @returns {string}
 */
function cleanType(typedef: string) {
    return typedef.replace(/^Promise<([\s\S]+?)>$/, '$1');
}

/**
 * Type to comment
 *
 * @access private
 * @param {string} typedef
 * @param {boolean} [promised]
 * @returns {string}
 */
function toComment(typedef: string, promised: boolean = false): string {
    if (promised) {
        typedef = promisedType(typedef);
    }

    // istanbul ignore next
    return typedef.split(/\r?\n/)
        .map((line, lineNum) => (lineNum ? '         * ' : '') + line)
        .join('\n');
}

/**
 * Compiles client source code and returns loaded module
 *
 * @access private
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
    const js = ts.transpile(src, tsOptions as CompilerOptions | undefined);

    if (options.write) {
        // istanbul ignore else
        if (!await fileExists(path)) {
            await mkdir(path);
        }

        await Promise.all([
            writeFile(srcFile, src),
            writeFile(jsFile, js),
        ]);
    }

    // istanbul ignore else
    if (options.compile) {
		const script = new vm.Script(js);
        const context = { exports: {}, require };

        script.runInNewContext(context, { filename: jsFile });

		return context.exports;
    }

    // istanbul ignore next
    return null;
}

