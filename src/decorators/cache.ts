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
// cache classes are imported from their defining modules (not the package
// barrel) to avoid a circular-import TDZ on the module-scope default options
import {
    type ICache,
    type ICacheConstructor,
    RedisCache,
} from '../cache/index.js';
import { IMQCache } from '../IMQCache.js';
import { signature } from '../helpers/index.js';

/**
 * Per-method options for the {@link cache} decorator.
 */
export interface CacheDecoratorOptions {
    /**
     * Cache adapter as a constructor, an instance, or a built-in adapter name.
     *
     * @defaultValue RedisCache
     *
     * @remarks
     * Only built-in adapters can be referenced by name — currently just
     * `'RedisCache'`. Any other string throws a `TypeError`.
     */
    adapter?: string | ICache | ICacheConstructor;
    /**
     * Time-to-live in milliseconds.
     *
     * @remarks
     * Omitted or non-positive means the entry never expires. A non-integer value is
     * rejected by Redis, which makes the write throw rather than return falsy.
     */
    ttl?: number;
    /**
     * Store only when the key does not already exist.
     *
     * @remarks
     * Honoured by the built-in Redis adapter, but outside the {@link ICache}
     * interface, so custom adapters may ignore it. When it suppresses a write, the
     * existing value and its remaining TTL are left untouched.
     */
    nx?: boolean;
}

/**
 * The type of the {@link cache} export: a decorator factory that also carries
 * process-wide defaults.
 */
export interface CacheDecorator {
    /**
     * @param options - per-method cache options, merged over
     *        {@link CacheDecorator.globalOptions}
     * @returns a dual-mode method decorator that replaces the method with an `async`
     *          wrapper — so a decorated synchronous method returns a promise
     */
    (options?: CacheDecoratorOptions): (...args: any[]) => any;
    /**
     * Process-wide defaults, merged under each call's own options.
     *
     * @remarks
     * Merging happens when a decorator is applied, so this must be set before any
     * decorated class is imported.
     */
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
 * @param options - per-method cache options (adapter,
 *  ttl, nx); merged over `cache.globalOptions`
 * @returns a dual-mode method decorator
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
