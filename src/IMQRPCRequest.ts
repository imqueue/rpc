/*!
 * IMQ-RPC Interfaces: IMQRPCRequest
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
import { IMQMetadata } from './IMQMetadata.js';

/**
 * Wire format of a remote call, produced by a client and consumed by a service.
 *
 * @remarks
 * `from`, `method` and `args` are always present; `metadata` is absent — not
 * `null` — when the caller passed none. The whole structure is JSON-serialized, so
 * any `undefined` inside it is dropped in transit.
 */
export interface IMQRPCRequest extends JsonObject {
    /**
     * Name of the caller's own queue — the call's reply address.
     *
     * @remarks
     * The service publishes the response to exactly this queue, so it is not a
     * human-readable client label. Rewriting it in a `beforeCall` hook redirects
     * the reply.
     */
    from: string;
    /**
     * Name of the service method to invoke.
     *
     * @remarks
     * Not supplied by the caller: the {@link remote} decorator appends it to the
     * argument list and the client pops it back off. The service uses it for the
     * method lookup and to authorize the call against its exposed description.
     */
    method: string;
    /**
     * Positional arguments for the method, applied in order.
     *
     * @remarks
     * The client removes the trailing {@link IMQMetadata} and {@link IMQDelay}
     * slots and, on a delayed call, any trailing `undefined` placeholders — so this
     * array carries only real arguments. Its length is checked against the exposed
     * method description before the method runs.
     */
    args: any[];
    /**
     * Optional metadata attached by the caller.
     *
     * @remarks
     * Absent rather than `null` when none was passed. Service code should read it
     * through `currentMetadata()`; the value there is the JSON round-trip of the
     * caller's bag, so it is a plain object, not an {@link IMQMetadata} instance.
     */
    metadata?: IMQMetadata;
}
