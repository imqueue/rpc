/*!
 * IMQ-RPC Decorators: lock
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
import { IMQLock, AcquiredLock, signature } from '..';

export interface LockOptions {
    disabled?: boolean;
    skipArgs?: number[];
}

/**
 * \@lock() decorator implementation
 * Will make all simultaneous similar method calls locked to be resolved with
 * the first obtained values. Similarity is identified by a bypassed method
 * argument values.
 *
 * @param {boolean|LockOptions} enabledOrOptions - whether to enable locks or not
 * @return {(
 *  target: any,
 *  methodName: (string),
 *  descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
 * ) => void}
 */
export function lock(enabledOrOptions: boolean | LockOptions = true) {
    return function(
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<(...args: any[]) => any>,
    ) {
        const enabled = typeof enabledOrOptions === 'boolean'
            ? enabledOrOptions
            : !enabledOrOptions.disabled;
        const skipArgs = typeof enabledOrOptions === 'boolean'
            ? undefined
            : enabledOrOptions.skipArgs;
        const original = descriptor.value;
        const className: string = typeof target === 'function'
            ? target.name              // static
            : target.constructor.name; // dynamic

        descriptor.value = async function<T>(...args: any[]): Promise<T> {
            const withLocks = !parseInt(
                process.env['DISABLE_LOCKS'] + ''
            ) && enabled;
            let lock: AcquiredLock<T>;
            let sig: string = '';

            if (withLocks) {
                sig = signature(
                    className,
                    methodName,
                    skipArgs ? args.filter((_, index) =>
                        !~skipArgs.indexOf(index)
                    ) : args,
                );
                lock = await IMQLock.acquire<T>(sig, undefined, {
                    className,
                    methodName,
                    args,
                });

                if (!IMQLock.locked(sig)) {
                    return <T>lock;
                }
            }

            try {
                // istanbul ignore next
                let result: any = original
                    ? original.apply(this, args)
                    : undefined;

                if (result && result.then &&
                    typeof result.then === 'function'
                ) {
                    result = await result;
                }

                if (withLocks) {
                    IMQLock.release(sig, result);
                }

                return result;
            } catch (err) {
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
