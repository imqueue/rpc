/*!
 * IMQ-RPC Interfaces: IMQServiceOptions
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
import { DEFAULT_IMQ_OPTIONS, type IMQOptions } from '@imqueue/core';
import { type IMQRPCRequest } from './IMQRPCRequest.js';
import { type IMQRPCResponse } from './IMQRPCResponse.js';
import { IMQService } from './IMQService.js';
import { IMQClient } from './IMQClient.js';

/**
 * Hook invoked before a service method call is dispatched.
 *
 * @param {IMQRPCRequest} [req] - the incoming request
 * @param {IMQRPCResponse} [res] - the response being prepared
 * @return {Promise<void>}
 */
export interface IMQBeforeCall<_T> {
    (req?: IMQRPCRequest, res?: IMQRPCResponse): Promise<void>;
}

/**
 * Hook invoked after a service method call has been handled.
 *
 * @param {IMQRPCRequest} req - the handled request
 * @param {IMQRPCResponse} [res] - the produced response
 * @return {Promise<void>}
 */
export interface IMQAfterCall<_T> {
    (req: IMQRPCRequest, res?: IMQRPCResponse): Promise<void>;
}

/**
 * Around hook wrapping the actual service method invocation. It receives the
 * request/response and a `next` callback that runs the method and resolves to
 * its return value; it MUST call `next()` (returning its resolved value) to
 * produce the response data. Unlike `beforeCall`/`afterCall`, this lets a hook
 * run the method inside its own scope — e.g. establishing an OpenTelemetry
 * context so any spans the method (and its downstream calls) create nest under
 * the request span. When unset, the method is invoked directly.
 *
 * @param {IMQRPCRequest} req - the incoming request
 * @param {IMQRPCResponse} res - the response being prepared
 * @param {() => Promise<any>} next - runs the method, resolves to its result
 * @return {Promise<any>} - the value to use as the response data
 */
export interface IMQWrapCall<_T> {
    (
        req: IMQRPCRequest,
        res: IMQRPCResponse,
        next: () => Promise<any>,
    ): Promise<any>;
}

/**
 * Options for the built-in metrics server.
 */
export interface IMQMetricsServerOptions {
    enabled?: boolean;
    port?: number;
    queueLengthFormatter?: (length: number, metricName: string) => string;
}

/**
 * Options accepted by an IMQ service.
 */
export interface IMQServiceOptions extends IMQOptions {
    multiProcess: boolean;
    childrenPerCore: number;
    metricsServer?: IMQMetricsServerOptions;
    beforeCall?: IMQBeforeCall<IMQService>;
    afterCall?: IMQAfterCall<IMQService>;
    wrapCall?: IMQWrapCall<IMQService>;
}

/**
 * Options accepted by a generated IMQ client.
 */
export interface IMQClientOptions extends IMQOptions {
    path: string;
    compile: boolean;
    timeout: number;
    write: boolean;
    // Per-call timeout in milliseconds. When set to a positive number, every
    // remote call that has not received a response within the given time (plus
    // any requested IMQDelay) is rejected with an IMQ_RPC_CALL_TIMEOUT error
    // and its pending resolver is released. When 0 or unset, calls wait
    // indefinitely (a hung service keeps the caller's promise pending
    // forever), so enabling it is recommended for production use.
    callTimeout?: number;
    beforeCall?: IMQBeforeCall<IMQClient>;
    afterCall?: IMQAfterCall<IMQClient>;
    singleQueue?: boolean;
}

/**
 * Default service options
 *
 * @type {IMQServiceOptions}
 */
export const DEFAULT_IMQ_SERVICE_OPTIONS: IMQServiceOptions = {
    ...DEFAULT_IMQ_OPTIONS,
    cleanup: true,
    cleanupFilter: '*:client',
    multiProcess: false,
    childrenPerCore: 1,
};

/**
 * Default metrics server options
 *
 * @type {NonNullable<IMQMetricsServerOptions>}
 */
export const DEFAULT_IMQ_METRICS_SERVER_OPTIONS: NonNullable<IMQMetricsServerOptions> =
    {
        enabled: false,
        port: 9090,
        queueLengthFormatter: (length, metricName) =>
            `${metricName}{} ${length}`,
    };

/**
 * Default client options
 *
 * @type {IMQClientOptions}
 */
export const DEFAULT_IMQ_CLIENT_OPTIONS: IMQClientOptions = {
    ...DEFAULT_IMQ_OPTIONS,
    cleanup: true,
    cleanupFilter: '*:client',
    path: './src/clients',
    compile: true,
    timeout: 30000,
    write: true,
};
