/*!
 * IMQService logger fallback coverage test
 */
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'crypto';
import {
    IMQService,
    IMQRPCRequest,
    expose,
    BEFORE_HOOK_ERROR,
    AFTER_HOOK_ERROR,
} from '..';

class ConsoleLoggerService extends IMQService {
    @expose()
    public ping() {
        return 'pong';
    }
}

describe('IMQService handleRequest logger fallback to console', () => {
    let warnStub: any;

    beforeEach(() => {
        warnStub = mock.method(console, 'warn' as any, () => {});
    });

    afterEach(async () => {
        mock.restoreAll();
    });

    it('should use console when no custom logger provided and catch BEFORE hook error', async () => {
        const beforeCall = async () => {
            throw new Error('before fails');
        };
        const service: any = new ConsoleLoggerService({ beforeCall }); // no logger provided

        const request: IMQRPCRequest = {
            from: 'Client',
            method: 'ping',
            args: [],
        };
        const id = uuid();

        await service.start();

        // Spy send to ensure regular flow continues and send is called even without afterCall
        const sendSpy = mock.method(service.imq, 'send');

        service.imq.emit('message', request, id);

        await new Promise((resolve, reject) =>
            setTimeout(() => {
                try {
                    assert.equal(warnStub.mock.callCount() > 0, true);
                    const hasBefore = warnStub
                        .mock.calls
                        .some((c: any) => c.arguments && c.arguments[0] === BEFORE_HOOK_ERROR);
                    assert.equal(hasBefore, true);
                    assert.equal(sendSpy.mock.callCount() > 0, true);
                    resolve(undefined);
                } catch (e) {
                    reject(e);
                }
            }, 1),
        );

        await service.destroy();
    });

    it('should use console when afterCall throws (send() logger fallback)', async () => {
        const afterCall = async () => {
            throw new Error('after fails');
        };
        const service: any = new ConsoleLoggerService({ afterCall }); // no logger provided

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
