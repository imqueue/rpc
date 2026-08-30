/*!
 * Graceful drain, end to end: a real child process, a real `SIGTERM`, and a
 * handler still running when it arrives.
 *
 * These cannot be in-process tests — the behaviour under test is what the
 * process does between receiving a signal and exiting, so each case spawns
 * `test/fixtures/drain-service.js` and reads the JSON progress lines it emits.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FIXTURE = fileURLToPath(
    new URL('./fixtures/drain-service.js', import.meta.url),
);
const WARMUP = fileURLToPath(new URL('./warmup.mjs', import.meta.url));

interface FixtureEvent {
    event: string;
    at: number;
    [key: string]: unknown;
}

interface FixtureRun {
    events: FixtureEvent[];
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
    exitAt: number;
    /** Milliseconds from the first `SIGTERM` to process exit. */
    sinceSignal: number;
}

/**
 * Runs the drain fixture in a child process and collects what it reported.
 *
 * @param {Record<string, string>} env - fixture configuration
 * @return {Promise<FixtureRun>}
 */
function run(env: Record<string, string>): Promise<FixtureRun> {
    return new Promise<FixtureRun>((resolve, reject) => {
        const child = spawn(
            process.execPath,
            ['--experimental-test-module-mocks', '--import', WARMUP, FIXTURE],
            { env: { ...process.env, ...env }, stdio: 'pipe' },
        );
        const events: FixtureEvent[] = [];
        let stdout = '';
        let stderr = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => (stdout += chunk));
        child.stderr.on('data', chunk => (stderr += chunk));
        child.on('error', reject);
        child.on('exit', (code, signal) => {
            const exitAt = Date.now();

            for (const line of stdout.split('\n')) {
                if (line.startsWith('{')) {
                    events.push(JSON.parse(line) as FixtureEvent);
                }
            }

            const signalled = events.find(e => e.event === 'signal:sent');

            resolve({
                events,
                stderr,
                code,
                signal,
                exitAt,
                sinceSignal: signalled ? exitAt - signalled.at : NaN,
            });
        });
    });
}

/**
 * Whether the fixture reported the given event.
 *
 * @param {FixtureRun} result - a completed fixture run
 * @param {string} event - event name
 * @return {boolean}
 */
function saw(result: FixtureRun, event: string): boolean {
    return result.events.some(e => e.event === event);
}

describe('IMQService graceful drain', () => {
    it("should keep today's behaviour when draining is off", async () => {
        // The regression guard. Without the opt-in a service signalled mid
        // handler must still abandon it and exit at once — that is the
        // documented behaviour existing deployments are timed against.
        const result = await run({
            IMQ_DRAIN_ENABLE: '0',
            HANDLER_MS: '3000',
            SIGNAL_AFTER_MS: '50',
        });

        assert.equal(result.code, 0, 'must still exit 0');
        assert.ok(
            saw(result, 'handler:start'),
            'the handler must have been dispatched',
        );
        assert.ok(
            !saw(result, 'handler:end'),
            'the handler must NOT be awaited when draining is off',
        );
        assert.ok(
            !saw(result, 'reply:sent'),
            'no reply is published when draining is off',
        );
        assert.ok(
            result.sinceSignal < 1500,
            `must exit promptly, took ${result.sinceSignal}ms`,
        );
    });

    it('should finish in-flight work and reply when draining is on', async () => {
        const result = await run({
            IMQ_DRAIN_ENABLE: '1',
            IMQ_DRAIN_TIMEOUT: '10000',
            HANDLER_MS: '3000',
            SIGNAL_AFTER_MS: '50',
        });

        assert.equal(result.code, 0, 'must exit 0');
        assert.ok(saw(result, 'handler:end'), 'the handler must complete');
        assert.ok(
            saw(result, 'reply:sent'),
            'the reply must be published — stop() leaves the writer alive',
        );
        // ~2950ms of handler remained when the signal landed
        assert.ok(
            result.sinceSignal > 2000 && result.sinceSignal < 5000,
            'signal-to-exit should be about the remaining handler time, ' +
                `was ${result.sinceSignal}ms`,
        );
    });

    it('should stay bounded by IMQ_DRAIN_TIMEOUT and never hang', async () => {
        const result = await run({
            IMQ_DRAIN_ENABLE: '1',
            IMQ_DRAIN_TIMEOUT: '800',
            HANDLER_MS: '8000',
            SIGNAL_AFTER_MS: '50',
        });

        assert.equal(result.code, 0, 'must exit 0 even when work is abandoned');
        assert.ok(
            !saw(result, 'handler:end'),
            'work exceeding the budget is abandoned, not awaited',
        );
        assert.ok(
            result.sinceSignal < 3000,
            `must exit within the budget, took ${result.sinceSignal}ms`,
        );
    });

    it('should exit immediately on a second signal during a drain', async () => {
        const result = await run({
            IMQ_DRAIN_ENABLE: '1',
            IMQ_DRAIN_TIMEOUT: '10000',
            HANDLER_MS: '8000',
            SIGNAL_AFTER_MS: '50',
            SECOND_SIGNAL_MS: '300',
        });

        assert.equal(result.code, 0, 'must exit 0');
        assert.ok(
            !saw(result, 'handler:end'),
            'the double interrupt must not wait for the handler',
        );
        assert.ok(
            result.sinceSignal < 2000,
            'must exit right after the second signal rather than at the ' +
                `budget, took ${result.sinceSignal}ms`,
        );
    });

    it('should survive a handler rejection mid-drain', async () => {
        const result = await run({
            IMQ_DRAIN_ENABLE: '1',
            IMQ_DRAIN_TIMEOUT: '10000',
            HANDLER_MS: '1000',
            HANDLER_THROWS: '1',
            SIGNAL_AFTER_MS: '50',
        });

        assert.equal(result.code, 0, 'must exit 0');
        assert.ok(saw(result, 'handler:end'), 'the handler must have run');
        assert.ok(
            saw(result, 'reply:sent'),
            'the error reply must still be published',
        );
        assert.ok(
            !/UnhandledPromiseRejection|ERR_UNHANDLED_REJECTION/.test(
                result.stderr,
            ),
            `tracking must not create an unhandled rejection: ${result.stderr}`,
        );
        assert.ok(
            result.sinceSignal < 4000,
            `a rejection must not stall the drain, took ${result.sinceSignal}ms`,
        );
    });
});
