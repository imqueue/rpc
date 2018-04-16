/*!
 * IMQ-RPC Validators: string
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
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
import { IMQValidatorInterface } from '.';

/**
 * Validate if a given value of string type.
 *
 * @param {any} value
 * @returns {boolean} - check result
 */
export const string: IMQValidatorInterface = function string(value: any) {
    return typeof value === 'string';
};

/**
 * Checks if a given value an empty string. By default all space characters
 * will be trimmed off the beginning and the end of a given string.
 *
 * @param {boolean} [trimSpace] - true - trim spaces (default),
 *                                false - keep spaces
 * @returns {(value: any) => any | boolean}
 */
string.empty = function(trimSpace: boolean = true) {
    return (value: any) => string(value) && (trimSpace
        ? value.trim() === ""
        : value === "");
};

/**
 * Checks if a given value is not empty string. By default all space characters
 * will be trimmed off the beginning and the end of a given string.
 *
 * @param {boolean} [trimSpace]true - trim spaces (default),
 *                                    false - keep spaces
 * @returns {(value: any) => any | boolean}
 */
string.notEmpty = function(trimSpace: boolean = true) {
    return (value: any) => string(value) && (trimSpace
        ? value.trim() !== ""
        : value !== "");
};

/**
 * Returns validation function which checks if a given value a string of a
 * given length.
 *
 * @param {number} len - string length to match with
 * @returns {(value: any) => any | boolean}
 */
string.len = function(len: number) {
    return (value: any) => string(value) && value.length === len;
};

/**
 * Returns validation function which checks if a given value a string of
 * a length lesser or equal given max length.
 *
 * @param {number} maxLen - max length of a string to verify against
 * @returns {(value: any) => any | boolean}
 */
string.maxLen = function(maxLen: number) {
    return (value: any) => string(value) && value.length <= maxLen;
};

/**
 * Returns validation function which checks if a given value a string of
 * a length greater or equal given min length.
 *
 * @param {number} minLen - min length of a string to verify against
 * @returns {(value: any) => any | boolean}
 */
string.minLen = function(minLen: number) {
    return (value: any) => string(value) && value.length >= minLen;
};

/**
 * Returns validation function which checks if a given value a string
 * fully matching given comparison string.
 *
 * @param {string} val - string to compare against
 * @returns {(value: any) => any | boolean}
 */
string.equal = function(val: string) {
    return (value: any) => string(value) && value === val;
};

/**
 * Returns validation function which checks if a given value a string matching
 * given regular expressions pattern.
 *
 * @param {RegExp} pattern - pattern to verify against
 * @returns {(value: any) => any | boolean}
 */
string.match = function(pattern: RegExp) {
    return (value: any) => string(value) && pattern.test(value);
};
