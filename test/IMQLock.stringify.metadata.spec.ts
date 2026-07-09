/*!
 * IMQLock stringify(metadata) failure branch coverage test
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { IMQLock } from '../index.js';

describe('IMQLock acquire() timeout with unstringifiable metadata', () => {
    const KEY = 'circular-metadata-key';
    let originalTimeout: number;

    beforeEach(() => {
        originalTimeout = IMQLock.deadlockTimeout;
        IMQLock.deadlockTimeout = 10; // keep test fast
    });

    afterEach(() => {
        IMQLock.deadlockTimeout = originalTimeout;
    });

    it('should reject with error containing "Unable to stringify metadata"', async () => {
        // Acquire and hold the lock
        const first = await IMQLock.acquire(KEY);
        assert.equal(first, true);

        // Prepare circular metadata that will make JSON.stringify throw
        const meta: any = {
            className: 'X',
            methodName: 'y',
            args: [] as any[],
        };
        (meta as any).self = meta; // circular reference

        try {
            await IMQLock.acquire(KEY, undefined as any, meta);
            assert.fail('should have been rejected by timeout');
        } catch (err: any) {
            assert.ok(err instanceof Error);
            assert.ok(
                String(err.message).includes('Unable to stringify metadata'),
            );
        }
    });
});
