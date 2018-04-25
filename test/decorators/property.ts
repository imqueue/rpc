/*!
 * property() Function Unit Tests
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
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

class TestBaseComplexType {

    @property('string')
    mandatoryStr: string;

    @property('string', true)
    nonMandatoryStr?: string;

    @property('TestPointType')
    point: TestPointType;
}

const typesMetadata = IMQRPCDescription.typesDescription;

describe('property()', () => {
    it('should be a function', () => {
        expect(typeof property).to.equal('function');
    });

    it('should return decorator function', () => {
        expect(typeof property('string')).to.equal('function');
    });

    it('should properly fill exposed metadata', () => {
        expect(typesMetadata.TestBaseComplexType).not.to.be.undefined;
        expect(typesMetadata.TestPointType).not.to.be.undefined;

        expect(typesMetadata.TestPointType.x).not.to.be.undefined;
        expect(typesMetadata.TestPointType.y).not.to.be.undefined;
        expect(typesMetadata.TestPointType.z).not.to.be.undefined;

        expect(typesMetadata.TestPointType.x.type)
            .to.equal('number');
        expect(typesMetadata.TestPointType.y.type)
            .to.equal('number');
        expect(typesMetadata.TestPointType.z.type)
            .to.equal('number');

        expect(typesMetadata.TestPointType.x.isOptional)
            .to.be.false;
        expect(typesMetadata.TestPointType.y.isOptional)
            .to.be.false;
        expect(typesMetadata.TestPointType.z.isOptional)
            .to.be.true;

        expect(typesMetadata.TestBaseComplexType.mandatoryStr)
            .not.to.be.undefined;
        expect(typesMetadata.TestBaseComplexType.nonMandatoryStr)
            .not.to.be.undefined;
        expect(typesMetadata.TestBaseComplexType.point)
            .not.to.be.undefined;

        expect(typesMetadata.TestBaseComplexType.mandatoryStr.type)
            .to.equal('string');
        expect(typesMetadata.TestBaseComplexType.nonMandatoryStr.type)
            .to.equal('string');
        expect(typesMetadata.TestBaseComplexType.point.type)
            .to.equal('TestPointType');

        expect(typesMetadata.TestBaseComplexType.mandatoryStr.isOptional)
            .to.be.false;
        expect(typesMetadata.TestBaseComplexType.nonMandatoryStr.isOptional)
            .to.be.true;
        expect(typesMetadata.TestBaseComplexType.point.isOptional)
            .to.be.false;
    });
});