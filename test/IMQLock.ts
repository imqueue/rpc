/*!
 * IMQLock Unit Tests
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
    this.timeout = 30000;

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
