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
import { expect } from 'chai';
import { property, IMQRPCDescription } from '../..';

class TestPointType {

    @property('number')
    x: number;

    @property('number')
    y: number;

    @property('number', true)
    z?: number;

}

// noinspection JSUnusedLocalSymbols
class TestBaseComplexType {

    @property('string')
    mandatoryStr: string;

    @property('string', true)
    nonMandatoryStr?: string;

    @property('TestPointType')
    point: TestPointType;
}

class TestExtendedComplexType extends TestPointType {
    @property('boolean')
    public is3d: boolean;
}

class ThunkComplexTypeDef {
    @property(TestPointType)
    point: TestPointType;

    @property(() => ThunkComplexTypeDef)
    self: ThunkComplexTypeDef;
}

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
        expect(typeof property).to.equal('function');
    });

    it('should return decorator function', () => {
        expect(typeof property('string')).to.equal('function');
    });

    it('should properly fill exposed metadata', () => {
        expect(typesMetadata.TestBaseComplexType).not.to.be.undefined;
        expect(typesMetadata.TestPointType).not.to.be.undefined;
        expect(typesMetadata.TestPointType.properties).not.to.be.undefined;

        expect(typesMetadata.TestPointType.properties.x).not.to.be.undefined;
        expect(typesMetadata.TestPointType.properties.y).not.to.be.undefined;
        expect(typesMetadata.TestPointType.properties.z).not.to.be.undefined;

        expect(typesMetadata.TestPointType.properties.x.type)
            .to.equal('number');
        expect(typesMetadata.TestPointType.properties.y.type)
            .to.equal('number');
        expect(typesMetadata.TestPointType.properties.z.type)
            .to.equal('number');

        expect(typesMetadata.TestPointType.properties.x.isOptional)
            .to.be.false;
        expect(typesMetadata.TestPointType.properties.y.isOptional)
            .to.be.false;
        expect(typesMetadata.TestPointType.properties.z.isOptional)
            .to.be.true;

        expect(typesMetadata.TestBaseComplexType.properties.mandatoryStr)
            .not.to.be.undefined;
        expect(typesMetadata.TestBaseComplexType.properties.nonMandatoryStr)
            .not.to.be.undefined;
        expect(typesMetadata.TestBaseComplexType.properties.point)
            .not.to.be.undefined;

        expect(typesMetadata.TestBaseComplexType.properties.mandatoryStr.type)
            .to.equal('string');
        expect(
            typesMetadata.TestBaseComplexType.properties.nonMandatoryStr.type
        ).to.equal('string');
        expect(typesMetadata.TestBaseComplexType.properties.point.type)
            .to.equal('TestPointType');

        expect(
            typesMetadata.TestBaseComplexType.properties.mandatoryStr.isOptional
        ).to.be.false;
        expect(
            typesMetadata.TestBaseComplexType.properties.nonMandatoryStr
                .isOptional
        ).to.be.true;
        expect(typesMetadata.TestBaseComplexType.properties.point.isOptional)
            .to.be.false;
        expect(typesMetadata.TestExtendedComplexType.inherits)
            .equals('TestPointType');
        expect(typesMetadata.TestPointType.inherits)
            .not.to.be.ok;
    });

    it('should allow objects and thunks as typedefs', () => {
        expect(typesMetadata.ThunkComplexTypeDef).not.to.be.undefined;
        expect(typesMetadata.ThunkComplexTypeDef.properties.point.type)
            .equals('TestPointType');
        expect(typesMetadata.ThunkComplexTypeDef.properties.self.type)
            .equals('ThunkComplexTypeDef');
    });

    it('should accept array types', () => {
        expect(typesMetadata.ArrayPropTypes).not.to.be.undefined;
        expect(typesMetadata.ArrayPropTypes.properties.points.type)
            .equals('TestPointType[]');
        expect(typesMetadata.ArrayPropTypes.properties.otherPoints.type)
            .equals('TestPointType[]');
        expect(typesMetadata.ArrayPropTypes.properties.morePoints.type)
            .equals('TestPointType[]');
        expect(typesMetadata.ArrayPropTypes.properties.yetMorePoints.type)
            .equals('TestPointType[]');
    });
});
