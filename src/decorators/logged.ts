/*!
 * IMQ-RPC Decorators: logged
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
                this.logger || target.logger || console;
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
                return original && await original.apply(this, args);
            } catch (err) {
                logger[level](err);

                if (doThrow) {
                    throw err;
                }
            }
        };
    };
}
