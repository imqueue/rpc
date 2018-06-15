/*!
 * IMQ-RPC Decorators: lock
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
import { IMQLock, AcquiredLock, signature } from '..';

/**
 * \@lock() decorator implementation
 * Will make all simultaneous similar method calls locked to be resolved with
 * the first obtained values. Similarity is identified by a bypassed method
 * argument values.
 *
 * @return {(
 *  target: any,
 *  methodName: (string),
 *  descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
 * ) => void}
 */
export function lock(enabled: boolean = true) {
    return function(
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
    ) {
        const original = descriptor.value ||
            // istanbul ignore next
            (() => {});
        const className = typeof target === 'function'
            ? target.name              // static
            : target.constructor.name; // dynamic

        descriptor.value = async function<T>(...args: any[]): Promise<T> {
            const withLocks = !parseInt(
                process.env['DISABLE_LOCKS'] + ''
            ) && enabled;
            let lock: AcquiredLock<T>;
            let sig: string = '';

            if (withLocks) {
                sig = signature(className, methodName, args);
                lock = await IMQLock.acquire<T>(sig);

                if (!IMQLock.locked(sig)) {
                    return <T>lock;
                }
            }

            try {
                let result: any = original.apply(this, args);

                if (result && result.then) {
                    result = await result;
                }

                if (withLocks) {
                    IMQLock.release(sig, result);
                }

                return result;
            }

            catch (err) {
                // istanbul ignore next
                if (withLocks) {
                    IMQLock.release(sig, null, err);
                }

                // istanbul ignore next
                throw err;
            }
        };
    }
}
