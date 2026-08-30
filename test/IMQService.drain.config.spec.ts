/*!
 * Graceful drain: configuration parsing, opt-in wiring and the precision of the
 * signal-handler takeover.
 *
 * The behavioural half of the drain lives in `IMQService.drain.spec.ts`, which
 * drives real processes with real signals. This file covers what can be
 * observed without exiting.
 */
import './mocks/index.js';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQService, expose, DEFAULT_IMQ_DRAIN_TIMEOUT } from '../index.js';
import { logger } from './mocks/index.js';

class DrainConfigService extends IMQService {
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

describe('IMQService drain configuration', () => {
    const saved = {
        enable: process.env.IMQ_DRAIN_ENABLE,
        timeout: process.env.IMQ_DRAIN_TIMEOUT,
    };

    beforeEach(() => {
        delete process.env.IMQ_DRAIN_ENABLE;
        delete process.env.IMQ_DRAIN_TIMEOUT;
    });

    afterEach(async () => {
        mock.restoreAll();

        for (const [key, value] of [
            ['IMQ_DRAIN_ENABLE', saved.enable],
            ['IMQ_DRAIN_TIMEOUT', saved.timeout],
        ] as [string, string | undefined][]) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    });

    it('should default to off, allocating no tracking state', async () => {
        const service: any = new DrainConfigService({ logger });

        assert.equal(service.drainEnabled, false);
        assert.equal(
            service.inFlight,
            undefined,
            'the fast path must not allocate a tracking set',
        );
        assert.notEqual(
            service.options.handleSignals,
            false,
            'the queue keeps its own signal handling when draining is off',
        );

        await service.destroy();
    });

    it('should enable through IMQ_DRAIN_ENABLE=1', async () => {
        process.env.IMQ_DRAIN_ENABLE = '1';

        const service: any = new DrainConfigService({ logger });

        assert.equal(service.drainEnabled, true);
        assert.ok(service.inFlight instanceof Set);
        assert.equal(service.drainTimeout, DEFAULT_IMQ_DRAIN_TIMEOUT);
        assert.equal(
            service.options.handleSignals,
            false,
            'the queue must not exit the process from under a drain',
        );

        await service.destroy();
    });

    it('should enable through the constructor option', async () => {
        const service: any = new DrainConfigService({
            logger,
            drain: true,
            drainTimeout: 1234,
        });

        assert.equal(service.drainEnabled, true);
        assert.equal(service.drainTimeout, 1234);

        await service.destroy();
    });

    it('should let the constructor option override the environment', async () => {
        process.env.IMQ_DRAIN_ENABLE = '1';
        process.env.IMQ_DRAIN_TIMEOUT = '2000';

        const service: any = new DrainConfigService({ logger, drain: false });

        assert.equal(service.drainEnabled, false);
        assert.equal(service.inFlight, undefined);

        await service.destroy();
    });

    it('should read IMQ_DRAIN_TIMEOUT as milliseconds', async () => {
        process.env.IMQ_DRAIN_ENABLE = '1';
        process.env.IMQ_DRAIN_TIMEOUT = '2500';

        const service: any = new DrainConfigService({ logger });

        assert.equal(service.drainTimeout, 2500);

        await service.destroy();
    });

    it('should fail loudly on a non-numeric IMQ_DRAIN_ENABLE', () => {
        // `true` coerces to NaN under the framework's numeric convention, so
        // silently reading it as "off" would leave the feature quietly inert
        process.env.IMQ_DRAIN_ENABLE = 'true';

        assert.throws(
            () => new DrainConfigService({ logger }),
            /IMQ_DRAIN_ENABLE must be 0 or 1/,
        );
    });

    it('should fail loudly on an unusable IMQ_DRAIN_TIMEOUT', () => {
        process.env.IMQ_DRAIN_ENABLE = '1';

        for (const bad of ['soon', '0', '-1']) {
            process.env.IMQ_DRAIN_TIMEOUT = bad;

            assert.throws(
                () => new DrainConfigService({ logger }),
                /IMQ_DRAIN_TIMEOUT must be a positive number/,
                `"${bad}" must be rejected`,
            );
        }
    });
});

describe('IMQService drain signal takeover', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('should register drain handlers without disturbing foreign ones', async () => {
        const foreign = (): void => undefined;

        process.on('SIGTERM', foreign);

        const baseline = process.listenerCount('SIGTERM');
        const service: any = new DrainConfigService({ logger, drain: true });

        assert.equal(
            process.listenerCount('SIGTERM'),
            baseline + 1,
            'a drain-enabled service still registers exactly one handler',
        );

        // the drain's takeover only ever removes references this package
        // registered, so an unrelated library's handler must survive it
        const { removeTrackedSignalHandlers } =
            await import('../src/helpers/drain.js');

        removeTrackedSignalHandlers();

        assert.ok(
            process.listeners('SIGTERM').includes(foreign),
            'a foreign handler must survive the takeover',
        );

        await service.destroy();
        process.removeListener('SIGTERM', foreign);
    });

    it('should remove its handlers on destroy', async () => {
        const baseline = process.listenerCount('SIGTERM');
        const service: any = new DrainConfigService({ logger, drain: true });

        assert.equal(process.listenerCount('SIGTERM'), baseline + 1);

        await service.destroy();

        assert.equal(
            process.listenerCount('SIGTERM'),
            baseline,
            'a drain handler is unregistered like any other',
        );
    });
});
