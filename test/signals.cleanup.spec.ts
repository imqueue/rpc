/*!
 * Signal-handler lifecycle tests: instances must remove their process signal
 * handlers when destroyed, so long-lived processes that create and destroy
 * clients/services do not leak listeners.
 */
import './mocks';
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { IMQClient, IMQService, expose, remote } from '..';
import { logger } from './mocks';

class SignalCleanupClient extends IMQClient {
    @remote()
    public async ping(): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

class SignalCleanupService extends IMQService {
    @expose()
    public ping(): string {
        return 'pong';
    }
}

describe('signal handler cleanup', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('client should remove its process signal handlers on destroy', async () => {
        const baseline = process.listenerCount('SIGTERM');
        const client = new SignalCleanupClient({ logger }, 'Ping');

        assert.equal(
            process.listenerCount('SIGTERM'),
            baseline + 1,
            'construction must register a SIGTERM handler',
        );

        await client.destroy();

        assert.equal(
            process.listenerCount('SIGTERM'),
            baseline,
            'destroy must remove the SIGTERM handler',
        );
    });

    it('service should remove its process signal handlers on destroy', async () => {
        const baseline = process.listenerCount('SIGTERM');
        const service = new SignalCleanupService({ logger });

        assert.equal(
            process.listenerCount('SIGTERM'),
            baseline + 1,
            'construction must register a SIGTERM handler',
        );

        await service.destroy();

        assert.equal(
            process.listenerCount('SIGTERM'),
            baseline,
            'destroy must remove the SIGTERM handler',
        );
    });
});
