/*!
 * Additional coverage: legacy decorator signatures, serialize edge cases,
 * error and request-context helpers.
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
import '../test/mocks/index.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    remote,
    logged,
    cache,
    lock,
    indexed,
    property,
    classType,
    IMQError,
    currentMetadata,
    runWithRequest,
    IMQRPCDescription,
} from '../index.js';
import { signature } from '../src/helpers/index.js';

describe('legacy decorator signatures', () => {
    // legacy form: (target, propertyKey, descriptor) with no TC39 context
    const legacyMethod = (dec: any) => {
        const descriptor: any = { value: function original() {} };
        const result = dec({}, 'legacyMethod', descriptor);

        assert.equal(result, descriptor);
        assert.equal(typeof descriptor.value, 'function');
    };

    it('remote() wraps via the legacy signature', () => {
        legacyMethod(remote());
    });

    it('logged() wraps via the legacy signature', () => {
        legacyMethod(logged());
    });

    it('cache() wraps via the legacy signature', () => {
        legacyMethod(cache());
    });

    it('lock() wraps via the legacy signature', () => {
        legacyMethod(lock());
    });

    it('classType() returns the class unchanged in legacy mode', () => {
        class LegacyClassTypeTarget {}

        assert.equal(classType()(LegacyClassTypeTarget), LegacyClassTypeTarget);
    });

    it('indexed() is a no-op without an index typedef (legacy)', () => {
        class NoIndex {}

        assert.equal(indexed('')(NoIndex), NoIndex);
    });

    it('indexed() attaches the index type in legacy mode', () => {
        class LegacyIndexed {}

        // a non-string typedef exercises the String() coercion branch too
        indexed(42 as any)(LegacyIndexed);

        assert.equal(
            IMQRPCDescription.typesDescription.LegacyIndexed.indexType,
            '42',
        );
    });

    it('property() returns undefined for a falsy type', () => {
        assert.equal(property(''), undefined);
    });

    it('property() registers the field directly in legacy mode', () => {
        class LegacyProp {}

        // a plain object type drives resolveTypeDef down its String() fallback
        property({} as any)(LegacyProp.prototype, 'field');

        assert.equal(
            typeof IMQRPCDescription.typesDescription.LegacyProp.properties
                .field.type,
            'string',
        );
    });
});

describe('signature() serialize edge cases', () => {
    const sig = (arg: unknown) => signature('C', 'm', [arg]);

    it('serializes every primitive kind without throwing', () => {
        for (const arg of [
            null,
            true,
            false,
            10n,
            undefined,
            () => undefined,
            Symbol('x'),
            NaN,
        ]) {
            assert.match(sig(arg), /^[0-9a-f]{16}$/);
        }
    });

    it('is deterministic across primitive kinds', () => {
        assert.equal(sig(true), sig(true));
        assert.notEqual(sig(true), sig(false));
    });
});

describe('IMQError()', () => {
    it('drops an original error that cannot be serialized', () => {
        const circular: any = {};
        circular.self = circular;

        const err = IMQError('E', 'msg', 'stack', 'method', [1], circular);

        assert.equal(err.original, undefined);
        assert.equal(err.code, 'E');
    });
});

describe('IMQRequestContext.currentMetadata()', () => {
    it('returns undefined outside of a request scope', () => {
        assert.equal(currentMetadata(), undefined);
    });

    it('returns the in-flight request metadata within a scope', () => {
        const request: any = { metadata: { traceId: 'abc' } };
        const meta = runWithRequest(request, () => currentMetadata());

        assert.deepEqual(meta, { traceId: 'abc' });
    });
});
