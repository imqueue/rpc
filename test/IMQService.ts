/*!
 * IMQService Unit Tests
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
import { logger } from './mocks';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { IMQService, IMQRPCRequest, Description, expose } from '..';
import { uuid } from '@imqueue/core';

const cluster: any = require('cluster');

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

    // noinspection JSMethodCanBeStatic
    public unexposed() {
        return 'unexposed';
    }

}

describe('IMQService', () => {
    it('should be a class', () => {
        expect(typeof IMQService).to.equal('function');
    });

    describe('constructor()', () => {
        it('should throw if directly called', () => {
            const Service: any = IMQService;

            expect(() => new Service()).to.throw(TypeError);
        });

        it('should not throw if inherited', () => {
            expect(new TestService()).not.to.throw;
        });

        it('should use constructor name by default', () => {
            expect(new TestService().name).to.equal('TestService');
        });

        it('should use given name if provided', () => {
            expect(new TestService({}, 'Test').name).to.equal('Test');
        });
    });

    describe('start()', () => {
        it('should start messaging queue', async () => {
            const service: any = new TestService({ logger });

            sinon.spy(service.imq, 'start');

            await service.start();

            expect(service.imq.start.called).to.be.true;

            await service.destroy();
        });

        it('should start multi-process if configured', async () => {
            const service: any = new TestService({
                multiProcess: true,
                logger
            });

            let counter = 0;
            const spy = sinon.stub(cluster, 'fork').callsFake((async () => {
                (<any>cluster).isMaster = false;
                (++counter == 1) && await service.start();
            }) as any);

            await service.start();

            expect(spy.called).to.be.true;

            spy.restore();
            await service.destroy();
        });
    });

    describe('stop()', () => {
        it('should properly stop service', async () => {
            const service: any = new TestService({ logger });

            sinon.spy(service.imq, 'stop');

            await service.stop();

            expect(service.imq.stop.called).to.be.true;
        });
    });

    describe('destroy()', () => {
        it('should properly destroy service', async () => {
            const service: any = new TestService({ logger });

            sinon.spy(service.imq, 'destroy');

            await service.destroy();

            expect(service.imq.destroy.called).to.be.true;
        });
    });

    describe('describe()', () => {
        it('should return proper service description', async () => {
            const service = new TestService({ logger });
            await service.start();
            const description: Description = service.describe();

            expect(description.service).not.to.be.undefined;
            expect(description.types).not.to.be.undefined;
            expect(description.service.methods.exposed).not.to.be.undefined;
            expect(description.service.methods.unexposed).to.be.undefined;

            await service.destroy();
        });
    });

    describe('handleRequest()', () => {
        it('should handle properly incoming requests', async () => {
            const reqSpy = sinon.spy(TestService.prototype, 'handleRequest');
            const service: any = new TestService({ logger });
            const request: IMQRPCRequest = {
                from: 'TestClient',
                method: 'exposed',
                args: []
            };
            const id = uuid();
            const imqSpy = sinon.spy(service.imq, 'send');

            await service.start();

            service.imq.emit('message', request, id);

            expect(reqSpy.calledWith(request, id)).to.be.true;

            // we need to defer here because emit is not async but
            // it calls send asynchronously
            await new Promise((resolve, reject) => setTimeout(() => {
                try {
                    resolve(expect(imqSpy.called).to.be.true);
                }

                catch (err) {
                    reject(err);
                }
            }));

            await service.destroy();
            reqSpy.restore();
        });

        it('should throw IMQ_RPC_NO_METHOD if non-existing method called',
            async () => {
                const service: any = new TestService({ logger });
                const request: IMQRPCRequest = {
                    from: 'TestClient',
                    method: 'nonExistingMethod',
                    args: []
                };
                const imqSpy = sinon.spy(service.imq, 'send');

                await service.start();

                service.imq.emit('message', request, uuid());

                await new Promise((resolve, reject) => setTimeout(() => {
                    try {
                        resolve(expect(imqSpy.lastCall.args[1].error.code)
                            .to.equal('IMQ_RPC_NO_METHOD')
                        );
                    }

                    catch (err) {
                        reject(err);
                    }
                }));

                await service.destroy();
            });

        it('should throw IMQ_RPC_NO_ACCESS if unexposed method called',
            async () => {
                const service: any = new TestService({ logger });
                const request: IMQRPCRequest = {
                    from: 'TestClient',
                    method: 'unexposed',
                    args: []
                };
                const imqSpy = sinon.spy(service.imq, 'send');

                await service.start();

                service.imq.emit('message', request, uuid());

                await new Promise((resolve, reject) => setTimeout(() => {
                    try {
                        resolve(expect(imqSpy.lastCall.args[1].error.code)
                            .to.equal('IMQ_RPC_NO_ACCESS')
                        );
                    }

                    catch (err) {
                        reject(err);
                    }
                }));

                await service.destroy();
            });

        it('should throw IMQ_RPC_INVALID_ARGS_COUNT if unexposed ' +
            'number of arguments given',
            async () => {
                const service: any = new TestService({ logger });
                const request: IMQRPCRequest = {
                    from: 'TestClient',
                    method: 'testArgs',
                    args: []
                };
                const imqSpy = sinon.spy(service.imq, 'send');

                await service.start();

                service.imq.emit('message', request, uuid());

                await new Promise((resolve, reject) => setTimeout(() => {
                    try {
                        resolve(expect(imqSpy.lastCall.args[1].error.code)
                            .to.equal('IMQ_RPC_INVALID_ARGS_COUNT')
                        );
                    }

                    catch (err) {
                        reject(err);
                    }
                }));

                await service.destroy();
            });

        it('should throw IMQ_RPC_CALL_ERROR if unexposed ' +
            'number of arguments given',
            async () => {
                const service: any = new TestService({ logger });
                const request: IMQRPCRequest = {
                    from: 'TestClient',
                    method: 'throwable',
                    args: []
                };
                const imqSpy = sinon.spy(service.imq, 'send');

                await service.start();

                service.imq.emit('message', request, uuid());

                await new Promise((resolve, reject) => setTimeout(() => {
                    try {
                        resolve(expect(imqSpy.lastCall.args[1].error.code)
                            .to.equal('IMQ_RPC_CALL_ERROR')
                        );
                    }

                    catch (err) {
                        reject(err);
                    }
                }));

                await service.destroy();
            });
    });
});
