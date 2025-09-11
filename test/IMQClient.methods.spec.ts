/*!
 * IMQClient methods Unit Tests (subscribe/unsubscribe/broadcast + signals)
 */
import './mocks';
import { expect } from 'chai';
import * as sinon from 'sinon';
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
        try { await client?.destroy(); } catch { /* ignore */ }
        sinon.restore();
    });

    it('should delegate subscribe() to subscriptionImq with service name', async () => {
        client = new MethodsClient({ logger });
        const subImq: any = (client as any).subscriptionImq;
        const spy = sinon.stub(subImq, 'subscribe').resolves();
        const handler = sinon.spy();
        await client.subscribe(handler as any);
        expect(spy.calledOnce).to.equal(true);
        expect(spy.firstCall.args[0]).to.equal(client.serviceName);
        expect(spy.firstCall.args[1]).to.equal(handler);
    });

    it('should delegate unsubscribe() to subscriptionImq', async () => {
        client = new MethodsClient({ logger });
        const subImq: any = (client as any).subscriptionImq;
        const spy = sinon.stub(subImq, 'unsubscribe').resolves();
        await client.unsubscribe();
        expect(spy.calledOnce).to.equal(true);
    });

    it('should delegate broadcast() to imq.publish with queueName', async () => {
        client = new MethodsClient({ logger });
        const imq: any = (client as any).imq;
        const spy = sinon.stub(imq, 'publish').resolves();
        const payload: any = { hello: 'world' };
        await client.broadcast(payload);
        expect(spy.calledOnce).to.equal(true);
        expect(spy.firstCall.args[0]).to.equal(payload);
        expect(spy.firstCall.args[1]).to.equal(client.queueName);
    });

    it('should handle process signals by calling destroy and then process.exit(0)', async () => {
        const callbacks: Array<() => any> = [];
        const onStub = sinon.stub(process as any, 'on').callsFake((sig: any, cb: any) => {
            callbacks.push(cb);
            return process as any;
        });
        const exitStub = sinon.stub(process as any, 'exit');
        const clock = sinon.useFakeTimers();

        client = new MethodsClient({ logger });
        const destroyStub = sinon.stub(client, 'destroy').resolves();

        // invoke the first registered signal handler (e.g., SIGTERM)
        await callbacks[0]();
        // fast-forward shutdown timeout
        clock.tick(10000); // IMQ_SHUTDOWN_TIMEOUT default

        expect(destroyStub.calledOnce).to.equal(true);
        expect(exitStub.called).to.equal(true);
        expect(exitStub.firstCall.args[0]).to.equal(0);

        clock.restore();
        onStub.restore();
        exitStub.restore();
    });
});
