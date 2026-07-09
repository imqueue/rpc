/*!
 * osUuid() Function Unit Tests
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
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { osUuid } from '../../src/helpers/index.js';

// The helper under test reads the live `require('node:child_process')` object at
// call time, so we mock that same object via import-equals (an `import * as`
// namespace copy under esModuleInterop would not be the object it reads).
import childProcess = require('node:child_process');
import { syncBuiltinESMExports } from 'node:module';

// osUuid memoizes its result at module level, so the per-platform parsing
// tests below load a FRESH copy of the module after mocking the platform and
// execSync — otherwise the first test's cached id would leak into the rest.
// The ES module registry is immutable, so freshness comes from a unique
// query string; syncBuiltinESMExports() publishes the execSync stub to the
// named-import binding the fresh copy links against.
let osUuidReload = 0;

async function freshOsUuid(): Promise<() => string> {
    syncBuiltinESMExports();

    const href = new URL('../../src/helpers/os-uuid.js', import.meta.url).href;

    return (await import(`${href}?reload=${++osUuidReload}`)).osUuid;
}

describe('helpers/osUuid()', () => {
    const realPlatform = process.platform;
    const realArch = process.arch;

    afterEach(() => {
        mock.restoreAll();
        syncBuiltinESMExports();
        Object.defineProperty(process, 'platform', { value: realPlatform });
        Object.defineProperty(process, 'arch', { value: realArch });
        delete process.env.PROCESSOR_ARCHITEW6432;
    });

    it('should be a function', () => {
        assert.equal(typeof osUuid, 'function');
    });

    it('should return same id for each call', () => {
        assert.equal(osUuid(), osUuid());
    });

    it('should return the raw, lower-cased machine id', () => {
        const id = osUuid();

        assert.equal(typeof id, 'string');
        assert.ok(id.length > 0);
        assert.equal(id, id.toLowerCase());
    });

    it('should memoize the machine id and shell out only once', async () => {
        const spy = mock.method(
            childProcess,
            'execSync',
            () => 'ab12cd34ef567890abcdef1234567890\n',
        );
        const uuid = await freshOsUuid();

        assert.equal(uuid(), uuid());
        assert.equal(
            spy.mock.callCount(),
            1,
            'the machine id command must run only once per process',
        );
    });

    it('should read and parse the darwin IOPlatformUUID', async () => {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        const spy = mock.method(
            childProcess,
            'execSync',
            () =>
                '  "IOPlatformUUID" = "AB12CD34-0000-1111-2222-33445566EE77"\n',
        );

        assert.equal(
            (await freshOsUuid())(),
            'ab12cd34-0000-1111-2222-33445566ee77',
        );
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /ioreg -rd1 -c IOPlatformExpertDevice/,
        );
    });

    it('should read and parse the win32 MachineGuid', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const spy = mock.method(
            childProcess,
            'execSync',
            () =>
                '\r\nHKEY_LOCAL_MACHINE\\...\\Cryptography\r\n' +
                '    MachineGuid    REG_SZ    AB12CD34-DEAD-BEEF\r\n',
        );

        assert.equal((await freshOsUuid())(), 'ab12cd34-dead-beef');
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /REG\.exe QUERY .*Cryptography \/v MachineGuid/,
        );
    });

    it('should read and parse the linux machine-id', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const spy = mock.method(
            childProcess,
            'execSync',
            () => 'AB12CD34EF567890ABCDEF1234567890\n',
        );

        assert.equal(
            (await freshOsUuid())(),
            'ab12cd34ef567890abcdef1234567890',
        );
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /\/etc\/machine-id/,
        );
    });

    it('should build the freebsd command', async () => {
        Object.defineProperty(process, 'platform', { value: 'freebsd' });
        const spy = mock.method(childProcess, 'execSync', () => 'ABCDEF12\n');

        assert.equal((await freshOsUuid())(), 'abcdef12');
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /kenv -q smbios\.system\.uuid/,
        );
    });

    it('should throw for an unsupported platform', async () => {
        Object.defineProperty(process, 'platform', { value: 'aix' });

        const uuid = await freshOsUuid();

        assert.throws(() => uuid(), /Unsupported platform/);
    });

    it('should use the sysnative redirector for 32-bit on 64-bit windows', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        Object.defineProperty(process, 'arch', { value: 'ia32' });
        process.env.PROCESSOR_ARCHITEW6432 = 'AMD64';
        const spy = mock.method(
            childProcess,
            'execSync',
            () => 'MachineGuid  REG_SZ  AB12CD34\r\n',
        );

        (await freshOsUuid())();

        assert.match(spy.mock.calls[0].arguments[0] as string, /sysnative/);
    });
});
