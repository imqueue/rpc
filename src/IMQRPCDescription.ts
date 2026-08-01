/*!
 * IMQRPCDescription implementation
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
/**
 * Description of one argument of an exposed method, as parsed from its JSDoc.
 */
export interface ArgDescription {
    /**
     * Prose describing the argument, taken from the text after the name on the
     * JSDoc `@param` line. Empty string when undocumented.
     */
    description: string;
    /**
     * Parameter name, from the JSDoc `@param` when documented, otherwise read from
     * the method's own signature.
     *
     * @remarks
     * Emitted verbatim into generated client code, so it must be a valid
     * identifier.
     */
    name: string;
    /**
     * Legacy duplicate of {@link ArgDescription.tsType} — always the identical
     * string.
     *
     * @remarks
     * Despite the pairing there is no wire-type/language-type distinction here.
     * This field is only read to recognise the framework's own {@link IMQDelay}
     * and {@link IMQMetadata} argument slots. Treat `tsType` as the single source
     * of truth.
     */
    type: string;
    /**
     * The argument's type as written in the method's JSDoc, defaulting to `'any'`
     * when undocumented. This is what a generated client emits into the method
     * signature. Never empty.
     */
    tsType: string;
    /**
     * Whether the argument was documented as optional, i.e. written `[name]` in
     * the JSDoc. A TypeScript `?` or a default value alone does not set this.
     *
     * @remarks
     * Affects the service's argument-count check: as soon as one argument is
     * optional, any call with at most the declared number of arguments is
     * accepted — including calls that omit required ones.
     */
    isOptional: boolean;
}

/**
 * Description of an exposed method's return value, as parsed from its JSDoc.
 *
 * @remarks
 * Always present on a {@link MethodDescription}, even when the method has no
 * `@returns` tag — in which case the type is `'any'`.
 */
export interface ReturnValueDescription {
    /**
     * Prose describing the return value, from the `@returns` JSDoc line.
     */
    description: string;
    /**
     * Legacy duplicate of {@link ReturnValueDescription.tsType} — always the
     * identical string.
     */
    type: string;
    /**
     * The return type from the method's `@returns` JSDoc, defaulting to `'any'`.
     *
     * @remarks
     * May span multiple lines. A generated client collapses whitespace and
     * rewrites a bare `Promise` to `Promise<any>`, so this is not necessarily what
     * ends up in the client verbatim.
     */
    tsType: string;
}

/**
 * Description of one exposed method: its summary, its positional arguments and
 * its return value.
 */
export interface MethodDescription {
    /**
     * The method's JSDoc summary, or an empty string when undocumented.
     */
    description: string;
    /**
     * The method's arguments, in positional order.
     *
     * @remarks
     * The client generator rewrites this array in place — it drops framework
     * arguments the service declared and appends the canonical optional
     * `imqMetadata`/`imqDelay` pair — so it can differ before and after client
     * generation in the same process.
     */
    arguments: ArgDescription[];
    /**
     * The method's return value description. Always present.
     */
    returns: ReturnValueDescription;
}

/**
 * Map of method name to method description.
 *
 * @remarks
 * In {@link ServiceClassDescription.methods} this holds only the methods that
 * class itself declares. In the description a service serves to clients it is the
 * whole inheritance chain flattened, with subclass methods overriding same-named
 * parent methods.
 */
export interface MethodsCollectionDescription {
    /**
     * Description of the method with the given name.
     */
    [methodName: string]: MethodDescription;
}

/**
 * The exposed methods a single class declares, plus its parent's name.
 */
export interface ServiceClassDescription {
    /**
     * Name of the class this one extends, read from the runtime prototype chain.
     * The literal `'Function'` means there is no class parent.
     *
     * @remarks
     * This differs from {@link TypesDescription}'s `inherits`, which uses an empty
     * string in that situation — one "has a parent?" check cannot serve both.
     */
    inherits: string;
    /**
     * Methods declared directly by this class, keyed by name.
     *
     * @remarks
     * Inherited methods live under their declaring class and are merged only when
     * a service builds the description it serves. Includes the inherited framework
     * `describe` method, which client generators skip.
     */
    methods: MethodsCollectionDescription;
}

/**
 * Raw registry of every class that declares exposed methods, keyed by class
 * name — the storage format behind {@link IMQRPCDescription.serviceDescription}.
 *
 * @remarks
 * This is not the payload a service returns from `describe()`. That is
 * {@link Description}, whose `service` field is `\{ name, methods \}` with the
 * inheritance chain already flattened.
 */
export interface ServiceDescription {
    /**
     * Description of the class with the given name.
     */
    [className: string]: ServiceClassDescription;
}

/**
 * Description of one property of an exposed complex type.
 */
export interface PropertyDescription {
    /**
     * The property's RPC type as a string — a literal type name, a constructor's
     * name, or a name with `[]` appended for the array form.
     *
     * @remarks
     * With standard decorators this is a read-only lazy getter, not a writable
     * field: the type is resolved the first time it is read, so a {@link Thunk}
     * runs then rather than at class-definition time, and assignment has no
     * effect. With legacy decorators it is an already-resolved plain string.
     */
    type: string;
    /**
     * Whether the property is optional, from the second argument of
     * {@link property}. Defaults to `false`, and is never inferred from a
     * TypeScript `?` modifier.
     */
    isOptional: boolean;
}

/**
 * The property bag of a single exposed type: property name to property
 * description.
 *
 * @remarks
 * Despite the singular name this does not describe a whole type — the per-type
 * record, which also carries `inherits` and `indexType`, is the value type of
 * {@link TypesDescription}.
 */
export interface TypeDescription {
    /**
     * Description of the property with the given name.
     */
    [propertyName: string]: PropertyDescription;
}

/**
 * Every exposed complex type, keyed by class name.
 *
 * @remarks
 * This map is process-global and is embedded by reference into every service's
 * description without filtering, so each service advertises every registered type
 * in its process — including types it does not use — and each becomes a generated
 * interface in every client. Because the reference is live, types registered after
 * a service first described itself still show up. Same-named classes collide.
 */
export interface TypesDescription {
    /**
     * Description of the type with the given class name.
     */
    [typeName: string]: {
        /**
         * The type's properties.
         */
        properties: TypeDescription;
        /**
         * Name of the parent class, or an empty string when there is no class
         * parent. A generated client only emits an `extends` clause when that
         * parent is itself registered here.
         */
        inherits: string;
        /**
         * Index signature as raw source text, present only for types decorated
         * with {@link indexed}. Injected verbatim into the generated interface and
         * not validated.
         */
        indexType?: string;
    };
}

/**
 * Process-global registry of RPC metadata gathered by the decorators.
 *
 * @remarks
 * Not instantiable and has no instance members — the two static maps are the whole
 * API. {@link expose} populates `serviceDescription`; {@link property} and
 * {@link indexed} populate `typesDescription`. A service's `describe()` reads both
 * to build the description it serves to clients, which is what the client
 * generator consumes.
 */
export class IMQRPCDescription {
    /**
     * All classes that declare exposed methods, keyed by class name (not service
     * name).
     *
     * @remarks
     * Filled in as decorators run at class-definition time, so it is only complete
     * once every service module has been loaded. Entries are never removed.
     */
    public static serviceDescription: ServiceDescription = {};
    /**
     * All complex types registered via {@link property} or {@link indexed}, keyed
     * by class name.
     */
    public static typesDescription: TypesDescription = {};
}
