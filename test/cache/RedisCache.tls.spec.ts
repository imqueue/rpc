/*!
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
import { Redis } from '../mocks/index.js';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCache } from '../../index.js';
import { type ILogger, type IRedisClient } from '@imqueue/core';

const CA = Buffer.from('-----BEGIN CERTIFICATE-----\nCA\n');
const OTHER_CA = Buffer.from('-----BEGIN CERTIFICATE-----\nOTHER\n');

const VARS = [
    'IMQ_REDIS_TLS',
    'IMQ_REDIS_TLS_CA_FILE',
    'IMQ_REDIS_TLS_SERVERNAME',
    'IMQ_REDIS_TLS_REJECT_UNAUTHORIZED',
];

/** A logger that records what it was warned about */
const spyLogger = (): ILogger & { warnings: string[] } => {
    const warnings: string[] = [];

    return {
        warnings,
        log: () => undefined,
        info: () => undefined,
        warn: (...args: unknown[]) => warnings.push(args.join(' ')),
        error: () => undefined,
    } as unknown as ILogger & { warnings: string[] };
};

/** The options the shared redis client was actually constructed with */
const clientOptions = (): any => (RedisCache as any).redis?.options;

describe('cache/RedisCache TLS', () => {
    beforeEach(() => {
        delete (RedisCache as any).redis;
        delete (RedisCache as any).initPromise;
        delete (RedisCache as any).tlsPrint;
    });

    afterEach(() => {
        for (const name of VARS) {
            delete process.env[name];
        }
    });

    describe('option pass-through', () => {
        it('should encrypt the cache connection when asked', async () => {
            await new RedisCache().init({
                logger: spyLogger(),
                tls: { ca: CA },
            });

            assert.deepEqual(clientOptions().tls, { ca: CA });
        });

        it('should normalise `true` into an empty option object', async () => {
            await new RedisCache().init({ logger: spyLogger(), tls: true });

            assert.deepEqual(clientOptions().tls, {});
        });

        it('should omit the option entirely when TLS is off', async () => {
            await new RedisCache().init({ logger: spyLogger() });

            assert.ok(!('tls' in clientOptions()));
        });

        it('should omit the option when TLS is declined explicitly', async () => {
            await new RedisCache().init({ logger: spyLogger(), tls: false });

            assert.ok(!('tls' in clientOptions()));
        });
    });

    describe('a cache that never asked for TLS', () => {
        // the guarantee for everyone who does not use this feature
        it('should carry no `tls` key on its options at all', async () => {
            const cache = await new RedisCache().init({ logger: spyLogger() });

            assert.equal('tls' in cache.options, false);
        });

        it('should hand the client no TLS option', async () => {
            await new RedisCache().init({ logger: spyLogger() });

            assert.equal('tls' in clientOptions(), false);
        });

        it('should still share the one connection, silently', async () => {
            await new RedisCache().init({ logger: spyLogger() });

            const first = (RedisCache as any).redis;
            const logger = spyLogger();

            await new RedisCache().init({ logger });

            assert.equal((RedisCache as any).redis, first);
            assert.deepEqual(logger.warnings, []);
        });

        it('should be unaffected by unrelated IMQ_ variables', async () => {
            process.env.IMQ_REDIS_TLS_REJECT_UNAUTHORIZED = '0';
            process.env.IMQ_REDIS_TLS_SERVERNAME = 'redis.internal';

            const cache = await new RedisCache().init({ logger: spyLogger() });

            assert.equal('tls' in cache.options, false);
            assert.equal('tls' in clientOptions(), false);
        });
    });

    describe('the environment configuration', () => {
        it('should encrypt a cache that asks for nothing in code', async () => {
            process.env.IMQ_REDIS_TLS = '1';

            await new RedisCache().init({ logger: spyLogger() });

            assert.deepEqual(clientOptions().tls, {});
        });

        it('should let explicit options decline the environment', async () => {
            process.env.IMQ_REDIS_TLS = '1';

            await new RedisCache().init({ logger: spyLogger(), tls: false });

            assert.ok(!('tls' in clientOptions()));
        });

        it('should throw rather than connect in the clear', async () => {
            // an unmounted secret is a deployment failure, and failing to
            // initialize is the only outcome that cannot end in plaintext
            process.env.IMQ_REDIS_TLS_CA_FILE = '/nonexistent/imq/ca.crt';

            await assert.rejects(
                () => new RedisCache().init({ logger: spyLogger() }),
                /IMQ_REDIS_TLS_CA_FILE/,
            );
        });
    });

    describe('the process-wide shared connection', () => {
        it('should say so when it is not the transport asked for', async () => {
            // the connection is opened once per process and the first caller
            // decides its transport; a second one asking for TLS and silently
            // getting plaintext is the case worth reporting
            await new RedisCache().init({ logger: spyLogger() });

            const logger = spyLogger();

            await new RedisCache().init({ logger, tls: { ca: CA } });

            assert.equal(logger.warnings.length, 1);
            assert.match(logger.warnings[0], /not the transport/);
            assert.match(logger.warnings[0], /plaintext/);
        });

        it('should say so in the other direction too', async () => {
            await new RedisCache().init({
                logger: spyLogger(),
                tls: { ca: CA },
            });

            const logger = spyLogger();

            await new RedisCache().init({ logger });

            assert.equal(logger.warnings.length, 1);
            assert.match(logger.warnings[0], /encrypted/);
        });

        it('should stay quiet for an equal configuration', async () => {
            await new RedisCache().init({
                logger: spyLogger(),
                tls: { ca: CA },
            });

            const logger = spyLogger();

            await new RedisCache().init({
                logger,
                tls: { ca: Buffer.from(CA) },
            });

            assert.deepEqual(logger.warnings, []);
        });

        it('should distinguish different trust anchors', async () => {
            await new RedisCache().init({
                logger: spyLogger(),
                tls: { ca: CA },
            });

            const logger = spyLogger();

            await new RedisCache().init({ logger, tls: { ca: OTHER_CA } });

            assert.equal(logger.warnings.length, 1);
        });

        it('should read the transport off a connection it was given', async () => {
            // the fingerprint has to come from the client, not from the
            // options handed to init(), or a reused encrypted connection would
            // be reported to the next caller as plaintext
            const conn = new Redis({
                tls: { ca: CA },
            }) as unknown as IRedisClient;

            await new RedisCache().init({ conn, logger: spyLogger() });

            const logger = spyLogger();

            await new RedisCache().init({ logger, tls: { ca: CA } });

            assert.deepEqual(logger.warnings, []);
        });
    });

    describe('warnings', () => {
        it('should warn when certificate verification is disabled', async () => {
            const logger = spyLogger();

            await new RedisCache().init({
                logger,
                tls: { ca: CA, rejectUnauthorized: false },
            });

            assert.equal(logger.warnings.length, 1);
            assert.match(logger.warnings[0], /verification is disabled/);
        });

        it('should stay quiet when verification is left on', async () => {
            const logger = spyLogger();

            await new RedisCache().init({ logger, tls: { ca: CA } });

            assert.deepEqual(logger.warnings, []);
        });
    });
});
