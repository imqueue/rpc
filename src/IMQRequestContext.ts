/*!
 * IMQRequestContext implementation
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
import { AsyncLocalStorage } from 'node:async_hooks';
import { IMQMetadata } from './IMQMetadata';
import { IMQRPCRequest } from './IMQRPCRequest';

const storage = new AsyncLocalStorage<IMQRPCRequest>();

/**
 * Runs the given function with `request` bound to the current async execution
 * context, so any code reached from it (and its asynchronous continuations) can
 * access the in-flight request's metadata via `currentMetadata()` without
 * threading it through call signatures.
 *
 * The binding is scoped to the function: it is established for the duration of
 * the call and automatically removed afterwards, which keeps concurrent
 * requests isolated from one another.
 *
 * @param {IMQRPCRequest} request - the request to bind for this execution
 * @param {() => T} fn - the work to run within the bound context
 * @return {T}
 */
export function runWithRequest<T>(request: IMQRPCRequest, fn: () => T): T {
    return storage.run(request, fn);
}

/**
 * Returns the metadata of the in-flight IMQ request for the current async
 * execution, if any. Returns `undefined` outside of a `runWithRequest()` scope.
 * The transport carries metadata as an opaque bag; callers interpret its fields.
 *
 * @return {IMQMetadata | undefined}
 */
export function currentMetadata(): IMQMetadata | undefined {
    return storage.getStore()?.metadata;
}
