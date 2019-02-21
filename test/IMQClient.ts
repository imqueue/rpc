/*!
 * IMQClient Unit Tests
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
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
    remote
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
        service = new TestService({ logger });
        await service.start();
        client = new TestServiceClient({ logger });
        await client.start();
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
