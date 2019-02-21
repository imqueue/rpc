/*!
 * IMQ-RPC Decorators: property
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
import { IMQRPCDescription } from '..';

export interface Thunk {
    (): any;
}

/**
 * Implements '@property' decorator factory
 * This is used to specify complex service types to be exposed
 *
 * @example
 * ~~~typescript
 * import { property, expose, IMQService } from '@imqueue/rpc';
 *
 * class Address {
 *     @property('string')
 *     country: string;
 *
 *     @property('string')
 *     city: string;
 *
 *     @property('string')
 *     address: string;
 *
 *     @property('string', true)
 *     zipCode?: string; // this is optional
 * }
 *
 * class User {
 *     @property('string')
 *     firstName: string;
 *
 *     @property('string')
 *     lastName: string;
 *
 *     @property('string')
 *     email: string;
 *
 *     @property('Array<Address>', true)
 *     address?: Array<Address>;
 * }
 *
 * // now we can use those complex types as service methods args
 * // and them will be properly exposed to service clients
 *
 * class UserService extends IMQService {
 *
 *     @expose()
 *     public save(user: User) {
 *         // do smth with given user data to persis it
 *     }
 *
 *     @expose()
 *     public find(id: number): User {
 *        // find and return user
 *     }
 *
 * }
 * ~~~
 *
 * @return {(
 *    target: any,
 *    methodName: (string),
 *    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
 * ) => void}
 */
export function property(
    type: string | Thunk | any,
    isOptional: boolean = false
): any {
    // istanbul ignore if
    if (!type) {
        return ;
    }

    return function (
        target: any,
        propertyKey: string,
    ): any {
        const typeName = target.constructor.name;
        const typeDef = typeof type === 'string'
            ? type
            : (type.name
                ? type.name
                : type().name || String(type)
            );

        IMQRPCDescription.typesDescription[typeName] =
        IMQRPCDescription.typesDescription[typeName] || {
            properties: {},
            inherits: Object.getPrototypeOf(target.constructor).name,
        };

        IMQRPCDescription.typesDescription[typeName].properties[propertyKey] = {
            type: typeDef,
            isOptional
        };
    };
}
