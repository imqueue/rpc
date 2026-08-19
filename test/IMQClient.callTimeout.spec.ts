/*!
 * IMQClient per-call timeout tests
 */
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQClient, IMQDelay, remote } from '../index.js';
import { logger } from './mocks/index.js';

class TimeoutClient extends IMQClient {
    @remote()
    public async ping(imqDelay?: IMQDelay): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

describe('IMQClient call timeout', () => {
    let client: TimeoutClient;

    afterEach(async () => {
        mock.timers.reset();
        await client?.destroy();
        mock.restoreAll();
    });

    it(
        'should reject a call that never gets a response once callTimeout ' +
            'elapses, and clean up its resolver',
        async () => {
            client = new TimeoutClient({ logger, callTimeout: 50 });
            await client.start();

            const imq: any = (client as any).imq;

            // send succeeds, but the service never responds
            mock.method(imq, 'send', async () => 'T1');
            mock.timers.enable({ apis: ['setTimeout'] });

            const call = client.ping();

            // let the internal send() settle so the timeout timer is registered
            await new Promise(resolve => setImmediate(resolve));

            mock.timers.tick(60);

            await assert.rejects(call, (err: any) => {
                assert.equal(err.code, 'IMQ_RPC_CALL_TIMEOUT');
                return true;
            });

            // the pending resolver must not leak
            assert.deepEqual(Object.keys((client as any).resolvers), []);
        },
    );

    it('should not reject a call that responds before the timeout', async () => {
        client = new TimeoutClient({ logger, callTimeout: 50 });
        await client.start();

        const imq: any = (client as any).imq;

        mock.method(imq, 'send', async (to: string, request: any) => {
            const id = 'T2';
            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'pong' }),
            );
            return id;
        });

        const result = await client.ping();

        assert.equal(result, 'pong');

        // ticking past the timeout after completion must be harmless
        mock.timers.enable({ apis: ['setTimeout'] });
        mock.timers.tick(100);
        assert.deepEqual(Object.keys((client as any).resolvers), []);
    });

    it('should extend the timeout budget by the requested delay', async () => {
        client = new TimeoutClient({ logger, callTimeout: 50 });
        await client.start();

        const imq: any = (client as any).imq;

        mock.method(imq, 'send', async () => 'T3');
        mock.timers.enable({ apis: ['setTimeout'] });

        const call = client.ping(new IMQDelay(100));

        // let the internal send() settle so the timeout timer is registered
        await new Promise(resolve => setImmediate(resolve));

        // 100ms delay + 50ms timeout: at 120ms the call must still be pending
        mock.timers.tick(120);
        assert.equal(
            Object.keys((client as any).resolvers).includes('T3'),
            true,
        );

        mock.timers.tick(40);

        await assert.rejects(call, (err: any) => {
            assert.equal(err.code, 'IMQ_RPC_CALL_TIMEOUT');
            return true;
        });
    });

    it('should reject the call when the underlying send throws', async () => {
        client = new TimeoutClient({ logger });
        await client.start();

        const imq: any = (client as any).imq;

        mock.method(imq, 'send', async () => {
            throw new Error('send boom');
        });

        await assert.rejects(client.ping());
    });

    it('should not time out calls when callTimeout is not set', async () => {
        client = new TimeoutClient({ logger });
        await client.start();

        const imq: any = (client as any).imq;

        mock.method(imq, 'send', async (to: string, request: any) => {
            const id = 'T4';
            // respond a long virtual time later
            setTimeout(
                () => imq.emit('message', { to: id, request, data: 'late' }),
                120000,
            );
            return id;
        });

        mock.timers.enable({ apis: ['setTimeout'] });

        const call = client.ping();

        // let the internal send() settle so the response timer is registered
        await new Promise(resolve => setImmediate(resolve));

        mock.timers.tick(120001);

        assert.equal(await call, 'late');
    });
});

describe('IMQClient response visibility', () => {
    let client: TimeoutClient;

    afterEach(async () => {
        mock.timers.reset();
        await client?.destroy();
        mock.restoreAll();
    });

    it('should warn about every response no call is waiting for', async () => {
        const warn = mock.fn();
        const capturing: any = {
            info: () => {},
            warn,
            error: () => {},
            log: () => {},
        };

        client = new TimeoutClient({ logger: capturing });
        await client.start();

        const imq: any = (client as any).imq;

        imq.emit('message', {
            to: 'TL3',
            request: { from: 'C', method: 'ping', args: ['secret-argument'] },
            data: 'late-pong',
        });
        imq.emit('message', {
            to: 'TL6',
            request: { from: 'C', method: 'ping', args: [] },
            data: 'late-pong',
        });

        const lines = warn.mock.calls
            .map((one: any) => String(one.arguments[0]))
            .filter((one: string) => /has no pending call/.test(one));

        // one line per unmatched response: each carries its own request id,
        // and the flow is bounded by the backlog left behind by a restart
        assert.equal(lines.length, 2);
        assert.match(lines[0], /TL3/);
        assert.match(lines[1], /TL6/);
        assert.match(lines[0], /ping/);
        assert.equal(lines[0].includes('secret-argument'), false);
        assert.equal(lines[0].includes('late-pong'), false);
    });

    it('should keep routing an unmatched response on a broken logger', async () => {
        const broken: any = {
            info: () => {},
            warn: () => {
                throw new Error('logger is broken');
            },
            error: () => {},
            log: () => {},
        };

        client = new TimeoutClient({ logger: broken });
        await client.start();

        const imq: any = (client as any).imq;
        const routed: any[] = [];

        client.on('ping', (message: any) => routed.push(message));

        imq.emit('message', {
            to: 'TL7',
            request: { from: 'C', method: 'ping', args: [] },
            data: 'late-pong',
        });

        assert.equal(
            routed.length,
            1,
            'the EventEmitter hand-off must survive a throwing logger',
        );
    });

    it('should stay quiet about a response its call still waits for', async () => {
        const warn = mock.fn();
        const capturing: any = {
            info: () => {},
            warn,
            error: () => {},
            log: () => {},
        };

        client = new TimeoutClient({ logger: capturing });
        await client.start();

        const imq: any = (client as any).imq;

        mock.method(imq, 'send', async (to: string, request: any) => {
            const id = 'TL4';

            setImmediate(() =>
                imq.emit('message', { to: id, request, data: 'pong' }),
            );

            return id;
        });

        assert.equal(await client.ping(), 'pong');
        assert.equal(
            warn.mock.calls
                .map((one: any) => String(one.arguments[0]))
                .filter((one: string) => /has no pending call/.test(one))
                .length,
            0,
        );
    });
});
