/*!
 * IMQDelay Unit Tests
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
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
import './mocks';
import { expect } from 'chai';
import { IMQDelay } from '..';

describe('IMQDelay', () => {
    it('should be a class', () => {
        expect(typeof IMQDelay).to.equal('function');
    });

    describe('constructor()', () => {
        it('should construct ms time from given args', () => {
            expect(new IMQDelay(5).ms).to.equal(5);
            expect(new IMQDelay(5, 'ms').ms).to.equal(5);
            expect(new IMQDelay(5, 's').ms).to.equal(5000);
            expect(new IMQDelay(5, 'm').ms).to.equal(300000);
            expect(new IMQDelay(5, 'h').ms).to.equal(3600*5000);
            expect(new IMQDelay(5, 'd').ms).to.equal(86400*5000);
        });
    });
});
