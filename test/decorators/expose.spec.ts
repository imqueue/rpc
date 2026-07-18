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
import '../mocks/index.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expose, parseSourceComments, IMQRPCDescription } from '../../index.js';

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

    it('should skip parsed classes whose name does not match', () => {
        class RenamedExposeClass {
            /**
             * Doc for a renamed class method
             *
             * @return {void}
             */
            public renamedMethod() {}
        }

        // force ctor.name to differ from the class name in ctor.toString(), so
        // the source parser finds a class declaration that does not match
        Object.defineProperty(RenamedExposeClass, 'name', {
            value: 'MismatchedExposeName',
        });

        const descriptor = Object.getOwnPropertyDescriptor(
            RenamedExposeClass.prototype,
            'renamedMethod',
        );

        assert.doesNotThrow(() =>
            expose()(RenamedExposeClass.prototype, 'renamedMethod', descriptor),
        );
    });

    it('should keep parsing after a regex literal following a keyword', () => {
        class RegexBraceClass {
            // `/\{+/` follows `return`, where a slash starts a regex, not a
            // division; the unbalanced `{` inside must not corrupt the brace
            // tracking that locates the next member
            public tricky(v: string) {
                return /\{+/.test(v);
            }

            /**
             * Documented after regex
             *
             * @return {string} - marker
             */
            public documented() {
                return 'ok';
            }
        }

        const descriptor = Object.getOwnPropertyDescriptor(
            RegexBraceClass.prototype,
            'documented',
        );

        expose()(RegexBraceClass.prototype, 'documented', descriptor);

        assert.equal(
            description.RegexBraceClass.methods.documented.description,
            'Documented after regex',
        );
        assert.equal(
            description.RegexBraceClass.methods.documented.returns.tsType,
            'string',
        );
    });

    it('should isolate the JSDoc type from braces in the description and keep object-literal types', () => {
        class BraceTypeClass {
            /**
             * Searches items
             *
             * @param {string} query - filter, for example `{ id, name }`
             * @param {{ x: number, y: number }} point - a point value
             * @return {string} - a marker like `{ ok }`
             */
            public search(query: string, point: { x: number; y: number }) {
                return `${query}:${point.x}`;
            }
        }

        const descriptor = Object.getOwnPropertyDescriptor(
            BraceTypeClass.prototype,
            'search',
        );

        expose()(BraceTypeClass.prototype, 'search', descriptor);

        const method = description.BraceTypeClass.methods.search;

        // a `}` inside the description must not extend the captured type
        assert.equal(method.arguments[0].tsType, 'string');
        assert.equal(method.arguments[0].name, 'query');
        // object-literal types (nested braces) must be preserved intact
        assert.equal(method.arguments[1].tsType, '{ x: number, y: number }');
        assert.equal(method.arguments[1].name, 'point');
        // a `}` inside the @return description must not corrupt the return type
        assert.equal(method.returns.tsType, 'string');
    });

    it('should extract method JSDoc from TypeScript source text', () => {
        // original .ts source: type annotations, generics, visibility
        // modifiers and decorators — none of which acorn can parse
        const src = [
            'export class TsSourceClass extends IMQService {',
            '    /**',
            '     * Authenticates a user',
            '     *',
            '     * @param {AuthenticateArgs} args - like `{ login, password }`',
            '     * @return {Promise<Authentication>} - session data',
            '     */',
            '    @expose()',
            '    public async authenticate(',
            '        args: AuthenticateArgs,',
            '    ): Promise<Authentication> {',
            '        return {} as Authentication;',
            '    }',
            '',
            '    /**',
            '     * @param {{ x: number, y: number }} point - a point',
            '     * @return {number}',
            '     */',
            '    protected calc<T>(point: { x: number; y: number }): number {',
            '        return 0;',
            '    }',
            '}',
            'class UnrelatedClass {',
            '    /** @return {string} */',
            '    public other() { return ""; }',
            '}',
        ].join('\n');

        const comments = parseSourceComments(src, 'TsSourceClass');

        assert.ok(comments.authenticate, 'authenticate doc not found');
        assert.match(comments.authenticate, /@param \{AuthenticateArgs\}/);
        assert.match(
            comments.authenticate,
            /@return \{Promise<Authentication>\}/,
        );
        assert.ok(comments.calc, 'calc doc not found');
        assert.match(comments.calc, /\{\{ x: number, y: number \}\}/);
        // members of other classes in the same file must not leak in
        assert.equal(comments.other, undefined);
    });

    it('should fall back to on-disk source when runtime comments are stripped', () => {
        class DevModeStrippedClass {
            /**
             * Does dev things
             *
             * @param {string} input - input value
             * @return {number} - result code
             */
            public devMethod(input: string) {
                return input.length;
            }
        }

        // simulate a comment-stripping dev transpiler (tsx/esbuild): the
        // runtime class source carries no JSDoc, while this file on disk
        // (located via the stack captured by the expose() factory) does
        Object.defineProperty(DevModeStrippedClass, 'toString', {
            value: () =>
                'class DevModeStrippedClass {\n' +
                '    devMethod(input) { return input.length; }\n' +
                '}',
        });

        const descriptor = Object.getOwnPropertyDescriptor(
            DevModeStrippedClass.prototype,
            'devMethod',
        );

        expose()(DevModeStrippedClass.prototype, 'devMethod', descriptor);

        const method = description.DevModeStrippedClass.methods.devMethod;

        assert.equal(method.description, 'Does dev things');
        assert.equal(method.arguments[0].name, 'input');
        assert.equal(method.arguments[0].tsType, 'string');
        assert.equal(method.returns.tsType, 'number');
    });

    it('should register the method via the legacy signature', () => {
        class LegacyExposeClass {
            /**
             * Legacy documented method
             *
             * @param {number} a - some number
             * @return {string}
             */
            public legacyMethod(a: number) {
                return String(a);
            }
        }

        const descriptor = Object.getOwnPropertyDescriptor(
            LegacyExposeClass.prototype,
            'legacyMethod',
        );

        // (target, propertyKey, descriptor) with no TC39 context object
        const result = expose()(
            LegacyExposeClass.prototype,
            'legacyMethod',
            descriptor,
        );

        assert.equal(result, descriptor);
        assert.notEqual(description.LegacyExposeClass, undefined);
        assert.equal(
            description.LegacyExposeClass.methods.legacyMethod.description,
            'Legacy documented method',
        );
    });

    it('should tolerate an unparseable class source', () => {
        class UnparseableExposeClass {
            public nativeLike() {}
        }

        // a bound/native function's toString is not valid JavaScript
        // (`[native code]` is a syntax error); the parser must swallow it and
        // still register the method with default metadata
        Object.defineProperty(UnparseableExposeClass, 'toString', {
            value: () => 'function nativeLike() { [native code] }',
        });

        const descriptor = Object.getOwnPropertyDescriptor(
            UnparseableExposeClass.prototype,
            'nativeLike',
        );

        assert.doesNotThrow(() =>
            expose()(
                UnparseableExposeClass.prototype,
                'nativeLike',
                descriptor,
            ),
        );
        assert.notEqual(description.UnparseableExposeClass, undefined);
        assert.notEqual(
            description.UnparseableExposeClass.methods.nativeLike,
            undefined,
        );
    });
});
