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

/**
 * A zero-argument function whose return value is resolved lazily.
 *
 * Used by {@link property} and {@link indexed} so a type definition can reference
 * a class that is not yet initialized at decoration time — self-references and
 * forward references.
 *
 * @remarks
 * Detection is by the absence of a function name, so the thunk must be an
 * anonymous function or arrow function. A named function is treated as a
 * constructor instead, and resolves to its own name.
 */
export interface Thunk {
    /**
     * @returns the deferred value — a type definition or an index-signature string
     */
    (): any;
}

/**
 * Internal record of one collected `@property` definition: the unresolved type
 * argument and its optionality.
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
 * @param input - the type argument as given to `@property`
 * @returns the resolved RPC type-definition string
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
 * Flushes `@property` definitions collected on a class into the RPC type
 * description. Invoked by class-level decorators once the class (and hence
 * its name) is available.
 *
 * @param ctor - the decorated class constructor
 * @param metadata - shared decorator metadata carrying the collected properties
 * @param indexType - optional index signature definition, as raw source text
 *
 * @remarks
 * Only the class's own collected properties are flushed — fields inherited
 * from a base class are not copied, and are represented solely by `inherits`. So
 * every class in a hierarchy that declares `@property` fields needs its own
 * {@link classType} or {@link indexed}, or those fields are lost.
 *
 * `inherits` is re-derived from the runtime prototype chain on every call, and is
 * the empty string for a class with no `extends`.
 *
 * Each property is installed as an accessor whose `type` is a memoising getter,
 * so the type argument is resolved on first read rather than at decoration time.
 * Existing entries are merged into, never cleared.
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

/**
 * Marks a class field as part of an exposed complex type, so it is described to
 * clients and appears in the generated client interfaces.
 *
 * @param type - the field's RPC type: a type-definition string (`'string'`,
 *        `'Address'`, `'Array<Address>'`), a constructor (its `name` is used), a
 *        single-element array such as `[Address]` (which yields `Address[]`), or
 *        an anonymous {@link Thunk} returning any of those — required for
 *        self- or forward-referencing types, since a thunk is not invoked until
 *        the description is first read. A named function is treated as a
 *        constructor, not a thunk.
 * @param isOptional - marks the field optional in the generated type. Not
 *        inferred from the TypeScript `?` modifier — pass `true` explicitly.
 * @returns a dual-mode field decorator `(target, context) => any`, typed `any`
 *          so one function serves both decorator protocols. Under standard (TC39)
 *          decorators it records the field on the class's decorator metadata for a
 *          later flush and returns `undefined`; under legacy decorators it writes
 *          the field into the RPC type description immediately.
 *
 * @example
 * ```typescript
 * import { classType, property, expose, IMQService } from '@imqueue/rpc';
 *
 * // every class using @property also needs a class-level @classType()
 * @classType()
 * class Address {
 *     @property('string')
 *     country!: string;
 *
 *     @property('string', true)
 *     zipCode?: string; // optional
 * }
 *
 * @classType()
 * class User {
 *     @property('string')
 *     firstName!: string;
 *
 *     // thunk + array form, for a forward reference
 *     @property(() => [Address], true)
 *     addresses?: Address[];
 * }
 *
 * class UserService extends IMQService {
 *     // exposed methods need a JSDoc block with typed @param/@returns tags —
 *     // see the `expose` decorator
 *     @expose()
 *     public async save(user: User): Promise<boolean> {
 *         return true;
 *     }
 * }
 * ```
 *
 * @remarks
 * Every class that uses `@property` must also carry a class-level
 * {@link classType} — or {@link indexed}, which does the same flush — when
 * compiling with standard (TC39) decorators, the protocol this package targets.
 * Standard field decorators cannot see their class, so a class-level decorator is
 * what registers the collected fields under the class name. Omitting it fails
 * silently: the type simply never appears in the RPC type description, and
 * generated clients reference an undeclared type.
 *
 * Passing a falsy `type` returns `undefined`, which TypeScript accepts as a no-op
 * decoration — the field is then silently absent from the type description.
 */
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
