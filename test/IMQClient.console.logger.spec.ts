/*!
 * IMQClient console logger fallback branches coverage
 */
import './mocks';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { IMQClient, IMQDelay, IMQMetadata, remote, AFTER_HOOK_ERROR, BEFORE_HOOK_ERROR } from '..';

class ConsoleClient extends IMQClient {
  @remote()
  public async ok(name?: string, meta?: IMQMetadata, delay?: IMQDelay) {
    return this.remoteCall<string>(...arguments);
  }
  @remote()
  public async boom() {
    return this.remoteCall<any>(...arguments);
  }
}

describe('IMQClient console logger fallbacks', () => {
  let client: ConsoleClient;

  afterEach(async () => {
    try { await client?.destroy(); } catch { /* ignore */ }
    sinon.restore();
  });

  it('should use console logger when BEFORE hook fails', async () => {
    const warn = sinon.stub(console, 'warn' as any).callsFake(() => {});
    client = new ConsoleClient({ beforeCall: async () => { throw new Error('before oops'); } });
    await client.start();

    const imq: any = (client as any).imq;
    sinon.stub(imq, 'send').callsFake(async (_to: string, request: any) => {
      const id = 'C1';
      setImmediate(() => imq.emit('message', { to: id, request, data: 'good' }));
      return id;
    });

    const res = await client.ok('x');
    expect(res).to.equal('good');
    expect(warn.called).to.equal(true);
    expect(String(warn.firstCall.args[0])).to.contain(BEFORE_HOOK_ERROR);
  });

  it('should use console logger when AFTER hook fails (resolve and reject paths)', async () => {
    const warn = sinon.stub(console, 'warn' as any).callsFake(() => {});
    client = new ConsoleClient({ afterCall: async () => { throw new Error('after oops'); } });
    await client.start();

    const imq: any = (client as any).imq;
    const send = sinon.stub(imq, 'send');

    // success path
    send.onFirstCall().callsFake(async (_to: string, request: any) => {
      const id = 'C2';
      setImmediate(() => imq.emit('message', { to: id, request, data: 'S' }));
      return id;
    });

    // reject path
    send.onSecondCall().callsFake(async (_to: string, request: any) => {
      const id = 'C3';
      setImmediate(() => imq.emit('message', { to: id, request, error: new Error('bad') }));
      return id;
    });

    const ok = await client.ok('ok');
    expect(ok).to.equal('S');

    try { await client.boom(); } catch { /* expected */ }

    expect(warn.callCount).to.be.greaterThan(0);
    const messages = warn.getCalls().map(c => String(c.args[0])).join(' ');
    expect(messages).to.contain(AFTER_HOOK_ERROR);
  });
});
