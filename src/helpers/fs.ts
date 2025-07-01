/*!
 * IMQ-RPC helpers: fs
 *
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
