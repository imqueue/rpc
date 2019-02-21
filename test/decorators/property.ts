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
});
