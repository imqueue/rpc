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
 * Hook invoked before a call is dispatched.
 *
 * @remarks
 * On a service the hook receives `(request, response)`; on a client it
 * receives `(request)` only, and `res` is always `undefined`.
 *
 * Assigning `res.error` aborts the call — the method is never invoked and the
 * error is returned to the caller. This is the supported way to reject a request
 * from a hook. Assigning `res.data` has no effect, since it is overwritten by the
 * method's result.
 *
 * Throwing does not abort anything: the error is logged as a warning
 * (see {@link BEFORE_HOOK_ERROR}) and dispatch proceeds.
 *
 * The hook is invoked bound to the service or client instance, so a `function`
 * expression can reach `this.logger` and `this.options` — but the type parameter is
 * decorative, so `this` is not typed, and an arrow function does not receive the
 * instance at all.
 */
export interface IMQBeforeCall<_T> {
    /**
     * @param req - the incoming request
     * @param res - the response being prepared; service side only
     */
    (req?: IMQRPCRequest, res?: IMQRPCResponse): Promise<void>;
}

/**
 * Hook invoked after a call has been handled.
 *
 * @remarks
 * Purely for observation — logging, metrics, tracing. On a service it runs after
 * the response has already been sent; on a client it runs after the caller's
 * promise has already been resolved or rejected. In both cases it is too late to
 * change the outcome, and the caller does not wait for it.
 *
 * It is also invoked for failures, where `res` may be absent — for example when the
 * request could not be sent at all. Thrown errors are logged as warnings (see
 * {@link AFTER_HOOK_ERROR}) and swallowed; the return value is ignored.
 */
export interface IMQAfterCall<_T> {
    /**
     * @param req - the handled request
     * @param res - the produced response; may be absent on a failure
     */
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
 * @remarks
 * Service side only — there is no client equivalent, despite the type parameter.
 *
 * The hook's resolved value is the response data. Calling `next()` exactly once
 * and returning its value is the required pattern, but it is not enforced: omitting
 * `next()` silently skips the method and returns your value instead, and calling it
 * twice runs the method twice.
 *
 * Unlike {@link IMQBeforeCall} and {@link IMQAfterCall}, errors here are not
 * swallowed — anything this hook throws, or that propagates out of `next()`, becomes
 * the call's error response (`IMQ_RPC_CALL_ERROR`, preserving the thrown error's own
 * `code` when it has one). So a wrapping hook can safely let failures through or
 * rethrow enriched errors.
 *
 * Invoked bound to the service instance; `this` is untyped, so do not use an arrow
 * function if you need it.
 */
export interface IMQWrapCall<_T> {
    /**
     * @param req - the incoming request
     * @param res - the response being prepared
     * @param next - runs the method and resolves to its result
     * @returns the value to use as the response data
     */
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
    /**
     * Start the metrics HTTP listener when true.
     *
     * @defaultValue false
     *
     * @remarks
     * The listener serves a single route, `GET /metrics`, is unauthenticated, and is
     * bound to all interfaces. Every process that starts the service — including the
     * cluster primary in `multiProcess` mode — attempts to bind the port.
     */
    enabled?: boolean;
    /**
     * TCP port to bind on all interfaces.
     *
     * @defaultValue 9090
     */
    port?: number;
    /**
     * Renders the response body from the current queue length and the metric name,
     * which is always the literal `'queue_length'`.
     *
     * @remarks
     * Defaults to a Prometheus-style rendering. A falsy return falls back to the
     * bare number. Note that the queue length reports `0` while the queue's writer
     * is disconnected.
     */
    queueLengthFormatter?: (length: number, metricName: string) => string;
}

/**
 * Options accepted by an IMQ service.
 *
 * @remarks
 * Extends the core queue options, so all transport settings — `host`, `port`,
 * `prefix`, `safeDelivery`, `useGzip`, `cluster`, `logger` and the rest — are
 * accepted and forwarded to the queue factory.
 */
