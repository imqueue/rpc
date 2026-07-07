/*!
 * IMQClient console logger fallback branches coverage
 */
import './mocks';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
    IMQClient,
    IMQDelay,
    IMQMetadata,
    remote,
    AFTER_HOOK_ERROR,
    BEFORE_HOOK_ERROR,
} from '..';

class ConsoleClient extends IMQClient {
    @remote()
    public async ok(name?: string, meta?: IMQMetadata, delay?: IMQDelay) {
        return this.remoteCall<string>(...arguments);
    }
    @remote()
    public async boom() {
        return this.remoteCall<any>(...arguments);
    }
}

describe('IMQClient console logger fallbacks', () => {
    let client: ConsoleClient;

    afterEach(async () => {
        try {
            await client?.destroy();
        } catch {
            /* ignore */
        }
        mock.restoreAll();
    });

    it('should use console logger when BEFORE hook fails', async () => {
        const warn = mock.method(console, 'warn' as any, () => {});
        client = new ConsoleClient({
            beforeCall: async () => {
                throw new Error('before oops');
            },
        });
        await client.start();

        const imq: any = (client as any).imq;
        mock.method(imq, 'send', async (_to: string, request: any) => {
            const id = 'C1';
            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'good' }),
            );
            return id;
        });

        const res = await client.ok('x');
        assert.equal(res, 'good');
        assert.equal(warn.mock.callCount() > 0, true);
        assert.ok(
            String(warn.mock.calls[0].arguments[0]).includes(BEFORE_HOOK_ERROR),
        );
    });

    it('should use console logger when AFTER hook fails (resolve and reject paths)', async () => {
        const warn = mock.method(console, 'warn' as any, () => {});
        client = new ConsoleClient({
            afterCall: async () => {
                throw new Error('after oops');
            },
        });
        await client.start();

        const imq: any = (client as any).imq;
        const send = mock.method(imq, 'send', () => {});

        // success path (first call)
        send.mock.mockImplementationOnce(async (_to: string, request: any) => {
            const id = 'C2';
            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'S' }),
            );
            return id;
        }, 0);

        // reject path (second call)
        send.mock.mockImplementationOnce(async (_to: string, request: any) => {
            const id = 'C3';
            setImmediate(() =>
                imq.emit('message', {
                    to: id,
                    request,
                    error: new Error('bad'),
                }),
            );
            return id;
        }, 1);

        const ok = await client.ok('ok');
        assert.equal(ok, 'S');

        try {
            await client.boom();
        } catch {
            /* expected */
        }

        assert.ok(warn.mock.callCount() > 0);
        const messages = warn.mock.calls
            .map((c: any) => String(c.arguments[0]))
            .join(' ');
        assert.ok(messages.includes(AFTER_HOOK_ERROR));
    });

    it('should use right-hand console branch in remoteCall when BEFORE hook fails', async () => {
        const warn = mock.method(console, 'warn' as any, () => {});
        // Explicitly override default logger to be undefined to force `|| console` take the right branch
        client = new ConsoleClient({
            beforeCall: async () => {
                throw new Error('before oops');
            },
            logger: undefined as any,
        });
        await client.start();

        const imq: any = (client as any).imq;
        mock.method(imq, 'send', async (_to: string, request: any) => {
            const id = 'MB1';
            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'ok' }),
            );
            return id;
        });

        const res = await client.ok('x');
        assert.equal(res, 'ok');
        assert.equal(warn.mock.callCount() > 0, true);
        assert.ok(
            String(warn.mock.calls[0].arguments[0]).includes(BEFORE_HOOK_ERROR),
        );
    });

    it('should use right-hand console branch in imqCallResolver when AFTER hook fails on resolve', async () => {
        const warn = mock.method(console, 'warn' as any, () => {});
        client = new ConsoleClient({
            afterCall: async () => {
                throw new Error('after oops');
            },
            logger: undefined as any,
        });
        await client.start();

        const imq: any = (client as any).imq;
        mock.method(imq, 'send', async (_to: string, request: any) => {
            const id = 'MB2';
            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'S' }),
            );
            return id;
        });

        const ok = await client.ok('ok');
        assert.equal(ok, 'S');
        assert.ok(warn.mock.callCount() > 0);
        const messages = warn.mock.calls
            .map((c: any) => String(c.arguments[0]))
            .join(' ');
        assert.ok(messages.includes(AFTER_HOOK_ERROR));
    });

    it('should use right-hand console branch in imqCallRejector when AFTER hook fails on reject', async () => {
        const warn = mock.method(console, 'warn' as any, () => {});
        client = new ConsoleClient({
            afterCall: async () => {
                throw new Error('after oops');
            },
            logger: undefined as any,
        });
        await client.start();

        const imq: any = (client as any).imq;
        mock.method(imq, 'send', async (_to: string, request: any) => {
            const id = 'MB3';
            setImmediate(() =>
                imq.emit('message', {
                    to: id,
                    request,
                    error: new Error('bad'),
                }),
            );
            return id;
        });

        try {
            await client.boom();
        } catch {
            /* expected */
        }

        assert.ok(warn.mock.callCount() > 0);
        const messages = warn.mock.calls
            .map((c: any) => String(c.arguments[0]))
            .join(' ');
        assert.ok(messages.includes(AFTER_HOOK_ERROR));
    });
});
