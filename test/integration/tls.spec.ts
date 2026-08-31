/*!
 * TLS on the method cache, against a real redis
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
/**
 * The unit specs replace `ioredis` wholesale and never open a socket, which is
 * fine for every option except `tls`: what it is for happens during a handshake
 * a mock does not perform. These specs therefore run unmocked, and skip
 * themselves - rather than fail - wherever `redis-server` and `openssl` are not
 * both available.
 */
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'node:crypto';
import { after, afterEach, beforeEach, describe, it } from 'node:test';
import type { TLSSocket } from 'node:tls';
import type { ILogger } from '@imqueue/core';
import { RedisCache } from '../../index.js';
import { startTlsBroker, type TlsBroker } from './tlsBroker.js';

const started = await startTlsBroker(false);
const skip = typeof started === 'string' ? started : undefined;
const broker = started as TlsBroker;

/** Silences the cache; a failing assertion says more than its log would */
const quiet: ILogger = {
    log: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
};

/** The TLS socket underneath the shared cache connection */
const socket = (): TLSSocket => (RedisCache as any).redis.stream as TLSSocket;

/** Options addressing the broker, with a key namespace of this test's own */
const against = (tls?: any): any => ({
    host: '127.0.0.1',
    port: broker.port,
    prefix: `itls-${uuid()}`,
    logger: quiet,
    ...(tls === undefined ? {} : { tls }),
});

describe('RedisCache TLS against a real redis', { skip }, () => {
    after(async () => {
        // the cache connection is process-wide and outlives the suite: without
        // closing it the runner has nothing left to do and still cannot exit
        await RedisCache.destroy();
        await broker.stop();
    });

    beforeEach(async () => {
        await RedisCache.destroy();
        delete (RedisCache as any).redis;
        delete (RedisCache as any).initPromise;
        delete (RedisCache as any).tlsPrint;
    });

    afterEach(() => {
        delete process.env.IMQ_REDIS_TLS_CA_FILE;
        delete process.env.IMQ_REDIS_TLS_SERVERNAME;
    });

    describe('an encrypted cache connection', () => {
        it('should complete a verified handshake', async () => {
            await new RedisCache().init(
                against({ ca: broker.ca, servername: broker.servername }),
            );

            const sock = socket();

            assert.ok(sock.encrypted, 'the socket is not a TLS socket');
            assert.ok(sock.authorized, sock.authorizationError?.message);
            assert.match(String(sock.getProtocol()), /^TLSv1\.[23]$/);
        });

        it('should carry a cached value end to end', async () => {
            const cache = await new RedisCache().init(
                against({ ca: broker.ca, servername: broker.servername }),
            );

            await cache.set('key', { hello: 'over tls' }, 30000);

            assert.deepEqual(await cache.get('key'), { hello: 'over tls' });
            assert.equal(await cache.del('key'), true);
            assert.equal(await cache.get('key'), undefined);
        });

        it('should present a client certificate when given one', async () => {
            // the broker here does not demand one, but the material still has
            // to reach `tls.connect()` for mutual TLS to be usable at all
            await new RedisCache().init(
                against({
                    ca: broker.ca,
                    cert: broker.cert,
                    key: broker.key,
                    servername: broker.servername,
                }),
            );

            const presented = socket().getCertificate();

            assert.ok(presented && 'subject' in presented);
            assert.equal(presented.subject.CN, 'imq-integration-client');
        });
    });

    describe('a broker that will not be reached in the clear', () => {
        it('should refuse a plaintext connection', async () => {
            // the broker runs with `--port 0`, so there is no plaintext
            // listener to fall back to and no way to reach it by accident
            await assert.rejects(() => new RedisCache().init(against()));
        });

        it('should refuse a certificate it cannot verify', async () => {
            await assert.rejects(() => new RedisCache().init(against(true)));
        });

        it('should refuse a name the certificate does not carry', async () => {
            await assert.rejects(() =>
                new RedisCache().init(
                    against({
                        ca: broker.ca,
                        servername: 'not-the-broker.invalid',
                    }),
                ),
            );
        });
    });

    describe('the environment configuration', () => {
        it('should encrypt a cache that asks for nothing in code', async () => {
            process.env.IMQ_REDIS_TLS_CA_FILE = broker.paths.ca;
            process.env.IMQ_REDIS_TLS_SERVERNAME = broker.servername;

            await new RedisCache().init(against());

            assert.ok(socket().encrypted);
            assert.ok(socket().authorized);
        });
    });
});