export interface IMQServiceOptions extends IMQOptions {
    /**
     * Fork one cluster worker per CPU core, multiplied by
     * {@link IMQServiceOptions.childrenPerCore}.
     *
     * @defaultValue false
     *
     * @remarks
     * The cluster primary also starts its own queue consumer and metrics listener
     * after forking, so a service configured for N workers runs N+1 consumers.
     * Workers are never respawned: when one dies the whole process exits with code
     * 1, leaving supervision to the process manager.
     */
    multiProcess: boolean;
    /**
     * Workers to fork per CPU core. Ignored unless
     * {@link IMQServiceOptions.multiProcess} is true.
     *
     * @defaultValue 1
     */
    childrenPerCore: number;
    /**
     * Built-in metrics HTTP listener settings.
     *
     * @remarks
     * Merged separately over {@link DEFAULT_IMQ_METRICS_SERVER_OPTIONS}, so
     * supplying a partial object keeps the default port and formatter.
     */
    metricsServer?: IMQMetricsServerOptions;
    /**
     * Pre-dispatch hook. See {@link IMQBeforeCall}.
     */
    beforeCall?: IMQBeforeCall<IMQService>;
    /**
     * Post-response hook. See {@link IMQAfterCall}.
     */
    afterCall?: IMQAfterCall<IMQService>;
    /**
     * Around hook wrapping the method invocation. See {@link IMQWrapCall}.
     */
    wrapCall?: IMQWrapCall<IMQService>;
    /**
     * Drain in-flight requests before shutting down on `SIGTERM`/`SIGINT`
     * instead of exiting on a fixed timer.
     *
     * @defaultValue the `IMQ_DRAIN_ENABLE` environment variable, itself
     *               defaulting to `false`
     *
     * @remarks
     * Opt-in. Left off, a service behaves exactly as it always has: the signal
     * handler starts `destroy()` without awaiting it and force-exits after
     * `IMQ_SHUTDOWN_TIMEOUT`, so a handler still running is abandoned and its
     * caller never receives a reply.
     *
     * Turned on, the service stops consuming, waits up to
     * {@link IMQServiceOptions.drainTimeout} for the handlers already running
     * to finish and publish their replies, then tears the transport down and
     * exits `0`. Because the queue layer's own signal handlers would exit the
     * process mid-drain, enabling this also forces
     * {@link IMQOptions.handleSignals} to `false` on the service's queue.
     *
     * Delivery stays at-least-once either way — a drain narrows the window in
     * which work is lost, it does not close it.
     *
     * Each process drains its own in-flight work, so under
     * {@link IMQServiceOptions.multiProcess} every forked worker drains
     * separately — and the cluster primary, which runs a consumer of its own,
     * drains only what that consumer was handling.
     */
    drain?: boolean;
    /**
     * Milliseconds a drain waits for in-flight requests before giving up on
     * them and exiting anyway. Ignored unless
     * {@link IMQServiceOptions.drain} is on.
     *
     * @defaultValue the `IMQ_DRAIN_TIMEOUT` environment variable, itself
     *               defaulting to {@link DEFAULT_IMQ_DRAIN_TIMEOUT} (4000)
     *
     * @remarks
     * The wait is always bounded: whatever has not finished by then is
     * abandoned, logged, and the process exits `0` regardless.
     */
    drainTimeout?: number;
}

/**
 * Options accepted by a generated IMQ client.
 *
 * @remarks
 * Extends the core queue options, so all transport settings are accepted as well.
 * Note that `path`, `compile`, `write` and `timeout` affect code generation
 * only and have no effect on an already-generated client at runtime.
 */
export interface IMQClientOptions extends IMQOptions {
    /**
     * Directory the generated client is written to, resolved relative to the
     * process working directory.
     *
     * @defaultValue './src/clients'
     *
     * @remarks
     * Created only one level deep, so the parent directories must already exist —
     * the default fails with `ENOENT` on a project that has no `./src` yet.
     */
    path: string;
    /**
     * Transpile the generated client and evaluate it in-process, returning its
     * exports.
     *
     * @defaultValue true
     *
     * @remarks
     * With `false`, generation only emits files and client creation resolves to
     * `null`.
     */
    compile: boolean;
    /**
     * Milliseconds the client generator waits for the target service to answer
     * its description request before failing.
     *
     * @defaultValue 30000
     *
     * @remarks
     * Despite the name this is not an RPC timeout and has no effect on runtime
     * calls — use {@link IMQClientOptions.callTimeout} for those.
     */
    timeout: number;
    /**
     * Persist the generated `.ts` and `.js` pair in {@link IMQClientOptions.path}.
     *
     * @defaultValue true
     *
     * @remarks
     * Existing files are silently overwritten.
     */
    write: boolean;
    /**
     * Per-call timeout in milliseconds.
     *
     * @remarks
     * When set to a positive number, every remote call that has not received a
     * response within the given time — plus any requested {@link IMQDelay} — is
     * rejected with an `IMQ_RPC_CALL_TIMEOUT` error and its pending resolver is
     * released. The internal timer is unref'd, so a pending call does not keep the
     * process alive.
     *
     * Unset by default, which means calls wait indefinitely and a hung or absent
     * service keeps the caller's promise pending forever. Enabling it is recommended
     * for production use.
     */
    callTimeout?: number;
    /**
     * Pre-dispatch hook. See {@link IMQBeforeCall}; on a client it receives the
     * request only.
     */
    beforeCall?: IMQBeforeCall<IMQClient>;
    /**
     * Post-settle hook. See {@link IMQAfterCall}.
     */
    afterCall?: IMQAfterCall<IMQClient>;
    /**
     * Share a single reply queue and transport connection across every client in the
     * process, instead of one per client.
     *
     * @defaultValue false
     *
     * @remarks
     * `queueName` then becomes the shared host-level name rather than a per-client
     * one, and each client keeps a private queue only for subscriptions.
     * Shared-queue teardown is reference-counted, so destroying one client leaves the
     * others working — but stopping one client stops reply delivery for every
     * client in the process.
     *
     * Use it to bound Redis connections when a process instantiates many clients.
     */
    singleQueue?: boolean;
}

