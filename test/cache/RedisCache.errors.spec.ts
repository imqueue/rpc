/*!
 * RedisCache error branches: methods before init should throw
 */
import { RedisCache, REDIS_CLIENT_INIT_ERROR } from '../..';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('cache/RedisCache errors when not initialized', () => {
    beforeEach(() => {
        delete (RedisCache as any).redis;
    });

    it('get() should throw if redis not initialized', async () => {
        const cache = new RedisCache();
        let threw = false;
        try {
            await cache.get('x');
        } catch (e: any) {
            threw = true;
            assert.ok(e instanceof TypeError);
            assert.equal(e.message, REDIS_CLIENT_INIT_ERROR);
        }
        assert.equal(threw, true);
    });

    it('set() should throw if redis not initialized', async () => {
        const cache = new RedisCache();
        let threw = false;
        try {
            await cache.set('x', 1);
        } catch (e: any) {
            threw = true;
            assert.ok(e instanceof TypeError);
            assert.equal(e.message, REDIS_CLIENT_INIT_ERROR);
        }
        assert.equal(threw, true);
    });

    it('del() should throw if redis not initialized', async () => {
        const cache = new RedisCache();
        let threw = false;
        try {
            await cache.del('x');
        } catch (e: any) {
            threw = true;
            assert.ok(e instanceof TypeError);
            assert.equal(e.message, REDIS_CLIENT_INIT_ERROR);
        }
        assert.equal(threw, true);
    });

    it('purge() should throw if redis not initialized', async () => {
        const cache = new RedisCache();
        let threw = false;
        try {
            await cache.purge('mask');
        } catch (e: any) {
            threw = true;
            assert.ok(e instanceof TypeError);
            assert.equal(e.message, REDIS_CLIENT_INIT_ERROR);
        }
        assert.equal(threw, true);
    });
});
