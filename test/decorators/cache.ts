/*!
 * cache() Function Unit Tests
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
import { logger } from '../mocks';
import { expect } from 'chai';
import { RedisCache, cache } from '../..';
import { ILogger } from 'imq';

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

    before(() => obj = new CacheTestClass());
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
