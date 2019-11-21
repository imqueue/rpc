/*!
 * IMQ-RPC helpers: fs
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
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
import * as fs from 'fs';

/**
 * Checks if file exists at given path
 *
 * @param {string} path
 * @return {Promise<any>}
 */
export function fileExists(path: string) {
    return new Promise(resolve => fs.access(path, err => resolve(!err)));
}

/**
 * Async mkdir
 *
 * @param {string} path
 * @return {Promise<any>}
 */
export function mkdir(path: string) {
    return new Promise((resolve, reject) => fs.mkdir(
        path,
        generalCallback.bind(null, resolve, reject)));
}

/**
 * Async writeFile
 *
 * @param {string} path
 * @param {string} content
 * @return {Promise<any>}
 */
export function writeFile(path: string, content: string) {
    return new Promise((resolve, reject) =>
        fs.writeFile(
            path,
            content,
            { encoding: 'utf8' },
            generalCallback.bind(null, resolve, reject)));
}

/**
 * Constructs and return callback which will resolve promise using
 * given resolver and reject'or
 *
 * @param {() => void} resolve
 * @param {(err: Error) => void} reject
 * @param {Error} err
 */
function generalCallback(
    resolve: () => void,
    reject: (err: Error) => void,
    err?: Error
) {
    if (err) {
        reject(err);
    }

    resolve();
}
