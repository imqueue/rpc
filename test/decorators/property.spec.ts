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
import '../mocks/index.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { property, classType, IMQRPCDescription } from '../../index.js';

@classType()
class TestPointType {
    @property('number')
    x: number;

    @property('number')
    y: number;

    @property('number', true)
    z?: number;
}

@classType()
class TestBaseComplexType {
    @property('string')
    mandatoryStr: string;

    @property('string', true)
    nonMandatoryStr?: string;

    @property('TestPointType')
    point: TestPointType;
}

@classType()
class TestExtendedComplexType extends TestPointType {
    @property('boolean')
    public is3d: boolean;
}

@classType()
class ThunkComplexTypeDef {
    @property(TestPointType)
    point: TestPointType;

    @property(() => ThunkComplexTypeDef)
    self: ThunkComplexTypeDef;
}

@classType()
class ArrayPropTypes {
    @property(() => Array.of(TestPointType))
    points: TestPointType[];

    @property([TestPointType])
    otherPoints: TestPointType[];

    @property(Array.of('TestPointType'))
    morePoints: TestPointType[];

    @property(() => ['TestPointType'])
    yetMorePoints: TestPointType[];
}

const typesMetadata = IMQRPCDescription.typesDescription;

describe('decorators/property()', () => {
    it('should be a function', () => {
        assert.equal(typeof property, 'function');
    });

    it('should return decorator function', () => {
        assert.equal(typeof property('string'), 'function');
    });

    it('should properly fill exposed metadata', () => {
        const point = typesMetadata.TestPointType;
        const base = typesMetadata.TestBaseComplexType;

        assert.notEqual(base, undefined);
        assert.notEqual(point, undefined);
        assert.notEqual(point.properties, undefined);

        assert.notEqual(point.properties.x, undefined);
        assert.notEqual(point.properties.y, undefined);
        assert.notEqual(point.properties.z, undefined);

        assert.equal(point.properties.x.type, 'number');
        assert.equal(point.properties.y.type, 'number');
        assert.equal(point.properties.z.type, 'number');

        assert.equal(point.properties.x.isOptional, false);
        assert.equal(point.properties.y.isOptional, false);
        assert.equal(point.properties.z.isOptional, true);

        assert.notEqual(base.properties.mandatoryStr, undefined);
        assert.notEqual(base.properties.nonMandatoryStr, undefined);
        assert.notEqual(base.properties.point, undefined);

        assert.equal(base.properties.mandatoryStr.type, 'string');
        assert.equal(base.properties.nonMandatoryStr.type, 'string');
        assert.equal(base.properties.point.type, 'TestPointType');

        assert.equal(base.properties.mandatoryStr.isOptional, false);
        assert.equal(base.properties.nonMandatoryStr.isOptional, true);
        assert.equal(base.properties.point.isOptional, false);

        assert.equal(
            typesMetadata.TestExtendedComplexType.inherits,
            'TestPointType',
        );
        assert.ok(!typesMetadata.TestPointType.inherits);
    });

    it('should allow objects and thunks as typedefs', () => {
        const t = typesMetadata.ThunkComplexTypeDef;

        assert.notEqual(t, undefined);
        assert.equal(t.properties.point.type, 'TestPointType');
        assert.equal(t.properties.self.type, 'ThunkComplexTypeDef');
    });

    it('should accept array types', () => {
        const a = typesMetadata.ArrayPropTypes;

        assert.notEqual(a, undefined);
        assert.equal(a.properties.points.type, 'TestPointType[]');
        assert.equal(a.properties.otherPoints.type, 'TestPointType[]');
        assert.equal(a.properties.morePoints.type, 'TestPointType[]');
        assert.equal(a.properties.yetMorePoints.type, 'TestPointType[]');
    });
});
