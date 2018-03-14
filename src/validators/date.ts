/*!
 * IMQ-RPC Validators: date
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
import { string } from '.';
import * as moment from 'moment';

export const date: IMQValidatorInterface = function date(
    value: any,
    format?: any
): boolean {
    return value instanceof Date || (typeof value === 'string' && (format
        ? moment(value, format, true).isValid()
        : moment(value).isValid()));
}

date.format = function(format: any = [moment.ISO_8601, moment.RFC_2822]) {
    return (value: any) => date(value, format);
}

date.gt = function(date: string | Date) {

}

date.gte = function(date: string | Date) {

}

date.lt = function(date: string | Date) {

}

date.lte = function(date: string | Date) {

}

date.eq = function(date: string | Date) {

}

date.between = function(date: string | Date) {

}

date.time = function (value: any) {

}

date.time.gt = function(time: string | number | Date) {

}

date.time.gte = function(time: string | number | Date) {

}

date.time.lt = function(time: string | number | Date) {

}

date.time.lte = function(time: string | number | Date) {

}

date.time.eq = function(time: string | number | Date) {

}

date.time.between = function(time: string | number | Date) {

}
