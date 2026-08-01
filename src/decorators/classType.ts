/*!
 * IMQ-RPC Decorators: classType
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
import { registerType } from './property.js';

/**
 * Registers a complex-type class's `@property` field definitions into the RPC
 * type description, so the type can be exposed to service clients.
 *
 * @returns a dual-mode class decorator `(value, context?) => any`, typed `any` so
 *          one function serves both decorator protocols. Under standard (TC39)
 *          decorators it flushes the collected fields via {@link registerType} and
 *          returns `undefined`; under legacy decorators it is a pass-through that
 *          returns the class unchanged.
 *
 * @example
 * ```typescript
 * import { classType, property, expose, IMQService } from '@imqueue/rpc';
 *
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
 *     @property(() => [Address], true)
 *     addresses?: Address[];
 * }
 *
 * class UserService extends IMQService {
 *     @expose()
 *     public save(user: User) {
 *         // now User (and Address) are properly exposed to clients
 *     }
 * }
 * ```
 *
 * @remarks
 * Required on every class that uses {@link property} when compiling with
 * standard (TC39) decorators, the protocol this package targets: standard field
 * decorators cannot see their class, so a class-level decorator is what flushes
 * the collected fields under the class name.
 *
 * Under legacy (`experimentalDecorators`) decorators `@property` registers each
 * field directly and this decorator is a harmless no-op.
 *
 * Omitting it produces no error — the type is silently missing from the RPC
 * type description, and generated clients then reference an undeclared type.
 * Applying it to a class with no `@property` fields registers an empty type
 * description.
 *
 * {@link indexed} performs the same flush in addition to recording an index
 * signature, so a class carrying `@indexed()` does not also need `@classType()`.
 */
export function classType(): any {
    // Dual-mode: standard (TC39) class decorators pass a context object with a
    // `kind` property; legacy ones pass only the constructor. In legacy mode
    // @property already registers each field directly, so there is nothing to
    // flush and the class is returned unchanged.
    return function (value: any, context?: any): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            registerType(value, context.metadata);

            return;
        }

        return value;
    };
}
