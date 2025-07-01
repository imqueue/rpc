/*!
 * IMQ-RPC Decorators: property
 *
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
    isOptional: boolean = false,
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
        let typeDef: any;

        if (typeof type === 'function' && !(type as Function).name) {
            type = (type as () => any)();
        }

        typeDef = type;

        if (Array.isArray(typeDef)) {
            typeDef = typeDef[0];
        }

        if (typeDef && typeof typeDef !== 'string') {
            typeDef = typeDef.name;
        }

        if (Array.isArray(type)) {
            typeDef += '[]';
        }

        // istanbul ignore if
        if (!typeDef) {
            typeDef = String(type);
        }

        IMQRPCDescription.typesDescription[typeName] =
        IMQRPCDescription.typesDescription[typeName] || {
            properties: {},
            inherits: Object.getPrototypeOf(target.constructor).name,
        };

        IMQRPCDescription.typesDescription[typeName].properties[propertyKey] = {
            type: typeDef as string,
            isOptional,
        };
    };
}
