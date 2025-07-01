/*!
 * IMQLock Unit Tests
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
import './mocks';
import { expect } from 'chai';
import { IMQLock, AcquiredLock } from '..';

const LOCK_TIMEOUT = 100;
const ORIGINAL_LOCK_TIMEOUT = IMQLock.deadlockTimeout;

async function deadLocked() {
    const lock: AcquiredLock<number> =
        await IMQLock.acquire<number>('deadLocked')
    ;

    if (IMQLock.locked('lockable')) {
        try {
            const res = await new Promise(resolve => setTimeout(() =>
                resolve(Math.random() * Math.random() + Math.random()),
                LOCK_TIMEOUT
            ));
            IMQLock.release('deadLocked', res);
            return res;
        }

        catch (err) {
            IMQLock.release('deadLocked', null, err);
            throw err;
        }
    }

    return lock;
}

describe('IMQLock', () => {
    (this as any).timeout = 30000;

    before(() => { IMQLock.deadlockTimeout = LOCK_TIMEOUT });
    after(() => { IMQLock.deadlockTimeout = ORIGINAL_LOCK_TIMEOUT });

    it('should be a class', () => {
        expect(typeof IMQLock).to.equal('function');
    });

    describe('acquire()', () => {
        it('should avoid dead-locks using timeout', async () => {
            try {
                for (let i = 0; i < 10; ++i) {
                    await deadLocked();
                }
            }

            catch (err) {
                expect(err.message).to.contain('Lock timeout');
            }

        });
    });
});
