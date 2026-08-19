/*!
 * Logging helpers unit tests
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { errorCode, logSafe } from '../../src/helpers/index.js';

const capturing = (): any => {
    const warn = mock.fn();

    return {
        warn,
        lines: (): string[] =>
            warn.mock.calls.map((one: any) => String(one.arguments[0])),
        logger: { log: () => {}, info: () => {}, warn, error: () => {} } as any,
    };
};

describe('logSafe()', () => {
    it('writes every line, repeats included', () => {
        const cap = capturing();

        logSafe(cap.logger, 'warn', 'one');
        logSafe(cap.logger, 'warn', 'one');
        logSafe(cap.logger, 'warn', 'two');

        assert.deepEqual(cap.lines(), ['one', 'one', 'two']);
    });

    it('writes through the requested level', () => {
        const error = mock.fn();
        const logger: any = {
            log: () => {},
            info: () => {},
            warn: () => {},
            error,
        };

        logSafe(logger, 'error', 'boom');

        assert.equal(error.mock.callCount(), 1);
    });

    it('never throws when the logger throws', () => {
        const broken: any = {
            warn: () => {
                throw new Error('logger is broken');
            },
        };

        assert.doesNotThrow(() => logSafe(broken, 'warn', 'line'));
    });
});

describe('errorCode()', () => {
    it('prefers an explicit code', () => {
        assert.equal(
            errorCode({ code: 'IMQ_RPC_CALL_TIMEOUT' }),
            'IMQ_RPC_CALL_TIMEOUT',
        );
        assert.equal(errorCode({ code: 42 }), '42');
    });

    it('reads the leading redis reply code', () => {
        assert.equal(errorCode(new Error('WRONGTYPE nope')), 'WRONGTYPE');
    });

    it('never returns the message itself', () => {
        assert.equal(
            errorCode(new Error('customer 12345 ssn 000-00-0000')),
            'unknown',
        );
        assert.equal(errorCode(new Error('CUSTOMER 12345 secret')), 'unknown');
    });

    it('never returns a code outside the allow-list', () => {
        assert.equal(errorCode({ code: 'SSN-000-00-0000' }), 'unknown');
        assert.equal(errorCode({ code: 123456789 }), 'unknown');
        assert.equal(errorCode({ name: 'Customer_12345' }), 'unknown');
    });

    it('maps a known client failure message to a code', () => {
        assert.equal(
            errorCode(new Error('Connection is closed.')),
            'CONNECTION_CLOSED',
        );
    });

    it('never throws on odd values', () => {
        assert.equal(errorCode(undefined), 'unknown');
        assert.equal(errorCode(null), 'unknown');
        assert.equal(errorCode({}), 'unknown');
        assert.equal(
            errorCode({
                get code(): string {
                    throw new Error('nope');
                },
            }),
            'unknown',
        );
    });
});
