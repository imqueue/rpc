/*!
 * IMQCache interfaces
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
/**
 * Constructor signature for cache adapter implementations.
 */
export interface ICacheConstructor {
    new (name?: string): ICache;
}

/**
 * Generic cache adapter interface. Any cache engine implementation must
 * conform to this contract to be usable within IMQ.
 */
export interface ICache {
    /**
     * Adapter (cache) name.
     *
     * @type {string}
     */
    name: string;

    /**
     * Whether the cache adapter is initialized and ready to use.
     *
     * @type {boolean}
     */
    ready: boolean;

    /**
     * Initializes the cache adapter with the given adapter-specific options.
     *
     * @param {any} [options] - adapter-specific options
     * @returns {void}
     */
    init(options?: any): void;

    /**
     * Returns the value stored in the cache under the given key.
     *
     * @param {string} key - key to read the value for
     * @returns {Promise<any>} - stored value, or undefined if not found
     */
    get(key: string): Promise<any>;

    /**
     * Stores the given value in the cache under the given key.
     *
     * @param {string} key - key to store the value under
     * @param {any} value - value to store
     * @param {number} [ttl] - time-to-live in milliseconds
     * @returns {Promise<boolean>}
     */
    set(key: string, value: any, ttl?: number): Promise<boolean>;

    /**
     * Removes the value stored in the cache under the given key.
     *
     * @param {string} key - key to remove
     * @returns {Promise<boolean>}
     */
    del(key: string): Promise<boolean>;

    /**
     * Purges all keys from the cache matching the given wildcard mask.
     *
     * @param {string} keyMask - wildcard mask to match keys against
     * @returns {Promise<boolean>}
     */
    purge(keyMask: string): Promise<boolean>;
}

/**
 * Accepted cache adapter references: a constructor, an instance, or an
 * adapter name.
 */
export type ICacheAdapter = ICacheConstructor | ICache | string;
