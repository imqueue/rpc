/*!
 * IMQService logger fallback branches coverage tests
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'crypto';
import {
    IMQService,
    IMQRPCRequest,
    expose,
    BEFORE_HOOK_ERROR,
    AFTER_HOOK_ERROR,
} from '..';

class FallbackLoggerService extends IMQService {
    @expose()
    public ping() {
        return 'pong';
    }
}

describe('IMQService logger fallback branches', () => {
    beforeEach(() => mock.restoreAll());

    it('should use console (fallback) inside handleRequest when beforeCall throws and options.logger is undefined', async () => {
        const warnStub = mock.method(console, 'warn' as any, () => {});
        const beforeCall = async () => {
            throw new Error('boom');
        };
        // Explicitly override default logger to undefined to force fallback branch
        const service: any = new FallbackLoggerService({
            beforeCall,
            logger: undefined as any,
        });

        const request: IMQRPCRequest = {
            from: 'Client',
            method: 'ping',
            args: [],
        };
        const id = uuid();

        await service.start();
        service.imq.emit('message', request, id);

        await new Promise((resolve, reject) =>
            setTimeout(() => {
                try {
                    assert.equal(warnStub.mock.callCount() > 0, true);
                    const hasBefore = warnStub
                        .mock.calls
                        .some((c: any) => c.arguments && c.arguments[0] === BEFORE_HOOK_ERROR);
                    assert.equal(hasBefore, true);
                    resolve(undefined);
                } catch (e) {
                    reject(e);
                }
            }, 1),
        );

        await service.destroy();
    });

    it('should use console (fallback) inside send() when afterCall throws and options.logger is undefined', async () => {
        const warnStub = mock.method(console, 'warn' as any, () => {});
        const afterCall = async () => {
            throw new Error('after fails');
        };
        // Explicitly override default logger to undefined to force fallback branch
        const service: any = new FallbackLoggerService({
            afterCall,
            logger: undefined as any,
        });

        const request: IMQRPCRequest = {
            from: 'Client',
            method: 'ping',
            args: [],
        };
        const id = uuid();

        await service.start();
        service.imq.emit('message', request, id);

        await new Promise((resolve, reject) =>
            setTimeout(() => {
                try {
                    assert.equal(warnStub.mock.callCount() > 0, true);
                    const hasAfter = warnStub
                        .mock.calls
                        .some((c: any) => c.arguments && c.arguments[0] === AFTER_HOOK_ERROR);
                    assert.equal(hasAfter, true);
                    resolve(undefined);
                } catch (e) {
                    reject(e);
                }
            }, 1),
        );

        await service.destroy();
    });
});
