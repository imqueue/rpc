/*!
 * IMQClient singleQueue lifecycle tests
 */
import './mocks';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQClient, remote } from '..';
import { logger } from './mocks';

class SingleQueueClient extends IMQClient {
    @remote()
    public async ping(): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

describe('IMQClient singleQueue lifecycle', () => {
    const clients: SingleQueueClient[] = [];

    const makeClient = (): SingleQueueClient => {
        const client = new SingleQueueClient(
            { logger, singleQueue: true },
            'Ping',
            `SingleQueueClient${clients.length}`,
        );

        clients.push(client);

        return client;
    };

    afterEach(async () => {
        while (clients.length) {
            try {
                await clients.pop()?.destroy();
            } catch {
                /* ignore */
            }
        }
        mock.restoreAll();
    });

    it('should not destroy the shared queue while other clients use it', async () => {
        const first = makeClient();
        const second = makeClient();

        const sharedImq: any = (first as any).imq;

        assert.equal(
            sharedImq,
            (second as any).imq,
            'both clients must share the same queue in singleQueue mode',
        );

        const destroySpy = mock.method(sharedImq, 'destroy', async () => {});

        await first.destroy();
        assert.equal(
            destroySpy.mock.callCount(),
            0,
            'shared queue must survive while another client still uses it',
        );

        await second.destroy();
        assert.equal(
            destroySpy.mock.callCount(),
            1,
            'last client must destroy the shared queue',
        );
    });

    it(
        'should create a fresh shared queue after the last client destroyed ' +
            'the previous one',
        async () => {
            const first = makeClient();
            const firstImq: any = (first as any).imq;

            mock.method(firstImq, 'destroy', async () => {});
            await first.destroy();

            const second = makeClient();

            assert.notEqual(
                (second as any).imq,
                firstImq,
                'a new client must not reuse a destroyed shared queue',
            );
        },
    );

    it('should destroy the per-client subscription queue', async () => {
        const client = makeClient();
        const subscriptionImq: any = (client as any).subscriptionImq;

        assert.notEqual(
            subscriptionImq,
            (client as any).imq,
            'singleQueue mode must use a separate subscription queue',
        );

        const destroySpy = mock.method(
            subscriptionImq,
            'destroy',
            async () => {},
        );

        await client.destroy();

        assert.equal(
            destroySpy.mock.callCount(),
            1,
            'subscription queue must be destroyed with the client',
        );
    });

    it(
        'should tolerate double destroy without over-releasing the shared ' +
            'queue',
        async () => {
            const first = makeClient();
            const second = makeClient();
            const sharedImq: any = (first as any).imq;
            const destroySpy = mock.method(
                sharedImq,
                'destroy',
                async () => {},
            );

            await first.destroy();
            await first.destroy(); // double destroy must be a no-op

            assert.equal(
                destroySpy.mock.callCount(),
                0,
                'double destroy must not tear down the shared queue early',
            );

            await second.destroy();
            assert.equal(destroySpy.mock.callCount(), 1);
        },
    );
});
