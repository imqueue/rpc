/*!
 * FS helpers Unit Tests
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
import * as mock from 'mock-require';
import { expect } from 'chai';

const fsMock = {
    access(path: string, cb: (err?: Error) => void) {
         if (path === 'exist') {
            cb();
         }
         if (path === 'unexist') {
            cb(new Error);
         }
    },
    mkdir(path: string, cb: (err?: | Error) => void) {
         if (path === 'done') {
            cb();
         }
         if (path === 'error') {
            cb(new Error);
         }
    },
    writeFile(
        path: string,
        content: string,
        options: { [ key: string ]: string },
        cb: (err?: Error) => void
   ) {
         if (path === 'done') {
            cb();
         }
         if (path === 'error') {
            cb(new Error);
         }
    },
};

let fileExists: (path: string) => Promise<boolean>;
let mkdir: (path: string) => Promise<void>;
let writeFile: (path: string, content: string) => Promise<void>;

describe('fs helpers', () => {
    before (function before() {
        mock('fs', fsMock);
        delete require.cache[require.resolve('../../src/helpers/fs')];
        const fs = require('../../src/helpers/fs');
        fileExists = fs.fileExists;
        mkdir = fs.mkdir;
        writeFile = fs.writeFile;
    });
    after(() => {
        mock.stop('fs');
    });

    it('should check file existance', () =>
        fileExists('exist').then((status: boolean) => expect(status).to.be.true));

    it('should check file unexistance', () =>
        fileExists('unexist').then((status: boolean) => expect(status).to.be.false));

    it('should mkdir', () => mkdir('done'));

    it('should mkdir with error', () =>
        mkdir('error').catch((err: Error) => expect(err).to.be.an.instanceof(Error)));

    it('should write file', async () => writeFile('done', ''));

    it('should write file with error', () =>
        writeFile('error', '').catch((err: Error) => expect(err).to.be.an.instanceof(Error)));
});

