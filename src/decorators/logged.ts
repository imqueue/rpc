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
import { type ILogger } from '@imqueue/core';
import { errorCode } from '../helpers/index.js';

/**
 * Name of the class a decorated method was called on, or `unknown` when it
 * cannot be told.
 *
 * @param self - the `this` of the decorated call
 * @returns the class name
 *
 * @remarks
 * On a static method `this` is the class itself, so its own name is the answer
 * there — going through the constructor would report `Function`.
 */
function className(self: any): string {
    try {
        const name =
            typeof self === 'function' ? self.name : self?.constructor?.name;

        return typeof name === 'string' && name ? name : 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Names of the `ILogger` methods {@link logged} can use to record a caught
 * error.
 *
 * @remarks
 * `ILogger` is declared by `@imqueue/core` and is not re-exported here — import it
 * from that package if you need the type. A plain `console` satisfies it.
 */
export type LoggedLogLevel = 'info' | 'log' | 'warn' | 'error';

/**
 * Options for the {@link logged} decorator.
 */
export interface LoggedDecoratorOptions {
    /**
     * Which `ILogger` method records the error.
     *
     * @defaultValue 'error'
     *
     * @remarks
     * The resolved logger must implement this method, or the call throws a
     * `TypeError` from inside the catch block.
     */
    level?: LoggedLogLevel;
    /**
     * An explicit logger, taking precedence over the instance, class and console
     * fallbacks.
     */
    logger?: ILogger;
    /**
     * Set to `true` to swallow the error after logging it, in which case the method
     * resolves to `undefined`.
     *
     * @remarks
     * Inverted sense: by default the error is re-thrown.
     */
    doNotThrow?: boolean;
}

/**
 * Creates a `@logged()` method decorator that wraps the decorated method in a
 * try/catch and logs any error it throws. The logged line names the class, the
 * method and an allow-listed failure code — never the error object itself,
 * whose message, stack and properties may carry application data. The logger
 * is resolved in this order: an explicitly passed logger, then a `logger`
 * defined on the instance or on the class, and finally the global `console`.
 * By default the error is re-thrown after being logged; pass
 * `{ doNotThrow: true }` to swallow it. The returned decorator is dual-mode:
 * it works both as a standard (TC39) and as a legacy method decorator.
 *
 * @param options - a logger to use, or the
 *  logged-decorator options
 * @returns a dual-mode method decorator
 */
export function logged(options?: ILogger | LoggedDecoratorOptions): any {
    const level: LoggedLogLevel =
        options && (options as LoggedDecoratorOptions).level
            ? ((options as LoggedDecoratorOptions).level as LoggedLogLevel)
            : 'error';
    const doThrow = !options || !(options as LoggedDecoratorOptions).doNotThrow;

    const wrap = (original: (...args: any[]) => any, method?: string) =>
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

                // the caught value itself is never printed: an application
                // error may carry personal data, and an imq error carries the
                // call arguments in its own properties. Only the class, the
                // method and the failure code go out
                let where = 'unknown.unknown()';
                let code = 'unknown';

                try {
                    where = `${className(this)}.${method || 'unknown'}()`;
                    code = errorCode(err);
                } catch {
                    // extraction must never replace the original error, so
                    // the fallbacks above stand
                }

                // deliberately not contained: a throwing logger replaces the
                // original error today, and changing that would be a change
                // of behaviour rather than of logging
                (logger as any)[level](`${where} failed, code ${code}`);

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
            return wrap(target, context.name && String(context.name));
        }

        descriptor.value = wrap(descriptor.value, context && String(context));

        return descriptor;
    };
}
