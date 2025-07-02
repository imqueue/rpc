/*!
 * RedisCache Unit Tests
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
import { Redis, logger } from '../mocks';
import { expect } from 'chai';
import { RedisCache } from '../..';
import { IRedisClient, uuid } from '@imqueue/core';

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
            const conn = new Redis() as unknown as IRedisClient;
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