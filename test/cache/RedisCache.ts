/*!
 * RedisCache Unit Tests
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
import { Redis, logger } from '../mocks';
import { expect } from 'chai';
import { RedisCache } from '../..';
import { uuid } from '@imqueue/core';

describe('cache/RedisCache', () => {
    it('should be a class', () => {
        expect(typeof RedisCache).to.equal('function');
    });

    describe('constructor()', () => {
        it('should not throw', () => {
            expect(() => new RedisCache()).not.to.throw;
        });
    });

    describe('init()', () => {
        beforeEach(() => { delete (<any>RedisCache).redis });

        it('should not throw without options', async () => {
            const cache = new RedisCache();

            expect(async () => await cache.init({ logger })).not.to.throw;
        });

        it('should re-use existing conn if given', async () => {
            let cache = new RedisCache();

            await cache.init({ logger });

            const oldConn = (<any>RedisCache).redis;

            cache = new RedisCache();

            await cache.init({ logger });

            expect(oldConn).to.equal((<any>RedisCache).redis);
        });

        it('should use connection from options if passed', async () => {
            const conn = new Redis();
            const cache = new RedisCache();

            await cache.init({ conn, logger });

            expect((<any>RedisCache).redis).to.equal(conn);
        });
    });

    describe('get()', () => {
        let cache: RedisCache;

        before(async() => {
            cache = new RedisCache();
            await cache.init({ logger });
        });

        after(async () => RedisCache.destroy());


        it('should return undefined if nothing found', async () => {
            expect(await cache.get(uuid())).to.be.undefined;
        });

        it('should return stored value if found', async () => {
            const key = uuid();
            await cache.set(key, 1000);
            expect(await cache.get(key)).to.equal(1000);
            await cache.set(key, { a: 'b' });
            expect(await cache.get(key)).to.deep.equal({ a: 'b' });
            await cache.set(key, false);
            expect(await cache.get(key)).to.be.false;
            await cache.set(key, null);
            expect(await cache.get(key)).to.be.null;
        });
    });

    describe('set()', () => {
        let cache: RedisCache;

        before(async() => {
            cache = new RedisCache();
            await cache.init({ logger });
        });

        after(async () => RedisCache.destroy());

        it('should not overwrite if asked', async () => {
            const key = uuid();
            await cache.set(key, 'initial value');
            expect(await cache.get(key)).to.equal('initial value');
            await cache.set(key, 'new value', undefined, true);
            expect(await cache.get(key)).to.equal('initial value');
        });

        it('should expire if ttl given', async () => {
            const key = uuid();
            await cache.set(key, 'initial value', 10);
            expect(await cache.get(key)).to.equal('initial value');
            await new Promise(resolve => setTimeout(async () => {
                resolve(expect(await cache.get(key)).to.be.undefined)
            }, 10));
        });
    });

    describe('del()', () => {
        it('should remove', async () => {
            const cache = new RedisCache();
            const key = uuid();
            await cache.init({ logger });
            await cache.set(key, 'value');
            await cache.del(key);
            expect(await cache.get(key)).to.be.undefined;
        });
    });

    describe('destroy()', () => {
        it('should destroy redis connection', async () => {
            new RedisCache();
            expect((<any>RedisCache).redis).to.be.ok;
            await RedisCache.destroy();
            expect((<any>RedisCache).redis).to.be.undefined;
        });
    });

});