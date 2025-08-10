/*!
 * IMQService Hooks Unit Tests (incremental)
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
import { expect } from 'chai';
import * as sinon from 'sinon';
import { uuid } from '@imqueue/core';
import { logger } from './mocks';
import {
    IMQService,
    IMQRPCRequest,
    expose,
    BEFORE_HOOK_ERROR,
} from '..';

class HookTestService extends IMQService {
    @expose()
    public ping() {
        return 'pong';
    }
}

describe('IMQService hooks (beforeCall)', () => {
    it('should execute beforeCall hook without error', async () => {
        const beforeCall = sinon.spy(async () => {});
        const service: any = new HookTestService({ logger, beforeCall });
        const request: IMQRPCRequest = {
            from: 'HookClient',
            method: 'ping',
            args: [],
        };
        const id = uuid();
        const sendSpy = sinon.spy(service.imq, 'send');

        await service.start();
        service.imq.emit('message', request, id);

        // wait for async send
        await new Promise((resolve, reject) => setTimeout(() => {
            try {
                expect(beforeCall.calledOnce).to.be.true;
                expect(sendSpy.called).to.be.true;
                resolve(undefined);
            } catch (err) {
                reject(err);
            }
        }));

        await service.destroy();
    });

    it('should catch beforeCall error and log BEFORE_HOOK_ERROR', async () => {
        const warnSpy = sinon.spy(logger, 'warn');
        const beforeCall = async () => { throw new Error('boom'); };
        const service: any = new HookTestService({ logger, beforeCall });
        const request: IMQRPCRequest = {
            from: 'HookClient',
            method: 'ping',
            args: [],
        };
        const id = uuid();

        await service.start();
        service.imq.emit('message', request, id);

        await new Promise((resolve, reject) => setTimeout(() => {
            try {
                expect(warnSpy.called).to.be.true;
                const calledWithBefore = warnSpy.getCalls().some((c: any) => c.args && c.args[0] === BEFORE_HOOK_ERROR);
                expect(calledWithBefore).to.be.true;
                resolve(undefined);
            } catch (err) {
                reject(err);
            }
        }));

        warnSpy.restore();
        await service.destroy();
    });
});
