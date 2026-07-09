import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { logged } from '../../src/decorators/logged.js';

describe('decorators/logged()', () => {
    it('should be a function and return decorator function', () => {
        assert.equal(typeof logged, 'function');
        // @ts-ignore
        const decorator = logged();
        assert.equal(typeof decorator, 'function');
    });

    it('should fallback to console logger and rethrow by default', async () => {
        const error = new Error('boom');
        const stub = mock.method(console, 'error', () => {});
        class A {
            // @ts-ignore
            @logged()
            public fail() {
                throw error;
            }
        }

        try {
            await new A().fail();
            assert.fail('should throw');
        } catch (e) {
            assert.equal(e, error);
            assert.equal(stub.mock.callCount() === 1, true);
            assert.equal(stub.mock.calls[0].arguments[0], error);
        } finally {
            stub.mock.restore();
        }
    });

    it('should use provided logger, level and suppress throw when doNotThrow', async () => {
        const error = new Error('warned');
        const myLogger = {
            warn: mock.fn(),
            error: mock.fn(),
            log: mock.fn(),
            info: mock.fn(),
        } as any;

        class B {
            // @ts-ignore
            @logged({ logger: myLogger, level: 'warn', doNotThrow: true })
            public fail() {
                throw error;
            }
        }

        const res = await new B().fail();
        assert.equal(res, undefined);
        assert.equal(myLogger.warn.mock.callCount() === 1, true);
        assert.equal(myLogger.warn.mock.calls[0].arguments[0], error);
    });

    it('should accept ILogger directly and rethrow by default', async () => {
        const error = new Error('as-logger');
        const myLogger = {
            warn: mock.fn(),
            error: mock.fn(),
            log: mock.fn(),
            info: mock.fn(),
        } as any;

        class C {
            // @ts-ignore
            @logged(myLogger)
            public fail() {
                throw error;
            }
        }

        try {
            await new C().fail();
            assert.fail('should throw');
        } catch (e) {
            assert.equal(e, error);
            assert.equal(myLogger.error.mock.callCount() === 1, true);
            assert.equal(myLogger.error.mock.calls[0].arguments[0], error);
        }
    });

    it('should use instance logger when present and rethrow', async () => {
        const error = new Error('inst-logger');
        const myLogger = {
            error: mock.fn(),
        } as any;
        class E {
            public logger = myLogger;
            // @ts-ignore
            @logged()
            public fail() {
                throw error;
            }
        }
        try {
            await new E().fail();
            assert.fail('should throw');
        } catch (e) {
            assert.equal(e, error);
            assert.equal(myLogger.error.mock.callCount() === 1, true);
            assert.equal(myLogger.error.mock.calls[0].arguments[0], error);
        }
    });

    it('should use target logger when present on prototype for instance method', async () => {
        const error = new Error('proto-logger');
        const protologger = { error: mock.fn() } as any;
        class F {
            // @ts-ignore
            @logged()
            public fail() {
                throw error;
            }
        }
        (F.prototype as any).logger = protologger;
        try {
            await new F().fail();
            assert.fail('should throw');
        } catch (e) {
            assert.equal(e, error);
            assert.equal(protologger.error.mock.callCount() === 1, true);
            assert.equal(protologger.error.mock.calls[0].arguments[0], error);
        }
    });

    it('should pass through successful return value', async () => {
        class D {
            // @ts-ignore
            @logged()
            public ok() {
                return 42;
            }
        }

        const v = await new D().ok();
        assert.equal(v, 42);
    });
});
