/*!
 * IMQLock implementation
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
import { type ILogger } from '@imqueue/core';

/**
 * What {@link IMQLock.acquire} resolves to: the literal `true` when this caller
 * acquired the lock and must perform the work, or the value the lock holder passed
 * to {@link IMQLock.release} when this caller had to wait.
 *
 * @remarks
 * Because the acquired case is the literal `true`, it cannot be told apart from a
 * resolved value of `true`. Always use {@link IMQLock.locked} immediately after
 * awaiting to decide whether you are the holder — never inspect the returned
 * value.
 */
export type AcquiredLock<T> = T | boolean;

/**
 * Internal representation of one queued waiter: its promise's
 * `[resolve, reject]` pair, selected by {@link IMQLock.release} according to
 * whether an error was supplied.
 */
export type IMQLockTask = [(...args: any[]) => any, (...args: any[]) => any];

/**
 * The FIFO queue of callers waiting on a single lock key, drained in arrival
 * order when the lock is released.
 */
export type IMQLockQueue = Array<IMQLockTask>;

/**
 * Diagnostic description of a locked call.
 *
 * @remarks
 * Used only to enrich the deadlock-timeout error message. Values that cannot be
 * serialized degrade to a placeholder rather than failing.
 */
export interface IMQLockMetadataItem {
    /**
     * Name of the class whose method holds the lock.
     */
    className: string;
    /**
     * Name of the locked method.
     */
    methodName: string | symbol;
    /**
     * Arguments the locked method was called with.
     */
    args: any[];
}

/**
 * Map from lock key to the metadata describing the call currently associated with
 * that key.
 */
export interface IMQLockMetadata {
    /**
     * Metadata for the given lock key.
     */
    [key: string]: IMQLockMetadataItem;
}

/**
 * In-process, promise-based locks used to collapse concurrent identical calls: the
 * first caller executes the work while later callers for the same key wait and are
 * then resolved with the first caller's result.
 *
 * @remarks
 * These are not distributed locks. The lock table is a set of plain static
 * objects held in memory, and nothing here touches Redis, the network or any
 * shared store. Separate processes, cluster workers and service replicas each
 * maintain their own independent locks and will run the guarded code
 * concurrently. {@link lock} inherits the same limitation. Use a Redis- or
 * database-backed lock if you need mutual exclusion across processes.
 *
 * Keys are used verbatim, with no prefixing or namespacing, so they are global to
 * the process and unrelated call sites sharing a string share a lock.
 *
 * Exclusion is not absolute, and {@link IMQLock.deadlockTimeout} is why. A waiter
 * that times out frees the key so that a holder which never releases cannot poison
 * it for the life of the process — but the holder is still running, so the next
 * call acquires and runs alongside it. Pass the {@link IMQLock.token} to
 * {@link IMQLock.release}, as the example does and as {@link lock} does for you,
 * and the damage stops there: the overtaken holder can no longer resolve the new
 * holder's waiters or free a lock still in use. Set `deadlockTimeout` to `0` if
 * you would rather have strict exclusion and let waiters wait forever.
 *
 * @example
 * ```typescript
 * import { IMQLock, type AcquiredLock } from '@imqueue/rpc';
 *
 * async function doSomething(): Promise<number | AcquiredLock<number>> {
 *     const lock: AcquiredLock<number> =
 *         await IMQLock.acquire<number>('doSomething');
 *
 *     // locked() is the only reliable way to tell holder from waiter
 *     if (IMQLock.locked('doSomething')) {
 *         // read the token straight after acquiring and pass it to every
 *         // release, so a release cannot land on a later holder's lock
 *         const token = IMQLock.token('doSomething');
 *
 *         // always wrap locked work in try/catch and release on both paths,
 *         // otherwise waiters hang until the deadlock timeout fires
 *         try {
 *             // runs only once across all concurrent calls; every waiter
 *             // resolves with this same value
 *             const res = Math.random();
 *
 *             IMQLock.release('doSomething', res, undefined, token);
 *
 *             return res;
 *         } catch (err) {
 *             // reject every waiter with the same error
 *             IMQLock.release('doSomething', null, err, token);
 *             throw err;
 *         }
 *     }
 *
 *     return lock;
 * }
 *
 * for (let i = 0; i < 10; ++i) {
 *     doSomething().then(res => console.log(res));
 * }
 * ```
 */
export class IMQLock {
    /**
     * Maps a locked key to the token identifying its current holder. Absent
     * means unlocked; tokens start at 1, so the map stays truthy-testable.
     */
    private static acquiredLocks: { [key: string]: number } = {};
    private static queues: { [key: string]: IMQLockQueue } = {};
    private static metadata: IMQLockMetadata = {};
    /**
     * Source of lock tokens, incremented once per successful acquire so that no
     * two holders of the same key can ever share one.
     */
    private static lastToken: number = 0;

    /**
     * Deadlock timeout in milliseconds
     */
    public static deadlockTimeout: number = 10000;

    /**
     * Logger used to log errors that appear during locked calls
     */
    public static logger: ILogger = console;

