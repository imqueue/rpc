/*!
 * IMQCache Unit Tests
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
import { logger } from './mocks';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQCache, RedisCache } from '..';

describe('IMQCache', () => {
    IMQCache.adapters = {};
    (<any>IMQCache).options = {};

    afterEach(() => {
        IMQCache.adapters = {};
        (<any>IMQCache).options = {};
    });

    it('should be a class', () => {
        assert.equal(typeof IMQCache, 'function');
    });

    describe('register', () => {
        it('should accept adapter name', () => {
            IMQCache.register('RedisCache');

            assert.ok((IMQCache.adapters['RedisCache']) instanceof 
                RedisCache,
            );
        });

        it('should accept constructor', () => {
            IMQCache.register(RedisCache);

            assert.ok((IMQCache.adapters['RedisCache']) instanceof 
                RedisCache,
            );
        });

        it('should accept instance', () => {
            IMQCache.register(new RedisCache());

            assert.ok((IMQCache.adapters['RedisCache']) instanceof 
                RedisCache,
            );
        });
    });

    describe('apply()', () => {
        it('should apply provided options to adapter', () => {
            IMQCache.register(RedisCache);

            assert.equal((<any>IMQCache).options['RedisCache'], undefined);

            IMQCache.apply('RedisCache', { logger });

            assert.equal((<any>IMQCache).options['RedisCache'].logger, 
                logger,
            );
        });

        it('should work the same if adapter name provided', () => {
            IMQCache.register(RedisCache);

            assert.equal((<any>IMQCache).options['RedisCache'], undefined);

            IMQCache.apply(RedisCache, { logger });

            assert.equal((<any>IMQCache).options['RedisCache'].logger, 
                logger,
            );
        });
    });

    describe('init()', () => {
        it('should initialize all registered adapters', async () => {
            IMQCache.register(RedisCache);
            IMQCache.apply(RedisCache, { logger });

            const spy = mock.method(IMQCache.adapters['RedisCache'], 'init');

            await IMQCache.init();

            assert.equal(spy.mock.callCount() > 0, true);
        });
    });

    describe('get()', () => {
        it('should return undefined if nothing registered', () => {
            assert.equal(IMQCache.get('RedisCache'), undefined);
            assert.equal(IMQCache.get(RedisCache), undefined);
        });

        it('should return adapter if registered', () => {
            IMQCache.register(RedisCache);

            assert.ok((IMQCache.get('RedisCache')) instanceof RedisCache);
            assert.ok((IMQCache.get(RedisCache)) instanceof RedisCache);
        });
    });
});
