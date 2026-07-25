/*!
 * IMQClient metadata slot handling tests
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
import './mocks/index.js';
import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQClient, IMQDelay, IMQMetadata, remote } from '../index.js';
import { logger } from './mocks/index.js';

class SlotClient extends IMQClient {
    @remote()
    public async ping(
        name: string,
        imqMetadata?: IMQMetadata,
        imqDelay?: IMQDelay,
    ): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }

    @remote()
    public async greet(
        name: string,
        greeting?: string,
        imqMetadata?: IMQMetadata,
        imqDelay?: IMQDelay,
    ): Promise<string> {
        return this.remoteCall<string>(...arguments);
    }
}

describe('IMQClient metadata slot', () => {
    let client: SlotClient;
    let sent: { request: any; delay?: number };

    /**
     * Starts a client with a send() that captures the outgoing request and
     * replies immediately, so the call resolves.
     *
     * @returns {Promise<SlotClient>}
     */
    async function startClient(): Promise<SlotClient> {
        client = new SlotClient({ logger });

        await client.start();

        const imq: any = (client as any).imq;

        mock.method(
            imq,
            'send',
            async (to: string, request: any, delay?: number) => {
                sent = { request, delay };
                setImmediate(() =>
                    imq.emit('message', { to: 'S1', request, data: 'pong' }),
                );

                return 'S1';
            },
        );

        return client;
    }

    afterEach(async () => {
        await client?.destroy();
        mock.restoreAll();
    });

    it('should drop a skipped metadata slot when a delay is given', async () => {
        await startClient();

        assert.equal(
            await client.ping('A', undefined, new IMQDelay(100)),
            'pong',
        );
        assert.deepEqual(sent.request.args, ['A']);
        assert.equal(sent.request.metadata, undefined);
        assert.equal(sent.delay, 100);
    });

    it('should keep both trailing values when metadata is given', async () => {
        await startClient();

        const metadata = new IMQMetadata({ traceId: 'x' });

        assert.equal(
            await client.ping('A', metadata, new IMQDelay(100)),
            'pong',
        );
        assert.deepEqual(sent.request.args, ['A']);
        assert.deepEqual(sent.request.metadata, metadata);
        assert.equal(sent.delay, 100);
    });

    it('should accept a delay passed in place of the metadata slot', async () => {
        await startClient();

        assert.equal(
            await client.ping('A', new IMQDelay(100) as any),
            'pong',
        );
        assert.deepEqual(sent.request.args, ['A']);
        assert.equal(sent.delay, 100);
    });

    it('should keep a trailing undefined when no delay is given', async () => {
        await startClient();

        // without a delay there is no metadata slot to skip, so the value
        // belongs to the declared arguments and must travel as-is
        assert.equal(await client.ping('A', undefined), 'pong');
        assert.deepEqual(sent.request.args, ['A', undefined]);
        assert.equal(sent.delay, 0);
    });

    it('should drop only the metadata slot, not declared arguments', async () => {
        await startClient();

        assert.equal(
            await client.greet('A', undefined, undefined, new IMQDelay(100)),
            'pong',
        );
        assert.deepEqual(sent.request.args, ['A', undefined]);
        assert.equal(sent.delay, 100);
    });
});
