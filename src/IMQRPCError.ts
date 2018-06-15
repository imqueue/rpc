/*!
 * IMQ-RPC Interfaces: IMQRPCError
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
import { IJson } from '@imqueue/core';

/**
 * Response error data structure, which service returns if error
 * occurred during service method execution.
 */
export interface IMQRPCError extends IJson {
    code: string;
    message: string;
    stack: string;
    method: string;
    args: string;
}

// istanbul ignore next
/**
 *
 * @param {string} code
 * @param {string} message
 * @param {string} stack
 * @param {string} method
 * @param {any} args
 * @return {IMQRPCError}
 */
export function IMQError(
    code: string,
    message: string,
    stack: any,
    method: any,
    args: any
): IMQRPCError {
    return {
        code,
        message,
        stack: stack || '',
        method: method || '',
        args: JSON.stringify(args, null, 2)
    };
}
