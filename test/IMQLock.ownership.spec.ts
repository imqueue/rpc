/*!
 * IMQLock Ownership Unit Tests
 *
 * I'm Queue Software Project
 * Copyright (C) 2026  imqueue.com <support@imqueue.com>
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
import './mocks/index.js';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IMQLock } from '../index.js';

// Wide enough that the margins below are tens of milliseconds rather than
// single-digit ones, since every wait here is a real timer.
const TIMEOUT = 200;
const ORIGINAL_TIMEOUT = IMQLock.deadlockTimeout;

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/** Lets already-settled promise continuations run, without advancing timers. */
const drain = (): Promise<void> =>
    new Promise(resolve => setImmediate(resolve));

/**
 * Waits on a key and reports what happened, with the handler attached
 * synchronously so a timeout rejection is never unhandled.
 */
function waiter(key: string): { settled: () => string | undefined } {
    // acquire() on a free key makes the caller the HOLDER and resolves with
    // `true` — a waiter that quietly became a holder would assert on the wrong
    // thing entirely, so refuse rather than mislead
    assert.equal(
        IMQLock.locked(key),
        true,
        'waiter() needs the key to be held by someone else',
    );

    let settled: string | undefined;

    void IMQLock.acquire<string>(key).then(
        value => (settled = `resolved:${value}`),
        err => (settled = `rejected:${err.message.split(',')[0]}`),
    );

    return { settled: () => settled };
}

/**
 * Drives the key to the state the deadlock timeout creates: `holder` acquired
 * it, a waiter timed out and freed it, and `overtook` then acquired it while
 * `holder` is still running.
 */
async function overtakenHolder(key: string) {
    await IMQLock.acquire<string>(key);

    const holder = IMQLock.token(key);
    const timedOut = waiter(key);

    // let the waiter's deadlock timer fire, which frees the key
    await sleep(TIMEOUT * 1.4);
    assert.equal(IMQLock.locked(key), false, 'timeout should free the key');
    assert.match(String(timedOut.settled()), /^rejected:Lock timeout/);

    await IMQLock.acquire<string>(key);

    const overtook = IMQLock.token(key);

    assert.notEqual(holder, overtook, 'the two holders must not share a token');

    return { holder, overtook };
}

describe('IMQLock ownership', () => {
    before(() => {
        IMQLock.deadlockTimeout = TIMEOUT;
    });
    after(() => {
        IMQLock.deadlockTimeout = ORIGINAL_TIMEOUT;
    });

    describe('token()', () => {
        it('is undefined while the key is unlocked', () => {
            assert.equal(IMQLock.token('token-unlocked'), undefined);
        });

        it('is a fresh value for every acquire of the same key', async () => {
            const key = 'token-fresh';

            await IMQLock.acquire<string>(key);

            const first = IMQLock.token(key);

            IMQLock.release(key, 'a', undefined, first);
            await IMQLock.acquire<string>(key);

            const second = IMQLock.token(key);

            assert.equal(typeof first, 'number');
            assert.notEqual(first, second);
            IMQLock.release(key, 'b', undefined, second);
        });
    });

    describe('release() with a token', () => {
        it('ignores a release from a holder that was overtaken', async () => {
            const key = 'release-overtaken';
            const { holder, overtook } = await overtakenHolder(key);
            // queued behind the second holder, so only its result is correct
            const queued = waiter(key);

            await drain();

            // the first holder finally finishes: this must not land on the
            // second holder's lock, metadata or waiters
            IMQLock.release(key, 'result-of-first', undefined, holder);
            await drain();

            assert.equal(
                queued.settled(),
                undefined,
                'a waiter on the second holder must not be resolved by the first',
            );
            assert.equal(IMQLock.locked(key), true, 'the key is still held');
            assert.equal(IMQLock.token(key), overtook);

            IMQLock.release(key, 'result-of-second', undefined, overtook);
            await drain();

            assert.equal(queued.settled(), 'resolved:result-of-second');
        });

        it('still applies when the timeout freed the key and nobody took it', async () => {
            const key = 'release-unowned';

            await IMQLock.acquire<string>(key);

            const holder = IMQLock.token(key);
            const timedOut = waiter(key);

            await sleep(TIMEOUT * 0.5);

            const surviving = waiter(key);

            // The first waiter's timer frees the key and rejects that waiter,
            // but a straggler release is the best answer the ones still queued
            // are going to get, so an unowned key is not treated as a conflict.
            await sleep(TIMEOUT * 0.7);
            assert.equal(IMQLock.locked(key), false);
            assert.match(String(timedOut.settled()), /^rejected:Lock timeout/);
            assert.equal(surviving.settled(), undefined);

            IMQLock.release(key, 'result-of-first', undefined, holder);
            await drain();

            assert.equal(surviving.settled(), 'resolved:result-of-first');
        });
    });

    describe('release() without a token', () => {
        it('applies unconditionally, as it always has', async () => {
            const key = 'release-legacy';
            const { overtook } = await overtakenHolder(key);
            const queued = waiter(key);

            await drain();

            // Pinned deliberately: an untokened release cannot be checked, and
            // stays as unsafe as it was so that existing callers of the raw
            // IMQLock API keep working. This is the whole reason the token is
            // optional rather than required — `lock()` passes one for you.
            IMQLock.release(key, 'result-of-first');
            await drain();

            assert.equal(queued.settled(), 'resolved:result-of-first');
            assert.equal(IMQLock.locked(key), false);
            assert.equal(IMQLock.token(key), undefined);
            // the overtaking holder's lock is what just got released
            assert.equal(typeof overtook, 'number');
        });
    });

    describe('deadlock timeout', () => {
        it('rejects only the waiter whose patience ran out', async () => {
            const key = 'timeout-per-waiter';

            await IMQLock.acquire<string>(key);

            const holder = IMQLock.token(key);
            // Two waiters whose timers expire well apart. Rejecting through
            // release() used to drain the whole queue, so the second one died
            // for the first one's patience with most of its own left.
            const early = waiter(key);

            await sleep(TIMEOUT * 0.9);

            const late = waiter(key);

            await sleep(TIMEOUT * 0.3);

            assert.match(String(early.settled()), /^rejected:Lock timeout/);
            assert.equal(
                late.settled(),
                undefined,
                'the later waiter still has patience left',
            );

            // leave nothing pending for the next test
            IMQLock.release(key, 'result-of-first', undefined, holder);
        });
    });
});
