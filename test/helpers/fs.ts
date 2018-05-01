/*!
 * FS helpers Unit Tests
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

