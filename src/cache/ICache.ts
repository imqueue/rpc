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
 * Constructor signature the registry uses to instantiate a cache adapter class.
 *
 * @remarks
 * The registry always calls it with no arguments. The optional `name` argument
 * is a legacy affordance that no built-in adapter accepts and that the registry
 * never supplies, so implementations must be constructible with zero arguments and
 * set their own {@link ICache.name}.
 */
export interface ICacheConstructor {
    /**
     * Constructs a cache adapter instance, ready to be initialized.
     *
     * @param name - legacy, and never supplied by the registry
     * @returns an uninitialized adapter — {@link ICache.init} must be called
     *          before use
     */
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
     * @remarks
     * The name is load-bearing twice over: it is the key the adapter is registered
     * under, and it is a segment of every physical cache key
     * (`<prefix>:<name>:<key>` in the Redis adapter). It must therefore be stable —
     * changing it at runtime moves the namespace and orphans existing entries.
     */
    name: string;

    /**
     * Whether the cache adapter is initialized and ready to use.
     *
     * @remarks
     * For the built-in Redis adapter this flag is never reset — destroying the
     * shared connection leaves it `true`, so a `true` value does not guarantee a
     * live connection after an explicit destroy.
     */
    ready: boolean;

    /**
     * Initializes the cache adapter with the given adapter-specific options.
     *
     * @param options - adapter-specific options
     *
     * @remarks
     * May be asynchronous: the registry awaits whatever is returned, so an
     * implementation that needs I/O must return a promise that settles once the
     * adapter is ready. Implementations must set {@link ICache.ready} on success.
     */
    init(options?: any): void;

    /**
     * Returns the value stored in the cache under the given key.
     *
     * @param key - key to read the value for
     * @returns the deserialized stored value, or `undefined` when the key is absent
     *          or expired
     *
     * @remarks
     * A stored `null` is returned as `null` and is therefore distinguishable from a
     * miss; a stored `undefined` is not. Callers that must tell "cached as
     * empty" from "not cached" should store an explicit sentinel rather than
     * `undefined`.
     */
    get(key: string): Promise<any>;

    /**
     * Stores the given value in the cache under the given key.
     *
     * @param key - key to store the value under
     * @param value - value to store
     * @param ttl - time-to-live in milliseconds
     * @returns a truthy value when the write happened, falsy when it did not
     *
     * @remarks
     * Test the result for truthiness rather than comparing against `true` — the
     * built-in Redis adapter resolves to the string `'OK'` or to `null`, never to a
     * boolean.
     *
     * The framework additionally passes a fourth argument, an `nx` flag meaning
     * "only create the key if it does not already exist". Adapters that cannot
     * honour it should say so, because the {@link cache} decorator always passes it.
     */
    set(key: string, value: any, ttl?: number): Promise<boolean>;

    /**
     * Removes the value stored in the cache under the given key.
     *
     * @param key - key to remove
     * @returns true if a key was actually removed, false if it did not exist —
     *          which is not an error
     */
    del(key: string): Promise<boolean>;

    /**
     * Deletes every key matching the given wildcard mask.
     *
     * @param keyMask - wildcard mask matched against fully qualified key names
     * @returns whether the purge ran
     *
     * @remarks
     * The mask is not automatically scoped to this cache — callers must include
     * the namespace themselves (`<prefix>:<name>:...`). A broad mask such as `'*'`
     * will delete unrelated data, including message-queue keys.
     */
    purge(keyMask: string): Promise<boolean>;
}

/**
 * Accepted cache adapter references: a constructor, an instance, or an
 * adapter name.
 */
export type ICacheAdapter = ICacheConstructor | ICache | string;
