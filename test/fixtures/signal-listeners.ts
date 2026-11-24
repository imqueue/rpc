/*!
 * Process signal listener counts, for specs asserting which handlers a client
 * or a service installs and removes.
 */

/**
 * The signals this package installs handlers for.
 */
export const SIGNALS = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGQUIT'];

/**
 * The current listener count of every signal in {@link SIGNALS}.
 *
 * @returns the count per signal name
 */
export function listenerCounts(): Record<string, number> {
    return Object.fromEntries(
        SIGNALS.map(signal => [signal, process.listenerCount(signal)]),
    );
}

/**
 * The counts expected once each of `signals` gained one listener.
 *
 * @param counts - the counts to start from, as {@link listenerCounts} took them
 * @param signals - the signals that gained a listener; all of them by default
 * @returns the expected count per signal name
 */
export function plusOne(
    counts: Record<string, number>,
    signals: string[] = SIGNALS,
): Record<string, number> {
    return Object.fromEntries(
        SIGNALS.map(signal => [
            signal,
            counts[signal] + (signals.includes(signal) ? 1 : 0),
        ]),
    );
}
