/*!
 * expose() Function Unit Tests
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
import { expose, IMQRPCDescription } from '../..';

const description = IMQRPCDescription.serviceDescription;

class ExposeTestClass {

    @expose()
    public testMethod() {}

    @expose()
    public async anotherMethod(strArr: string[], num?: number) {}

    /**
     * Commented service method
     *
     * @param {string[]} strArr - array of strings
     * @param {number} [num] - some number
     * @return {string} - dummy string
     */
    @expose()
    public async oneMoreMethod(strArr: string[], num?: number) {
        return await new Promise((res, rej) => {
            try {
                res('Hello, World!');
            }

            catch (e) {
                rej(e);
            }
        });
    }

    public nonExposedMethod() {}

}

class ExposeTestClassExtended extends ExposeTestClass {
    @expose()
    public extendedMethod() {}
}

describe('decorators/expose()', () => {
    it('should be a function', () => {
        expect(typeof expose).to.equal('function');
    });
    it('should return decorator function', () => {
        expect(typeof expose()).to.equal('function');
    });
    it('should properly fill exposed description', () => {
        expect(description.ExposeTestClass).not.to.be.undefined;
        expect(description.ExposeTestClass.inherits).to.equal('Function');
        expect(description.ExposeTestClass.methods).not.to.be.undefined;
        expect(description.ExposeTestClass.methods.testMethod)
            .not.to.be.undefined;
        expect(description.ExposeTestClass.methods.anotherMethod)
            .not.to.be.undefined;
        expect(description.ExposeTestClass.methods.oneMoreMethod)
            .not.to.be.undefined;
        expect(description.ExposeTestClass.methods.nonExposedMethod)
            .to.be.undefined;

        expect(description.ExposeTestClass.methods.oneMoreMethod.description)
            .to.equal('Commented service method');

        // oneMoreMethod
        expect(description.ExposeTestClass.methods.oneMoreMethod
            .arguments.length
        ).to.equal(2);
        expect(description.ExposeTestClass.methods.oneMoreMethod.returns)
            .to.deep.equal({
            description: 'dummy string',
            type: 'Promise',
            tsType: 'string'
        });
        expect(description.ExposeTestClass.methods.oneMoreMethod.arguments[0])
            .to.deep.equal({
            description: 'array of strings',
            type: 'Array',
            tsType: 'string[]',
            name: 'strArr',
            isOptional: false
        });
        expect(description.ExposeTestClass.methods.oneMoreMethod.arguments[1])
            .to.deep.equal({
            description: 'some number',
            type: 'Number',
            tsType: 'number',
            name: 'num',
            isOptional: true
        });

        // anotherMethod
        expect(description.ExposeTestClass.methods.anotherMethod
            .arguments.length
        ).to.equal(2);
        expect(description.ExposeTestClass.methods.anotherMethod.returns)
            .to.deep.equal({
            description: '',
            type: 'Promise',
            tsType: 'Promise'
        });
        expect(description.ExposeTestClass.methods.anotherMethod.arguments[0])
            .to.deep.equal({
            description: '',
            type: 'Array',
            tsType: 'any[]',
            name: 'strArr',
            isOptional: false
        });
        expect(description.ExposeTestClass.methods.anotherMethod.arguments[1])
            .to.deep.equal({
            description: '',
            type: 'Number',
            tsType: 'number',
            name: 'num',
            isOptional: false
        });

        // testMethod
        expect(description.ExposeTestClass.methods.testMethod.arguments.length)
            .to.equal(0);
        expect(description.ExposeTestClass.methods.testMethod.returns)
            .to.deep.equal({
            description: '',
            type: 'undefined',
            tsType: 'void'
        });

        expect(description.ExposeTestClassExtended)
            .not.to.be.undefined;
        expect(description.ExposeTestClassExtended.inherits)
            .to.be.equal('ExposeTestClass');
    });
});