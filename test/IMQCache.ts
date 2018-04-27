/*!
 * IMQCache Unit Tests
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
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
