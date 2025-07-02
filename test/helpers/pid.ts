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
import { logger } from '../mocks';
import { expect } from 'chai';
import { pid, forgetPid, IMQ_TMP_DIR, uuid } from '../..';
import * as fs from 'fs';

function rmdirr(path: string) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach((file) => {
            const curPath = `${path}/${file}`;

            if (fs.lstatSync(curPath).isDirectory()) {
                rmdirr(curPath);
            }

            else {
                fs.unlinkSync(curPath);
            }
        });

        fs.rmdirSync(path);
    }
}

describe('helpers/pid()', () => {
    let TEST_PID_DIR: string;

    beforeEach(() => { TEST_PID_DIR = `${IMQ_TMP_DIR}/${uuid()}` });
    afterEach(() => { rmdirr(TEST_PID_DIR) });

    it('should be a function', () => {
        expect(typeof pid).to.equal('function');
    });

    it('should return pid file numeric incremental identifier', () => {
        const name: string = 'TestPidFile';

        expect(pid(name, TEST_PID_DIR)).to.equal(0);
        expect(pid(name, TEST_PID_DIR)).to.equal(1);
        expect(pid(name, TEST_PID_DIR)).to.equal(2);
    });

    it('should re-use free identifiers', () => {
        const name: string = 'TestPidFile';

        expect(pid(name, TEST_PID_DIR)).to.equal(0);
        expect(pid(name, TEST_PID_DIR)).to.equal(1);
        expect(pid(name, TEST_PID_DIR)).to.equal(2);
        fs.unlinkSync(`${TEST_PID_DIR}/${name}-1.pid`);
        expect(pid(name, TEST_PID_DIR)).to.equal(1);
    });
});

describe('helpers/forgetPid()', () => {
    let TEST_PID_DIR: string;

    beforeEach(() => { TEST_PID_DIR = `${IMQ_TMP_DIR}/${uuid()}` });
    afterEach(() => { rmdirr(TEST_PID_DIR) });

    it('should be a function', () => {
        expect(typeof forgetPid).to.equal('function');
    });

    it('should free-up pid file', () => {
        const name: string = 'TestPidFile';
        const id: number = pid(name, TEST_PID_DIR);

        forgetPid(name, id, logger, TEST_PID_DIR);

        expect(fs.existsSync(`${TEST_PID_DIR}/${name}-0.pid`)).not.to.be.ok;
    });
});
