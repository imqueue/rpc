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
export function indexed(indexTypedef: string): any {
    return function (constructor: Function): any {
        // istanbul ignore if
        if (!indexTypedef) {
            return ; // nothing to do here
        }

        const typeName = constructor.name;

        IMQRPCDescription.typesDescription[typeName] =
        IMQRPCDescription.typesDescription[typeName] || {
            indexType: indexTypedef,
            properties: {},
            inherits: Object.getPrototypeOf(constructor).name,
        };

        IMQRPCDescription.typesDescription[typeName].indexType = indexTypedef;
    };
}
