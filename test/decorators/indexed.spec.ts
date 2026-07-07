/*!
 * property() Function Unit Tests
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
import '../mocks';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

@indexed(() => `[fieldName: string]: ${SchemaField.name}`)
class SchemaThunk {
    [fieldName: string]: SchemaField;
}

const typesMetadata = IMQRPCDescription.typesDescription;

describe('decorators/property()', () => {
    it('should be a function', () => {
        assert.equal(typeof indexed, 'function');
    });

    it('should return decorator function', () => {
        assert.equal(typeof indexed('[name: string]: any'), 'function');
    });

    it('should properly fill exposed metadata', () => {
        assert.notEqual(typesMetadata.Schema, undefined);
        assert.ok(
            typesMetadata.Schema!.indexType!.includes(
                '[fieldName: string]: SchemaField',
            ),
        );
    });

    it('should accept thunk definition', () => {
        assert.notEqual(typesMetadata.SchemaThunk, undefined);
        assert.ok(
            typesMetadata.SchemaThunk!.indexType!.includes(
                '[fieldName: string]: SchemaField',
            ),
        );
    });
});
