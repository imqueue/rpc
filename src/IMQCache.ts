/*!
 * IMQCache implementation
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
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
import { ICache, ICacheAdapter } from '.';

/**
 * Generic cache registry
 */
export class IMQCache {

    private static options: { [name: string]: any } = {};
    public static adapters: { [name: string]: ICache } = {};

    /**
     * Registers given cache adapter
     *
     * @param { ICache | string} adapter - adapter name or class or instance
     * @param {any} options - adapter specific options
     * @returns {IMQCache}
     */
    public static register(adapter: ICacheAdapter, options?: any) {
        const self = IMQCache;

        if (typeof adapter === 'string') {
            // istanbul ignore else
            if (!self.adapters[adapter]) {
                self.adapters[adapter] = <ICache>new (require(
                    `${__dirname}/cache/${adapter}.js`
                )[adapter])();
            }
        }

        else {
            // istanbul ignore else
            if (!self.adapters[adapter.name]) {
                if (typeof adapter === 'function') {
                    self.adapters[(<any>adapter).name] = new (<any>adapter)();
                }

                else {
                    self.adapters[adapter.name] = adapter;
                }
            }
        }

        self.apply(adapter, options);

        return self;
    }

    /**
     * Overrides existing adapter options with the given
     *
     * @param { ICache | string} adapter - adapter to apply options to
     * @param {any} options - adapter specific options
     * @returns {IMQCache}
     */
    public static apply(adapter: ICacheAdapter, options: any) {
        const self = IMQCache;

        if (!options) {
            return self;
        }

        const name = typeof adapter === 'string' ? adapter : adapter.name;

        let opts = self.options[name] || {};

        self.options[name] = { ...opts, ...options };

        return self;
    }

    /**
     * Initializes all registered cache adapters
     *
     * @returns {Promise<any>}
     */
    public static async init() {
        const self: any = IMQCache;
        const promises = [];

        for (let adapter of Object.keys(self.adapters)) {
            // istanbul ignore else
            if (!self.adapters[adapter].ready) {
                promises.push(
                    self.adapters[adapter].init(
                        self.options[adapter]
                    )
                );
            }
        }

        await Promise.all(promises);

        return self;
    }

    /**
     * Returns registered cache adapter by its given name or class
     *
     * @param { ICache | string} adapter - adapter name or class
     * @returns {ICache} - adapter instance
     */
    public static get(adapter: ICacheAdapter): ICache {
        return IMQCache.adapters[
            typeof adapter === 'string' ? adapter : adapter.name
        ];
    }

}
