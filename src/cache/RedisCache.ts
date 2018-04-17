/*!
 * RedisCache adapter implementation
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
import { ICache } from '.';
import {
    ILogger,
    DEFAULT_IMQ_OPTIONS,
    redis,
    IRedisClient,
    IMQOptions
} from 'imq';
import * as os from 'os';

export interface IRedisCacheOptions extends Partial<IMQOptions> {
    conn?: IRedisClient
}

export const DEFAULT_REDIS_CACHE_OPTIONS = Object.assign(
    {}, DEFAULT_IMQ_OPTIONS, {
        prefix: 'imq-cache'
    });

export class RedisCache implements ICache {
    private static redis: IRedisClient;
    private logger: ILogger;
    public options: IRedisCacheOptions;
    public name: string = RedisCache.name;
    public ready: boolean = false;

    public async init(options?: IRedisCacheOptions) {
        if (RedisCache.redis) {
            return this;
        }

        this.options = Object.assign(
            {}, DEFAULT_REDIS_CACHE_OPTIONS, options || {}
        );

        this.logger = this.options.logger || console;

        if (this.options.conn) {
            this.logger.info('Re-using given connection for cache.');
            RedisCache.redis = this.options.conn;
            return this;
        }

        return new Promise((resolve, reject) => {
            RedisCache.redis = <IRedisClient>redis.createClient(
                Number(this.options.port),
                String(this.options.host)
            );

            RedisCache.redis.on('ready', async () => {
                this.logger.info(
                    '%s: redis cache connected, host %s:%s, pid %s',
                    this.name,
                    this.options.host,
                    this.options.port,
                    process.pid
                );

                await RedisCache.redis.client(
                    'setname',
                    `${this.options.prefix}:${this.name
                    }:pid:${process.pid}:host:${os.hostname()}`
                );

                this.ready = true;

                resolve(this);
            });

            RedisCache.redis.on('error', (err: Error) => {
                this.logger.error(
                    `${this.name}: error connecting redis, pid ${process.pid}:`,
                    err
                );

                reject(err);
            });
        });
    }

    private key(key: string) {
        return `${this.options.prefix}:${this.name}:${key}`;
    }

    public async get(key: string): Promise<any> {
        const data = <any>await RedisCache.redis.get(this.key(key));

        if (data) {
            return JSON.parse(data);
        }

        return undefined;
    }

    public async set(
        key: string,
        value: any,
        ttl?: number,
        nx: boolean = false
    ): Promise<boolean> {
        const args: any[] = [
            this.key(key),
            JSON.stringify(value)
        ];

        if (ttl && ttl > 0) {
            args.push('PX', ttl);
        }

        if (nx) {
            args.push('NX');
        }

        return await RedisCache.redis.set.apply(RedisCache.redis, args);
    }

    public async del(key: string): Promise<boolean> {
        return await RedisCache.redis.del(this.key(key));
    }

}
