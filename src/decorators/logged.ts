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

// noinspection JSUnusedGlobalSymbols
/**
 * Logger decorator factory for class methods. Will try, catch and log errors
 * during method calls. If logger is bypassed, will use given logger, otherwise
 * will try to use logger defined on class dynamically or statically or will
 * fallback to console.
 *
 * @param {ILogger} [logger] - some special logger to use, otherwise will
 *                             try to utilize thisObject.logger or
 *                             ObjectClass.logger or fallback to console
 * @return {Function} - decorator function
 */
export function logged(logger?: ILogger) {
    return (
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<(...args: any[]) => any>,
    ) => {
        const original = descriptor.value;

        descriptor.value = async function<T>(...args: any[]): Promise<T|void> {
            try {
                return original && await original.apply(this, args);
            } catch (err) {
                (logger || this.logger || target.logger || console).error(err);

                throw err;
            }
        };
    };
}
