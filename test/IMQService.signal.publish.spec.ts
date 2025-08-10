/*!
 * IMQService signal handler and publish() coverage tests
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { uuid } from '@imqueue/core';
import { IMQService, IMQRPCRequest, expose } from '..';

class SignalTestService extends IMQService {
  @expose()
  public ping() {
    return 'pong';
  }
}

describe('IMQService signal handler and publish()', () => {
  afterEach(async () => {
    sinon.restore();
  });

  it('should call destroy() and log error on process signal (without exiting)', async () => {
    const onStub = sinon.stub(process as any, 'on');
    const handlers: { sig: string; fn: (...args: any[]) => any }[] = [];
    onStub.callsFake((sig: string, fn: any) => { handlers.push({ sig, fn }); return process as any; });

    // use fake timers to avoid triggering real process.exit from setTimeout
    const clock = sinon.useFakeTimers();

    const logger: any = { info: () => {}, warn: () => {}, error: sinon.spy() };
    const service: any = new SignalTestService({ logger });

    // make destroy reject to hit catch(logger.error)
    sinon.stub(service, 'destroy').callsFake(async () => { throw new Error('boom'); });

    // simulate first registered signal handler
    expect(handlers.length).to.be.greaterThan(0);
    await handlers[0].fn();

    // let microtasks settle
    await Promise.resolve();

    expect(logger.error.called).to.equal(true);

    clock.restore();
  });

  it('publish() should delegate to imq.publish', async () => {
    const logger: any = { info: () => {}, warn: () => {}, error: () => {} };
    const service: any = new SignalTestService({ logger });
    const stub = sinon.stub(service.imq, 'publish').resolves(undefined as any);

    await service.publish({ id: uuid() } as any);

    expect(stub.calledOnce).to.equal(true);
  });
});