/**
 * Process-wide anchor for the mutable default-option singletons below.
 *
 * @remarks
 * A module can be evaluated more than once inside one process: a loader that
 * handles ESM and CJS through separate pipelines — `tsx`, for one — produces a
 * distinct instance for `require('@imqueue/rpc')` and `import('@imqueue/rpc')`.
 * Ordinary module-scope objects would then exist twice, and anything that
 * *mutates* them to install behaviour would silently patch a copy the
 * application never calls. `@imqueue/opentelemetry` does exactly that to attach
 * its `beforeCall`/`afterCall`/`wrapCall` tracing hooks, and produced no spans
 * at all under such a loader, with no error to explain it.
 *
 * Keying on `Symbol.for` makes these singletons per *process* rather than per
 * module evaluation, so every instance hands out the same object and a mutation
 * through any of them is visible to all.
 */
const shared = <T extends object>(key: string, create: () => T): T => {
    const anchor = globalThis as unknown as Record<symbol, T | undefined>;
    const symbol = Symbol.for(`@imqueue/rpc:${key}`);

    return (anchor[symbol] ??= create());
};

/**
 * Default options applied to every IMQ service: the core queue defaults, plus
 * cleanup enabled with a `'*:client'` filter, single-process mode, and one worker
 * per core.
 *
 * @remarks
 * Note the two deliberate overrides of the core defaults: `cleanup` is `true`
 * (core defaults to `false`) and `cleanupFilter` is `'*:client'` (core `'*'`). So a
 * starting service prunes abandoned client queue keys, and the filter
 * deliberately excludes service queues.
 *
 * Metrics-server defaults are not part of this object — they live in
 * {@link DEFAULT_IMQ_METRICS_SERVER_OPTIONS} and are merged in separately by the
 * service constructor.
 */
export const DEFAULT_IMQ_SERVICE_OPTIONS: IMQServiceOptions = shared(
    'DEFAULT_IMQ_SERVICE_OPTIONS',
    () => ({
        ...DEFAULT_IMQ_OPTIONS,
        cleanup: true,
        cleanupFilter: '*:client',
        multiProcess: false,
        childrenPerCore: 1,
    }),
);

/**
 * Default metrics server options
 */
export const DEFAULT_IMQ_METRICS_SERVER_OPTIONS: NonNullable<IMQMetricsServerOptions> =
    {
        enabled: false,
        port: 9090,
        queueLengthFormatter: (length, metricName) =>
            `${metricName}{} ${length}`,
    };

/**
 * Default options applied to every generated IMQ client: the core queue defaults,
 * plus cleanup enabled with a `'*:client'` filter and the code-generation settings.
 *
 * @remarks
 * What is intentionally absent matters as much as what is present:
 * {@link IMQClientOptions.callTimeout} is unset, so runtime calls never time out
 * unless you set it, and {@link IMQClientOptions.singleQueue} is unset, so every
 * client creates its own queue.
 *
 * As with the service defaults, `cleanup: true` and `cleanupFilter: '*:client'`
 * override the core defaults, and `timeout` applies to the generator only.
 */
export const DEFAULT_IMQ_CLIENT_OPTIONS: IMQClientOptions = shared(
    'DEFAULT_IMQ_CLIENT_OPTIONS',
    () => ({
        ...DEFAULT_IMQ_OPTIONS,
        cleanup: true,
        cleanupFilter: '*:client',
        path: './src/clients',
        compile: true,
        timeout: 30000,
        write: true,
    }),
);
