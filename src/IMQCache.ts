/*!
 * IMQCache implementation
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
import { ICache, ICacheAdapter, ICacheConstructor } from '.';

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
    public static register(adapter: ICacheAdapter | string, options?: any) {
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
            if (!self.adapters[(adapter as ICacheConstructor).name]) {
                if (typeof adapter === 'function') {
                    self.adapters[(adapter as ICacheConstructor).name] =
                        new (<any>adapter)();
                }

                else {
                    self.adapters[(adapter as ICache).name] =
                        adapter as any as ICache;
                }
            }
        }

        self.apply(adapter, options);

        return self;
    }

    /**
     * Overrides existing adapter options with the given
     *
     * @param {ICache | string} adapter - adapter to apply options to
     * @param {any} options - adapter specific options
     * @returns {IMQCache}
     */
    public static apply(adapter: ICacheAdapter | string, options: any) {
        const self = IMQCache;

        if (!options) {
            return self;
        }

        const name = typeof adapter === 'string'
            ? adapter
            : (adapter as ICache).name;

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
            typeof adapter === 'string'
                ? adapter
                : (adapter as ICache).name
        ];
    }

}
