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
import { registerType } from './property';

/**
 * Implements the '@classType' decorator factory.
 *
 * Applied to a complex-type class, it registers the class's '@property' field
 * definitions into the RPC type description so the type can be exposed to
 * service clients. It is required on any class that uses '@property':
 * standard (TC39) field decorators cannot see the class they belong to, so a
 * class-level decorator is needed to flush the collected properties under the
 * class name.
 *
 * @example
 * ~~~typescript
 * import { classType, property, expose, IMQService } from '@imqueue/rpc';
 *
 * @classType()
 * class Address {
 *     @property('string')
 *     country: string;
 *
 *     @property('string', true)
 *     zipCode?: string; // optional
 * }
 *
 * @classType()
 * class User {
 *     @property('string')
 *     firstName: string;
 *
 *     @property('Array<Address>', true)
 *     addresses?: Address[];
 * }
 *
 * class UserService extends IMQService {
 *     @expose()
 *     public save(user: User) {
 *         // now User (and Address) are properly exposed to clients
 *     }
 * }
 * ~~~
 *
 * @return {(value: Function, context: ClassDecoratorContext) => void}
 */
export function classType(): (
    value: Function,
    context: ClassDecoratorContext,
) => void {
    return function (value: Function, context: ClassDecoratorContext): void {
        registerType(value, context.metadata);
    };
}
