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
            assert.equal(
                stub.mock.calls[0].arguments[0],
                'A.fail() failed, code unknown',
            );
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
        assert.equal(
            myLogger.warn.mock.calls[0].arguments[0],
            'B.fail() failed, code unknown',
        );
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
            assert.equal(
                myLogger.error.mock.calls[0].arguments[0],
                'C.fail() failed, code unknown',
            );
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
            assert.equal(
                myLogger.error.mock.calls[0].arguments[0],
                'E.fail() failed, code unknown',
            );
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
            assert.equal(
                protologger.error.mock.calls[0].arguments[0],
                'F.fail() failed, code unknown',
            );
        }
    });

    it('should never log the error object, its message or its stack', async () => {
        const error = new Error('customer 12345 ssn 000-00-0000');
        const myLogger = { error: mock.fn() } as any;

        class G {
            public logger = myLogger;
            // @ts-ignore
            @logged()
            public fail() {
                throw error;
            }
        }

        try {
            await new G().fail();
            assert.fail('should throw');
        } catch (e) {
            assert.equal(e, error, 'the original error must be re-thrown');
        }

        const line = String(myLogger.error.mock.calls[0].arguments[0]);

        assert.equal(myLogger.error.mock.calls[0].arguments.length, 1);
        assert.match(line, /G\.fail\(\)/);
        assert.equal(line.includes('12345'), false);
        assert.equal(line.includes('000-00-0000'), false);
        assert.equal(line.includes('at '), false);
    });

    it('should log the code of an error which carries one', async () => {
        const error = Object.assign(new Error('nope'), {
            code: 'IMQ_RPC_CALL_TIMEOUT',
        });
        const myLogger = { error: mock.fn() } as any;

        class H {
            public logger = myLogger;
            // @ts-ignore
            @logged()
            public fail() {
                throw error;
            }
        }

        await assert.rejects(new H().fail() as any);
        assert.equal(
            myLogger.error.mock.calls[0].arguments[0],
            'H.fail() failed, code IMQ_RPC_CALL_TIMEOUT',
        );
    });

    it('should keep names in the legacy decorator form', async () => {
        const error = new Error('legacy');
        const myLogger = { error: mock.fn() } as any;

        class I {
            public logger = myLogger;
            public fail(): void {
                throw error;
            }
        }

        const descriptor = {
            value: I.prototype.fail,
        } as PropertyDescriptor;

        (logged() as any)(I.prototype, 'fail', descriptor);
        I.prototype.fail = descriptor.value;

        await assert.rejects(new I().fail() as any);
        assert.equal(
            myLogger.error.mock.calls[0].arguments[0],
            'I.fail() failed, code unknown',
        );
    });

    it('should keep the current behaviour of a throwing logger', async () => {
        const error = new Error('original');
        const loggerError = new Error('logger is broken');
        const myLogger = {
            error: () => {
                throw loggerError;
            },
        } as any;

        class J {
            public logger = myLogger;
            // @ts-ignore
            @logged({ doNotThrow: true })
            public fail() {
                throw error;
            }
        }

        await assert.rejects(
            new J().fail() as any,
            (err: any) => err === loggerError,
        );
    });

    it('should name the class of a static method, not Function', async () => {
        const myLogger = { error: mock.fn() } as any;

        class K {
            public static logger = myLogger;

            public static fail(): void {
                throw new Error('static boom');
            }
        }

        const descriptor = { value: K.fail } as PropertyDescriptor;

        (logged() as any)(K, 'fail', descriptor);
        (K as any).fail = descriptor.value;

        await assert.rejects((K as any).fail());
        assert.equal(
            myLogger.error.mock.calls[0].arguments[0],
            'K.fail() failed, code unknown',
        );
    });

    it('should name the class of a static method in the TC39 form', async () => {
        const myLogger = { error: mock.fn() } as any;

        class L {
            public static logger = myLogger;

            public static fail(): void {
                throw new Error('static boom');
            }
        }

        const wrapped = (logged() as any)(L.fail, {
            kind: 'method',
            name: 'fail',
            static: true,
        });

        await assert.rejects(wrapped.call(L));
        assert.equal(
            myLogger.error.mock.calls[0].arguments[0],
            'L.fail() failed, code unknown',
        );
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
