/*!
 * IMQ-RPC Decorators: remote
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
 * Creates a `@remote()` method decorator for client classes. The decorated
 * method has the remote method name appended to its arguments and is then
 * forwarded to `remoteCall()`. The returned decorator is dual-mode: it works
 * both as a standard (TC39) and as a legacy (experimentalDecorators) method
 * decorator.
 *
 * @return {Function} - a dual-mode method decorator
 */
export function remote(): any {
    const wrap = (original: (...args: any[]) => any, methodName: string) =>
        function (this: any, ...args: any[]) {
            args.push(methodName);

            // istanbul ignore next
            return original ? original.apply(this, args) : undefined;
        };

    // Dual-mode: standard (TC39) invocations pass a context object with a
    // `kind` property; legacy ones pass (target, propertyKey, descriptor).
    return function (target: any, context: any, descriptor?: any): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            return wrap(target, String(context.name));
        }

        descriptor.value = wrap(descriptor.value, String(context));

        return descriptor;
    };
}
