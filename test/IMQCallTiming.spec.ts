/*!
 * Where a remote call spent its time: the service's half, the client's half,
 * and how the two are put together
 */
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'node:crypto';
import {
    IMQClient,
    IMQService,
    type IMQRPCRequest,
    type IMQRPCResponse,
    callTiming,
    expose,
    remote,
} from '../index.js';
import { logger } from './mocks/index.js';

class TimedService extends IMQService {
    @expose()
    public async slow(): Promise<string> {
        return await new Promise<string>(resolve =>
            setTimeout(() => resolve('done'), 30),
        );
    }

    @expose()
    public broken(): string {
        throw new Error('broken');
    }
}

class TimedClient extends IMQClient {
    @remote()
    public async ping(): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

async function answerTo(
    service: any,
    request: IMQRPCRequest,
): Promise<IMQRPCResponse> {
    const sent = new Promise<IMQRPCResponse>(resolve =>
        mock.method(service.imq, 'send', async (_to: string, response: any) => {
            resolve(response);

            return uuid();
        }),
    );

    service.imq.emit('message', request, uuid());

    return sent;
}

describe('call timing', () => {
    afterEach(() => mock.restoreAll());

    it('a service says when it received, started and finished a call', async () => {
        const service: any = new TimedService({ logger });

        await service.start();

        const before = Date.now();
        const response = await answerTo(service, {
            from: 'TimedClient',
            method: 'slow',
            args: [],
        });

        await service.destroy();

        const timing = response.timing!;

        assert.equal(response.data, 'done');
        assert.ok(timing.received >= before);
        assert.ok(timing.started >= timing.received);
        assert.ok(timing.finished - timing.started >= 25);
    });

    it('a call that fails still says when it was handled', async () => {
        const service: any = new TimedService({ logger });

        await service.start();

        const response = await answerTo(service, {
            from: 'TimedClient',
            method: 'broken',
            args: [],
        });

        await service.destroy();

        assert.equal(response.error?.code, 'IMQ_RPC_CALL_ERROR');
        assert.ok(response.timing!.finished >= response.timing!.started);
    });

    it('a refused call says it was never started', async () => {
        const service: any = new TimedService({ logger });

        await service.start();

        const response = await answerTo(service, {
            from: 'TimedClient',
            method: 'missing',
            args: [],
        });

        await service.destroy();

        assert.equal(response.error?.code, 'IMQ_RPC_NO_METHOD');
        assert.equal(response.timing!.finished, response.timing!.started);
    });

    it('a client stamps when it sent a call, after beforeCall', async () => {
        const client = new TimedClient({
            logger,
            beforeCall: async (request?: IMQRPCRequest) => {
                assert.equal(request?.sentAt, undefined);
            },
        });

        await client.start();

        const imq: any = (client as any).imq;
        let sent: IMQRPCRequest | undefined;

        mock.method(imq, 'send', async (_to: string, request: any) => {
            sent = request;
            setImmediate(() =>
                imq.emit('message', { to: 'C1', request, data: 'pong' }),
            );

            return 'C1';
        });

        const before = Date.now();

        assert.equal(await client.ping(), 'pong');
        assert.ok(typeof sent?.sentAt === 'number');
        assert.ok(sent.sentAt >= before);

        await client.destroy();
    });

    it('splits a round trip without comparing two clocks', () => {
        const request = { from: 'A', method: 'm', args: [], sentAt: 1_000 };
        const response = {
            to: 'x',
            data: null,
            error: null,
            request,
            // a service clock an hour ahead of the caller's
            timing: {
                received: 3_601_010,
                started: 3_601_015,
                finished: 3_601_065,
            },
        };

        assert.deepEqual(callTiming(request, response, 1_100), {
            total: 100,
            handled: 50,
            waited: 5,
            transit: 45,
        });
    });

    it('says nothing where either side kept no time', () => {
        const request = { from: 'A', method: 'm', args: [] };
        const response = { to: 'x', data: null, error: null, request };

        assert.equal(callTiming(request, response), null);
        assert.equal(callTiming({ ...request, sentAt: 1 }, response), null);
        assert.equal(callTiming(undefined, undefined), null);
    });
});
