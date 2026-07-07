/*!
 * IMQ-RPC Decorators: logged
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
import { ILogger } from '@imqueue/core';

export type LoggedLogLevel = 'info' | 'log' | 'warn' | 'error';

export interface LoggedDecoratorOptions {
    level?: LoggedLogLevel;
    logger?: ILogger;
    doNotThrow?: boolean;
}

/**
 * Creates a `@logged()` method decorator that wraps the decorated method in a
 * try/catch and logs any error it throws. The logger is resolved in this
 * order: an explicitly passed logger, then a `logger` defined on the instance
 * or on the class, and finally the global `console`. By default the error is
 * re-thrown after being logged; pass `{ doNotThrow: true }` to swallow it. The
 * returned decorator is dual-mode: it works both as a standard (TC39) and as a
 * legacy method decorator.
 *
 * @param {ILogger | LoggedDecoratorOptions} [options] - a logger to use, or the
 *  logged-decorator options
 * @return {Function} - a dual-mode method decorator
 */
export function logged(options?: ILogger | LoggedDecoratorOptions): any {
    const level: LoggedLogLevel =
        options && (options as LoggedDecoratorOptions).level
            ? ((options as LoggedDecoratorOptions).level as LoggedLogLevel)
            : 'error';
    const doThrow = !options || !(options as LoggedDecoratorOptions).doNotThrow;

    const wrap = (original: (...args: any[]) => any) =>
        async function <T>(this: any, ...args: any[]): Promise<T | void> {
            try {
                if (original) {
                    return await original.apply(this, args);
                }
            } catch (err) {
                const logger: ILogger =
                    options && (options as LoggedDecoratorOptions).logger
                        ? ((options as LoggedDecoratorOptions)
                              .logger as ILogger)
                        : options && (options as any).error
                          ? (options as ILogger)
                          : this && (this as any).logger
                            ? ((this as any).logger as ILogger)
                            : this &&
                                this.constructor &&
                                (this.constructor as any).logger
                              ? ((this.constructor as any).logger as ILogger)
                              : console;

                (logger as any)[level](err);

                if (doThrow) {
                    throw err;
                }
            }
        };

    // Dual-mode: works as both a standard (TC39) and a legacy
    // (experimentalDecorators) method decorator. Standard invocations pass a
    // context object with a `kind` property; legacy ones pass
    // (target, propertyKey, descriptor).
    return function (target: any, context: any, descriptor?: any): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            return wrap(target);
        }

        descriptor.value = wrap(descriptor.value);

        return descriptor;
    };
}
