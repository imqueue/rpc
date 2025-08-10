import { expect } from 'chai';
import { logged } from '../../src/decorators/logged';

// Small, targeted tests to hit missing branches in logged.ts (lines 64 and 72)
describe('decorators/logged() target logger and no-original branches', () => {
  it('should return undefined when original is missing (no call, no throw)', async () => {
    const descriptor: PropertyDescriptor = { value: undefined } as any;
    const target: any = {};

    // Apply decorator to a descriptor without original implementation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged() as any)(target, 'missing', descriptor);

    // Call decorated function directly; should just return undefined
    const result = await (descriptor.value as any)();
    expect(result).to.be.undefined;
  });

  it('should use target logger when this is undefined and rethrow by default', async () => {
    const error = new Error('boom');
    const original = () => { throw error; };
    const descriptor: PropertyDescriptor = { value: original } as any;

    const targetLoggerCalls: Error[] = [];
    const target: any = {
      logger: {
        error: (e: Error) => { targetLoggerCalls.push(e); },
        warn: () => void 0,
        info: () => void 0,
        log: () => void 0,
      },
    };

    // Apply decorator; we will call without binding `this` so inside wrapper
    // `this` will be undefined and the code should select target.logger (line 72)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logged() as any)(target, 'willThrow', descriptor);

    try {
      // Call as a plain function to keep `this` undefined in strict mode
      await (descriptor.value as any)();
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).to.equal(error);
      expect(targetLoggerCalls).to.have.length(1);
      expect(targetLoggerCalls[0]).to.equal(error);
    }
  });

    it('should return undefined when original is missing (no call, no throw)', async () => {
        const descriptor: PropertyDescriptor = { value: undefined } as any;
        const target: any = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (logged() as any)(target, 'missing', descriptor);
        const result = await (descriptor.value as any)();
        expect(result).to.be.undefined;
    });

    it('should use target logger when this is undefined and rethrow by default', async () => {
        const error = new Error('boom');
        const original = () => { throw error; };
        const descriptor: PropertyDescriptor = { value: original } as any;

        const targetLoggerCalls: Error[] = [];
        const target: any = {
            logger: {
                error: (e: Error) => { targetLoggerCalls.push(e); },
                warn: () => void 0,
                info: () => void 0,
                log: () => void 0,
            },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (logged() as any)(target, 'willThrow', descriptor);

        try {
            await (descriptor.value as any)();
            expect.fail('should have thrown');
        } catch (e) {
            expect(e).to.equal(error);
            expect(targetLoggerCalls).to.have.length(1);
            expect(targetLoggerCalls[0]).to.equal(error);
        }
    });
});