    /**
     * Acquires a lock for a given key.
     *
     * @param key - key to acquire the lock for
     * @param callback - callback invoked on
     *                                               lock resolution
     * @param metadata - metadata for the locked call
     */
    public static async acquire<T>(
        key: string,
        callback?: (...args: any[]) => any,
        metadata?: IMQLockMetadataItem,
    ): Promise<AcquiredLock<T>> {
        IMQLock.queues[key] = IMQLock.queues[key] || [];

        if (metadata) {
            IMQLock.metadata[key] = metadata;
        }

        if (IMQLock.locked(key)) {
            return new Promise<T>((resolve, reject) => {
                let timer: NodeJS.Timeout | null = null;

                const task: IMQLockTask = [
                    (result: any) => {
                        // lock resolve
                        try {
                            timer && clearTimeout(timer);
                            timer = null;
                            callback && callback(null, result);
                        } catch (err) {
                            IMQLock.logger.error(err);
                        }

                        resolve(result);
                    },
                    (err: any) => {
                        // lock reject
                        try {
                            timer && clearTimeout(timer);
                            timer = null;
                            callback && callback(err);
                        } catch (e) {
                            err = e;
                        }

                        reject(err);
                    },
                ];

                if (IMQLock.deadlockTimeout) {
                    // avoid dead-locks using timeouts
                    timer = setTimeout(() => {
                        let dumpStr = '';

                        try {
                            dumpStr = JSON.stringify(IMQLock.metadata[key]);
                        } catch {
                            dumpStr = 'Unable to stringify metadata';
                        }

                        const err = new Error(
                            `Lock timeout, "${
                                key
                            }" call rejected, metadata: ${dumpStr}`,
                        );

                        timer && clearTimeout(timer);
                        timer = null;

                        // Rejecting through release() used to reject EVERY
                        // waiter on the key and hand the holder's lock to
                        // whoever asked next, so a waiter that arrived a
                        // moment ago died for an older waiter's patience. Only
                        // this waiter is rejected now, and only this waiter is
                        // taken out of the queue.
                        const queue = IMQLock.queues[key] || [];
                        const index = queue.indexOf(task);

                        if (~index) {
                            queue.splice(index, 1);
                        }

                        // The key is still freed: the holder may be one that
                        // never releases, and leaving the lock in place would
                        // poison the key for the life of the process. The
                        // queue is deliberately left alone, so the next holder
                        // adopts the waiters instead of them being dropped.
                        delete IMQLock.acquiredLocks[key];
                        delete IMQLock.metadata[key];

                        task[1](err);
                    }, IMQLock.deadlockTimeout);
                }

                IMQLock.queues[key].push(task);
            });
        }

        IMQLock.acquiredLocks[key] = ++IMQLock.lastToken;

        return true;
    }

    /**
     * Returns the token identifying the current holder of a given key, or
     * `undefined` when the key is not locked.
     *
     * @remarks
     * Read it immediately after {@link IMQLock.acquire} resolves and
     * {@link IMQLock.locked} confirms you are the holder, then hand it back to
     * {@link IMQLock.release} — that is what proves the release is yours. There
     * is no way to recover it later: once the deadlock timeout has freed the
     * key, this returns the NEXT holder's token, which is exactly the confusion
     * the token exists to prevent.
     *
     * @param key - key to read the current holder's token for
     */
    public static token(key: string): number | undefined {
        return IMQLock.acquiredLocks[key];
    }

    /**
     * Releases a previously acquired lock for a given key.
     *
     * @remarks
     * Pass the `token` {@link IMQLock.token} gave you when you acquired the
     * lock, and the release is ignored unless the key is still yours. Without
     * it the release is applied unconditionally, which is what this did for
     * every caller: the deadlock timeout frees a key while its holder is still
     * running, so the holder's eventual release landed on whichever call had
     * acquired the key in the meantime — resolving that call's waiters with a
     * result computed for nobody and freeing a lock still in use, which let a
     * third call in behind it.
     *
     * The token is optional only to keep the signature compatible. A release
     * without one cannot be checked, and stays as unsafe as it was.
     *
     * @param key - key to release the lock for
     * @param value - value to resolve pending calls with
     * @param err - error to reject pending calls with
     * @param token - token from {@link IMQLock.token} proving this release is
     *  the holder's own
     */
    public static release<T, E>(
        key: string,
        value?: T,
        err?: E,
        token?: number,
    ): void {
        const owner = IMQLock.acquiredLocks[key];

        // A different call owns the key now, so this release is a straggler
        // from a holder the deadlock timeout already gave up on: it must not
        // touch the current holder's lock, metadata or waiters. An unowned key
        // is not a conflict — the timeout freed it and nobody took it, so the
        // straggler is still the best answer its waiters are going to get.
        if (token !== undefined && owner !== undefined && owner !== token) {
            return;
        }

        const queue: IMQLockQueue = IMQLock.queues[key];

        IMQLock.queues[key] = [];
        delete IMQLock.acquiredLocks[key];
        delete IMQLock.metadata[key];

        let task: IMQLockTask | undefined;
        const processor = err ? 1 : 0;
        const arg = err ? err : value;

        while ((task = queue.shift())) {
            task[processor](arg);
        }
    }

    /**
     * Returns true if the given key is locked, false otherwise.
     *
     * @param key - key to check the lock state for
     */
    public static locked(key: string): boolean {
        return !!IMQLock.acquiredLocks[key];
    }
}
