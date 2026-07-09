/*!
 * IMQ-RPC Decorators: property
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
import { IMQRPCDescription } from '../index.js';

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
interface CollectedProperty {
    rawType: string | Thunk | any;
    isOptional: boolean;
}

/**
 * Per-class store of collected @property definitions, keyed off the shared
 * decorator metadata object. Standard field decorators cannot see their
 * class at decoration time, so properties are stashed here and flushed to
 * the RPC type description by a class-level decorator (@expose on a type,
 * or @indexed) once the class name is available.
 */
const PROPERTIES = Symbol('@imqueue/rpc:properties');

/**
 * Resolves a @property type argument (string, constructor, thunk, or array
 * form) to its RPC type-definition string.
 *
 * @param {string | Thunk | any} input
 * @return {string}
 */
function resolveTypeDef(input: string | Thunk | any): string {
    let type: any = input;

    if (typeof type === 'function' && !(type as Function).name) {
        type = (type as () => any)();
    }

    let typeDef: any = type;

    if (Array.isArray(typeDef)) {
        typeDef = typeDef[0];
    }

    if (typeDef && typeof typeDef !== 'string') {
        typeDef = typeDef.name;
    }

    if (Array.isArray(type)) {
        typeDef += '[]';
    }

    if (!typeDef) {
        typeDef = String(type);
    }

    return typeDef as string;
}

/**
 * Flushes @property definitions collected on a class into the RPC type
 * description. Invoked by class-level decorators once the class (and hence
 * its name) is available.
 *
 * @param {Function} ctor - the decorated class constructor
 * @param {DecoratorMetadata | undefined} metadata - shared decorator metadata
 * @param {string} [indexType] - optional index signature definition
 */
export function registerType(
    ctor: Function,
    metadata: DecoratorMetadata | undefined,
    indexType?: string,
): void {
    const typeName = ctor.name;
    const collected: Record<string, CollectedProperty> =
        metadata && Object.prototype.hasOwnProperty.call(metadata, PROPERTIES)
            ? (metadata as any)[PROPERTIES]
            : {};

    IMQRPCDescription.typesDescription[typeName] = IMQRPCDescription
        .typesDescription[typeName] || {
        properties: {},
        inherits: Object.getPrototypeOf(ctor).name,
    };

    const description = IMQRPCDescription.typesDescription[typeName];

    description.inherits = Object.getPrototypeOf(ctor).name;

    for (const key of Object.keys(collected)) {
        const { rawType, isOptional } = collected[key];
        let resolved: string | undefined;

        // resolve the type lazily on first read: standard decorators run
        // before class bindings are initialized, so a thunk referencing the
        // (self- or forward-referenced) type cannot be called during
        // decoration — only once the description is actually consumed
        Object.defineProperty(description.properties, key, {
            enumerable: true,
            configurable: true,
            value: {
                isOptional,
                get type(): string {
                    if (resolved === undefined) {
                        resolved = resolveTypeDef(rawType);
                    }

                    return resolved;
                },
            },
        });
    }

    if (indexType !== undefined) {
        description.indexType = indexType;
    }
}

export function property(
    type: string | Thunk | any,
    isOptional: boolean = false,
): any {
    if (!type) {
        return;
    }

    // Dual-mode: standard (TC39) field decorators pass a context object with a
    // `kind` property; legacy ones pass (prototype, propertyKey).
    return function (target: any, context: any): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            const metadata = context.metadata as any;

            // each class keeps its OWN property bag (metadata prototype-
            // inherits from a base class, so we must not mutate the inherited
            // one)
            if (!Object.prototype.hasOwnProperty.call(metadata, PROPERTIES)) {
                Object.defineProperty(metadata, PROPERTIES, {
                    value: {},
                    enumerable: false,
                    writable: true,
                    configurable: true,
                });
            }

            // store the raw type; resolution is deferred to first read (see
            // registerType) to avoid touching not-yet-initialized bindings
            (metadata[PROPERTIES] as Record<string, CollectedProperty>)[
                String(context.name)
            ] = {
                rawType: type,
                isOptional,
            };

            return;
        }

        // legacy: the class is available at decoration time, so write the
        // property straight into the RPC type description (no @classType flush
        // is required in this mode)
        const typeName = target.constructor.name;

        IMQRPCDescription.typesDescription[typeName] = IMQRPCDescription
            .typesDescription[typeName] || {
            properties: {},
            inherits: Object.getPrototypeOf(target.constructor).name,
        };

        IMQRPCDescription.typesDescription[typeName].properties[
            String(context)
        ] = {
            type: resolveTypeDef(type),
            isOptional,
        };
    };
}
