/*!
 * signature() Function Unit Tests
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
import '../mocks';
import { expect } from 'chai';
import { signature } from '../..';

describe('helpers/signature()', () => {
    it('should be a function', () => {
        expect(typeof signature).to.equal('function');
    });

    it('should return hash string', () => {
        expect(/^[0-9a-f]{32}$/.test(signature('A', 'a', []))).to.be.true;
    });

    it('should return same hash string for the same arguments bypassed', () => {
        const hashOne: string = signature('A', 'a', []);
        const hashTwo: string = signature('A', 'a', []);

        expect(hashOne).to.equal(hashTwo);
    });

    it('should return different hash string for different args', () => {
        const hashOne: string = signature('A', 'a', []);
        const hashTwo: string = signature('A', 'b', []);
        const hashThree: string = signature('A', 'a', [1,2,3]);

        expect(hashOne).not.to.equal(hashTwo);
        expect(hashTwo).not.to.equal(hashThree);
        expect(hashOne).not.to.equal(hashThree);
    });
});
