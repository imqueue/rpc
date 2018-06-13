/*!
 * IMQ-RPC Decorators: cache
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
    const cacheOptions: CacheDecoratorOptions =
        Object.assign({}, cache.globalOptions, options || {});
    let Adapter: any = cacheOptions.adapter || RedisCache;

    return function(
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
    ) {
        const original = descriptor.value ||
            // istanbul ignore next
            (() => {});

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
                        opts = Object.assign(opts || {}, { logger });
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
                        !!cacheOptions.nx
                    );
                }

                return result;
            }

            catch (err) {
                // istanbul ignore next
                (this.logger || context.cache.logger).warn(
                    'cache: Error fetching cached value for %s.%s(), args: %s!',
                    className, methodName, JSON.stringify(args), err
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
