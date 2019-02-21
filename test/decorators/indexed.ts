/*!
 * property() Function Unit Tests
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
import '../mocks';
import { expect } from 'chai';
import { indexed, property, IMQRPCDescription } from '../..';

@indexed('[fieldName: string]: SchemaField')
class Schema {
    [fieldName: string]: SchemaField;
}

class SchemaField {
    @property('string')
    type: string;

    @property('any')
    value: any;
}

const typesMetadata = IMQRPCDescription.typesDescription;

describe('decorators/property()', () => {
    it('should be a function', () => {
        expect(typeof indexed).to.equal('function');
    });

    it('should return decorator function', () => {
        expect(typeof indexed('[name: string]: any')).to.equal('function');
    });

    it('should properly fill exposed metadata', () => {
        expect(typesMetadata.Schema).not.to.be.undefined;
        expect(typesMetadata.Schema.indexType)
            .contains('[fieldName: string]: SchemaField');
    });
});
