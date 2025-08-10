import { expect } from 'chai';
import { logged } from '../../src/decorators/logged';

/*
 * Additional coverage for logged.ts to reach 100% branches:
 * - Exercise `this || target` left-hand path (this is truthy)
 * - Ensure `this.logger` is preferred when available
 * - Cover options.logger usage and default rethrow behavior
 * - Cover passing an ILogger directly as options
 */

describe('decorators/logged() this logger and options logger branches', () => {
  afterEach(() => {
    // nothing to cleanup
  });

  it('should use bound `this` in apply(), prefer this.logger, not rethrow when doNotThrow=true', async () => {
    const error = new Error('use-this');
    let capturedThis: any;
    // original captures `this` then throws
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original: any = function original(this: any) {
      capturedThis = this;
      throw error;
    };

    const descriptor: PropertyDescriptor = { value: original } as any;
    const target: any = { logger: { error: () => void 0, warn: () => void 0, info: () => void 0, log: () => void 0 } };

    // Apply decorator: do not throw and use non-default level to verify dynamic call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged({ doNotThrow: true, level: 'warn' }) as any)(target, 'x', descriptor);

    const thisLoggerCalls: { level: string; error: Error }[] = [];
    const self: any = {
      logger: {
        error: (_e: Error) => thisLoggerCalls.push({ level: 'error', error: _e }),
        warn: (_e: Error) => thisLoggerCalls.push({ level: 'warn', error: _e }),
        info: (_e: Error) => thisLoggerCalls.push({ level: 'info', error: _e }),
        log: (_e: Error) => thisLoggerCalls.push({ level: 'log', error: _e }),
      },
    };

    // Call with `this` bound so (this || target) takes left-hand branch
    const res = await (descriptor.value as any).call(self);
    expect(res).to.be.undefined; // swallowed due to doNotThrow
    expect(capturedThis).to.equal(self);
    expect(thisLoggerCalls).to.have.length(1);
    expect(thisLoggerCalls[0].level).to.equal('warn');
    expect(thisLoggerCalls[0].error).to.equal(error);
  });

  it('should use options.logger when provided and rethrow by default', async () => {
    const error = new Error('use-options-logger');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original: any = () => { throw error; };
    const descriptor: PropertyDescriptor = { value: original } as any;
    const target: any = {};

    const calls: Error[] = [];
    const logger = { info: (e: Error) => { calls.push(e); }, error: () => {}, warn: () => {}, log: () => {} } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged({ logger, level: 'info' }) as any)(target, 'y', descriptor);

    try {
      await (descriptor.value as any)();
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).to.equal(error);
      expect(calls).to.have.length(1);
      expect(calls[0]).to.equal(error);
    }
  });

  it('should treat options itself as ILogger when it has error() method', async () => {
    const error = new Error('options-is-logger');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original: any = () => { throw error; };
    const descriptor: PropertyDescriptor = { value: original } as any;
    const target: any = {};

    const calls: Error[] = [];
    const optionsLogger = { error: (e: Error) => calls.push(e), log: () => {}, warn: () => {}, info: () => {} } as any;

    // Pass logger directly instead of options object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged(optionsLogger) as any)(target, 'z', descriptor);

    try {
      await (descriptor.value as any)();
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).to.equal(error);
      expect(calls).to.have.length(1);
      expect(calls[0]).to.equal(error);
    }
  });

  it('should use bound `this` in apply() and return value when original resolves', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original: any = function(this: any) { return this.answer; };
    const descriptor: PropertyDescriptor = { value: original } as any;
    const target: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged() as any)(target, 'ok', descriptor);
    const self: any = { answer: 42 };
    const res = await (descriptor.value as any).call(self);
    expect(res).to.equal(42);
  });

  it('should use target as `this` when caller `this` is falsy (right branch of this||target)', async () => {
    let gotThis: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original: any = function(this: any) { gotThis = this; return this.mark; };
    const descriptor: PropertyDescriptor = { value: original } as any;
    const target: any = { mark: 'TARGET' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged() as any)(target, 'right', descriptor);
    // Explicitly call with undefined `this`
    const res = await (descriptor.value as any).call(undefined);
    expect(res).to.equal('TARGET');
    expect(gotThis).to.equal(target);
  });

  it('should use target when caller `this` is null (second condition false)', async () => {
    let gotThis: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original: any = function(this: any) { gotThis = this; return this.mark; };
    const descriptor: PropertyDescriptor = { value: original } as any;
    const target: any = { mark: 'TARGET-NULL' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged() as any)(target, 'right-null', descriptor);
    // Explicitly call with null `this` to pass first check and fail second
    const res = await (descriptor.value as any).call(null);
    expect(res).to.equal('TARGET-NULL');
    expect(gotThis).to.equal(target);
  });
});
