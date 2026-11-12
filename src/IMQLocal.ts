/*!
 * IMQLocal implementation
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
 * A service this process serves itself, as a client in the same process
 * reaches it.
 *
 * @remarks
 * Registered by a service started with {@link IMQServiceOptions.local}, and
 * found by name by every client in the process. The contract is this object
 * and nothing else, because the service and its client need not share one
 * copy of this package: a host that loads a service from its own directory
 * loads that service's own `@imqueue/rpc` beside the host's, and both see one
 * registry.
 */
export interface IMQLocalService {
    /**
     * The service name, which is also its queue name.
     */
    readonly name: string;
    /**
     * Answers one request as the service would through its queue.
     *
     * @param request - the request as it would arrive off the queue: already
     *        a copy the caller no longer holds
     * @returns the response the service would have sent, before it is copied
     *          back to the caller
     */
    call(request: IMQRPCRequest): Promise<IMQRPCResponse>;
}

const registry = (() => {
    const anchor = globalThis as unknown as Record<
        symbol,
        Map<string, IMQLocalService> | undefined
    >;
    const symbol = Symbol.for('@imqueue/rpc:IMQ_LOCAL_SERVICES');

    return (anchor[symbol] ??= new Map<string, IMQLocalService>());
})();

/**
 * Makes a service reachable in process under its name.
 *
 * @param service - the service's local endpoint
 *
 * @remarks
 * A second service under the same name replaces the first, so that a service
 * started again after it was destroyed is the one called.
 */
export function registerLocalService(service: IMQLocalService): void {
    registry.set(service.name, service);
}

/**
 * Stops reaching a service in process. Its clients go back to the queue.
 *
 * @param service - the endpoint that was registered; another one registered
 *        since under the same name is left in place
 */
export function unregisterLocalService(service: IMQLocalService): void {
    if (registry.get(service.name) === service) {
        registry.delete(service.name);
    }
}

/**
 * The service this process serves under the given name, if it serves one.
 *
 * @param name - the service (queue) name
 */
export function localService(name: string): IMQLocalService | undefined {
    return registry.get(name);
}

/**
 * The name of every service this process serves itself, sorted.
 */
export function localServiceNames(): string[] {
    return [...registry.keys()].sort();
}

/**
 * Copies a value the way the queue does: through JSON and back.
 *
 * @param value - an object to copy
 * @returns the copy, which shares nothing with the value
 *
 * @remarks
 * This is what keeps an in-process call's semantics those of a queued one: a
 * `Date` arrives as its ISO string, a class instance as a plain object,
 * `undefined` properties are gone and `undefined` array items are `null`, and
 * neither side can change an object the other still holds. It throws where
 * the queue would fail to send, on a `BigInt` or a cycle.
 */
export function wireCopy<T extends object>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
