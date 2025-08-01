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
import { ICache } from '.';
import {
    ILogger,
    DEFAULT_IMQ_OPTIONS,
    IRedisClient,
    IMQOptions,
    Redis,
} from '@imqueue/core';
import * as os from 'os';

export interface IRedisCacheOptions extends Partial<IMQOptions> {
    conn?: IRedisClient;
}

export const DEFAULT_REDIS_CACHE_OPTIONS = {
    ...DEFAULT_IMQ_OPTIONS,
    prefix: 'imq-cache',
};

export const REDIS_CLIENT_INIT_ERROR = 'Redis client is not initialized!';

/**
 * Class RedisCache. Implements cache engine over redis.
 */
export class RedisCache implements ICache {
    private static redis?: IRedisClient;
    private logger: ILogger;
    public options: IRedisCacheOptions;
    public name: string = RedisCache.name;
    public ready: boolean = false;

    /**
     * Initializes cache instance
     *
     * @param {IRedisCacheOptions} [options]
     * @returns {Promise<RedisCache>}
     */
    public async init(options?: IRedisCacheOptions): Promise<RedisCache> {
        this.options = {
            ...DEFAULT_REDIS_CACHE_OPTIONS,
            ...options,
        };

        this.logger = this.options.logger ||
            // istanbul ignore next
            console;

        if (RedisCache.redis) {
            return this;
        }

        if (this.options.conn) {
            this.logger.info('Re-using given connection for cache.');

            RedisCache.redis = this.options.conn;

            return this;
        }

        return new Promise<RedisCache>((resolve, reject) => {
            const connectionName = `${
                this.options.prefix}:${
                this.name }:pid:${
                process.pid }:host:${
                os.hostname()
            }`;

            RedisCache.redis = new Redis({
                port: Number(this.options.port),
                host: String(this.options.host),
                username: this.options.username,
                password: this.options.password,
                connectionName,
            });

            RedisCache.redis.on('ready', async () => {
                this.logger.info(
                    '%s: redis cache connected, host %s:%s, pid %s',
                    this.name,
                    this.options.host,
                    this.options.port,
                    process.pid,
                );

                this.ready = true;

                resolve(this);
            });

            // istanbul ignore next
            RedisCache.redis.on('error', (err: Error) => {
                this.logger.error(
                    `${this.name}: error connecting redis, pid ${process.pid}:`,
                    err
                );

                reject(err);
            });
        });
    }

    /**
     * Returns fully qualified key name for a given generic key
     *
     * @access private
     * @param {string} key
     * @returns {string}
     */
    private key(key: string): string {
        return `${this.options.prefix}:${this.name}:${key}`;
    }

    /**
     * Returns value stored in cache by a given key
     *
     * @param {string} key
     * @returns {Promise<any>}
     */
    public async get(key: string): Promise<any> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        // noinspection ES6RedundantAwait
        const data = <any>await RedisCache.redis.get(this.key(key));

        if (data) {
            return JSON.parse(data);
        }

        return undefined;
    }

    /**
     * Stores in cache given value under given key. If TTL is specified,
     * cached value will expire in a given number of milliseconds. If NX
     * argument set to true will create key:value in cache only if it does
     * not exist yet. Given value could be any JSON-compatible object and
     * will be serialized automatically.
     *
     * @param {string} key
     * @param {any} value
     * @param {number} ttl
     * @param {boolean} nx
     * @returns {Promise<boolean>}
     */
    public async set(
        key: string,
        value: any,
        ttl?: number,
        nx: boolean = false
    ): Promise<boolean> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        const args: any[] = [
            this.key(key),
            JSON.stringify(value && value.then ? await value : value)
        ];

        if (ttl && ttl > 0) {
            args.push('PX', ttl);
        }

        if (nx) {
            args.push('NX');
        }

        return await RedisCache.redis.set.apply(RedisCache.redis, args);
    }

    /**
     * Removes stored in cache value under given key
     *
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    public async del(key: string): Promise<boolean> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        return !!await RedisCache.redis.del(this.key(key));
    }

    /**
     * Purges all keys from cache by a given wildcard mask
     *
     * @param {string} keyMask
     * @return {boolean}
     */
    public async purge(keyMask: string): Promise<boolean> {
        if (!RedisCache.redis) {
            throw new TypeError(REDIS_CLIENT_INIT_ERROR);
        }

        try {
            // noinspection SpellCheckingInspection
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
     * Safely destroys redis connection
     *
     * @returns {Promise<void>}
     */
    public static async destroy(): Promise<void> {
        try {
            // istanbul ignore else
            if (RedisCache.redis) {
                RedisCache.redis.removeAllListeners();
                RedisCache.redis.disconnect(false);
                RedisCache.redis.quit();
                delete RedisCache.redis;
            }
        }

        catch (err) {}
    }

}
