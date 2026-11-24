/*!
 * IMQClient and `handleSignals`: a host that owns the process's shutdown — an
 * HTTP gateway holding clients — must be able to keep the client from
 * installing process signal handlers, because those exit the process on a
 * fixed timer and cut the host's own graceful shutdown short.
 */
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQClient, remote } from '../index.js';
import { logger } from './mocks/index.js';
import { listenerCounts, plusOne } from './fixtures/signal-listeners.js';

class SignalOptionClient extends IMQClient {
    @remote()
    public async ping(): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

describe('IMQClient handleSignals', () => {
    const savedDrain = process.env.IMQ_DRAIN_ENABLE;

    afterEach(() => {
        mock.restoreAll();

        if (savedDrain === undefined) {
            delete process.env.IMQ_DRAIN_ENABLE;
        } else {
            process.env.IMQ_DRAIN_ENABLE = savedDrain;
        }
    });

    it('installs a handler for every signal by default', async () => {
        const baseline = listenerCounts();
        const client = new SignalOptionClient({ logger }, 'Ping');

        assert.deepEqual(listenerCounts(), plusOne(baseline));

        await client.destroy();

        assert.deepEqual(
            listenerCounts(),
            baseline,
            'destroy must remove every handler the client installed',
        );
    });

    it('installs them with handleSignals: true as well', async () => {
        const baseline = listenerCounts();
        const client = new SignalOptionClient(
            { logger, handleSignals: true },
            'Ping',
        );

        assert.deepEqual(listenerCounts(), plusOne(baseline));

        await client.destroy();

        assert.deepEqual(listenerCounts(), baseline);
    });

    it('installs no process signal listener with handleSignals: false', async () => {
        const baseline = listenerCounts();
        const client = new SignalOptionClient(
            { logger, handleSignals: false },
            'Ping',
        );

        assert.deepEqual(
            listenerCounts(),
            baseline,
            'the host owns shutdown, so construction must add no listener',
        );

        // the queue layer installs its own handlers when it starts, so the
        // option has to reach it too for the process to stay the host's
        await client.start();

        assert.deepEqual(
            listenerCounts(),
            baseline,
            'starting must add no listener either',
        );

        await client.destroy();

        assert.deepEqual(listenerCounts(), baseline);
    });

    it("leaves the host's own handler in place across destroy", async () => {
        const hostHandler = (): void => undefined;

        process.on('SIGTERM', hostHandler);

        const withHost = listenerCounts();
        const client = new SignalOptionClient(
            { logger, handleSignals: false },
            'Ping',
        );

        assert.deepEqual(listenerCounts(), withHost);

        await client.destroy();

        assert.deepEqual(listenerCounts(), withHost);
        assert.ok(process.listeners('SIGTERM').includes(hostHandler));

        process.removeListener('SIGTERM', hostHandler);
    });

    it('keeps its handlers for a drain to take over when the host said nothing', async () => {
        process.env.IMQ_DRAIN_ENABLE = '1';

        const baseline = listenerCounts();
        const client = new SignalOptionClient({ logger }, 'Ping');

        assert.equal(
            client.options.handleSignals,
            false,
            "a drain keeps the queue's handlers off, as before",
        );
        assert.deepEqual(
            listenerCounts(),
            plusOne(baseline),
            "the client's own handlers stay, for the drain to take over",
        );

        await client.destroy();

        assert.deepEqual(listenerCounts(), baseline);
    });

    it('installs none under a drain when the host said false', async () => {
        process.env.IMQ_DRAIN_ENABLE = '1';

        const baseline = listenerCounts();
        const client = new SignalOptionClient(
            { logger, handleSignals: false },
            'Ping',
        );

        assert.deepEqual(listenerCounts(), baseline);

        await client.destroy();
    });
});
