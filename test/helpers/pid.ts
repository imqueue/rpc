/*!
 * pid(), forgetPid() Functions Unit Tests
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
import { pid, forgetPid, IMQ_TMP_DIR, uuid } from '../..';
import { logger } from '../mocks';
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

    beforeEach(() => TEST_PID_DIR = `${IMQ_TMP_DIR}/${uuid()}`);
    afterEach(() => rmdirr(TEST_PID_DIR));

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

    beforeEach(() => TEST_PID_DIR = `${IMQ_TMP_DIR}/${uuid()}`);
    afterEach(() => rmdirr(TEST_PID_DIR));

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
