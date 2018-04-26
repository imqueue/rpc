/*!
 * IMQClient implementation
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
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
    IMQOptions,
    ILogger
} from 'imq';
import {
    pid,
    forgetPid,
    osUuid,
    DEFAULT_IMQ_CLIENT_OPTIONS,
    ServiceDescription,
    IMQServiceOptions,
    IMQClientOptions,
    IMQRPCResponse,
    IMQRPCRequest,
    IMQDelay,
    remote,
    Description
} from '.';
import * as fs from 'fs';
import * as ts from 'typescript';
import { EventEmitter } from 'events';

const tsOptions = require('../tsconfig.json').compilerOptions;
const SIGNALS: string[] = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGBREAK'];

/**
 * Class IMQClient - base abstract class for service clients.
 */
export abstract class IMQClient extends EventEmitter {

    public options: IMQClientOptions;
    public id: number;
    private baseName: string;
    private imq: IMessageQueue;
    private name: string;
    private serviceName: string;
    private logger: ILogger;
    private resolvers: { [id: string]: [Function, Function] } = {};

    /**
     * Class constructor
     *
     * @constructor
     * @param {Partial<IMQOptions>} options
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
            throw new TypeError('IMQClient class is abstract and can not' +
                'be instantiated directly!');
        }

        this.options = Object.assign({},
            DEFAULT_IMQ_CLIENT_OPTIONS,
            options || {}
        );

        this.id = pid(baseName);
        this.logger = this.options.logger || console;
        this.name = `${baseName}-${osUuid()}-${this.id}`;
        this.serviceName = serviceName || baseName.replace(/Client$/, '');
        this.imq = IMQ.create(this.name, this.options);

        this.imq.on('message', (message: IMQRPCResponse) => {
            process.nextTick(() => {
                if (!this.resolvers[message.to]) {
                    // when there is no resolvers it means
                    // we have massage in queue which was initiated
                    // by some process which is broken. So we provide an
                    // ability to handle enqueued messages via EventEmitter
                    // interface
                    this.emit(message.request.method, message);
                }

                const [ resolve, reject ] = this.resolvers[message.to] || [
                    undefined,
                    undefined
                ];

                if (message.error) {
                    return reject && reject(message.error);
                }

                resolve && resolve(message.data);
            });
        });

        const terminate = async () => {
            await this.destroy();
            process.nextTick(() => process.exit(0));
        };

        SIGNALS.forEach((signal: any) => process.on(signal, terminate));
        process.on('exit', terminate);
    }

    /**
     * Sends call to remote service method
     *
     * @access protected
     * @param {...any[]} args
     * @returns {Promise<T>}
     */
    protected async remoteCall<T>(...args: any[]): Promise<T> {
        const method = args.pop();
        const from = this.name;
        const to = this.serviceName;
        let delay: number = 0;

        if (args[args.length - 1] instanceof IMQDelay) {
            delay = args.pop().ms;

            if (!isFinite(delay) || isNaN(delay) || delay < 0) {
                delay = 0;
            }
        }

        return new Promise<T>(async (resolve, reject) => {
            try {
                const message: IMQRPCRequest = { from, method, args};
                const id = await this.imq.send(to, message, delay, reject);

                this.resolvers[id] = [resolve, reject];
            }

            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Initializes client work
     *
     * @returns {Promise<void>}
     */
    public async start() {
        await this.imq.start();
    }

    /**
     * Stops client work
     *
     * @returns {Promise<void>}
     */
    public async stop() {
        await this.imq.stop();
    }

    /**
     * Destroys client
     *
     * @returns {Promise<void>}
     */
    public async destroy() {
        forgetPid(this.baseName, this.id, this.logger);

        for (let event of this.eventNames()) {
            this.removeAllListeners(event);
        }

        await this.imq.destroy();
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
        const clientOptions: IMQClientOptions = Object.assign({},
            DEFAULT_IMQ_CLIENT_OPTIONS,
            options
        );

        return await generator(name, clientOptions);
    }

}

/**
 * Class GeneratorClient - generator helper class implementation
 * @access private
 */
class GeneratorClient extends IMQClient {
    @remote()
    public async describe() {
        return await this.remoteCall<ServiceDescription>(...arguments);
    }
}

async function getDescription(
    name: string,
    options: IMQClientOptions
): Promise<Description> {
    return new Promise<Description>(async (resolve, reject) => {
        const client: any = new GeneratorClient(options, name, `${name}Client`);
        const timeout = setTimeout(async () => {
            await client.destroy();
            timeout && clearTimeout(timeout);
            resolve = () => {};
            reject(new EvalError('Generate client error: service remote ' +
                `call timed-out! Is service "${name}" running?`));
        }, options.timeout);

        const description = await client.describe();
        timeout && clearTimeout(timeout);
        await client.destroy();

        resolve(description);
    });

}

/**
 * Client generator helper function
 *
 * @access private
 * @param {string} name
 * @param {IMQClientOptions} options
 * @return {Promise<string>}
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
 * IMQ-RPC Service: ${description.service.name}
 *
 * Copyright (c) ${new Date().getFullYear()}, imqueue.com
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
import { IMQClient, Description, remote, profile } from 'imq-rpc';

export namespace ${namespaceName} {\n`;

    for (let typeName of Object.keys(description.types)) {
        src += `    export interface ${typeName} {\n`;

        for (let propertyName in description.types[typeName]) {
            const { type, isOptional } =
                description.types[typeName][propertyName];

            src += ' '.repeat(8);
            src += `${propertyName}${isOptional ? '?' : ''}: ${type};\n`;
        }

        src += '    }\n\n';
    }

    src += `    export class ${clientName} extends IMQClient {\n\n`;

    const methods = description.service.methods;

    for (let methodName of Object.keys(methods)) {
        let args = methods[methodName].arguments;
        let description = methods[methodName].description;
        let ret = methods[methodName].returns;
        let retType = ret.tsType
            .replace(/\r?\n/g, ' ')
            .replace(/\s{2,}/g, ' ');

        if (retType === 'Promise') {
            retType = 'any';
        }

        src += '        /**\n';
        src += description ?description.split(/\r?\n/)
            .map(line => `         * ${line}`)
            .join('\n') + '\n         *\n' : '';

        for (let i = 0, s = args.length; i < s; i++) {
            let arg = args[i];
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
            let arg = args[i];
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

    const module = compile(name, src, options);

    return module ? module[namespaceName] : null;
}

/**
 * Return promised typedef of a given type if its missing
 *
 * @param {string} typedef
 * @returns {string}
 */
function promisedType(typedef: string) {
    if (!/^Promise</.test(typedef)) {
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
function cleanType(typedef: string) {
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

    return typedef.split(/\r?\n/)
        .map((line, linenum) =>
            (linenum ? '         * ' : '') + line
        )
        .join('\n');
}

/**
 * Compiles client source code and returns loaded module
 *
 * @param {string} name
 * @param {string} src
 * @param {IMQClientOptions} options
 * @returns {any}
 */
function compile(name: string, src: string, options: IMQClientOptions) {
    const path = options.path || './clients';
    const srcFile = `${path}/${name}.ts`;
    const jsFile = `${path}/${name}.js`;

    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }

    fs.writeFileSync(srcFile, src, { encoding: 'utf8' });

    if (options.compile) {
        fs.writeFileSync(jsFile,
            ts.transpile(src, tsOptions), { encoding: 'utf8' });

        return require(fs.realpathSync(jsFile));
    }

    return null;
}
