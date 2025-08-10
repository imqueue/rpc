/*!
 * RedisCache error branches: methods before init should throw
 */
import { expect } from 'chai';
import { RedisCache, REDIS_CLIENT_INIT_ERROR } from '../..';

describe('cache/RedisCache errors when not initialized', () => {
  beforeEach(() => { delete (RedisCache as any).redis; });

  it('get() should throw if redis not initialized', async () => {
    const cache = new RedisCache();
    let threw = false;
    try {
      await cache.get('x');
    } catch (e: any) {
      threw = true;
      expect(e).to.be.instanceOf(TypeError);
      expect(e.message).to.equal(REDIS_CLIENT_INIT_ERROR);
    }
    expect(threw).to.equal(true);
  });

  it('set() should throw if redis not initialized', async () => {
    const cache = new RedisCache();
    let threw = false;
    try {
      await cache.set('x', 1);
    } catch (e: any) {
      threw = true;
      expect(e).to.be.instanceOf(TypeError);
      expect(e.message).to.equal(REDIS_CLIENT_INIT_ERROR);
    }
    expect(threw).to.equal(true);
  });

  it('del() should throw if redis not initialized', async () => {
    const cache = new RedisCache();
    let threw = false;
    try {
      await cache.del('x');
    } catch (e: any) {
      threw = true;
      expect(e).to.be.instanceOf(TypeError);
      expect(e.message).to.equal(REDIS_CLIENT_INIT_ERROR);
    }
    expect(threw).to.equal(true);
  });

  it('purge() should throw if redis not initialized', async () => {
    const cache = new RedisCache();
    let threw = false;
    try {
      await cache.purge('mask');
    } catch (e: any) {
      threw = true;
      expect(e).to.be.instanceOf(TypeError);
      expect(e.message).to.equal(REDIS_CLIENT_INIT_ERROR);
    }
    expect(threw).to.equal(true);
  });
});
