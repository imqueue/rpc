/*!
 * IMQDelay Unit Tests
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
