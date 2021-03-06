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
import { JsonObject } from '@imqueue/core';

export const BEFORE_HOOK_ERROR = 'Before call hook error:';
export const AFTER_HOOK_ERROR = 'After call hook error:';

/**
 * Response error data structure, which service returns if error
 * occurred during service method execution.
 */
export interface IMQRPCError extends JsonObject {
    code: string;
    message: string;
    stack: string;
    method: string;
    args: string;
    original?: any;
}

// istanbul ignore next
/**
 * Builds JSON representation of IMQ Error
 *
 * @param {string} code    - error code
 * @param {string} message - error message
 * @param {string} stack   - error stack
 * @param {string} method  - IMQ service method called, which produced an error
 * @param {any} args       - IMQ service method call args passed
 * @param {any} [original] - Original error thrown (JSON'ified) if any
 * @return {IMQRPCError}
 */
export function IMQError(
    code: string,
    message: string,
    stack: any,
    method: any,
    args: any,
    original?: any,
): IMQRPCError {
    return {
        code,
        message,
        stack: stack || '',
        method: method || '',
        args: JSON.stringify(args, null, 2),
        original: (() => {
            try {
                return JSON.stringify(original);
            } catch (err) {
                return undefined;
            }
        })(),
    };
}
