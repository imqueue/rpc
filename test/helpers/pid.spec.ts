/*!
 * pid(), forgetPid() Functions Unit Tests
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
import { logger } from '../mocks/index.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { pid, forgetPid, IMQ_TMP_DIR } from '../../src/helpers/index.js';
import { randomUUID as uuid } from 'node:crypto';
import {
    existsSync,
    lstatSync,
    readdirSync,
    rmdirSync,
    unlinkSync,
} from 'node:fs';

function rmdirr(path: string) {
    if (existsSync(path)) {
        readdirSync(path).forEach(file => {
            const curPath = `${path}/${file}`;

            if (lstatSync(curPath).isDirectory()) {
                rmdirr(curPath);
            } else {
                unlinkSync(curPath);
            }
        });

        rmdirSync(path);
    }
}

describe('helpers/pid()', () => {
    let TEST_PID_DIR: string;

    beforeEach(() => {
        TEST_PID_DIR = `${IMQ_TMP_DIR}/${uuid()}`;
    });
    afterEach(() => {
        rmdirr(TEST_PID_DIR);
    });

    it('should be a function', () => {
        assert.equal(typeof pid, 'function');
    });

    it('should return pid file numeric incremental identifier', () => {
        const name: string = 'TestPidFile';

        assert.equal(pid(name, TEST_PID_DIR), 0);
        assert.equal(pid(name, TEST_PID_DIR), 1);
        assert.equal(pid(name, TEST_PID_DIR), 2);
    });

    it('should re-use free identifiers', () => {
        const name: string = 'TestPidFile';

        assert.equal(pid(name, TEST_PID_DIR), 0);
        assert.equal(pid(name, TEST_PID_DIR), 1);
        assert.equal(pid(name, TEST_PID_DIR), 2);
        unlinkSync(`${TEST_PID_DIR}/${name}-1.pid`);
        assert.equal(pid(name, TEST_PID_DIR), 1);
    });

    it('should not re-use an identifier this process gave back', () => {
        const name: string = 'TestPidFile';

        // the identifier is the only part of a client's queue name that tells
        // two clients of the same service apart, and the queue of a destroyed
        // client still has a reader blocked on it, which would swallow the
        // first reply addressed to whoever took the name over next
        assert.equal(pid(name, TEST_PID_DIR), 0);

        forgetPid(name, 0, logger, TEST_PID_DIR);

        assert.equal(pid(name, TEST_PID_DIR), 1);

        forgetPid(name, 1, logger, TEST_PID_DIR);

        assert.equal(pid(name, TEST_PID_DIR), 2);
    });

    it('should keep retired identifiers apart per name and directory', () => {
        const other: string = `${IMQ_TMP_DIR}/${uuid()}`;

        try {
            assert.equal(pid('One', TEST_PID_DIR), 0);
            forgetPid('One', 0, logger, TEST_PID_DIR);

            // a different service name is unaffected...
            assert.equal(pid('Two', TEST_PID_DIR), 0);
            // ...as is the same name kept somewhere else
            assert.equal(pid('One', other), 0);
        } finally {
            rmdirr(other);
        }
    });
});

describe('helpers/forgetPid()', () => {
    let TEST_PID_DIR: string;

    beforeEach(() => {
        TEST_PID_DIR = `${IMQ_TMP_DIR}/${uuid()}`;
    });
    afterEach(() => {
        rmdirr(TEST_PID_DIR);
    });

    it('should be a function', () => {
        assert.equal(typeof forgetPid, 'function');
    });

    it('should free-up pid file', () => {
        const name: string = 'TestPidFile';
        const id: number = pid(name, TEST_PID_DIR);

        forgetPid(name, id, logger, TEST_PID_DIR);

        assert.ok(!existsSync(`${TEST_PID_DIR}/${name}-0.pid`));
    });

    it('should ignore a missing pid file', () => {
        assert.doesNotThrow(() =>
            forgetPid('DoesNotExist', 999, logger, TEST_PID_DIR),
        );
    });
});
