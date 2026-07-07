/*!
 * cache() Function Unit Tests
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
import { logger } from '../mocks';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCache, cache } from '../..';
import { ILogger } from '@imqueue/core';

class CacheTestClass {
    private logger: ILogger = logger;

    @cache()
    public async testMethod() {
        return Math.random() * Math.random() + Math.random();
    }

    @cache({ ttl: 100 })
    public async testMethodWithTTL() {
        return Math.random() * Math.random() + Math.random();
    }
}

describe('decorators/cache()', () => {
    let obj: any;

    before(() => {
        obj = new CacheTestClass();
    });
    after(async () => await RedisCache.destroy());

    it('should be a function', () => {
        assert.equal(typeof cache, 'function');
    });

    it('should return decorator function', () => {
        assert.equal(typeof cache(), 'function');
    });

    it('should cache method execution result', async () => {
        const callOne = await obj.testMethod();
        const callTwo = await obj.testMethod();

        const callThree = await obj.testMethod(1);
        const callFour = await obj.testMethod(1);

        assert.equal(callOne, callTwo);
        assert.equal(callThree, callFour);
    });

    it('should expire if ttl specified', async () => {
        const callOne = await obj.testMethodWithTTL();
        const callTwo = await obj.testMethodWithTTL();

        assert.equal(callOne, callTwo);

        await (async () =>
            setTimeout(async () => {
                const callThree = await obj.testMethodWithTTL();

                assert.notEqual(callThree, callOne);
            }, 100));
    });
});
