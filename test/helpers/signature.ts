/*!
 * signature() Function Unit Tests
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
import '../mocks';
import { expect } from 'chai';
import { signature } from '../..';

describe('helpers/signature()', () => {
    it('should be a function', () => {
        expect(typeof signature).to.equal('function');
    });

    it('should return hash string', () => {
        expect(/^[0-9a-f]{16,32}$/.test(signature('A', 'a', []))).to.be.true;
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
