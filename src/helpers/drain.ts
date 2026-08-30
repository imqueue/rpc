/*!
 * IMQ-RPC helpers: graceful drain configuration and signal-handler registry
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

/**
 * Default drain budget in milliseconds, used when neither
 * {@link IMQServiceOptions.drainTimeout} nor the `IMQ_DRAIN_TIMEOUT`
 * environment variable is set.
 *
 * @remarks
 * Chosen to sit below the `imq stop` CLI's escalation window: the CLI signals
 * the process group, then polls liveness 20 times at 250 ms (~5 s) before
 * sending `SIGKILL`. A budget above that would let the local CLI kill a
 * draining service harder than a cluster would, which is backwards. 4000 ms
 * leaves roughly a second of headroom for `stop()`, `destroy()` and process
 * teardown inside that window.
 *
 * Kubernetes is not the binding constraint here — its
 * `terminationGracePeriodSeconds` defaults to 30 s — so raise this (and the
 * CLI is then the odd one out) only for deployments that never use `imq stop`.
 */
export const DEFAULT_IMQ_DRAIN_TIMEOUT = 4000;

/**
 * Signals that trigger a graceful drain when draining is enabled.
 *
 * @remarks
 * A deliberate subset of {@link SIGNALS}: `SIGHUP` and `SIGQUIT` keep the
 * framework's pre-existing immediate-shutdown behaviour.
 */
export const DRAIN_SIGNALS: readonly string[] = ['SIGTERM', 'SIGINT'];

/**
 * A process signal handler registered by this framework.
 */
export type SignalHandler = (...args: any[]) => void;

/**
 * Every signal handler this package has installed on the process, by the exact
 * function reference, so a drain can take over from them without disturbing
 * handlers installed by unrelated libraries.
 *
 * @remarks
 * `process.removeAllListeners(signal)` would also drop those foreign handlers,
 * which is why registration is tracked explicitly instead.
 */
const registry = new Map<string, Set<SignalHandler>>();

/**
 * Set once any service in this process is constructed with draining enabled.
 *
 * @remarks
 * Read by {@link IMQClient} so that clients living in a draining service's
 * process do not let the queue layer's own signal handlers cut the drain
 * short. It is only consulted when draining was enabled through constructor
 * options; the environment variable is visible to every component directly.
 */
let processDrainEnabled = false;

/**
 * Installs a process signal handler and records it, so
 * {@link removeTrackedSignalHandlers} can take it back off again.
 *
 * @param signal - the signal to listen for
 * @param handler - the handler to install
 */
export function addTrackedSignalHandler(
    signal: string,
    handler: SignalHandler,
): void {
    let handlers = registry.get(signal);

    if (!handlers) {
        handlers = new Set<SignalHandler>();
        registry.set(signal, handlers);
    }

    handlers.add(handler);
    process.on(signal, handler);
}

/**
 * Removes a previously tracked signal handler from the process and from the
 * registry.
 *
 * @param signal - the signal the handler was installed for
 * @param handler - the exact handler reference that was installed
 */
export function removeTrackedSignalHandler(
    signal: string,
    handler: SignalHandler,
): void {
    registry.get(signal)?.delete(handler);
    process.removeListener(signal, handler);
}

/**
 * Removes every signal handler this package has installed, leaving handlers
 * installed by anything else untouched.
 *
 * @remarks
 * Used at the start of a drain: the framework's pre-existing handlers exit the
 * process on a fixed timer without waiting for in-flight work, which is exactly
 * what a drain must prevent. Drain handlers themselves are never registered
 * here, so they survive this and can still force an immediate exit on a second
 * signal.
 */
export function removeTrackedSignalHandlers(): void {
    for (const [signal, handlers] of registry) {
        for (const handler of handlers) {
            process.removeListener(signal, handler);
        }

        handlers.clear();
    }
}

/**
 * Marks this process as running with draining enabled.
 *
 * @param enabled - whether a drain-enabled service exists in this process
 */
export function setProcessDrainEnabled(enabled: boolean): void {
    processDrainEnabled = processDrainEnabled || enabled;
}

/**
 * Whether draining is enabled anywhere in this process, either through the
 * `IMQ_DRAIN_ENABLE` environment variable or through a service constructed
 * with the `drain` option.
 */
export function isProcessDrainEnabled(): boolean {
    return processDrainEnabled || drainEnabledFromEnv();
}

/**
 * Reads a boolean `IMQ_*` environment variable.
 *
 * @param name - environment variable name
 * @param defaultValue - value to use when the variable is unset or empty
 * @returns the parsed flag
 * @throws TypeError when the variable is set to something non-numeric
 *
 * @remarks
 * Numeric coercion matches the rest of the framework's boolean `IMQ_*`
 * variables, which are read as `!!+(process.env.X || 0)`. Under that
 * convention a well-meant `IMQ_DRAIN_ENABLE=true` coerces to `NaN` and reads
 * as *disabled* — a feature silently not doing anything. So anything that is
 * not a number throws instead.
 */
export function envFlag(name: string, defaultValue: boolean): boolean {
    const raw = process.env[name];

    if (raw === undefined || raw === '') {
        return defaultValue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
        throw new TypeError(
            `${name} must be 0 or 1, got ${JSON.stringify(raw)}. ` +
                'Boolean IMQ_* variables are read numerically.',
        );
    }

    return !!value;
}

/**
 * Reads a millisecond-valued `IMQ_*` environment variable.
 *
 * @param name - environment variable name
 * @param defaultValue - value to use when the variable is unset or empty
 * @returns the parsed duration in milliseconds
 * @throws TypeError when the variable is set to something that is not a finite
 *         number greater than zero
 */
export function envMs(name: string, defaultValue: number): number {
    const raw = process.env[name];

    if (raw === undefined || raw === '') {
        return defaultValue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0) {
        throw new TypeError(
            `${name} must be a positive number of milliseconds, ` +
                `got ${JSON.stringify(raw)}.`,
        );
    }

    return value;
}

/**
 * Whether `IMQ_DRAIN_ENABLE` turns draining on.
 *
 * @returns `true` only when the variable is set to a non-zero number
 * @throws TypeError when the variable is set to a non-numeric value
 *
 * @remarks
 * Read on every call rather than memoized at import time, unlike core's
 * `IMQ_SHUTDOWN_TIMEOUT`. Services resolve it once, at construction, so an
 * environment loaded after this module is imported — a `.env` file, a test
 * harness — still takes effect.
 */
export function drainEnabledFromEnv(): boolean {
    return envFlag('IMQ_DRAIN_ENABLE', false);
}

/**
 * The drain budget in milliseconds from `IMQ_DRAIN_TIMEOUT`, falling back to
 * {@link DEFAULT_IMQ_DRAIN_TIMEOUT}.
 *
 * @returns the drain budget in milliseconds
 * @throws TypeError when the variable is set to a non-positive or non-numeric
 *         value
 */
export function drainTimeoutFromEnv(): number {
    return envMs('IMQ_DRAIN_TIMEOUT', DEFAULT_IMQ_DRAIN_TIMEOUT);
}
