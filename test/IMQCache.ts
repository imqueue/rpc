/*!
 * IMQCache Unit Tests
 *
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
 */
import { logger } from './mocks';
import { expect } from 'chai';
import { IMQCache, RedisCache } from '..';
import * as sinon from 'sinon';

describe('IMQCache', () => {
    IMQCache.adapters = {};
    (<any>IMQCache).options = {};

    afterEach(() => {
        IMQCache.adapters = {};
        (<any>IMQCache).options = {};
    });

    it('should be a class', () => {
        expect(typeof IMQCache).to.equal('function');
    });

    describe('register', () => {
        it('should accept adapter name', () => {
            IMQCache.register('RedisCache');

            expect(IMQCache.adapters['RedisCache'])
                .to.be.instanceOf(RedisCache);
        });

        it('should accept constructor', () => {
            IMQCache.register(RedisCache);

            expect(IMQCache.adapters['RedisCache'])
                .to.be.instanceOf(RedisCache);
        });

        it('should accept instance', () => {
            IMQCache.register(new RedisCache());

            expect(IMQCache.adapters['RedisCache'])
                .to.be.instanceOf(RedisCache);
        });
    });

    describe('apply()', () => {
        it('should apply provided options to adapter', () => {
            IMQCache.register(RedisCache);

            expect((<any>IMQCache).options['RedisCache']).to.be.undefined;

            IMQCache.apply('RedisCache', { logger });

            expect((<any>IMQCache).options['RedisCache'].logger)
                .to.be.equal(logger);
        });

        it('should work the same if adapter name provided', () => {
            IMQCache.register(RedisCache);

            expect((<any>IMQCache).options['RedisCache']).to.be.undefined;

            IMQCache.apply(RedisCache, { logger });

            expect((<any>IMQCache).options['RedisCache'].logger)
                .to.be.equal(logger);
        });
    });

    describe('init()', () => {
        it('should initialize all registered adapters', async () => {
            IMQCache.register(RedisCache);
            IMQCache.apply(RedisCache, { logger });

            const spy = sinon.spy(IMQCache.adapters['RedisCache'], 'init');

            await IMQCache.init();

            expect(spy.called).to.be.true;
        });
    });

    describe('get()', () => {
        it('should return undefined if nothing registered', () => {
            expect(IMQCache.get('RedisCache')).to.be.undefined;
            expect(IMQCache.get(RedisCache)).to.be.undefined;
        });

        it('should return adapter if registered', () => {
            IMQCache.register(RedisCache);

            expect(IMQCache.get('RedisCache')).to.be.instanceOf(RedisCache);
            expect(IMQCache.get(RedisCache)).to.be.instanceOf(RedisCache);
        });
    });

});
