/*!
 * cache() Function Unit Tests
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
import { logger } from '../mocks/index.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCache, cache, IMQCache } from '../../index.js';
import { ILogger } from '@imqueue/core';

class CacheTestClass {
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

// minimal in-memory adapter used to exercise the decorator's init/error paths
// without touching a real redis connection
class MemoryAdapter {
    public name = 'MemoryAdapter';
    public ready = false;
    public logger: any = logger;
    public initOptions: any;
    public throwOnGet = false;

    public init(options?: any): void {
        this.initOptions = options;
        this.ready = true;
    }
    public async get(): Promise<any> {
        if (this.throwOnGet) {
            throw new Error('cache get failure');
        }

        return undefined;
    }
    public async set(): Promise<boolean> {
        return true;
    }
    public async del(): Promise<boolean> {
        return true;
    }
    public async purge(): Promise<boolean> {
        return true;
    }
}

class CacheConnClass {
    public imq: any = { writer: { fake: 'writer' }, logger };

    @cache({ adapter: MemoryAdapter as any })
    public async withConn() {
        return 1;
    }
}

class CacheErrClass {
    public logger: ILogger = logger;

    @cache({ adapter: MemoryAdapter as any })
    public async willFallBack() {
        return 42;
    }
}

describe('decorators/cache()', () => {
    let obj: any;

    before(() => {
        obj = new CacheTestClass();
    });
    after(async () => await RedisCache.destroy());

    it('should be a function', () => {
        assert.equal(typeof cache, 'function');
    });

    it('should return decorator function', () => {
        assert.equal(typeof cache(), 'function');
    });

    it('should cache method execution result', async () => {
        const callOne = await obj.testMethod();
        const callTwo = await obj.testMethod();

        const callThree = await obj.testMethod(1);
        const callFour = await obj.testMethod(1);

        assert.equal(callOne, callTwo);
        assert.equal(callThree, callFour);
    });

    it('should expire if ttl specified', async () => {
        const callOne = await obj.testMethodWithTTL();
        const callTwo = await obj.testMethodWithTTL();

        assert.equal(callOne, callTwo);

        await (async () =>
            setTimeout(async () => {
                const callThree = await obj.testMethodWithTTL();

                assert.notEqual(callThree, callOne);
            }, 100));
    });

    it('passes the imq writer connection to a fresh adapter', async () => {
        const conn = new CacheConnClass();

        assert.equal(await conn.withConn(), 1);
        const adapter: any = IMQCache.get(MemoryAdapter as any);

        assert.ok(adapter.ready);
        assert.deepEqual(adapter.initOptions.conn, { fake: 'writer' });
    });

    it('reuses a ready adapter and falls back on a cache error', async () => {
        // first instance registers + inits the (now ready) shared adapter
        await new CacheErrClass().willFallBack();
        const adapter: any = IMQCache.get(MemoryAdapter as any);
        adapter.throwOnGet = true;

        // a second instance finds the adapter already ready, then get() throws
        // and the decorator falls back to the original method
        const result = await new CacheErrClass().willFallBack();

        assert.equal(result, 42);
    });
});
