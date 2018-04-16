/*!
 * IMQ-RPC Validators: number
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
 * Checks if given value is a valid number type
 *
 * @param {any} value - value to validate
 * @returns {boolean} - check result
 */
export const number: IMQValidatorInterface = function number(value: any) {
    return typeof value === 'number';
};

/**
 * Checks if a given number a valid integer type
 *
 * @param {any} value - value to validate
 * @returns {boolean} - check result
 */
number.int = function(value: any) {
    return number(value) && Number.isInteger(value);
};

/**
 * Returns validate function to check if a given number value greater than
 * given comparison value.
 *
 * @param {number} val - comparison value
 * @returns {(value: any) => any | boolean} - validator function for given value
 */
number.gt = function(val: number) {
    return (value: any) => number(value) && value > val;
};

/**
 * Returns validate function to check if a given number value greater than
 * or equals given comparison value.
 *
 * @param {number} val - comparison value
 * @returns {(value: any) => any | boolean} - validator function for given value
 */
number.gte = function(val: number) {
    return (value: any) => number(value) && value >= val;
};

/**
 * Returns validate function to check if a given number value less than
 * given comparison value.
 *
 * @param {number} val - comparison value
 * @returns {(value: any) => any | boolean} - validator function for given value
 */
number.lt = function(val: number) {
    return (value: any) => number(value) && value < val;
};

/**
 * Returns validate function to check if a given number value less than
 * or equals given comparison value.
 *
 * @param {number} val - comparison value
 * @returns {(value: any) => any | boolean} - validator function for given value
 */
number.lte = function(val: number) {
    return (value: any) => number(value) && value <= val;
};

/**
 * Returns validate function to check if a given number value equals given
 * comparison value..
 *
 * @param {number} val - comparison value
 * @returns {(value: any) => any | boolean} - validator function for given value
 */
number.eq = function(val: number) {
    return (value: any) => number(value) && value === val;
};

/**
 * Returns validate function to check if a given number is in between
 * range defined my a given min and max values.
 *
 * @param {number} min - min value of the range
 * @param {number} max - max value of the range
 * @returns {(value: any) => any | boolean} - validator function for given value
 */
number.between = function(min: number, max: number) {
    return (value: any) => number(value) && (value >= min && value <= max);
};
