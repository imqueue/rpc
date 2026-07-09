/*!
 * IMQService reply-publish failure handling tests
 */
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'node:crypto';
import { IMQService, IMQRPCRequest, expose } from '../index.js';

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
});
