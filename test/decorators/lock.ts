/*!
 * lock() Function Unit Tests
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
import { lock } from '../..';

class TestLockClass {

    @lock()
    public async dynamicLock() {
        return Math.random() * Math.random() + Math.random();
    }

    @lock()
    public static async staticLock() {
        return Math.random() * Math.random() + Math.random();
    }

    @lock()
    public static nonPromised() {
        return Math.random() * Math.random() + Math.random();
    }

    @lock()
    public static async rejected() {
        throw new Error('Rejected!');
    }

}

describe('decorators/lock()', () => {
    it('should be a function', () => {
        expect(typeof lock).to.equal('function');
    });

    it('should return decorator function', () => {
        expect(typeof lock()).to.equal('function');
    });

    it('should resolve all called with the first resolved', async  () => {
        const obj = new TestLockClass();
        const results = [...new Set(await Promise.all(
            new Array(10).fill(0).map(() => obj.dynamicLock())
        ))];
        expect(results.length).to.equal(1);
    });

    it('should work for static methods as well', async  () => {
        const results = [...new Set(await Promise.all(
            new Array(10).fill(0).map(() => TestLockClass.staticLock())
        ))];
        expect(results.length).to.equal(1);
    });

    it('should work with non-promised methods as well', async () => {
        const results = [...new Set(await Promise.all(
            new Array(10).fill(0).map(() => TestLockClass.nonPromised())
        ))];
        expect(results.length).to.equal(1);
    });

    it('should be turned off if DISABLE_LOCKS env var set', async () => {
        process.env['DISABLE_LOCKS'] = '1';
        const results = [...new Set(await Promise.all(
            new Array(10).fill(0).map(() => TestLockClass.staticLock())
        ))];
        expect(results.length).to.equal(10);
    });
});
