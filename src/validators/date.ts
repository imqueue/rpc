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
import { string, number } from '.';
import * as moment from 'moment';
export { moment };

export const DEFAULT_DATE_FORMAT: moment.MomentFormatSpecification = [
    moment.ISO_8601,
    moment.RFC_2822
];
export const DEFAULT_TIME_FORMATS: string[] = [
    'HH:mm',
    'HH:mm:ss',
    'HH:mm:ss.SSS',
    'h:mm A',
    'h:mm:ss A',
    'h:mm:ss.SSS A'
];

/**
 * Generic toString() converter
 *
 * @access private
 * @type {Function}
 */
const toString: Function = Object.prototype.toString.call;

/**
 * Constructs and returns date moment
 *
 * @access private
 * @param {any} value
 * @param {moment.MomentFormatSpecification} format
 * @param {string} lang
 * @returns {moment.Moment}
 */
function dateMoment(
    value: any,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
): moment.Moment {
    try {
        if (
            toString(value) === '[object Object]' ||
            toString(value) === '[object Array]'
        ) {
            return  moment('Invalid Date');
        }

        return moment.parseZone((
            value instanceof Date || value instanceof moment
                ? value.toISOString()
                : value
        ), format, lang, true);
    }

    catch (err) {
        return moment('Invalid Date');
    }
}

/**
 * Constructs and returns time moment
 *
 * @access private
 * @param {any} value
 * @param {string | string[]} [format]
 * @param {string} [lang]
 * @returns {moment.Moment}
 */
function timeMoment(
    value: any,
    format: string | string[] = DEFAULT_TIME_FORMATS,
    lang?: string
): moment.Moment {
    try {
        if (number(value)) {
            if (!number.int(value)) { // float number
                value = parseInt(String(value * 1000), 10);
            }

            if (format === 'unix') {
                return moment.unix(value);
            }

            return moment(value);
        }

        return moment(value, format, lang, true);
    }

    catch (err) {
        return moment('Invalid Time');
    }
}

/**
 * Checks if given value is a valid date
 *
 * @param {any} value - value to check
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - use language withing the value, should be usually
 *                          2-char iso lang string, like 'en', 'fr', etc.
 * @returns {boolean} - check result, true - if valid, otherwise - false
 */
export const date: IMQValidatorInterface = function date(
    value: any,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
): boolean {
    return dateMoment(value, format, lang).isValid();
};

/**
 *  * Returns validator to check if given value date is in future in comparison
 * to a given compare date.
 *
 * @param {string | Date | moment.Moment} cmpDate - date to compare with
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - check result, true - if valid, otherwise - false
 * @returns {(value: any) => boolean}
 */
date.gt = function(
    cmpDate: string | Date | moment.Moment,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
) {
    const compare = dateMoment(cmpDate, format, lang);

    return (value: any) => {
        const given = dateMoment(value, format, lang);

        return compare.isValid() && given.isValid() && compare.isBefore(given);
    }
};

/**
 * Returns validator to check if given value date is in future in comparison
 * to a given compare date or equal to compare date.
 *
 * @param {string | Date | moment.Moment} cmpDate - date to compare with
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - check result, true - if valid, otherwise - false
 * @returns {(value: any) => boolean}
 */
date.gte = function(
    cmpDate: string | Date | moment.Moment,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
) {
    const compare = dateMoment(cmpDate, format, lang);

    return (value: any) => {
        const given = dateMoment(value, format, lang);

        return compare.isValid() && given.isValid() && (
            compare.isBefore(given) || compare.diff(given) === 0
        );
    }
};

/**
 * Returns validator to check if given value date is in the past in comparison
 * to a given compare date.
 *
 * @param {string | Date | moment.Moment} cmpDate - date to compare with
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - check result, true - if valid, otherwise - false
 * @returns {(value: any) => boolean}
 */
date.lt = function(
    cmpDate: string | Date | moment.Moment,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
) {
    const compare = dateMoment(cmpDate, format, lang);

    return (value: any) => {
        const given = dateMoment(value, format, lang);

        return compare.isValid() && given.isValid() && compare.isAfter(given);
    }
};

/**
 * Returns validator to check if given value date is in the past in comparison
 * to a given compare date or equal to compare date.
 *
 * @param {string | Date | moment.Moment} cmpDate - date to compare with
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - check result, true - if valid, otherwise - false
 * @returns {(value: any) => boolean}
 */
date.lte = function(
    cmpDate: string | Date | moment.Moment,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
) {
    const compare = dateMoment(cmpDate, format, lang);

    return (value: any) => {
        const given = dateMoment(value, format, lang);

        return compare.isValid() && given.isValid() && (
            compare.isAfter(given) || compare.diff(given) === 0
        );
    }
};

/**
 * Returns validator to check if given value date equals compare date.
 *
 * @param {string | Date | moment.Moment} cmpDate - date to compare with
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - check result, true - if valid, otherwise - false
 * @returns {(value: any) => boolean}
 */
