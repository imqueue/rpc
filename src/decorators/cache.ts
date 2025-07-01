/*!
 * IMQ-RPC Decorators: cache
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
import { IMQCache, ICache, RedisCache, ICacheConstructor, signature } from '..';

export interface CacheDecoratorOptions {
    adapter?: string | ICache | ICacheConstructor;
    ttl?: number; // milliseconds
    nx?: boolean; // rewrite only if not exists in cache
}

export interface CacheDecorator {
    (options?: CacheDecoratorOptions): (...args: any[]) => any;
    globalOptions?: CacheDecoratorOptions;
}

// codebeat:disable[BLOCK_NESTING]
export const cache: CacheDecorator = function(options?: CacheDecoratorOptions) {
    const cacheOptions: CacheDecoratorOptions = {
        ...cache.globalOptions,
        ...options,
    };
    let Adapter: any = cacheOptions.adapter || RedisCache;

    return function(
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<(...args: any[]) => any>,
    ) {
        const original: (...args: any[]) => any = descriptor.value as any;

        descriptor.value = async function(...args: any[]) {
            const context: any = this;
            const className = this.constructor.name;

            if (!context.cache) {
                let cache = IMQCache.get(Adapter);

                // istanbul ignore next
                if (cache && cache.ready) {
                    context.cache = cache;
                }

                else {
                    let opts: any = undefined;

                    if (context.imq && context.imq.writer) {
                        opts = { conn: (<any>context.imq).writer };
                    }

                    const logger = context.logger ||
                        (context.imq && context.imq.logger);

                    if (logger) {
                        opts = { ...opts, logger };
                    }

                    await IMQCache.register(Adapter, opts).init();

                    context.cache = IMQCache.get(Adapter);
                }
            }

            try {
                const key = signature(className, methodName, args);

                let result = await context.cache.get(key);

                if (result === undefined) {
                    result = original.apply(this, args);

                    await context.cache.set(
                        key,
                        result,
                        cacheOptions.ttl,
                        !!cacheOptions.nx,
                    );
                }

                return result;
            }

            catch (err) {
                // istanbul ignore next
                (this.logger || context.cache.logger).warn(
                    'cache: Error fetching cached value for %s.%s(), args: %s!',
                    className, methodName, JSON.stringify(args), err,
                );

                // istanbul ignore next
                return original.apply(this, args);
            }
        };
    }
};
// codebeat:enable[BLOCK_NESTING]

cache.globalOptions = {
    adapter: RedisCache
};
