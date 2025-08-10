import 'reflect-metadata';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { logged } from '../../src/decorators/logged';

describe('decorators/logged()', () => {
    it('should be a function and return decorator function', () => {
        expect(typeof logged).to.equal('function');
        // @ts-ignore
        const decorator = logged();
        expect(typeof decorator).to.equal('function');
    });

    it('should fallback to console logger and rethrow by default', async () => {
        const error = new Error('boom');
        const stub = sinon.stub(console, 'error');
        class A {
            // @ts-ignore
            @logged()
            public fail() {
                throw error;
            }
        }

        try {
            await new A().fail();
            expect.fail('should throw');
        } catch (e) {
            expect(e).to.equal(error);
            expect(stub.calledOnce).to.equal(true);
            expect(stub.firstCall.args[0]).to.equal(error);
        } finally {
            stub.restore();
        }
    });

    it('should use provided logger, level and suppress throw when doNotThrow', async () => {
        const error = new Error('warned');
        const myLogger = {
            warn: sinon.stub(),
            error: sinon.stub(),
            log: sinon.stub(),
            info: sinon.stub(),
        } as any;

        class B {
            // @ts-ignore
            @logged({ logger: myLogger, level: 'warn', doNotThrow: true })
            public fail() {
                throw error;
            }
        }

        const res = await new B().fail();
        expect(res).to.equal(undefined);
        expect(myLogger.warn.calledOnce).to.equal(true);
        expect(myLogger.warn.firstCall.args[0]).to.equal(error);
    });

    it('should accept ILogger directly and rethrow by default', async () => {
        const error = new Error('as-logger');
        const myLogger = {
            warn: sinon.stub(),
            error: sinon.stub(),
            log: sinon.stub(),
            info: sinon.stub(),
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
            expect.fail('should throw');
        } catch (e) {
            expect(e).to.equal(error);
            expect(myLogger.error.calledOnce).to.equal(true);
            expect(myLogger.error.firstCall.args[0]).to.equal(error);
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
        expect(v).to.equal(42);
    });
});
