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
import * as vm from 'vm';

process.setMaxListeners(10000);

const tsOptions = require('../tsconfig.json').compilerOptions;
const SIGNALS: string[] = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGBREAK'];

/**
 * Class IMQClient - base abstract class for service clients.
 */
export abstract class IMQClient extends EventEmitter {

    public readonly options: IMQClientOptions;
    public readonly id: number;
    private readonly baseName: string;
    private imq: IMessageQueue;
    public readonly name: string;
    private readonly serviceName: string;
    private readonly logger: ILogger;
    private resolvers: { [id: string]: [Function, Function] } = {};

    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
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
            throw new TypeError('IMQClient class is abstract and cannot ' +
                'be instantiated directly!');
        }

        this.options = Object.assign({},
            DEFAULT_IMQ_CLIENT_OPTIONS,
            options || /* istanbul ignore next */ {}
        );

        this.id = pid(baseName);
        this.logger = this.options.logger || /* istanbul ignore next */ console;
        this.name = `${baseName}-${osUuid()}-${this.id}`;
        this.serviceName = serviceName || baseName.replace(/Client$/, '');
        this.imq = IMQ.create(this.name, this.options);

        const terminate = async () => {
            await this.destroy();
            // istanbul ignore next
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

            // istanbul ignore if
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
                // istanbul ignore next
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
        this.imq.on('message', (message: IMQRPCResponse) => {
            process.nextTick(() => {
                // the following condition below is hard to test with the
                // current redis mock, BTW it was tested manually on real
                // redis run
                // istanbul ignore if
                if (!this.resolvers[message.to]) {
                    // when there is no resolvers it means
                    // we have massage in queue which was initiated
                    // by some process which is broken. So we provide an
                    // ability to handle enqueued messages via EventEmitter
                    // interface
                    this.emit(message.request.method, message);
                }

                const [ resolve, reject ] = this.resolvers[message.to] ||
                    // istanbul ignore next
                    [ undefined, undefined ];

                if (message.error) {
                    return reject && reject(message.error);
                }

                resolve && resolve(message.data);
            });
        });

        await this.imq.start();
    }

    // noinspection JSUnusedGlobalSymbols
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
    });

}

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
import { IMQClient, IMQDelay, Description, remote, profile } from 'imq-rpc';

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
        if (methodName === 'describe') {
            continue; // do not create inherited method - no need
        }

        let args = methods[methodName].arguments;
        let description = methods[methodName].description;
        let ret = methods[methodName].returns;
        let retType = ret.tsType
            .replace(/\r?\n/g, ' ')
            .replace(/\s{2,}/g, ' ');

        // make sure each method allows optional delay argument
        const lastArg = args[args.length - 1];

        if (lastArg && lastArg.type !== 'IMQDelay') {
            args.push({
                description: 'if passed the method will be called with ' +
                             'the specified delay over message queue',
                name: 'delay',
                type: 'IMQDelay',
                tsType: 'IMQDelay',
                isOptional: true
            });
        }

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

    const module = await compile(name, src, options);

    return module ? module[namespaceName] : /* istanbul ignore next */ null;
}

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
async function compile(name: string, src: string, options: IMQClientOptions): Promise<any> {
    const path = options.path;
    const srcFile = `${path}/${name}.ts`;
    const jsFile = `${path}/${name}.js`;

	const js = ts.transpile(src, tsOptions);
	if (options.write) {
		// istanbul ignore else
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path);
		}

		fs.writeFileSync(srcFile, src, { encoding: 'utf8' });
        fs.writeFileSync(jsFile, js, { encoding: 'utf8' });
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
