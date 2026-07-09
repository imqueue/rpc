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
import { Redis, logger } from '../mocks/index.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCache } from '../../index.js';
import { IRedisClient } from '@imqueue/core';
import { randomUUID as uuid } from 'node:crypto';

describe('cache/RedisCache', () => {
    it('should be a class', () => {
        assert.equal(typeof RedisCache, 'function');
    });

    describe('constructor()', () => {
        it('should not throw', () => {
            assert.doesNotThrow(() => new RedisCache());
        });
    });

    describe('init()', () => {
        beforeEach(() => {
            delete (<any>RedisCache).redis;
            delete (<any>RedisCache).initPromise;
        });

        it('should not throw without options', async () => {
            const cache = new RedisCache();

            assert.doesNotThrow(async () => await cache.init({ logger }));
        });

        it('should re-use existing conn if given', async () => {
            let cache = new RedisCache();

            await cache.init({ logger });

            const oldConn = (<any>RedisCache).redis;

            cache = new RedisCache();

            await cache.init({ logger });

            assert.equal(oldConn, (<any>RedisCache).redis);
        });

        it('should use connection from options if passed', async () => {
            const conn = new Redis() as unknown as IRedisClient;
            const cache = new RedisCache();

            await cache.init({ conn, logger });

            assert.equal((<any>RedisCache).redis, conn);
        });
    });

    describe('get()', () => {
        let cache: RedisCache;

        before(async () => {
            cache = new RedisCache();
            await cache.init({ logger });
        });

        after(async () => RedisCache.destroy());

        it('should return undefined if nothing found', async () => {
            assert.equal(await cache.get(uuid()), undefined);
        });

        it('should return stored value if found', async () => {
            const key = uuid();
            await cache.set(key, 1000);
            assert.equal(await cache.get(key), 1000);
            await cache.set(key, { a: 'b' });
            assert.deepEqual(await cache.get(key), { a: 'b' });
            await cache.set(key, false);
            assert.equal(await cache.get(key), false);
            await cache.set(key, null);
            assert.equal(await cache.get(key), null);
        });
    });

    describe('set()', () => {
        let cache: RedisCache;

        before(async () => {
            cache = new RedisCache();
            await cache.init({ logger });
        });

        after(async () => RedisCache.destroy());

        it('should not overwrite if asked', async () => {
            const key = uuid();
            await cache.set(key, 'initial value');
            assert.equal(await cache.get(key), 'initial value');
            await cache.set(key, 'new value', undefined, true);
            assert.equal(await cache.get(key), 'initial value');
        });

        it('should expire if ttl given', async () => {
            const key = uuid();
            await cache.set(key, 'initial value', 10);
            assert.equal(await cache.get(key), 'initial value');
            await new Promise(resolve =>
                setTimeout(async () => {
                    resolve(assert.equal(await cache.get(key), undefined));
                }, 10),
            );
        });
    });

    describe('del()', () => {
        it('should remove', async () => {
            const cache = new RedisCache();
            const key = uuid();
            await cache.init({ logger });
            await cache.set(key, 'value');
            await cache.del(key);
            assert.equal(await cache.get(key), undefined);
        });
    });

    describe('destroy()', () => {
        it('should destroy redis connection', async () => {
            new RedisCache();
            assert.ok((<any>RedisCache).redis);
            await RedisCache.destroy();
            assert.equal((<any>RedisCache).redis, undefined);
        });
    });
});
