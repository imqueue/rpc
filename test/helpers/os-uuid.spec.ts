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
import '../mocks';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { osUuid } from '../..';

// The helper under test reads the live `require('child_process')` object at
// call time, so we mock that same object (not an `import * as` namespace copy).
const childProcess: typeof import('child_process') = require('child_process');

describe('helpers/osUuid()', () => {
    const realPlatform = process.platform;

    afterEach(() => {
        mock.restoreAll();
        Object.defineProperty(process, 'platform', { value: realPlatform });
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

    it('should read and parse the darwin IOPlatformUUID', () => {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        const spy = mock.method(
            childProcess,
            'execSync',
            () =>
                '  "IOPlatformUUID" = "AB12CD34-0000-1111-2222-33445566EE77"\n',
        );

        assert.equal(osUuid(), 'ab12cd34-0000-1111-2222-33445566ee77');
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /ioreg -rd1 -c IOPlatformExpertDevice/,
        );
    });

    it('should read and parse the win32 MachineGuid', () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const spy = mock.method(
            childProcess,
            'execSync',
            () =>
                '\r\nHKEY_LOCAL_MACHINE\\...\\Cryptography\r\n'
                + '    MachineGuid    REG_SZ    AB12CD34-DEAD-BEEF\r\n',
        );

        assert.equal(osUuid(), 'ab12cd34-dead-beef');
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /REG\.exe QUERY .*Cryptography \/v MachineGuid/,
        );
    });

    it('should read and parse the linux machine-id', () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const spy = mock.method(
            childProcess,
            'execSync',
            () => 'AB12CD34EF567890ABCDEF1234567890\n',
        );

        assert.equal(osUuid(), 'ab12cd34ef567890abcdef1234567890');
        assert.match(
            spy.mock.calls[0].arguments[0] as string,
            /\/etc\/machine-id/,
        );
    });
});
