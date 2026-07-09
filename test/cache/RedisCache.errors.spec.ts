/*!
 * RedisCache error branches: methods before init should throw
 */
import { RedisCache, REDIS_CLIENT_INIT_ERROR } from '../../index.js';
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

    it('init() rejects and logs when the connection errors', async () => {
        delete (RedisCache as any).redis;
        (RedisCache as any).initPromise = undefined;

        const cache: any = new RedisCache();
        const pending = cache.init();

        // the mock emits 'ready' on a later tick, so emitting 'error'
        // synchronously here reaches the reject branch first
        (RedisCache as any).redis.emit('error', new Error('connection boom'));

        await assert.rejects(pending, /connection boom/);

        // the failed attempt still left a live mock connection — close it so it
        // does not keep the process alive
        await RedisCache.destroy().catch(() => undefined);
        (RedisCache as any).initPromise = undefined;
    });
});
