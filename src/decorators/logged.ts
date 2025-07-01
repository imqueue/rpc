/*!
 * IMQ-RPC Decorators: logged
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
        const logger = options && (options as LoggedDecoratorOptions).logger
            ? (options as LoggedDecoratorOptions).logger
            : options && (options as ILogger).error ? options :
                this?.logger || target?.logger || console;
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
                logger[level](err);

                if (doThrow) {
                    throw err;
                }
            }
        };
    };
}
