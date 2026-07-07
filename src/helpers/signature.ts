/*!
 * IMQ-RPC helpers: signature
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
import { fingerprint64 } from 'farmhash-modern';

/**
 * Serializes a value into a deterministic, JSON-compatible string. It mirrors
 * `JSON.stringify` semantics (including `toJSON` support and how `undefined`,
 * functions, and non-finite numbers are treated), with two deliberate
 * differences that make it safe for hashing:
 *
 * - object keys are sorted, so two objects that differ only in key insertion
 *   order serialize identically (for objects whose keys are already sorted,
 *   the output is byte-identical to `JSON.stringify`, which keeps previously
 *   generated cache/lock keys valid);
 * - circular references serialize as the marker string `"[Circular]"` instead
 *   of throwing. Repeated non-circular references to the same object are
 *   serialized in full each time, exactly as `JSON.stringify` does.
 *
 * @param {unknown} value - value to serialize
 * @param {object[]} ancestors - stack of objects on the current descent path,
 *  used for cycle detection
 * @returns {string | undefined} - the serialized value, or `undefined` where
 *  JSON would omit it (`undefined`, functions, and symbols)
 */
function serialize(value: unknown, ancestors: object[]): string | undefined {
    if (value === null) {
        return 'null';
    }

    switch (typeof value) {
        case 'string':
            return JSON.stringify(value);
        case 'number':
            return isFinite(value) ? String(value) : 'null';
        case 'boolean':
            return value ? 'true' : 'false';
        case 'bigint':
            // JSON.stringify throws on bigint; serialize it as a string
            // instead so hashing never fails on valid runtime input
            return `"${String(value)}"`;
        case 'undefined':
        case 'function':
        case 'symbol':
            return undefined;
    }

    const obj = value as Record<string, unknown> & { toJSON?: () => unknown };

    if (typeof obj.toJSON === 'function') {
        return serialize(obj.toJSON(), ancestors);
    }

    if (ancestors.includes(obj)) {
        return '"[Circular]"';
    }

    ancestors.push(obj);

    try {
        if (Array.isArray(obj)) {
            const items = obj.map(item => serialize(item, ancestors) ?? 'null');

            return `[${items.join(',')}]`;
        }

        const parts: string[] = [];

        for (const key of Object.keys(obj).sort()) {
            const serialized = serialize(obj[key], ancestors);

            if (serialized !== undefined) {
                parts.push(`${JSON.stringify(key)}:${serialized}`);
            }
        }

        return `{${parts.join(',')}}`;
    } finally {
        ancestors.pop();
    }
}

/**
 * Constructs and returns a hash string for the given set of className,
 * methodName and arguments. The hash is deterministic: argument objects that
 * differ only in key insertion order produce the same signature, and circular
 * arguments are handled without throwing.
 *
 * @param {string} className - name of the class the method belongs to
 * @param {string | symbol} methodName - name of the method being called
 * @param {readonly unknown[]} args - arguments passed to the method
 * @returns {string} - hexadecimal hash string
 */
export function signature(
    className: string,
    methodName: string | symbol,
    args: readonly unknown[],
): string {
    const data = serialize([className, methodName, args], []) as string;
    const hashBigInt = fingerprint64(data);
    return hashBigInt.toString(16);
}
