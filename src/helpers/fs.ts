/*!
 * IMQ-RPC helpers: fs
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
import { access, mkdir as fsMkdir, writeFile as fsWriteFile } from 'node:fs';

/**
 * Checks whether a file exists at the given path.
 *
 * @param {string} path - path to the file to check
 * @return {Promise<boolean>} - true if the file exists, false otherwise
 */
export function fileExists(path: string): Promise<boolean> {
    return new Promise(resolve => access(path, err => resolve(!err)));
}

/**
 * Asynchronously creates a directory at the given path.
 *
 * @param {string} path - path of the directory to create
 * @return {Promise<void>}
 */
export function mkdir(path: string): Promise<void> {
    return new Promise((resolve, reject) =>
        fsMkdir(path, generalCallback.bind(null, resolve, reject)),
    );
}

/**
 * Asynchronously writes the given content to a file at the given path.
 *
 * @param {string} path - path of the file to write
 * @param {string} content - content to write to the file
 * @return {Promise<void>}
 */
export function writeFile(path: string, content: string): Promise<void> {
    return new Promise((resolve, reject) =>
        fsWriteFile(
            path,
            content,
            { encoding: 'utf8' },
            generalCallback.bind(null, resolve, reject),
        ),
    );
}

/**
 * Constructs a callback that settles a promise using the given resolve and
 * reject functions, rejecting when an error is provided.
 *
 * @param {(value: void | PromiseLike<void>) => void} resolve - promise resolver
 * @param {(reason?: unknown) => void} reject - promise rejecter
 * @param {Error | null} [err] - error passed by the underlying fs operation
 */
function generalCallback(
    resolve: (value: void | PromiseLike<void>) => void,
    reject: (reason?: unknown) => void,
    err?: Error | null,
): void {
    if (err) {
        reject(err);
    }

    resolve();
}
