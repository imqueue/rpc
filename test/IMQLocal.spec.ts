/*!
 * IMQLocal Unit Tests
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { logger } from './mocks/index.js';
import {
    IMQClient,
    IMQService,
    IMQDelay,
    IMQMetadata,
    callTiming,
    currentMetadata,
    expose,
    remote,
    localService,
    localServiceNames,
    wireCopy,
} from '../index.js';

class Shelf {
    constructor(public readonly label: string) {}
}

const kept = { items: ['a'] };
let hang: Promise<void> = Promise.resolve();

class LocalShop extends IMQService {
    @expose()
    public echo(value: any) {
        return value;
    }

    @expose()
    public stamp() {
        return {
            at: new Date('2026-11-12T10:00:00.000Z'),
            shelf: new Shelf('front'),
            gone: undefined,
            list: [1, undefined, 3],
        };
    }

    @expose()
    public grab(arg: { touched?: boolean }) {
        arg.touched = true;

        return kept;
    }

    @expose()
    public refuse() {
        const error: any = new Error('Not today');

        error.code = 'SHOP_CLOSED';
        throw error;
    }

    @expose()
    public whoAsks() {
        return currentMetadata()?.['who'] ?? null;
    }

    @expose()
    public async wait() {
        await hang;

        return 'late';
    }

    @expose()
    public big() {
        return { n: 1n };
    }
}

class LocalShopClient extends IMQClient {
    @remote()
    public async echo(value: any, metadata?: IMQMetadata, delay?: IMQDelay) {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async stamp() {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async grab(arg: { touched?: boolean }) {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async refuse() {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async whoAsks(metadata?: IMQMetadata) {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async wait() {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async big() {
        return await this.remoteCall<any>(...arguments);
    }

    @remote()
    public async missing() {
        return await this.remoteCall<any>(...arguments);
    }
}

describe('IMQService served in process (local)', () => {
    let service: any;
    let client: any;
    let serviceSend: any;
    let clientSend: any;
    let signalsAdded = -1;
    const answered: any[] = [];

    before(async () => {
        const signalsBefore = process.listenerCount('SIGTERM');

        service = new LocalShop({ logger, local: true }, 'LocalShop');
        signalsAdded = process.listenerCount('SIGTERM') - signalsBefore;
        await service.start();
        client = new LocalShopClient(
            {
                logger,
                afterCall: async (request: any, response: any) => {
                    answered.push(callTiming(request, response));
                },
            },
            'LocalShop',
        );
        await client.start();
        serviceSend = mock.method(service.imq, 'send');
        clientSend = mock.method(client.imq, 'send');
    });

    after(async () => {
        await client.destroy();
        await service.destroy();
    });

    it('is registered under its name once started', () => {
        assert.ok(localService('LocalShop'));
        assert.ok(localServiceNames().includes('LocalShop'));
    });

    it('installs no signal handlers of its own', () => {
        assert.equal(signalsAdded, 0);
        assert.equal(service.options.handleSignals, false);
    });

    it('answers a client in the same process without the queue', async () => {
        clientSend.mock.resetCalls();
        serviceSend.mock.resetCalls();

        assert.equal(await client.echo('hello'), 'hello');
        assert.equal(clientSend.mock.callCount(), 0);
        assert.equal(serviceSend.mock.callCount(), 0);
    });

    it('copies values as the queue does', async () => {
        const answer = await client.stamp();

        assert.deepEqual(answer, {
            at: '2026-11-12T10:00:00.000Z',
            shelf: { label: 'front' },
            list: [1, null, 3],
        });
        assert.equal('gone' in answer, false);
    });

    it('shares no object between the two sides', async () => {
        const arg: { touched?: boolean } = {};
        const answer = await client.grab(arg);

        assert.equal(arg.touched, undefined);
        answer.items.push('b');
        assert.deepEqual(kept.items, ['a']);
    });

    it('rejects with the plain error object the queue delivers', async () => {
        await assert.rejects(client.refuse(), (err: any) => {
            assert.equal(err instanceof Error, false);
            assert.equal(err.code, 'SHOP_CLOSED');
            assert.equal(err.message, 'Not today');

            return true;
        });
    });

    it('refuses a method the service does not have', async () => {
        await assert.rejects(client.missing(), (err: any) => {
            assert.equal(err.code, 'IMQ_RPC_NO_METHOD');

            return true;
        });
    });

    it('carries the metadata to the method', async () => {
        assert.equal(
            await client.whoAsks(new IMQMetadata({ who: 'Ann' })),
            'Ann',
        );
    });

    it('stamps a timing the caller can split', async () => {
        answered.length = 0;
        await client.echo(1);

        assert.equal(answered.length, 1);
        assert.equal(typeof answered[0].transit, 'number');
    });

    it('rejects at once an answer that cannot be sent', async () => {
        await assert.rejects(client.big(), (err: any) => {
            assert.equal(err.code, 'IMQ_RPC_CALL_ERROR');

            return true;
        });
    });

    it('sends a delayed call through the queue', async () => {
        clientSend.mock.resetCalls();
        void client.echo('later', undefined, new IMQDelay(10));
        await new Promise(resolve => setTimeout(resolve, 20));

        assert.equal(clientSend.mock.callCount(), 1);
    });

    it('goes through the queue for a client that says local: false', async () => {
        const queued: any = new LocalShopClient(
            { logger, local: false },
            'LocalShop',
        );

        await queued.start();
        const send = mock.method(queued.imq, 'send');

        void queued.echo('queued');
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(send.mock.callCount(), 1);
        await queued.destroy();
    });

    it('times out a call that is never answered', async () => {
        let release: () => void = () => undefined;

        hang = new Promise(resolve => (release = resolve));

        const waiting: any = new LocalShopClient(
            { logger, callTimeout: 20 },
            'LocalShop',
        );

        await assert.rejects(waiting.wait(), (err: any) => {
            assert.equal(err.code, 'IMQ_RPC_CALL_TIMEOUT');

            return true;
        });
        release();
        await waiting.destroy();
    });
});

describe('IMQService local options', () => {
    it('cannot be combined with multiProcess', () => {
        assert.throws(
            () => new LocalShop({ logger, local: true, multiProcess: true }),
            TypeError,
        );
    });

    it('is no longer reached once destroyed', async () => {
        const service = new LocalShop({ logger, local: true }, 'Destroyed');

        await service.start();
        assert.ok(localService('Destroyed'));
        await service.destroy();
        assert.equal(localService('Destroyed'), undefined);
    });

    it('is not served in process unless asked', async () => {
        const service = new LocalShop({ logger }, 'QueueOnly');

        await service.start();
        assert.equal(localService('QueueOnly'), undefined);
        await service.destroy();
    });
});

describe('wireCopy()', () => {
    it('throws where the queue cannot send', () => {
        assert.throws(() => wireCopy({ n: 1n }));
    });
});
