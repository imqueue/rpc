/*!
 * IMQLock implementation
 *
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
 */
import { ILogger } from '@imqueue/core';

export type AcquiredLock<T> = T | boolean;
export type IMQLockTask = [(...args: any[]) => any, (...args: any[]) => any];
export type IMQLockQueue  = Array<IMQLockTask>;
export interface IMQLockMetadataItem {
    className: string;
    methodName: string | symbol;
    args: any[];
}
export interface IMQLockMetadata {
    [key: string]: IMQLockMetadataItem;
}

/**
 * Class IMQLock.
 * Implements promise-based locks.
 *
 * @example
 * ~~~typescript
 * import { IMQLock, AcquiredLock } from '.';
 *
 * async function doSomething(): Promise<number | AcquiredLock<number>> {
 *     const lock: AcquiredLock<number> = await IMQLock.acquire<number>('doSomething');
 *
 *     if (IMQLock.locked('doSomething')) {
 *         // avoiding err handling in this way can cause ded-locks
 *         // so it is good always try catch locked calls!
 *         // BTW, IMQLock uses timeouts to avoid dead-locks
 *         try {
 *             // this code will be called only once per multiple async calls
 *             // so all promises will be resolved with the same value
 *             const res = Math.random();
 *             IMQLock.release('doSomething', res);
 *             return res;
 *         }
 *
 *         catch (err) {
 *              // release acquired locks with error
 *             IMQLock.release('doSomething', null, err);
 *             throw err;
 *         }
 *     }
 *
 *     return lock;
 * }
 *
 * (async () => {
 *     for (let i = 0; i < 10; ++i) {
 *         // run doSomething() asynchronously 10 times
 *         doSomething().then((res) => console.log(res));
 *     }
 * })();
 * ~~~
 */
export class IMQLock {

    private static acquiredLocks: { [key: string]: boolean } = {};
    private static queues: { [key: string]: IMQLockQueue } = {};
    private static metadata: IMQLockMetadata = {};

    /**
     * Deadlock timeout in milliseconds
     *
     * @type {number}
     */
    public static deadlockTimeout: number = 10000;

    /**
     * Logger used to log errors which appears during locked calls
     *
     * @type {ILogger}
     */
    public static logger: ILogger = console;

    /**
     * Acquires a lock for a given key
     *
     * @param {string} key
     * @param {(...args: any[]) => any} [callback]
     * @param {IMQLockMetadataItem} [metadata]
     * @returns {AcquiredLock}
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
                let timer: any = null;

                // istanbul ignore else
                if (IMQLock.deadlockTimeout) {
                    // avoid dead-locks using timeouts
                    timer = setTimeout(() => {
                        let dumpStr = '';

                        try {
                            dumpStr =  JSON.stringify(IMQLock.metadata[key]);
                        } catch (err) {
                            dumpStr = 'Unable to stringify metadata';
                        }

                        const err = new Error(`Lock timeout, "${
                            key
                        }" call rejected, metadata: ${ dumpStr }`);

                        clearTimeout(timer);
                        timer = null;

                        IMQLock.release(key, null, err);
                    }, IMQLock.deadlockTimeout);
                }

                IMQLock.queues[key].push([
                    // istanbul ignore next
                    (result: any) => { // lock resolve
                        try {
                            timer && clearTimeout(timer);
                            timer = null;
                            callback && callback(null, result);
                        }

                        catch (err) { IMQLock.logger.error(err) }

                        resolve(result);
                    },
                    // istanbul ignore next
                    (err: any) => { // lock reject
                        try {
                            timer && clearTimeout(timer);
                            timer = null;
                            callback && callback(err);
                        }

                        catch (e) { err = e }

                        reject(err);
                    }
                ]);
            });
        }

        IMQLock.acquiredLocks[key] = true;

        return true;
    }

    /**
     * Releases previously acquired lock for a given key
     *
     * @param {string} key
     * @param {T} value
     * @param {E} err
     */
    public static release<T, E>(key: string, value?: T, err?: E) {
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
     * Returns true if given key is locked, false otherwise
     *
     * @param {string} key
     * @returns {boolean}
     */
    public static locked(key: string): boolean {
        // noinspection PointlessBooleanExpressionJS
        return !!IMQLock.acquiredLocks[key];
    }
}
