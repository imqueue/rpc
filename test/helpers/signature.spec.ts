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
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signature } from '../..';

describe('helpers/signature()', () => {
    it('should be a function', () => {
        assert.equal(typeof signature, 'function');
    });

    it('should return hash string', () => {
        assert.ok(/^[0-9a-f]{16,32}$/.test(signature('A', 'a', [])));
    });

    it('should return same hash string for the same arguments bypassed', () => {
        const hashOne: string = signature('A', 'a', []);
        const hashTwo: string = signature('A', 'a', []);

        assert.equal(hashOne, hashTwo);
    });

    it('should return different hash string for different args', () => {
        const hashOne: string = signature('A', 'a', []);
        const hashTwo: string = signature('A', 'b', []);
        const hashThree: string = signature('A', 'a', [1, 2, 3]);

        assert.notEqual(hashOne, hashTwo);
        assert.notEqual(hashTwo, hashThree);
        assert.notEqual(hashOne, hashThree);
    });
});
