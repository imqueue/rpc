/*!
 * IMQLock Unit Tests
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
import './mocks';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { IMQLock, AcquiredLock } from '..';

const LOCK_TIMEOUT = 100;
const ORIGINAL_LOCK_TIMEOUT = IMQLock.deadlockTimeout;

async function deadLocked() {
    const lock: AcquiredLock<number> =
        await IMQLock.acquire<number>('deadLocked');

    if (IMQLock.locked('lockable')) {
        try {
            const res = await new Promise(resolve =>
                setTimeout(
                    () =>
                        resolve(Math.random() * Math.random() + Math.random()),
                    LOCK_TIMEOUT,
                ),
            );
            IMQLock.release('deadLocked', res);
            return res;
        } catch (err: any) {
            IMQLock.release('deadLocked', null, err);
            throw err;
        }
    }

    return lock;
}

describe('IMQLock', () => {
    (this as any).timeout = 30000;

    before(() => {
        IMQLock.deadlockTimeout = LOCK_TIMEOUT;
    });
    after(() => {
        IMQLock.deadlockTimeout = ORIGINAL_LOCK_TIMEOUT;
    });

    it('should be a class', () => {
        assert.equal(typeof IMQLock, 'function');
    });

    describe('acquire()', () => {
        it('should avoid dead-locks using timeout', async () => {
            try {
                for (let i = 0; i < 10; ++i) {
                    await deadLocked();
                }
            } catch (err: any) {
                assert.ok(err.message.includes('Lock timeout'));
            }
        });
    });
});

describe('IMQLock queued callback errors', () => {
    const originalTimeout = IMQLock.deadlockTimeout;
    const originalLogger = IMQLock.logger;

    before(() => {
        // no deadlock timer, and a silent logger so a thrown callback is
        // contained rather than logged to the console
        IMQLock.deadlockTimeout = 0;
        IMQLock.logger = {
            log: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
        } as any;
    });
    after(() => {
        IMQLock.deadlockTimeout = originalTimeout;
        IMQLock.logger = originalLogger;
    });

    it('contains a throwing callback on the resolve path', async () => {
        const key = 'cbResolveThrow';

        await IMQLock.acquire(key);

        const pending = IMQLock.acquire(key, () => {
            throw new Error('resolve callback boom');
        });

        IMQLock.release(key, 'ok');

        assert.equal(await pending, 'ok');
    });

    it('surfaces a throwing callback on the reject path', async () => {
        const key = 'cbRejectThrow';

        await IMQLock.acquire(key);

        const pending = IMQLock.acquire(key, () => {
            throw new Error('reject callback boom');
        });

        IMQLock.release(key, null, new Error('original rejection'));

        await assert.rejects(pending, /reject callback boom/);
    });
});
