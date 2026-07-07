/*!
 * IMQDelay Unit Tests
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
import './mocks';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IMQDelay } from '..';

describe('IMQDelay', () => {
    it('should be a class', () => {
        assert.equal(typeof IMQDelay, 'function');
    });

    describe('constructor()', () => {
        it('should construct ms time from given args', () => {
            assert.equal(new IMQDelay(5).ms, 5);
            assert.equal(new IMQDelay(5, 'ms').ms, 5);
            assert.equal(new IMQDelay(5, 's').ms, 5000);
            assert.equal(new IMQDelay(5, 'm').ms, 300000);
            assert.equal(new IMQDelay(5, 'h').ms, 3600 * 5000);
            assert.equal(new IMQDelay(5, 'd').ms, 86400 * 5000);
        });
    });
});
