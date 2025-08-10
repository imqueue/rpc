/*!
 * RedisCache additional coverage: purge() and set() with Promise
 */
import { expect } from 'chai';
import { RedisCache } from '../..';

class FakeRedis {
  // minimal in-memory store
  private store = new Map<string, string>();
  public status: string = 'ready';
  public connected: boolean = true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public on(event: string, listener: (...args: any[]) => void): any { return this }
  public once?: any;
  public emit?: any;
  public removeAllListeners(): void {}
  public disconnect(_reconnect: boolean): void {}
  public quit(): void {}
  public end?(): void {}

  public async set(key: string, val: string, ..._args: any[]): Promise<any> {
    this.store.set(key, val);
    return true;
  }
  public async get(key: string, ..._args: any[]): Promise<any> {
    return this.store.get(key) as any;
  }
  public async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }
  public async eval(script: string, _numkeys: number, ..._args: any[]): Promise<any> {
    // Extract mask from: redis.call('keys','<MASK>')
    const m = script.match(/redis\.call\('keys','([^']*)'\)/);
    const mask = m ? m[1] : '';
    if (mask.endsWith('*')) {
      const prefix = mask.slice(0, -1);
      for (const key of Array.from(this.store.keys())) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
        }
      }
    } else if (mask) {
      this.store.delete(mask);
    }
    return true;
  }
}

class ErrorEvalRedis extends FakeRedis {
  public async eval(): Promise<any> {
    throw new Error('eval failed');
  }
}

describe('cache/RedisCache purge() and set() with Promise', () => {
  afterEach(async () => {
    await RedisCache.destroy();
  });

  it('purge() should delete keys by wildcard and return true', async () => {
    const conn = new FakeRedis();
    const cache = new RedisCache();
    await cache.init({ conn: conn as any, prefix: 'cov-cache', logger: console as any });

    // prepare some keys
    await cache.set('keep', 'x'); // fully qualified: cov-cache:RedisCache:keep
    await cache.set('del1', 1);
    await cache.set('del2', 2);

    // unrelated key stored directly in connection should not be removed
    await conn.set('other:namespace:key', 'y');

    const mask = `${cache.options.prefix}:${cache.name}:del*`;
    const ok = await cache.purge(mask);
    expect(ok).to.equal(true);

    // del* gone, keep remains, and unrelated stays
    expect(await cache.get('del1')).to.equal(undefined);
    expect(await cache.get('del2')).to.equal(undefined);
    expect(await cache.get('keep')).to.equal('x');
    // Sanity: unrelated
    expect(await (conn as any).get('other:namespace:key')).to.equal('y');
  });

  it('purge() should return false and log when eval throws', async () => {
    const conn = new ErrorEvalRedis();
    const cache = new RedisCache();
    const logs: any[] = [];
    const logger = { info: () => {}, error: (e: any) => logs.push(e) } as any;
    await cache.init({ conn: conn as any, prefix: 'cov-cache', logger });
    const res = await cache.purge('cov-cache:RedisCache:*');
    expect(res).to.equal(false);
    expect(logs.length).to.be.greaterThan(0);
  });

  it('set() should accept Promise value and store resolved value', async () => {
    const conn = new FakeRedis();
    const cache = new RedisCache();
    await cache.init({ conn: conn as any, prefix: 'cov-cache', logger: console as any });

    const key = 'promised';
    const valuePromise = new Promise<number>((resolve) => setTimeout(() => resolve(42), 1));
    await cache.set(key, valuePromise);
    expect(await cache.get(key)).to.equal(42);
  });

  it('del() should return boolean false when key did not exist', async () => {
    const conn = new FakeRedis();
    const cache = new RedisCache();
    await cache.init({ conn: conn as any, prefix: 'cov-cache', logger: console as any });

    const res = await cache.del('missing');
    expect(res).to.equal(false);
  });
});
