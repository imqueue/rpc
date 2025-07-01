/*!
 * cache() Function Unit Tests
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
import { logger } from '../mocks';
import { expect } from 'chai';
import { RedisCache, cache } from '../..';
import { ILogger } from '@imqueue/core';

class CacheTestClass {

    // noinspection JSUnusedLocalSymbols
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

    before(() => { obj = new CacheTestClass() });
    after(async () => await RedisCache.destroy());

    it('should be a function', () => {
        expect(typeof cache).to.equal('function');
    });

    it('should return decorator function', () => {
        expect(typeof cache()).to.equal('function');
    });

    it('should cache method execution result', async () => {
        const callOne = await obj.testMethod();
        const callTwo = await obj.testMethod();

        const callThree = await obj.testMethod(1);
        const callFour = await obj.testMethod(1);

        expect(callOne).to.be.equal(callTwo);
        expect(callThree).to.be.equal(callFour);
    });

    it('should expire if ttl specified', async () => {
        const callOne = await obj.testMethodWithTTL();
        const callTwo = await obj.testMethodWithTTL();

        expect(callOne).to.equal(callTwo);

        await (async () => setTimeout(async () => {
            const callThree = await obj.testMethodWithTTL();

            expect(callThree).not.to.equal(callOne);
        }, 100));
    });
});
