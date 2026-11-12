/*!
 * IMQ-RPC: where a remote call spent its time
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
import type { IMQRPCRequest } from './IMQRPCRequest.js';
import type { IMQRPCResponse } from './IMQRPCResponse.js';

/**
 * One call's round trip, split into where it went, in milliseconds.
 */
export interface IMQCallTiming {
    /** From handing the call to the queue until its answer arrived. */
    total: number;
    /** Inside the service's method. */
    handled: number;
    /** In the service between leaving the queue and entering the method. */
    waited: number;
    /**
     * Everything else: both trips through the queue, and the caller's own wait
     * to read the answer.
     */
    transit: number;
}

/**
 * Splits a call's round trip from the request a client sent and the response
 * it was answered with.
 *
 * @param request - the request as the client sent it, carrying `sentAt`
 * @param response - the response as it arrived, carrying `timing`
 * @param answeredAt - when the answer arrived, by the caller's clock
 * @returns the split, or `null` where either side did not record its half
 *
 * @remarks
 * Each figure is a difference of two readings of one clock — `total` the
 * caller's, `handled` and `waited` the service's — so clocks that disagree
 * between hosts move no figure. `transit` is what is left, and is where a
 * busy caller, a busy broker and the size of a message show.
 *
 * Call it from an `afterCall` hook, which runs as the answer arrives.
 */
export function callTiming(
    request: Partial<IMQRPCRequest> | undefined,
    response: Partial<IMQRPCResponse> | undefined,
    answeredAt: number = Date.now(),
): IMQCallTiming | null {
    const sentAt = request?.sentAt;
    const timing = response?.timing;

    if (typeof sentAt !== 'number' || !timing) {
        return null;
    }

    const total = Math.max(0, answeredAt - sentAt);
    const handled = Math.max(0, timing.finished - timing.started);
    const waited = Math.max(0, timing.started - timing.received);

    return {
        total,
        handled,
        waited,
        transit: Math.max(0, total - handled - waited),
    };
}
