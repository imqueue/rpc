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
import { Thunk } from '..';

/**
 * Implements '@indexed' decorator factory
 * This is used to specify complex service types which are need to expose
 * types containing indexed definition, for example:
 *
 * @example
 * ~~~typescript
 * import { type } from '@imqueue/rpc';
 *
 * @indexed('[fieldName: string]: any')
 * class Schema {
 *     [fieldName: string]: any
 * }
 * ~~~
 *
 * @return {(constructor: Function) => void}
 */
export function indexed(indexTypedef: string | Thunk): any {
    return function (constructor: Function): any {
        // istanbul ignore if
        if (!indexTypedef) {
            return ; // nothing to do here
        }

        if (typeof indexTypedef === 'function') {
            indexTypedef = indexTypedef();
        }

        // istanbul ignore if
        if (typeof indexTypedef !== 'string') {
            indexTypedef = String(indexTypedef);
        }

        const typeName = constructor.name;

        IMQRPCDescription.typesDescription[typeName] =
        IMQRPCDescription.typesDescription[typeName] || {
            indexType: indexTypedef as string,
            properties: {},
            inherits: Object.getPrototypeOf(constructor).name,
        };

        IMQRPCDescription.typesDescription[typeName]
            .indexType = indexTypedef as string;
    };
}
