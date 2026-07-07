/*!
 * IMQClient methods Unit Tests (subscribe/unsubscribe/broadcast + signals)
 */
import './mocks';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQClient, remote } from '..';
import { logger } from './mocks';

class MethodsClient extends IMQClient {
    // ensure there is at least one remote method (not used directly here)
    @remote()
    public async ping(): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

describe('IMQClient methods', () => {
    let client: MethodsClient;

    afterEach(async () => {
        try {
            await client?.destroy();
        } catch {
            /* ignore */
        }
        mock.restoreAll();
    });

    it('should delegate subscribe() to subscriptionImq with service name', async () => {
        client = new MethodsClient({ logger });
        const subImq: any = (client as any).subscriptionImq;
        const spy = mock.method(subImq, 'subscribe', async () => {});
        const handler = mock.fn();
        await client.subscribe(handler as any);
        assert.equal(spy.mock.callCount() === 1, true);
        assert.equal(spy.mock.calls[0].arguments[0], client.serviceName);
        assert.equal(spy.mock.calls[0].arguments[1], handler);
    });

    it('should delegate unsubscribe() to subscriptionImq', async () => {
        client = new MethodsClient({ logger });
        const subImq: any = (client as any).subscriptionImq;
        const spy = mock.method(subImq, 'unsubscribe', async () => {});
        await client.unsubscribe();
        assert.equal(spy.mock.callCount() === 1, true);
    });

    it('should delegate broadcast() to imq.publish with queueName', async () => {
        client = new MethodsClient({ logger });
        const imq: any = (client as any).imq;
        const spy = mock.method(imq, 'publish', async () => {});
        const payload: any = { hello: 'world' };
        await client.broadcast(payload);
        assert.equal(spy.mock.callCount() === 1, true);
        assert.equal(spy.mock.calls[0].arguments[0], payload);
        assert.equal(spy.mock.calls[0].arguments[1], client.queueName);
    });

    it('should handle process signals by calling destroy and then process.exit(0)', async () => {
        const callbacks: Array<() => any> = [];
        const onStub = mock.method(
            process as any,
            'on',
            (sig: any, cb: any) => {
                callbacks.push(cb);
                return process as any;
            },
        );
        const exitStub = mock.method(process as any, 'exit', () => {});
        mock.timers.enable({ apis: ['setTimeout'] });

        client = new MethodsClient({ logger });
        const destroyStub = mock.method(client, 'destroy', async () => {});

        // invoke the first registered signal handler (e.g., SIGTERM)
        await callbacks[0]();
        // fast-forward shutdown timeout
        mock.timers.tick(10000); // IMQ_SHUTDOWN_TIMEOUT default

        assert.equal(destroyStub.mock.callCount(), 1);
        assert.ok(exitStub.mock.callCount() > 0);
        assert.equal(exitStub.mock.calls[0].arguments[0], 0);

        mock.timers.reset();
        onStub.mock.restore();
        exitStub.mock.restore();
    });
});