date.eq = function(
    cmpDate: string | Date | moment.Moment,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
) {
    const compare = dateMoment(cmpDate, format, lang);

    return (value: any) => {
        const given = dateMoment(value, format, lang);

        return compare.isValid() && given.isValid() && (
            compare.diff(given) === 0
        );
    }
};

/**
 * Returns validator to check if given value date is between start and end
 * comparison dates.
 *
 * @param {string | Date | moment.Moment} start - start date to compare with
 * @param {string | Date | moment.Moment} end - end date to compare with
 * @param {moment.MomentFormatSpecification} [format] - date formats to match
 *                                                      within the given value
 * @param {string} [lang] - check result, true - if valid, otherwise - false
 * @returns {(value: any) => boolean}
 */
date.between = function(
    start: string | Date | moment.Moment,
    end: string | Date | moment.Moment,
    format: moment.MomentFormatSpecification = DEFAULT_DATE_FORMAT,
    lang?: string
) {
    const startDate = dateMoment(start, format, lang);
    const endDate = dateMoment(end, format, lang);

    return (value: any) => {
        const given = dateMoment(value, format, lang);

        return startDate.isValid() && endDate.isValid() && given.isValid() &&
            given.isBetween(startDate, endDate);
    }
};

/**
 * Checks if a given value valid time
 *
 * @param {any} value
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {boolean} - check result, if valid - true, false - otherwise
 */
date.time = function (
    value: any,
    format: string | string[] = DEFAULT_TIME_FORMATS
): boolean {
    return timeMoment(value, format).isValid();
};

/**
 * Returns validator to check if a given time is in the future in
 * comparison to a given compare time.
 *
 * @param {string | number | Date | moment.Moment} cmpTime
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {(value: any) => boolean}
 */
date.time.gt = function(
    cmpTime: string | number | Date | moment.Moment,
    format: string | string[] = DEFAULT_TIME_FORMATS
) {
    const compare = timeMoment(cmpTime, format);

    return (value: any) => {
        const given = timeMoment(cmpTime, value);

        return compare.isValid() && given.isValid() && compare.isBefore(given);
    }
};

/**
 * Returns validator to check if a given time is in the future in
 * comparison to a given compare time or both times are equal.
 *
 * @param {string | number | Date | moment.Moment} cmpTime
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {(value: any) => boolean}
 */
date.time.gte = function(
    cmpTime: string | number | Date | moment.Moment,
    format: string | string[] = DEFAULT_TIME_FORMATS
) {
    const compare = timeMoment(cmpTime, format);

    return (value: any) => {
        const given = timeMoment(cmpTime, value);

        return compare.isValid() && given.isValid() && (
            compare.isBefore(given) || compare.diff(given) === 0
        );
    }
};

/**
 * Returns validator to check if a given time is in the past in
 * comparison to a given compare time.
 *
 * @param {string | number | Date | moment.Moment} cmpTime
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {(value: any) => boolean}
 */
date.time.lt = function(
    cmpTime: string | number | Date | moment.Moment,
    format: string | string[] = DEFAULT_TIME_FORMATS
) {
    const compare = timeMoment(cmpTime, format);

    return (value: any) => {
        const given = timeMoment(cmpTime, value);

        return compare.isValid() && given.isValid() && compare.isAfter(given);
    }
};

/**
 * Returns validator to check if a given time is in the future in
 * comparison to a given compare time or both times are equal.
 *
 * @param {string | number | Date | moment.Moment} cmpTime
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {(value: any) => boolean}
 */
date.time.lte = function(
    cmpTime: string | number | Date | moment.Moment,
    format: string | string[] = DEFAULT_TIME_FORMATS
) {
    const compare = timeMoment(cmpTime, format);

    return (value: any) => {
        const given = timeMoment(cmpTime, value);

        return compare.isValid() && given.isValid() && (
            compare.isAfter(given) || compare.diff(given) === 0
        );
    }
};

/**
 * Returns validator to check if a given time equals to given compare time.
 *
 * @param {string | number | Date | moment.Moment} cmpTime
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {(value: any) => boolean}
 */
date.time.eq = function(
    cmpTime: string | number | Date | moment.Moment,
    format: string | string[] = DEFAULT_TIME_FORMATS
) {
    const compare = timeMoment(cmpTime, format);

    return (value: any) => {
        const given = timeMoment(cmpTime, value);

        return compare.isValid() && given.isValid() && (
            compare.diff(given) === 0
        );
    }
};

/**
 * Returns validator to check if a given time is in between the given
 * start and and comparison times.
 *
 * @param {string | number | Date | moment.Moment} start
 * @param {string | number | Date | moment.Moment} end
 * @param {string | string[]} [format] - acceptable time formats for validation
 * @returns {(value: any) => boolean}
 */
date.time.between = function(
    start: string | number | Date | moment.Moment,
    end: string | number | Date | moment.Moment,
    format: string | string[] = DEFAULT_TIME_FORMATS
) {
    const startTime = timeMoment(start, format);
    const endTime = timeMoment(end, format);

    return (value: any) => {
        const given = timeMoment(value, format);

        return startTime.isValid() && endTime.isValid() && given.isValid() &&
            given.isBetween(startTime, endTime);
    }
};
