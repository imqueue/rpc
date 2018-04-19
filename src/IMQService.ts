/*!
 * IMQService implementation
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
import IMQ, { ILogger, IMessageQueue, profile } from 'imq';
import {
    TypesDescription,
    ServiceDescription,
    IMQRPCDescription,
    IMQRPCError,
    IMQRPCRequest,
    IMQRPCResponse,
    IMQServiceOptions,
    expose,
    property,
    ICache,
    ServiceClassDescription,
    MethodsCollectionDescription
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

const DEFAULT_SERVICE_OPTIONS: Partial<IMQServiceOptions> = {
    multiProcess: false,
    childrenPerCore: 1
};

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
    return (argsInfo.some(argInfo => argInfo.isOptional)
        ? argsInfo.length >= args.length
        : argsInfo.length === args.length
    );
}

/**
 * Class IMQService
 * Basic abstract service (server-side) implementation.
 *
 * @example
 * ~~~typescript
 * import { IMQService, expose, profile, property } from 'imq-rpc';
 *
 *  class Address {
 *     @property('string')
 *     country: sting;
 *
 *     @property('string')
 *     city: string;
 *
 *     @property('string')
 *     address: string;
 *
 *     @property('string')
 *     zipCode: string;
 *
 *     @property("'billing' | 'shipping'")
 *     type: 'billing' | 'shipping';
 *
 *     @property('boolean', true)
 *     isPrimary?: boolean;
 * }
 *
 * class Email {
 *     @property('string')
 *     address: string;
 *
 *     @property('boolean', true, [EmailValidator])
 *     isPrimary?: boolean;
 * }
 *
 * class Phone {
 *     @property('string')
 *     countryCode: string;
 *
 *     @property('string');
 *     areaCode: string;
 *
 *     @property('string')
 *     number: string;
 *
 *     @property('boolean', true)
 *     isPrimary?: boolean;
 *
 *      @property("'cell' | 'work' | 'home'", true)
 *     type?: 'cell' | 'work' | 'home';
 * }
 *
 * class User {
 *     @property('string', false, [ValidateString.minLength(2), ValidateString.capitalized()])
 *     firstName: string;
 *
 *     @property('string', false, [ValidateString.minLength(2), ValidateString.capitalized()])
 *     lastName: string;
 *
 *     @property('Email');
 *     email: Email[];
 *
 *     @property('Phone[]')
 *     phone: Phone[];
 *
 *     @property('Address[]')
 *     address: Address[]
 * }
 *
 * \/**
 *  * Class UserService
 *  * Implements user server-data manipulations.
 *  *\/
 * class UserService() extends IMQService {
 *
 *     /**
 *      * Finds and returns a user object from server
 *      *
 *      * @param {number} id - user identifier
 *      * @returns {User | null} - user object or null if not found
 *      *\/
 *     @expose()
 *     public async find(id: number): User | null {
 *         // ... implementation goes here ...
 *     }
 *
 *     /**
 *      * Persist user data on server
 *      *
 *      * @param {Partial<User>} user - user data
 *      * @returns {boolean} - save operation result
 *      *\/
 *     @expose()
 *     public async save(user: Partial<User>): boolean {
 *         // ... implementation goes here ...
 *     }
 *
 *     // ... other methods implementation ...
 * }
 *
 * (async () => {
 *    const service = new UserService({ multiProcess: true });
 *    await service.start();
 * })();
 * ~~~
 */
export abstract class IMQService {

    [property: string]: any;

    protected imq: IMessageQueue;
    protected logger: ILogger;
    protected cache: ICache;

    public name: string;
    public options: IMQServiceOptions;

    constructor(options?: Partial<IMQServiceOptions>, name?: string) {
        this.name = name || this.constructor.name;

        if (this.name === 'IMQService') {
            throw new TypeError('IMQService class is abstract and can ' +
                'not be instantiated directly!');
        }

        options = Object.assign({}, DEFAULT_SERVICE_OPTIONS, options || {});

        this.imq = IMQ.create(this.name, options);
        this.options = (<any>this.imq).options;
        this.logger = this.options.logger || console;
        this.handleRequest = this.handleRequest.bind(this);
        this.imq.on('message', this.handleRequest);
    }

    private async handleRequest(msg: IMQRPCRequest, id: string) {
        const method = msg.method;
        const description = await this.describe();
        const args = msg.args;
        let response: IMQRPCResponse = {
            to: id,
            data: null,
            error: null,
            request: msg
        };

        if (!this[method]) {
            response.error = {
                code: 'IMQ_RPC_NO_METHOD',
                message: `Method ${this.name}.${method}() does not exist.`,
                stack: new Error().stack || '',
                method: method || '',
                args: JSON.stringify(args, null, 2)
            }
        }

        if (!description.service.methods[method]) {
            response.error = {
                code: 'IMQ_RPC_NO_ACCESS',
                message: `Access to ${this.name}.${method}() denied!`,
                stack: new Error().stack || '',
                method: method || '',
                args: JSON.stringify(args, null, 2)
            };
        }

        if (!isValidArgsCount(
            description.service.methods[method].arguments,
            args
        )) {
            response.error = {
                code: 'IMQ_RPC_INVALID_ARGS_COUNT',
                message: `Invalid args count for ${this.name}.${method}().`,
                stack: new Error().stack || '',
                method: method || '',
                args: JSON.stringify(args, null, 2)
            };
        }

        if (response.error) {
            return response;
        }

        try {
            response.data = this[method].apply(this, args);

            if (response.data && response.data.then) {
                response.data = await response.data;
            }
        }

        catch (err) {
            response.error = {
                code: 'IMQ_RPC_CALL_ERROR',
                message: err.message,
                stack: err.stack || new Error().stack || '',
                method: method || '',
                args: JSON.stringify(args, null, 2)
            };
        }

        return response;
    }

    @profile()
    public async start() {
        const numCpus = os.cpus().length;
        const numWorkers = numCpus * this.options.childrenPerCore;

        if (!this.options.multiProcess) {
            this.logger.info(
                '%s: starting single-worker, pid %s',
                this.name, process.pid
            );

            return this.imq.start();
        }

        if (cluster.isMaster) {
            for (let i = 0; i < numWorkers; i++) {
                this.logger.info('%s: starting worker #%s ...', this.name, i);
                cluster.fork({ workerId: i });
            }

            cluster.on('exit', (worker: any) => {
                this.logger.info(
                    '%s: worker pid %s died, exiting',
                    this.name,
                    worker.process.pid
                );
                process.exit(1);
            });
        }

        else {
            this.logger.info(
                '%s: worker #%s started, pid %s',
                this.name,
                process.env['workerId'],
                process.pid
            );

            this.describe();

            return this.imq.start();
        }
    }

    @profile()
    public async stop() {
        await this.imq.stop();
    }

    @profile()
    public async destroy() {
        await this.imq.destroy();
    }

    /**
     * Returns service description metadata
     *
     * @returns {Description} - service description metadata
     */
    @profile()
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
