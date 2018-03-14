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

export const string: IMQValidatorInterface = function string(value: any) {
    return typeof value === 'string';
}

string.empty = function(trimSpace: boolean = true) {
    return (value: any) => string(value) && (trimSpace
        ? value.trim() === ""
        : value === "");
}

string.notEmpty = function(trimSpace: boolean = true) {
    return (value: any) => string(value) && (trimSpace
        ? value.trim() !== ""
        : value !== "");
}

string.len = function(len: number) {
    return (value: any) => string(value) && value.length === len;
}

string.maxLen = function(maxLen: number) {
    return (value: any) => string(value) && value.length <= maxLen;
}

string.minLen = function(minLen: number) {
    return (value: any) => string(value) && value.length >= minLen;
}

string.equal = function(val: string) {
    return (value: any) => string(value) && value === val;
}

string.match = function(pattern: RegExp) {
    return (value: any) => string(value) && pattern.test(value);
}

string.numeric = function() {
    return (value: any) => string(value) && !isNaN(value) && isFinite(+value);
}

string.int = function() {
    return (value: any) => string(value) && Number.isInteger(+value);
}
