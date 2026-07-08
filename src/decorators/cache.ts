/*!
 * IMQ-RPC Decorators: cache
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
import { IMQCache, ICache, RedisCache, ICacheConstructor } from '..';
import { signature } from '../helpers';

export interface CacheDecoratorOptions {
    adapter?: string | ICache | ICacheConstructor;
    ttl?: number; // time-to-live, in milliseconds
    nx?: boolean; // write only if the key does not already exist in the cache
}

export interface CacheDecorator {
    (options?: CacheDecoratorOptions): (...args: any[]) => any;
    globalOptions?: CacheDecoratorOptions;
}

/**
 * Creates a `@cache()` method decorator that memoizes the decorated method's
 * result in a cache adapter (RedisCache by default). On each call the cache is
 * checked first; on a miss the method runs, and its result is stored under a
 * key derived from the class name, method name, and arguments. The returned
 * decorator is dual-mode: it works both as a standard (TC39) and as a legacy
 * method decorator.
 *
 * @param {CacheDecoratorOptions} [options] - per-method cache options (adapter,
 *  ttl, nx); merged over `cache.globalOptions`
 * @return {Function} - a dual-mode method decorator
 */
export const cache: CacheDecorator = function (
    options?: CacheDecoratorOptions,
) {
    const cacheOptions: CacheDecoratorOptions = {
        ...cache.globalOptions,
        ...options,
    };
    let Adapter: any = cacheOptions.adapter || RedisCache;

    const wrap = (
        original: (...args: any[]) => any,
        methodName: string | symbol,
    ) =>
        async function (this: any, ...args: any[]) {
            const className = this.constructor.name;

            if (!this.cache) {
                let cache = IMQCache.get(Adapter);

                if (cache && cache.ready) {
                    this.cache = cache;
                } else {
                    let opts: any = undefined;

                    if (this.imq && this.imq.writer) {
                        opts = { conn: (<any>this.imq).writer };
                    }

                    const logger = this.logger || (this.imq && this.imq.logger);

                    if (logger) {
                        opts = { ...opts, logger };
                    }

                    await IMQCache.register(Adapter, opts).init();

                    this.cache = IMQCache.get(Adapter);
                }
            }

            try {
                const key = signature(className, methodName, args);

                let result = await this.cache.get(key);

                if (result === undefined) {
                    result = original.apply(this, args);

                    await this.cache.set(
                        key,
                        result,
                        cacheOptions.ttl,
                        !!cacheOptions.nx,
                    );
                }

                return result;
            } catch (err) {
                (this.logger || this.cache.logger).warn(
                    'cache: Error fetching cached value for %s.%s(), args: %s!',
                    className,
                    methodName,
                    JSON.stringify(args),
                    err,
                );

                return original.apply(this, args);
            }
        };

    // Dual-mode: standard (TC39) invocations pass a context object with a
    // `kind` property; legacy ones pass (target, propertyKey, descriptor).
    return function (target: any, context: any, descriptor?: any): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            return wrap(target, context.name);
        }

        descriptor.value = wrap(descriptor.value, context);

        return descriptor;
    };
};

cache.globalOptions = {
    adapter: RedisCache,
};
