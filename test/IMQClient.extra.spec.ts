/*!
 * IMQClient Extra Unit Tests (non-RPC, using send stubs)
 */
import './mocks';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { logger } from './mocks';
import {
    IMQClient,
    IMQDelay,
    IMQMetadata,
    remote,
    AFTER_HOOK_ERROR,
    BEFORE_HOOK_ERROR,
} from '..';

class ExtraClient extends IMQClient {
    @remote()
    public async greet(
        name?: string,
        imqMetadata?: IMQMetadata,
        imqDelay?: IMQDelay,
    ) {
        return this.remoteCall<string>(...arguments);
    }
    @remote()
    public async fail(imqDelay?: IMQDelay) {
        return this.remoteCall<any>(...arguments);
    }
}

describe('IMQClient (extra branches without service)', () => {
    let client: ExtraClient;

    afterEach(async () => {
        await client?.destroy();
        mock.restoreAll();
    });

    it('should warn on BEFORE_HOOK_ERROR and continue call', async () => {
        const warn = mock.method(logger, 'warn', () => {});
        client = new ExtraClient({
            logger,
            beforeCall: async () => {
                throw new Error('before');
            },
        });
        await client.start();
        const imq: any = (client as any).imq;
        mock.method(
            imq,
            'send',
            async (to: string, request: any, delay?: number) => {
                const id = 'ID1';
                setImmediate(() =>
                    imq.emit('message', { to: id, request, data: 'ok' }),
                );
                return id;
            },
        );
        const res = await client.greet('imq');
        assert.equal(res, 'ok');
        assert.equal(warn.mock.callCount() > 0, true);
        assert.ok(
            String(warn.mock.calls[0].arguments[0]).includes(BEFORE_HOOK_ERROR),
        );
    });

    it('should warn on AFTER_HOOK_ERROR for resolve and reject paths', async () => {
        const warn = mock.method(logger, 'warn', () => {});
        client = new ExtraClient({
            logger,
            afterCall: async () => {
                throw new Error('after');
            },
        });
        await client.start();
        const imq: any = (client as any).imq;
        const send = mock.method(imq, 'send', () => {});
        // success path (first call)
        send.mock.mockImplementationOnce(async (to: string, request: any) => {
            const id = 'ID2';
            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'success' }),
            );
            return id;
        }, 0);
        // reject path (second call)
        send.mock.mockImplementationOnce(async (to: string, request: any) => {
            const id = 'ID3';
            setImmediate(() =>
                imq.emit('message', {
                    to: id,
                    request,
                    error: new Error('boom'),
                }),
            );
            return id;
        }, 1);
        const ok = await client.greet('ok');
        assert.equal(ok, 'success');
        try {
            await client.fail();
        } catch (e) {
            /* expected */
        }
        // both paths should warn due to afterCall throwing
        assert.ok(warn.mock.callCount() > 0);
        assert.ok(
            warn.mock.calls
                .map((c: any) => String(c.arguments[0]))
                .join(' ')
                .includes(AFTER_HOOK_ERROR),
        );
    });

    it('should emit event when resolver is missing', async () => {
        client = new ExtraClient({ logger });
        await client.start();
        const evt = mock.fn();
        client.on('greet', evt);
        (client as any).imq.emit('message', {
            to: 'unknown-id',
            request: { method: 'greet' },
            data: { foo: 'bar' },
        });
        assert.equal(evt.mock.callCount() === 1, true);
    });

    it('should sanitize invalid IMQDelay and pass IMQMetadata through request', async () => {
        client = new ExtraClient({ logger });
        await client.start();
        const imq: any = (client as any).imq;
        const sendStub = mock.method(
            imq,
            'send',
            async (to: string, request: any, delay?: number) => {
                assert.equal(delay, 0);
                assert.ok(request.metadata instanceof IMQMetadata);
                const id = 'ID4';
                setImmediate(() =>
                    imq.emit('message', { to: id, request, data: 'x' }),
                );
                return id;
            },
        );
        const meta = new IMQMetadata({ a: 1 } as any);
        const res = await client.greet(
            'z',
            meta as any,
            new IMQDelay(-100) as any,
        );
        assert.equal(res, 'x');
        assert.equal(sendStub.mock.callCount() === 1, true);
    });
});
