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
 * Creates a `@lock()` method decorator. Concurrent calls to the decorated
 * method that share the same arguments are coalesced: only the first call is
 * executed, and all the others resolve with its result. Call similarity is
 * determined by the method's argument values. The returned decorator is
 * dual-mode: it works both as a standard (TC39) and as a legacy method
 * decorator.
 *
 * @param {boolean | LockOptions} enabledOrOptions - whether locking is enabled,
 *  or the lock options
 * @return {Function} - a dual-mode method decorator
 */
export function lock(enabledOrOptions: boolean | LockOptions = true): any {
    const enabled =
        typeof enabledOrOptions === 'boolean'
            ? enabledOrOptions
            : !enabledOrOptions.disabled;
    const skipArgs =
        typeof enabledOrOptions === 'boolean'
            ? undefined
            : enabledOrOptions.skipArgs;

    const wrap = (
        original: (...args: any[]) => any,
        methodName: string | symbol,
        isStatic: boolean,
    ) =>
        async function <T>(this: any, ...args: any[]): Promise<T> {
            const className: string = isStatic
                ? this.name // static: `this` is the class
                : this.constructor.name; // dynamic: `this` is the instance
            const withLocks =
                !parseInt(process.env['DISABLE_LOCKS'] + '') && enabled;
            let lock: AcquiredLock<T>;
            let sig: string = '';

            if (withLocks) {
                sig = signature(
                    className,
                    methodName,
                    skipArgs
                        ? args.filter((_, index) => !~skipArgs.indexOf(index))
                        : args,
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
                let result: any = original
                    ? original.apply(this, args)
                    : undefined;

                if (
                    result &&
                    result.then &&
                    typeof result.then === 'function'
                ) {
                    result = await result;
                }

                if (withLocks) {
                    IMQLock.release(sig, result);
                }

                return result;
            } catch (err) {
                if (withLocks) {
                    IMQLock.release(sig, null, err);
                }

                throw err;
            }
        };

    // Dual-mode: standard (TC39) invocations pass a context object with a
    // `kind` property; legacy ones pass (target, propertyKey, descriptor).
    return function (target: any, context: any, descriptor?: any): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            return wrap(target, context.name, context.static);
        }

        const isStatic = typeof target === 'function';

        descriptor.value = wrap(descriptor.value, context, isStatic);

        return descriptor;
    };
}
