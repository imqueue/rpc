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
 *         // always wrap locked work in try/catch and release on both paths,
 *         // otherwise waiters hang until the deadlock timeout fires
 *         try {
 *             // runs only once across all concurrent calls; every waiter
 *             // resolves with this same value
 *             const res = Math.random();
 *
 *             IMQLock.release('doSomething', res);
 *
 *             return res;
 *         } catch (err) {
 *             // reject every waiter with the same error
 *             IMQLock.release('doSomething', null, err);
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
    private static acquiredLocks: { [key: string]: boolean } = {};
    private static queues: { [key: string]: IMQLockQueue } = {};
    private static metadata: IMQLockMetadata = {};

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

                        IMQLock.release(key, null, err);
                    }, IMQLock.deadlockTimeout);
                }

                IMQLock.queues[key].push([
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
                ]);
            });
        }

        IMQLock.acquiredLocks[key] = true;

        return true;
    }

    /**
     * Releases a previously acquired lock for a given key.
     *
     * @param key - key to release the lock for
     * @param value - value to resolve pending calls with
     * @param err - error to reject pending calls with
     */
    public static release<T, E>(key: string, value?: T, err?: E): void {
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
