/*!
 * IMQLock implementation
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

import { ILogger } from 'imq';

export type AcquiredLock<T> = T | boolean;
export type IMQLockTask = [Function, Function];
export type IMQLockQueue  = Array<IMQLockTask>;

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
     * @param {Function} callback
     * @returns {AcquiredLock}
     */
    public static async acquire<T>(
        key: string,
        callback?: Function
    ): Promise<AcquiredLock<T>> {
        IMQLock.queues[key] = IMQLock.queues[key] || [];

        if (IMQLock.locked(key)) {
            return new Promise<T>((resolve, reject) => {
                let timer: any = null;

                if (IMQLock.deadlockTimeout) {
                    // avoid dead-locks using timeouts
                    timer = setTimeout(() => {
                        const err = new Error(
                            `Lock timeout, "${key}" call rejected`);

                        clearTimeout(timer);
                        timer = null;

                        IMQLock.release(key, null, err);
                    }, IMQLock.deadlockTimeout);
                }

                IMQLock.queues[key].push([
                    (result: any) => { // lock resolve
                        try {
                            timer && clearTimeout(timer);
                            timer = null;
                            callback && callback(null, result);
                        }

                        catch (err) { IMQLock.logger.error(err) }

                        resolve(result);
                    },
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

        let task: IMQLockTask | undefined;
        const processor = err ? 1 : 0;
        const arg = err ? err : value;

        while (task = queue.shift()) {
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
        return !!IMQLock.acquiredLocks[key];
    }
}
