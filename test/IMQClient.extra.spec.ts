/*!
 * IMQClient Extra Unit Tests (non-RPC, using send stubs)
 */
import './mocks';
import { logger } from './mocks';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { IMQClient, IMQDelay, IMQMetadata, remote, AFTER_HOOK_ERROR, BEFORE_HOOK_ERROR } from '..';

class ExtraClient extends IMQClient {
    @remote()
    public async greet(name?: string, imqMetadata?: IMQMetadata, imqDelay?: IMQDelay) {
        return this.remoteCall<string>(...arguments);
    }
    @remote()
    public async fail(imqDelay?: IMQDelay) {
        return this.remoteCall<any>(...arguments);
    }
}

describe('IMQClient (extra branches without service)', () => {
    let client: ExtraClient;

    afterEach(async () => {
        await client?.destroy();
        sinon.restore();
    });

    it('should warn on BEFORE_HOOK_ERROR and continue call', async function() {
        this.timeout(5000);
        const warn = sinon.stub(logger, 'warn');
        client = new ExtraClient({ logger, beforeCall: async () => { throw new Error('before'); } });
        await client.start();
        const imq: any = (client as any).imq;
        sinon.stub(imq, 'send').callsFake(async (to: string, request: any, delay?: number) => {
            const id = 'ID1';
            setImmediate(() => imq.emit('message', { to: id, request, data: 'ok' }));
            return id;
        });
        const res = await client.greet('imq');
        expect(res).to.equal('ok');
        expect(warn.called).to.equal(true);
        expect(String(warn.firstCall.args[0])).to.contain(BEFORE_HOOK_ERROR);
    });

    it('should warn on AFTER_HOOK_ERROR for resolve and reject paths', async () => {
        const warn = sinon.stub(logger, 'warn');
        client = new ExtraClient({ logger, afterCall: async () => { throw new Error('after'); } });
        await client.start();
        const imq: any = (client as any).imq;
        const send = sinon.stub(imq, 'send');
        // success path
        send.onFirstCall().callsFake(async (to: string, request: any) => {
            const id = 'ID2';
            setImmediate(() => imq.emit('message', { to: id, request, data: 'success' }));
            return id;
        });
        // reject path
        send.onSecondCall().callsFake(async (to: string, request: any) => {
            const id = 'ID3';
            setImmediate(() => imq.emit('message', { to: id, request, error: new Error('boom') }));
            return id;
        });
        const ok = await client.greet('ok');
        expect(ok).to.equal('success');
        try { await client.fail(); } catch (e) { /* expected */ }
        // both paths should warn due to afterCall throwing
        expect(warn.callCount).to.be.greaterThan(0);
        expect(warn.getCalls().map(c => String(c.args[0])).join(' ')).to.contain(AFTER_HOOK_ERROR);
    });

    it('should emit event when resolver is missing', async () => {
        client = new ExtraClient({ logger });
        await client.start();
        const evt = sinon.spy();
        client.on('greet', evt);
        (client as any).imq.emit('message', {
            to: 'unknown-id',
            request: { method: 'greet' },
            data: { foo: 'bar' },
        });
        expect(evt.calledOnce).to.equal(true);
    });

    it('should sanitize invalid IMQDelay and pass IMQMetadata through request', async () => {
        client = new ExtraClient({ logger });
        await client.start();
        const imq: any = (client as any).imq;
        const sendStub = sinon.stub(imq, 'send').callsFake(async (to: string, request: any, delay?: number) => {
            expect(delay).to.equal(0);
            expect(request.metadata).to.be.instanceOf(IMQMetadata);
            const id = 'ID4';
            setImmediate(() => imq.emit('message', { to: id, request, data: 'x' }));
            return id;
        });
        const meta = new IMQMetadata({ a: 1 } as any);
        const res = await client.greet('z', meta as any, new IMQDelay(-100) as any);
        expect(res).to.equal('x');
        expect(sendStub.calledOnce).to.equal(true);
    });
});
