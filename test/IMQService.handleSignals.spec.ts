/*!
 * IMQService and `handleSignals`: a host that owns the process's shutdown must
 * be able to keep the service from installing its fixed-timer signal
 * handlers, as it can for a client. A drain is an opt-in of its own and keeps
 * its `SIGTERM`/`SIGINT` handlers either way.
 */
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQService, expose } from '../index.js';
import { logger } from './mocks/index.js';
import { listenerCounts, plusOne } from './fixtures/signal-listeners.js';

class SignalOptionService extends IMQService {
    /**
     * Answers immediately.
     *
     * @return {string}
     */
    @expose()
    public ping(): string {
        return 'pong';
    }
}

describe('IMQService handleSignals', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('installs a handler for every signal by default', async () => {
        const baseline = listenerCounts();
        const service = new SignalOptionService({ logger });

        assert.deepEqual(listenerCounts(), plusOne(baseline));

        await service.destroy();

        assert.deepEqual(listenerCounts(), baseline);
    });

    it('installs no process signal listener with handleSignals: false', async () => {
        const baseline = listenerCounts();
        const service = new SignalOptionService({
            logger,
            handleSignals: false,
        });

        assert.deepEqual(listenerCounts(), baseline);

        await service.start();

        assert.deepEqual(
            listenerCounts(),
            baseline,
            'its queue must not install any on start either',
        );

        await service.destroy();

        assert.deepEqual(listenerCounts(), baseline);
    });

    it('keeps only the drain handlers when draining with handleSignals: false', async () => {
        const baseline = listenerCounts();
        const service = new SignalOptionService({
            logger,
            handleSignals: false,
            drain: true,
        });

        assert.deepEqual(
            listenerCounts(),
            plusOne(baseline, ['SIGTERM', 'SIGINT']),
            'the drain is an explicit opt-in and still owns SIGTERM/SIGINT',
        );

        await service.destroy();

        assert.deepEqual(listenerCounts(), baseline);
    });
});
