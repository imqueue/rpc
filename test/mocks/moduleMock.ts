/*!
 * IMQ-RPC Unit Test Mocks: native module-mock helper
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
import { mock, MockModuleOptions } from 'node:test';

/**
 * Builds `mock.module()` options for the running Node version. Node 24+ takes
 * the mock's exports through the `exports` option (a `default` key is the
 * default export; for CJS/builtin consumers `module.exports` becomes that
 * value), and deprecated the earlier `defaultExport`/`namedExports` pair.
 * Node 22 only understands the earlier pair, so the same exports shape is
 * translated there.
 *
 * `cache: true` keeps mock-require's semantics: every `require()` of the
 * mocked specifier returns the same module instance, so a test may patch a
 * property in place and the code under test observes the change.
 *
 * @param {Record<string, unknown>} exports - mock exports, `default` key being
 *                                            the default export
 * @returns {MockModuleOptions}
 */
export function moduleMockOptions(
    exports: Record<string, unknown>,
): MockModuleOptions {
    if (+process.versions.node.split('.')[0] >= 24) {
        // typings (@types/node 24.x) lag the runtime's `exports` option
        return { cache: true, exports } as MockModuleOptions;
    }

    const { default: defaultExport, ...namedExports } = exports;
    const options: MockModuleOptions = { cache: true };

    if (defaultExport !== undefined) {
        options.defaultExport = defaultExport;
    }

    if (Object.keys(namedExports).length) {
        options.namedExports = namedExports;
    }

    return options;
}

/**
 * Registers a native `node:test` module mock whose CommonJS `module.exports`
 * (and ESM default export) is `value`. Requires `--experimental-test-module-mocks`.
 *
 * @param {string} specifier - the module specifier to mock
 * @param {unknown} value - the value `require(specifier)` should return
 * @returns {{ restore(): void }} - handle to undo the mock
 */
export function mockModule(
    specifier: string,
    value: unknown,
): { restore(): void } {
    return mock.module(specifier, moduleMockOptions({ default: value }));
}
