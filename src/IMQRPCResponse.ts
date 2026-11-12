/*!
 * IMQ-RPC Interfaces: IMQRPCResponse
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
import { type IMQRPCError, type IMQRPCRequest } from './index.js';

/**
 * Response message data structure that a service replies with to handled
 * requests.
 */
export interface IMQRPCResponse extends JsonObject {
    /**
     * Correlation identifier: the queue-assigned message id of the request this
     * response answers.
     *
     * @remarks
     * This is not an address. The client matches it against its table of
     * pending calls, so it must be echoed back exactly. The response is delivered
     * to {@link IMQRPCRequest.from} instead.
     */
    to: string;
    /**
     * The value the service method returned, as JSON.
     *
     * @remarks
     * Despite the `JsonObject` annotation this may be any JSON value — primitive,
     * array or object — and the key is absent from the delivered message when
     * the method returned nothing. It is `null` on the initial response skeleton
     * and stays `null` when the call failed.
     */
    data: JsonObject | null;
    /**
     * `null` on success, otherwise the failure descriptor.
     *
     * @remarks
     * The client checks this field first and rejects the call with it, ignoring
     * {@link IMQRPCResponse.data} — so the two are effectively mutually exclusive.
     */
    error: IMQRPCError | null;
    /**
     * The originating request, echoed back in full — method, arguments and
     * metadata included.
     *
     * @remarks
     * Always present: the client reads `request.method` when it cannot match the
     * response to a pending call, in order to re-emit it as an event. Note that
     * this round-trips every argument value back to the caller.
     */
    request: IMQRPCRequest;
    /**
     * When the service took the request off the queue, started the method and
     * finished it, in milliseconds since the epoch by the service's clock.
     *
     * @remarks
     * Absent on a response from a service older than this field. Only the
     * differences between its own values mean anything to a caller, because
     * the two clocks are not the same clock; {@link callTiming} combines them
     * with the caller's own round trip without comparing one with the other.
     */
    timing?: IMQRPCTiming;
}

/**
 * Where a service spent a call, by its own clock.
 */
export interface IMQRPCTiming extends JsonObject {
    /** When the message was taken off the queue. */
    received: number;
    /** When the method was entered, after the service's `beforeCall` ran. */
    started: number;
    /** When the method returned or threw. */
    finished: number;
}
