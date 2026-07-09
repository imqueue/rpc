/*!
 * RedisCache adapter implementation
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
import {
    type ILogger,
    DEFAULT_IMQ_OPTIONS,
    type IRedisClient,
    type IMQOptions,
    Redis,
} from '@imqueue/core';
import { hostname } from 'node:os';
import { type ICache } from './index.js';

export interface IRedisCacheOptions extends Partial<IMQOptions> {
    conn?: IRedisClient;
}

export const DEFAULT_REDIS_CACHE_OPTIONS: IMQOptions = {
    ...DEFAULT_IMQ_OPTIONS,
    prefix: 'imq-cache',
};

export const REDIS_CLIENT_INIT_ERROR = 'Redis client is not initialized!';

/**
 * Class RedisCache. Implements a cache engine on top of Redis.
 */
export class RedisCache implements ICache {
    private static redis?: IRedisClient;
    // pending shared connection attempt; concurrent init() calls await this
    // single promise instead of opening one connection each
    private static initPromise?: Promise<void>;
    private logger!: ILogger;
    public options!: IRedisCacheOptions;
    public name: string = RedisCache.name;
    public ready: boolean = false;

    /**
     * Initializes the cache instance. The underlying Redis connection is
     * shared between all instances; concurrent initializations share a single
     * connection attempt.
     *
     * @param {IRedisCacheOptions} [options] - Redis cache options
     * @returns {Promise<RedisCache>}
     */
    public async init(options?: IRedisCacheOptions): Promise<RedisCache> {
        this.options = {
            ...DEFAULT_REDIS_CACHE_OPTIONS,
            ...options,
        };

        this.logger = this.options.logger || console;

        if (RedisCache.redis && !RedisCache.initPromise) {
            this.ready = true;

            return this;
        }

        if (this.options.conn && !RedisCache.initPromise) {
            this.logger.info('Re-using given connection for cache.');

            RedisCache.redis = this.options.conn;
            this.ready = true;

            return this;
        }

        if (!RedisCache.initPromise) {
            RedisCache.initPromise = new Promise<void>((resolve, reject) => {
                const connectionName = `${this.options.prefix}:${
                    this.name
                }:pid:${process.pid}:host:${hostname()}`;

                RedisCache.redis = new Redis({
                    port: Number(this.options.port),
                    host: String(this.options.host),
                    username: this.options.username,
                    password: this.options.password,
                    connectionName,
                });

                RedisCache.redis.on('ready', () => {
                    this.logger.info(
                        '%s: redis cache connected, host %s:%s, pid %s',
                        this.name,
                        this.options.host,
                        this.options.port,
                        process.pid,
                    );

                    resolve();
                });

                RedisCache.redis.on('error', (err: Error) => {
                    this.logger.error(
                        `${this.name}: error connecting redis, pid ${
                            process.pid
                        }:`,
                        err,
                    );

                    reject(err);
                });
            });
        }

        try {
            await RedisCache.initPromise;
        } finally {
            // the promise only guards the pending connection attempt; once it
            // settles (either way), clear it so later init() calls observe
            // the current RedisCache.redis state (or retry after a failure)
            RedisCache.initPromise = undefined;
        }

        this.ready = true;

        return this;
    }

    /**
     * Returns the fully qualified key name for a given generic key.
     *
     * @param {string} key - generic key to qualify
     * @returns {string}
     */
    private key(key: string): string {
        return `${this.options.prefix}:${this.name}:${key}`;
    }

    /**
     * Returns the value stored in the cache under a given key.
     *
     * @param {string} key - key to read the value for
     * @returns {Promise<any>} - stored value, or undefined if not found
     */
    public async get(key: string): Promise<any> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        const data = await RedisCache.redis.get(this.key(key));

        if (data) {
            return JSON.parse(data);
        }

        return undefined;
    }

    /**
     * Stores the given value in the cache under the given key. If TTL is
     * specified, the cached value will expire after the given number of
     * milliseconds. If the NX argument is set to true, the key:value pair
     * is created only if it does not exist yet. The given value can be any
     * JSON-compatible object and will be serialized automatically.
     *
     * @param {string} key - key to store the value under
     * @param {any} value - value to store
     * @param {number} [ttl] - time-to-live in milliseconds
     * @param {boolean} [nx] - store only if the key does not exist yet
     * @returns {Promise<boolean>}
     */
    public async set(
        key: string,
        value: any,
        ttl?: number,
        nx: boolean = false,
    ): Promise<boolean> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        const args: (string | number)[] = [
            this.key(key),
            JSON.stringify(value && value.then ? await value : value),
        ];

        if (ttl && ttl > 0) {
            args.push('PX', ttl);
        }

        if (nx) {
            args.push('NX');
        }

        return await (RedisCache.redis.set as any).apply(
            RedisCache.redis,
            args,
        );
    }

    /**
     * Removes the value stored in the cache under the given key.
     *
     * @param {string} key - key to remove
     * @returns {Promise<boolean>}
     */
    public async del(key: string): Promise<boolean> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        return !!(await RedisCache.redis.del(this.key(key)));
    }

    /**
     * Purges all keys from the cache matching a given wildcard mask.
     *
     * @param {string} keyMask - wildcard mask to match keys against
     * @return {Promise<boolean>}
     */
    public async purge(keyMask: string): Promise<boolean> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        try {
            await RedisCache.redis.eval(
                `for _,k in ipairs(redis.call('keys','${
                    keyMask
                }')) do redis.call('del',k) end`,
                0,
            );

            return true;
        } catch (e) {
            this.logger.error(e);

            return false;
        }
    }

    /**
     * Safely destroys the Redis connection.
     *
     * @returns {Promise<void>}
     */
    public static async destroy(): Promise<void> {
        RedisCache.initPromise = undefined;

        try {
            if (RedisCache.redis) {
                RedisCache.redis.removeAllListeners();
                RedisCache.redis.disconnect(false);
                RedisCache.redis.quit();
                delete RedisCache.redis;
            }
        } catch {}
    }
}
