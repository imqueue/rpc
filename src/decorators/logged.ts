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

// noinspection JSUnusedGlobalSymbols
/**
 * Logger decorator factory for class methods. Will try, catch and log errors
 * during method calls. If logger is bypassed, will use given logger, otherwise
 * will try to use logger defined on class dynamically or statically or will
 * fallback to console.
 *
 * @param {ILogger | LoggedDecoratorOptions} [options] - custom logger or
 *                                                       logged decorator
 *                                                       options
 * @return {Function} - decorator function
 */
export function logged(options?: ILogger | LoggedDecoratorOptions) {
    return (
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<(...args: any[]) => any>,
    ) => {
        const original = descriptor.value;
        const level: LoggedLogLevel = (
            options &&
            (options as LoggedDecoratorOptions).level
        )
            ? (options as LoggedDecoratorOptions).level as LoggedLogLevel
            : 'error';
        const doThrow = !options ||
            !(options as LoggedDecoratorOptions).doNotThrow;

        descriptor.value = async function<T>(...args: any[]): Promise<T|void> {
            try {
                return original && await original.apply(this || target, args);
            } catch (err) {
                const logger: ILogger = (options && (options as LoggedDecoratorOptions).logger)
                    ? (options as LoggedDecoratorOptions).logger as ILogger
                    : (options && (options as any).error)
                        ? options as ILogger
                        : (this && (this as any).logger)
                            ? (this as any).logger as ILogger
                            : (target && (target as any).logger)
                                ? (target as any).logger as ILogger
                                : console;

                (logger as any)[level](err);

                if (doThrow) {
                    throw err;
                }
            }
        };
    };
}
