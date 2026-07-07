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

export const cache: CacheDecorator = function (
    options?: CacheDecoratorOptions,
) {
    const cacheOptions: CacheDecoratorOptions = {
        ...cache.globalOptions,
        ...options,
    };
    let Adapter: any = cacheOptions.adapter || RedisCache;

    return function (
        value: (...args: any[]) => any,
        context: ClassMethodDecoratorContext,
    ): (...args: any[]) => any {
        const original: (...args: any[]) => any = value;
        const methodName = context.name;

        return async function (this: any, ...args: any[]) {
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
    };
};

cache.globalOptions = {
    adapter: RedisCache,
};
