/*!
 * IMQService signal handler and publish() coverage tests
 */
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'crypto';
import { IMQService, IMQRPCRequest, expose } from '..';

class SignalTestService extends IMQService {
    @expose()
    public ping() {
        return 'pong';
    }
}

describe('IMQService signal handler and publish()', () => {
    afterEach(async () => {
        mock.restoreAll();
    });

    it('should call destroy() and log error on process signal (without exiting)', async () => {
        const handlers: { sig: string; fn: (...args: any[]) => any }[] = [];
        mock.method(process as any, 'on', (sig: string, fn: any) => {
            handlers.push({ sig, fn });
            return process as any;
        });

        // use fake timers to avoid triggering real process.exit from setTimeout
        mock.timers.enable({ apis: ['setTimeout'] });

        const logger: any = {
            info: () => {},
            warn: () => {},
            error: mock.fn(),
        };
        const service: any = new SignalTestService({ logger });

        // make destroy reject to hit catch(logger.error)
        mock.method(service, 'destroy', async () => {
            throw new Error('boom');
        });

        // simulate first registered signal handler
        assert.ok(handlers.length > 0);
        await handlers[0].fn();

        // let microtasks settle
        await Promise.resolve();

        assert.ok(logger.error.mock.callCount() > 0);

        mock.timers.reset();
    });

    it('publish() should delegate to imq.publish', async () => {
        const logger: any = { info: () => {}, warn: () => {}, error: () => {} };
        const service: any = new SignalTestService({ logger });
        const stub = mock.method(
            service.imq,
            'publish',
            async () => undefined as any,
        );

        await service.publish({ id: uuid() } as any);

        assert.equal(stub.mock.callCount() === 1, true);
    });
});
