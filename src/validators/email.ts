/*!
 * IMQ-RPC Validators: email
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
 * Validates if given value string a valid  email address syntactically.
 *
 * @example
 * ~~~typescript
 * let isEmail = email('test@example.com');
 * console.log(isEmail);
 * ~~~
 *
 * @param {string} value
 * @returns {boolean}
 */
export const email: IMQValidatorInterface = function email(value: any) {
    // inspired by
    // @see https://www.w3.org/TR/html5/forms.html#valid-e-mail-address
    const rx = new RegExp(
        '^[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+@[a-zA-Z0-9]' +
        '(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?' +
        '(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    );

    return typeof value === 'string' && rx.test(value);
};
