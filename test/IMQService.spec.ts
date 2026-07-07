/*!
 * IMQService Unit Tests
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
import { logger } from './mocks';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { IMQService, IMQRPCRequest, Description, expose } from '..';
import { randomUUID as uuid } from 'crypto';

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
        throw new Error('No way!');
    }

    public unexposed() {
        return 'unexposed';
    }
}

describe('IMQService', () => {
    it('should be a class', () => {
        assert.equal(typeof IMQService, 'function');
    });

    describe('constructor()', () => {
        it('should throw if directly called', () => {
            const Service: any = IMQService;

            assert.throws(() => new Service(), TypeError);
        });

        it('should not throw if inherited', () => {
            assert.doesNotThrow(() => new TestService());
        });

        it('should use constructor name by default', () => {
            assert.equal(new TestService().name, 'TestService');
        });

        it('should use given name if provided', () => {
            assert.equal(new TestService({}, 'Test').name, 'Test');
        });
    });

    describe('start()', () => {
        it('should start messaging queue', async () => {
            const service: any = new TestService({ logger });

            mock.method(service.imq, 'start');

            await service.start();

            assert.equal(service.imq.start.mock.callCount() > 0, true);

            await service.destroy();
        });

        it('should start multi-process if configured', async () => {
            const service: any = new TestService({
                multiProcess: true,
                logger,
            });

            let counter = 0;
            const spy = mock.method(cluster, 'fork', (async () => {
                (<any>cluster).isMaster = false;
                ++counter == 1 && (await service.start());
            }) as any);

            await service.start();

            assert.equal(spy.mock.callCount() > 0, true);

            spy.mock.restore();
            await service.destroy();
        });
    });

    describe('stop()', () => {
        it('should properly stop service', async () => {
            const service: any = new TestService({ logger });

            mock.method(service.imq, 'stop');

            await service.stop();

            assert.equal(service.imq.stop.mock.callCount() > 0, true);
        });
    });

    describe('destroy()', () => {
        it('should properly destroy service', async () => {
            const service: any = new TestService({ logger });

            mock.method(service.imq, 'destroy');

            await service.destroy();

            assert.equal(service.imq.destroy.mock.callCount() > 0, true);
        });
    });

    describe('describe()', () => {
        it('should return proper service description', async () => {
            const service = new TestService({ logger });
            await service.start();
            const description: Description = service.describe();

            assert.notEqual(description.service, undefined);
            assert.notEqual(description.types, undefined);
            assert.notEqual(description.service.methods.exposed, undefined);
            assert.equal(description.service.methods.unexposed, undefined);

            await service.destroy();
        });
    });

    describe('handleRequest()', () => {
        it('should handle properly incoming requests', async () => {
            const reqSpy = mock.method(TestService.prototype, 'handleRequest');
            const service: any = new TestService({ logger });
            const request: IMQRPCRequest = {
                from: 'TestClient',
                method: 'exposed',
                args: [],
            };
            const id = uuid();
            const imqSpy = mock.method(service.imq, 'send');

            await service.start();

            service.imq.emit('message', request, id);

            assert.ok(
                reqSpy.mock.calls.some(
                    (c: any) =>
                        c.arguments[0] === request && c.arguments[1] === id,
                ),
            );

            // we need to defer here because emit is not async but
            // it calls send asynchronously
            await new Promise((resolve, reject) =>
                setTimeout(() => {
                    try {
                        resolve(
                            assert.equal(imqSpy.mock.callCount() > 0, true),
                        );
                    } catch (err) {
                        reject(err);
                    }
                }),
            );

            await service.destroy();
            reqSpy.mock.restore();
        });

        it('should throw IMQ_RPC_NO_METHOD if non-existing method called', async () => {
            const service: any = new TestService({ logger });
            const request: IMQRPCRequest = {
                from: 'TestClient',
                method: 'nonExistingMethod',
                args: [],
            };
            const imqSpy = mock.method(service.imq, 'send');

            await service.start();

            service.imq.emit('message', request, uuid());

            await new Promise((resolve, reject) =>
                setTimeout(() => {
                    try {
                        resolve(
                            assert.equal(
                                imqSpy.mock.calls.at(-1).arguments[1].error
                                    .code,
                                'IMQ_RPC_NO_METHOD',
                            ),
                        );
                    } catch (err) {
                        reject(err);
                    }
                }),
            );

            await service.destroy();
        });

        it('should throw IMQ_RPC_NO_ACCESS if unexposed method called', async () => {
            const service: any = new TestService({ logger });
            const request: IMQRPCRequest = {
                from: 'TestClient',
                method: 'unexposed',
                args: [],
            };
            const imqSpy = mock.method(service.imq, 'send');

            await service.start();

            service.imq.emit('message', request, uuid());

            await new Promise((resolve, reject) =>
                setTimeout(() => {
                    try {
                        resolve(
                            assert.equal(
                                imqSpy.mock.calls.at(-1).arguments[1].error
                                    .code,
                                'IMQ_RPC_NO_ACCESS',
                            ),
                        );
                    } catch (err) {
                        reject(err);
                    }
                }),
            );

            await service.destroy();
        });

        it(
            'should throw IMQ_RPC_INVALID_ARGS_COUNT if unexposed ' +
                'number of arguments given',
            async () => {
                const service: any = new TestService({ logger });
                const request: IMQRPCRequest = {
                    from: 'TestClient',
                    method: 'testArgs',
                    args: [],
                };
                const imqSpy = mock.method(service.imq, 'send');

                await service.start();

                service.imq.emit('message', request, uuid());

                await new Promise((resolve, reject) =>
                    setTimeout(() => {
                        try {
                            resolve(
                                assert.equal(
                                    imqSpy.mock.calls.at(-1).arguments[1].error
                                        .code,
                                    'IMQ_RPC_INVALID_ARGS_COUNT',
                                ),
                            );
                        } catch (err) {
                            reject(err);
                        }
                    }),
                );

                await service.destroy();
            },
        );

        it(
            'should throw IMQ_RPC_CALL_ERROR if unexposed ' +
                'number of arguments given',
            async () => {
                const service: any = new TestService({ logger });
                const request: IMQRPCRequest = {
                    from: 'TestClient',
                    method: 'throwable',
                    args: [],
                };
                const imqSpy = mock.method(service.imq, 'send');

                await service.start();

                service.imq.emit('message', request, uuid());

                await new Promise((resolve, reject) =>
                    setTimeout(() => {
                        try {
                            resolve(
                                assert.equal(
                                    imqSpy.mock.calls.at(-1).arguments[1].error
                                        .code,
                                    'IMQ_RPC_CALL_ERROR',
                                ),
                            );
                        } catch (err) {
                            reject(err);
                        }
                    }),
                );

                await service.destroy();
            },
        );
    });
});
