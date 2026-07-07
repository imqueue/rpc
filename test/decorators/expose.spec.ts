/*!
 * expose() Function Unit Tests
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
            } catch (e) {
                rej(e);
            }
        });
    }

    public nonExposedMethod() {}

    /**
     * @param {number} a
     * @returns {string}
     */
    @expose()
    async withEmbeddedAsync(a: number) {
        return await new Promise(async resolve => {
            try {
                resolve(a.toString());
            } catch (e) {
                resolve('');
            }
        });
    }
}

class ExposeTestClassExtended extends ExposeTestClass {
    @expose()
    public extendedMethod() {}
}

// Standard decorators cannot see their class at decoration time, so the RPC
// service description is built when a service is first constructed (which is
// always the case in real usage) rather than at class-definition time.
new ExposeTestClass();
new ExposeTestClassExtended();

describe('decorators/expose()', () => {
    it('should be a function', () => {
        assert.equal(typeof expose, 'function');
    });
    it('should return decorator function', () => {
        assert.equal(typeof expose(), 'function');
    });
    it('should properly fill exposed description', () => {
        assert.notEqual(description.ExposeTestClass, undefined);
        assert.equal(description.ExposeTestClass.inherits, 'Function');
        assert.notEqual(description.ExposeTestClass.methods, undefined);
        assert.notEqual(
            description.ExposeTestClass.methods.testMethod,
            undefined,
        );
        assert.notEqual(
            description.ExposeTestClass.methods.anotherMethod,
            undefined,
        );
        assert.notEqual(
            description.ExposeTestClass.methods.oneMoreMethod,
            undefined,
        );
        assert.equal(
            description.ExposeTestClass.methods.nonExposedMethod,
            undefined,
        );

        assert.equal(
            description.ExposeTestClass.methods.oneMoreMethod.description,
            'Commented service method',
        );

        // oneMoreMethod
        assert.equal(
            description.ExposeTestClass.methods.oneMoreMethod.arguments.length,
            2,
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.oneMoreMethod.returns,
            {
                description: 'dummy string',
                type: 'string',
                tsType: 'string',
            },
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.oneMoreMethod.arguments[0],
            {
                description: 'array of strings',
                type: 'string[]',
                tsType: 'string[]',
                name: 'strArr',
                isOptional: false,
            },
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.oneMoreMethod.arguments[1],
            {
                description: 'some number',
                type: 'number',
                tsType: 'number',
                name: 'num',
                isOptional: true,
            },
        );

        // anotherMethod
        assert.equal(
            description.ExposeTestClass.methods.anotherMethod.arguments.length,
            2,
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.anotherMethod.returns,
            {
                description: '',
                type: 'any',
                tsType: 'any',
            },
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.anotherMethod.arguments[0],
            {
                description: '',
                type: 'any',
                tsType: 'any',
                name: 'strArr',
                isOptional: false,
            },
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.anotherMethod.arguments[1],
            {
                description: '',
                type: 'any',
                tsType: 'any',
                name: 'num',
                isOptional: false,
            },
        );

        // testMethod
        assert.equal(
            description.ExposeTestClass.methods.testMethod.arguments.length,
            0,
        );
        assert.deepEqual(
            description.ExposeTestClass.methods.testMethod.returns,
            {
                description: '',
                type: 'any',
                tsType: 'any',
            },
        );

        assert.notEqual(description.ExposeTestClassExtended, undefined);
        assert.equal(
            description.ExposeTestClassExtended.inherits,
            'ExposeTestClass',
        );
    });
    it('should parse embedded async functions', () => {
        assert.deepEqual(
            description.ExposeTestClass.methods.withEmbeddedAsync.returns,
            {
                description: '',
                type: 'string',
                tsType: 'string',
            },
        );
    });
});
