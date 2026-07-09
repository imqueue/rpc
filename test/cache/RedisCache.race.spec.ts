/*!
 * RedisCache concurrent-initialization tests
 */
import '../mocks/index.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCache } from '../../index.js';
import { RedisClientMock } from '../mocks/index.js';
import { logger } from '../mocks/index.js';

describe('cache/RedisCache concurrent init', () => {
    beforeEach(async () => {
        await RedisCache.destroy();
    });

    it('should open a single connection for concurrent init() calls', async () => {
        const before = RedisClientMock.__constructed;
        const one = new RedisCache();
        const two = new RedisCache();

        await Promise.all([one.init({ logger }), two.init({ logger })]);

        assert.equal(
            RedisClientMock.__constructed - before,
            1,
            'concurrent init() must share one connection, not open two',
        );
        assert.equal(one.ready, true);
        assert.equal(two.ready, true);
    });

    it('should allow re-initialization after destroy()', async () => {
        const one = new RedisCache();

        await one.init({ logger });
        await RedisCache.destroy();

        const two = new RedisCache();

        await two.init({ logger });

        assert.equal(two.ready, true);
    });
});
