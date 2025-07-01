/*!
 * expose() Function Unit Tests
 *
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
 */
import '../mocks';
import { expect } from 'chai';
import { expose, IMQRPCDescription } from '../..';

const description = IMQRPCDescription.serviceDescription;

class ExposeTestClass {

    @expose()
    public testMethod() {}

    // noinspection JSUnusedLocalSymbols
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

    // noinspection JSUnusedGlobalSymbols
    public nonExposedMethod() {}

    /**
     * @param {number} a
     * @returns {string}
     */
    @expose()
    async withEmbeddedAsync(a: number) {
        return await new Promise(async (resolve) => {
            try {
                resolve(a.toString());
            } catch(e) {
                resolve('');
            }
        });
    }
}

// noinspection JSUnusedLocalSymbols
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
    it('should parse embedded async functions', () => {
        expect(description.ExposeTestClass.methods.withEmbeddedAsync.returns)
            .to.deep.equal({
                description: '',
                type: 'Promise',
                tsType: 'string'
            });
    });
});
