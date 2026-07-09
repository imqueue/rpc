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
import { Thunk, IMQRPCDescription } from '../index.js';
import { registerType } from './property.js';

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
    // Dual-mode: standard (TC39) class decorators pass a context object with a
    // `kind` property; legacy ones pass only the constructor.
    return function (value: any, context?: any): any {
        const isStandard =
            context && typeof context === 'object' && 'kind' in context;

        if (!indexTypedef) {
            return isStandard ? undefined : value; // nothing to do here
        }

        if (typeof indexTypedef === 'function') {
            indexTypedef = indexTypedef();
        }

        if (typeof indexTypedef !== 'string') {
            indexTypedef = String(indexTypedef);
        }

        if (isStandard) {
            // registers any @property fields on this class plus the index type
            registerType(value, context.metadata, indexTypedef as string);

            return;
        }

        // legacy: @property already registered the fields directly, so only
        // the index type needs to be attached to the existing description
        const typeName = value.name;

        IMQRPCDescription.typesDescription[typeName] = IMQRPCDescription
            .typesDescription[typeName] || {
            properties: {},
            inherits: Object.getPrototypeOf(value).name,
        };
        IMQRPCDescription.typesDescription[typeName].indexType =
            indexTypedef as string;

        return value;
    };
}
