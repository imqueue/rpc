/*!
 * IMQService reply-publish failure handling tests
 */
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'node:crypto';
import { IMQService, type IMQRPCRequest, expose } from '../index.js';

class ReplyFailService extends IMQService {
    @expose()
    public ping(): string {
        return 'pong';
    }
}

describe('IMQService reply-publish failure', () => {
    let service: any;

    afterEach(async () => {
        try {
            await service?.destroy();
        } catch {
            /* ignore */
        }
        mock.restoreAll();
    });

    it(
        'should not produce an unhandled rejection when publishing the ' +
            'response fails, and should log the error',
        async () => {
            const error = mock.fn();
            const logger: any = {
                info: () => {},
                warn: () => {},
                error,
                log: () => {},
            };

            service = new ReplyFailService({ logger });
            await service.start();

            // make the response publish fail (e.g. broker went away)
            mock.method(service.imq, 'send', async () => {
                throw new Error('broker down');
            });

            const unhandled = mock.fn();

            process.once('unhandledRejection', unhandled as any);

            const request: IMQRPCRequest = {
                from: 'ReplyFailClient',
                method: 'ping',
                args: [],
            };

            service.imq.emit('message', request, uuid());

            // allow the async handler chain (and any unhandled rejection
            // detection) to settle
            await new Promise(resolve => setTimeout(resolve, 20));

            assert.equal(
                unhandled.mock.callCount(),
                0,
                'reply failure must not surface as an unhandled rejection',
            );
            assert.ok(
                error.mock.callCount() > 0,
                'reply failure must be logged via logger.error',
            );

            process.removeListener('unhandledRejection', unhandled as any);
        },
    );

    it('should keep returning the message id of the sent response', async () => {
        const logger: any = {
            info: () => {},
            warn: () => {},
            error: () => {},
            log: () => {},
        };
        const order: string[] = [];

        service = new ReplyFailService({
            logger,
            afterCall: (async () => {
                order.push('afterCall');
            }) as any,
        });
        await service.start();

        mock.method(service.imq, 'send', async () => {
            order.push('send');

            return 'the-sent-id';
        });

        const { send: sendResponse } = await import('../index.js');
        const request: IMQRPCRequest = {
            from: 'ReplyFailClient',
            method: 'ping',
            args: [],
        };
        const id = await sendResponse(
            request,
            { to: 'request-id', data: null, error: null, request },
            service,
        );

        assert.equal(id, 'the-sent-id');
        assert.deepEqual(order, ['send', 'afterCall']);
    });

    it('should call core send without an error handler of its own', async () => {
        const logger: any = {
            info: () => {},
            warn: () => {},
            error: () => {},
            log: () => {},
        };

        service = new ReplyFailService({ logger });
        await service.start();

        const seen: any[] = [];

        mock.method(service.imq, 'send', async (...args: any[]) => {
            seen.push(args);

            return 'sent-id';
        });

        const { send: sendResponse } = await import('../index.js');
        const request: IMQRPCRequest = {
            from: 'ReplyFailClient',
            method: 'ping',
            args: [],
        };

        await sendResponse(
            request,
            { to: 'request-id', data: null, error: null, request },
            service,
        );

        // a rejected response write is core's to report: rpc passes no
        // fourth-argument error handler, exactly as it always did
        assert.equal(seen.length, 1);
        assert.equal(seen[0].length, 2);
        assert.equal(seen[0][0], 'ReplyFailClient');
    });
});
