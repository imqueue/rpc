/*!
 * IMQService logger fallback coverage test
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { uuid } from '@imqueue/core';
import { IMQService, IMQRPCRequest, expose, BEFORE_HOOK_ERROR, AFTER_HOOK_ERROR } from '..';

class ConsoleLoggerService extends IMQService {
  @expose()
  public ping() { return 'pong'; }
}

describe('IMQService handleRequest logger fallback to console', () => {
  let warnStub: sinon.SinonSpy;

  beforeEach(() => {
    warnStub = sinon.stub(console, 'warn' as any).callsFake(() => {});
  });

  afterEach(async () => {
    sinon.restore();
  });

  it('should use console when no custom logger provided and catch BEFORE hook error', async () => {
    const beforeCall = async () => { throw new Error('before fails'); };
    const service: any = new ConsoleLoggerService({ beforeCall }); // no logger provided

    const request: IMQRPCRequest = { from: 'Client', method: 'ping', args: [] };
    const id = uuid();

    await service.start();

    // Spy send to ensure regular flow continues and send is called even without afterCall
    const sendSpy = sinon.spy(service.imq, 'send');

    service.imq.emit('message', request, id);

    await new Promise((resolve, reject) => setTimeout(() => {
      try {
        expect(warnStub.called).to.equal(true);
        const hasBefore = warnStub.getCalls().some(c => c.args && c.args[0] === BEFORE_HOOK_ERROR);
        expect(hasBefore).to.equal(true);
        expect(sendSpy.called).to.equal(true);
        resolve(undefined);
      } catch (e) { reject(e); }
    }, 1));

    await service.destroy();
  });

  it('should use console when afterCall throws (send() logger fallback)', async () => {
    const afterCall = async () => { throw new Error('after fails'); };
    const service: any = new ConsoleLoggerService({ afterCall }); // no logger provided

    const request: IMQRPCRequest = { from: 'Client', method: 'ping', args: [] };
    const id = uuid();

    await service.start();

    service.imq.emit('message', request, id);

    await new Promise((resolve, reject) => setTimeout(() => {
      try {
        expect(warnStub.called).to.equal(true);
        const hasAfter = warnStub.getCalls().some(c => c.args && c.args[0] === AFTER_HOOK_ERROR);
        expect(hasAfter).to.equal(true);
        resolve(undefined);
      } catch (e) { reject(e); }
    }, 1));

    await service.destroy();
  });
});
