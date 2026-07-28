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
import { type JsonObject } from '@imqueue/core';

/**
 * Prefix used when logging a failure inside a `beforeCall` hook.
 *
 * @remarks
 * A throwing before-hook is warned about and then ignored — the call proceeds — so
 * this string is how such failures are recognized in logs. It is a log prefix, not
 * an {@link IMQRPCError.code} value.
 */
export const BEFORE_HOOK_ERROR = 'Before call hook error:';

/**
 * Prefix used when logging a failure inside an `afterCall` hook.
 *
 * @remarks
 * The hook always runs after the response has been sent (service side) or after
 * the call promise has settled (client side), so a throwing after-hook cannot
 * change the call's outcome. It is a log prefix, not an {@link IMQRPCError.code}
 * value.
 */
export const AFTER_HOOK_ERROR = 'After call hook error:';

/**
 * Failure descriptor for a remote call.
 *
 * Produced by a service when a method throws, and also before dispatch when the
 * method does not exist, is not exposed, or was called with the wrong number of
 * arguments. A client additionally synthesizes one locally on call timeout.
 *
 * @remarks
 * A rejected client call rejects with this object as-is — it is not an `Error`
 * instance, so `err instanceof Error` is false, `err.stack` describes the remote
 * process rather than the caller's frames, and `message` is a plain property rather
 * than an `Error` message.
 */
export interface IMQRPCError extends JsonObject {
    /**
     * Machine-readable failure code.
     *
     * @remarks
     * The framework emits `IMQ_RPC_NO_METHOD`, `IMQ_RPC_NO_ACCESS`,
     * `IMQ_RPC_INVALID_ARGS_COUNT` and `IMQ_RPC_CALL_ERROR` on the service side,
     * and `IMQ_RPC_CALL_TIMEOUT` on the client side. When a service method throws
     * an error carrying its own `code`, that value is used verbatim instead of
     * `IMQ_RPC_CALL_ERROR`, so application-specific codes also surface here.
     *
     * These codes are not exported as constants — compare against the string
     * literals.
     */
    code: string;
    /**
     * Human-readable failure description.
     *
     * @remarks
     * Framework-generated messages name the service and method. For a method
     * failure it is the thrown value's `message` copied verbatim, so throwing a
     * non-`Error` leaves this absent from the delivered message.
     */
    message: string;
    /**
     * Stack trace as a string, from the service process. Empty string rather
     * than absent when unavailable.
     *
     * @remarks
     * For pre-dispatch failures it is captured at the framework check and points
     * into the service internals, not into application code; for a method failure
     * it is the thrown error's own stack.
     */
    stack: string;
    /**
     * Bare name of the method the call targeted, unqualified by service name.
     * Empty string rather than absent when unknown.
     */
    method: string;
    /**
     * The call's arguments serialized as a pretty-printed JSON string, not an
     * array — parse it before use.
     *
     * @remarks
     * This embeds every argument value in the error, which is also written to the
     * service log, so treat it as potentially sensitive. Serialization of this field
     * is not guarded: constructing an error throws if `args` is not
     * JSON-serializable, unlike {@link IMQRPCError.original}.
     */
    args: string;
    /**
     * The error the service method threw, as a JSON string — not an object,
     * despite the `any` type.
     *
     * @remarks
     * Present only for method failures, and `undefined` when the value could not be
     * serialized (circular references, `BigInt`).
     *
     * Because `Error`'s `message` and `stack` are non-enumerable, an ordinary
     * thrown `Error` serializes to `"\{\}"` here: this field carries only the
     * error's own enumerable properties, and never the stack. Read
     * {@link IMQRPCError.stack} and {@link IMQRPCError.message} for those.
     */
    original?: any;
}

/**
 * Builds a JSON representation of an IMQ error.
 *
 * @param code - error code
 * @param message - error message
 * @param stack - error stack
 * @param method - IMQ service method that produced the error
 * @param args - arguments passed to the service method call
 * @param original - original error thrown (JSON-serialized), if any
 */
export function IMQError(
    code: string,
    message: string,
    stack: any,
    method: any,
    args: unknown,
    original?: unknown,
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
            } catch {
                return undefined;
            }
        })(),
    };
}
