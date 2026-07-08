/*!
 * IMQService afterCall and promise branch Unit Tests (incremental)
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
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuid } from 'node:crypto';
import { logger } from './mocks';
import { IMQService, IMQRPCRequest, expose, AFTER_HOOK_ERROR } from '..';

class AfterHookService extends IMQService {
    @expose()
    public ping() {
        return 'pong';
    }

    @expose()
    public async asyncHello(name: string) {
        return await new Promise<string>(resolve =>
            setTimeout(() => resolve(`Hello, ${name}!`), 5),
        );
    }
}

describe('IMQService hooks (afterCall) and promise branch', () => {
    it('should execute afterCall hook without error', async () => {
        const afterCall = mock.fn(async () => {});
        const service: any = new AfterHookService({ logger, afterCall });
        const request: IMQRPCRequest = {
            from: 'HookClient',
            method: 'ping',
            args: [],
        };
        const id = uuid();
        const sendSpy = mock.method(service.imq, 'send');

        await service.start();
        service.imq.emit('message', request, id);

        await new Promise((resolve, reject) =>
            setTimeout(() => {
                try {
                    assert.equal(sendSpy.mock.callCount() > 0, true);
                    assert.equal(afterCall.mock.callCount() === 1, true);
                    resolve(undefined);
                } catch (err) {
                    reject(err);
                }
            }),
        );

        await service.destroy();
    });

    it('should catch afterCall error and log AFTER_HOOK_ERROR', async () => {
        const warnSpy = mock.method(logger, 'warn');
        const afterCall = async () => {
            throw new Error('after boom');
        };
        const service: any = new AfterHookService({ logger, afterCall });
        const request: IMQRPCRequest = {
            from: 'HookClient',
            method: 'ping',
            args: [],
        };
        const id = uuid();

        await service.start();
        service.imq.emit('message', request, id);

        await new Promise((resolve, reject) =>
            setTimeout(() => {
                try {
                    assert.equal(warnSpy.mock.callCount() > 0, true);
                    const hasAfter = warnSpy.mock.calls.some(
                        (c: any) =>
                            c.arguments && c.arguments[0] === AFTER_HOOK_ERROR,
                    );
                    assert.equal(hasAfter, true);
                    resolve(undefined);
                } catch (err) {
                    reject(err);
                }
            }),
        );

        warnSpy.mock.restore();
        await service.destroy();
    });

    it('should await promise-returning method result before sending', async () => {
        const service: any = new AfterHookService({ logger });
        // make an exposed method return a Promise to hit thenable branch
        service.exposed = async () =>
            await new Promise<string>(resolve =>
                setTimeout(() => resolve('Hello, IMQ!'), 5),
            );
        const request: IMQRPCRequest = {
            from: 'HookClient',
            method: 'exposed',
            args: [],
        };
        const id = uuid();

        // stub to assert when send() is actually called, after promise resolved
        const done = new Promise<void>((resolve, reject) => {
            mock.method(
                service.imq,
                'send',
                async (_to: string, response: any) => {
                    try {
                        assert.equal(response.data, 'Hello, IMQ!');
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                    return id;
                },
            );
        });

        await service.start();
        service.imq.emit('message', request, id);

        await done;

        await service.destroy();
    });
});
