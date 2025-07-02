/*!
 * IMQ-RPC Interfaces: IMQRPCError
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
