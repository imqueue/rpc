/*!
 * IMQClient Unit Tests
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
import mockRequire from 'mock-require';
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { logger } from './mocks';
import {
    IMQClient,
    IMQService,
    IMQDelay,
    Description,
    expose,
    remote,
} from '..';
import * as fs from 'fs';
import * as imqRpc from '..';

mockRequire('@imqueue/rpc', imqRpc);

class TestService extends IMQService {
    @expose()
    public exposed() {
        return 'exposed';
    }

    @expose()
    public testArgs(a: string, b?: number) {
        return a + b;
    }

    @expose()
    public throwable() {
        throw new Error('No way!');
    }
}

class TestServiceClient extends IMQClient {
    @remote()
    public async exposed(delay?: IMQDelay) {
        return await this.remoteCall<string>(...arguments);
    }

    @remote()
    public async testArgs(delay?: IMQDelay) {
        return await this.remoteCall<string>(...arguments);
    }

    @remote()
    public async throwable(delay?: IMQDelay) {
        return await this.remoteCall<any>(...arguments);
    }
}

function rmdirr(path: string) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(file => {
            const curPath = `${path}/${file}`;

            if (fs.lstatSync(curPath).isDirectory()) {
                rmdirr(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });

        fs.rmdirSync(path);
    }
}

describe('IMQClient', () => {
    const CLIENTS_PATH = './test/clients';

    let service: TestService;
    let client: TestServiceClient;

    before(async () => {
        try {
            service = new TestService({ logger });
            await service.start();
            client = new TestServiceClient({ logger });
            await client.start();
        } catch (err: any) {
            console.error(err);
        }
    });

    after(async () => {
        await service.destroy();
        await client.destroy();
    });

    it('should be a class', () => {
        assert.equal(typeof IMQClient, 'function');
    });

    describe('constructor', () => {
        it('should throw if directly called', () => {
            const Client: any = IMQClient;

            assert.throws(() => new Client(), TypeError);
        });

        it('should not throw', () => {
            assert.doesNotThrow(() => new TestServiceClient());
        });

        it('should use constructor name by default', () => {
            assert.ok(
                new TestServiceClient().name.includes('TestServiceClient'),
            );
        });

        it('should use given name if provided', () => {
            assert.ok(
                new TestServiceClient(
                    {},
                    undefined,
                    'TestClient',
                ).name.includes('TestClient'),
            );
        });

        it(
            'should re-use existing redis connection if singleQueue option ' +
                'enabled',
            () => {
                const options = { logger, singleQueue: true };
                const client1: any = new TestServiceClient(options);
                const client2: any = new TestServiceClient(options);

                assert.equal(client1.imq, client2.imq);
            },
        );

        it(
            'should not re-use existing redis connection if singleQueue option ' +
                'disabled',
            () => {
                const options = { logger, singleQueue: false };
                const client1: any = new TestServiceClient(options);
                const client2: any = new TestServiceClient(options);

                assert.notEqual(client1.imq, client2.imq);
            },
        );
    });

    describe('describe()', () => {
        it('should return service description', async () => {
            const description: Description = await client.describe();

            assert.notEqual(description.service, undefined);
            assert.notEqual(description.types, undefined);
            assert.notEqual(description.service.methods.exposed, undefined);
            assert.equal(description.service.methods.unexposed, undefined);
        });

        it('should allow delayed calls', async () => {
            const start = Date.now();
            const description: Description = await client.describe(
                new IMQDelay(100),
            );
            const time = Date.now() - start;

            assert.ok(time >= 100);
            assert.notEqual(description.service, undefined);
            assert.notEqual(description.types, undefined);
            assert.notEqual(description.service.methods.exposed, undefined);
            assert.equal(description.service.methods.unexposed, undefined);
        });
    });

    describe('remoteCall()', () => {
        it('should throw if service returned error', async () => {
            try {
                await client.throwable();
            } catch (err: any) {
                assert.equal(err.code, 'IMQ_RPC_CALL_ERROR');
            }
        });
    });

    describe('create()', () => {
        it('should create and return compiled module dynamically', async () => {
            try {
                const testService: any = await IMQClient.create('TestService', {
                    logger,
                    path: CLIENTS_PATH,
                });
                const cli = new testService.TestClient({ logger });

                assert.ok(cli instanceof IMQClient);

                const notExists = await new Promise(resolve =>
                    fs.access(`${CLIENTS_PATH}/TestService.ts`, resolve),
                );
                assert.equal(!notExists, true, 'TestService.ts does not exit');

                cli.destroy();
                rmdirr(CLIENTS_PATH);
            } catch (err: any) {
                rmdirr(CLIENTS_PATH);
                throw err;
            }
        });

        it('should just return module without writing', async () => {
            try {
                const testService: any = await IMQClient.create('TestService', {
                    logger,
                    path: CLIENTS_PATH,
                    write: false,
                });
                const cli = new testService.TestClient({ logger });

                assert.ok(cli instanceof IMQClient);

                const notExists = await new Promise(resolve =>
                    fs.access(`${CLIENTS_PATH}/TestService.ts`, resolve),
                );
                assert.equal(!notExists, false, 'TestService.ts exits');

                cli.destroy();
            } catch (err: any) {
                throw err;
            }
        });

        it('should stop by timeout if service is not started', async () => {
            try {
                await IMQClient.create('SomeService', {
                    logger,
                    path: CLIENTS_PATH,
                    timeout: 200,
                });
            } catch (err: any) {
                assert.ok(
                    err.message.includes('service remote call timed-out'),
                );
            }
        });
    });

    describe('stop()', () => {
        it('should stop client form serving messages', async () => {
            const spy = mock.method((<any>client).imq, 'stop' as any);
            await client.stop();
            assert.equal(spy.mock.callCount() > 0, true);
            spy.mock.restore();
        });
    });
});
