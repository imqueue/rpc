/*!
 * IMQClient Unit Tests
 *
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
 */
import * as mock from 'mock-require';
import { logger } from './mocks';
import { expect } from 'chai';
import {
    IMQClient,
    IMQService,
    IMQDelay,
    Description,
    expose,
    remote,
} from '..';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as imqRpc from '..';

mock('@imqueue/rpc', imqRpc);

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
        throw new Error('No way!')
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
        fs.readdirSync(path).forEach((file) => {
            const curPath = `${path}/${file}`;

            if (fs.lstatSync(curPath).isDirectory()) {
                rmdirr(curPath);
            }

            else {
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
        } catch (err) {
            console.error(err);
        }
    });

    after(async () => {
        await service.destroy();
        await client.destroy();
    });

    it('should be a class', () => {
        expect(typeof IMQClient).to.equal('function');
    });

    describe('constructor', () => {
        it('should throw if directly called', () => {
            const Client: any = IMQClient;

            expect(() => new Client()).to.throw(TypeError);
        });

        it('should not throw', () => {
            expect(() => new TestServiceClient()).not.to.throw;
        });

        it('should use constructor name by default', () => {
            expect(new TestServiceClient().name)
                .to.contain('TestServiceClient');
        });

        it('should use given name if provided', () => {
            expect(new TestServiceClient({}, undefined, 'TestClient').name)
                .to.contain('TestClient');
        });

        it('should re-use existing redis connection if singleQueue option '
            + 'enabled', () => {
            const options = { logger, singleQueue: true };
            const client1: any = new TestServiceClient(options);
            const client2: any = new TestServiceClient(options);

            expect(client1.imq).to.equal(client2.imq);
        });

        it('should not re-use existing redis connection if singleQueue option '
            + 'disabled', () => {
            const options = { logger, singleQueue: false };
            const client1: any = new TestServiceClient(options);
            const client2: any = new TestServiceClient(options);

            expect(client1.imq).to.not.equal(client2.imq);
        });
    });

    describe('describe()', () => {
        it('should return service description', async () => {
            const description: Description = await client.describe();

            expect(description.service).not.to.be.undefined;
            expect(description.types).not.to.be.undefined;
            expect(description.service.methods.exposed).not.to.be.undefined;
            expect(description.service.methods.unexposed).to.be.undefined;
        });

        it('should allow delayed calls', async () => {
            const start = Date.now();
            const description: Description = await client.describe(
                new IMQDelay(100));
            const time = Date.now() - start;

            expect(time).to.be.gte(100);
            expect(description.service).not.to.be.undefined;
            expect(description.types).not.to.be.undefined;
            expect(description.service.methods.exposed).not.to.be.undefined;
            expect(description.service.methods.unexposed).to.be.undefined;
        });
    });

    describe('remoteCall()', () => {
        it('should throw if service returned error', async () => {
            try {
                await client.throwable();
            }

            catch (err) {
                expect(err.code).to.equal('IMQ_RPC_CALL_ERROR');
            }
        });
    });

    describe('create()', () => {
        it('should create and return compiled module dynamically', async () => {
            try {
                const testService: any = await IMQClient.create(
                    'TestService', { logger, path: CLIENTS_PATH });
                // noinspection TypeScriptUnresolvedFunction
                const cli = new testService.TestClient({ logger });

                expect(cli).instanceOf(IMQClient);

                const notExists = await new Promise(resolve =>
                    fs.access(`${CLIENTS_PATH}/TestService.ts`, resolve));
                expect(!notExists).to.be.equal(
                    true,
                    'TestService.ts does not exit'
                );

                cli.destroy();
                rmdirr(CLIENTS_PATH);
            } catch (err) {
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
                // noinspection TypeScriptUnresolvedFunction
                const cli = new testService.TestClient({ logger });

                expect(cli).instanceOf(IMQClient);

                const notExists = await new Promise(resolve =>
                    fs.access(`${CLIENTS_PATH}/TestService.ts`, resolve));
                expect(!notExists).to.be.equal(false, 'TestService.ts exits');

                cli.destroy();
            } catch (err) {
                throw err;
            }
        });

        it('should stop by timeout if service is not started', async () => {
            try {
                await IMQClient.create('SomeService', {
                    logger,
                    path: CLIENTS_PATH,
                    timeout: 200
                });
            }

            catch (err) {
                expect(err.message).to.contain('service remote call timed-out');
            }
        });
    });

    describe('stop()', () => {
        it('should stop client form serving messages', async () => {
            const spy = sinon.spy((<any>client).imq, 'stop' as any);
            await client.stop();
            expect(spy.called).to.be.true;
            spy.restore();
        });
    });
});
