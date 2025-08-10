/*!
 * IMQService logger fallback branches coverage tests
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { uuid } from '@imqueue/core';
import { IMQService, IMQRPCRequest, expose, BEFORE_HOOK_ERROR, AFTER_HOOK_ERROR } from '..';

class FallbackLoggerService extends IMQService {
  @expose()
  public ping() { return 'pong'; }
}

describe('IMQService logger fallback branches', () => {
  beforeEach(() => sinon.restore());

  it('should use console (fallback) inside handleRequest when beforeCall throws and options.logger is undefined', async () => {
    const warnStub = sinon.stub(console, 'warn' as any).callsFake(() => {});
    const beforeCall = async () => { throw new Error('boom'); };
    // Explicitly override default logger to undefined to force fallback branch
    const service: any = new FallbackLoggerService({ beforeCall, logger: undefined as any });

    const request: IMQRPCRequest = { from: 'Client', method: 'ping', args: [] };
    const id = uuid();

    await service.start();
    service.imq.emit('message', request, id);

    await new Promise((resolve, reject) => setTimeout(() => {
      try {
        expect(warnStub.called).to.equal(true);
        const hasBefore = warnStub.getCalls().some(c => c.args && c.args[0] === BEFORE_HOOK_ERROR);
        expect(hasBefore).to.equal(true);
        resolve(undefined);
      } catch (e) { reject(e); }
    }, 1));

    await service.destroy();
  });

  it('should use console (fallback) inside send() when afterCall throws and options.logger is undefined', async () => {
    const warnStub = sinon.stub(console, 'warn' as any).callsFake(() => {});
    const afterCall = async () => { throw new Error('after fails'); };
    // Explicitly override default logger to undefined to force fallback branch
    const service: any = new FallbackLoggerService({ afterCall, logger: undefined as any });

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
