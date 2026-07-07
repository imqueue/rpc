/*!
 * IMQ-RPC helpers: pid, forgetPid
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
import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { ILogger } from '@imqueue/core';

/**
 * OS signals that should trigger pid file cleanup on process termination.
 */
export const SIGNALS: string[] = ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGQUIT'];

/**
 * Base temporary directory used by imq-rpc.
 */
export const IMQ_TMP_DIR = process.env.TMPDIR || '/tmp';

/**
 * Directory where imq-rpc stores its pid files.
 */
export const IMQ_PID_DIR = resolve(IMQ_TMP_DIR, '.imq-rpc');

/**
 * Returns an increment-based process identifier for the given service name,
 * creating the corresponding pid file under the given directory.
 *
 * @param {string} name - name of the service to create the pid file for
 * @param {string} [path] - directory to store the pid file in
 * @returns {number} - the allocated increment-based identifier
 */
export function pid(name: string, path: string = IMQ_PID_DIR): number {
    const pidFile = `${path}/${name}`;
    const pidOpts: {
        encoding: BufferEncoding;
        mode?: string | number | undefined;
        flag?: string | undefined;
    } = { encoding: 'utf8', flag: 'wx' };

    if (!existsSync(path)) {
        mkdirSync(path);
    }

    let id: number = 0;
    let done: boolean = false;

    while (!done) {
        try {
            writeFileSync(`${pidFile}-${id}.pid`, process.pid + '', pidOpts);
            done = true;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
                id++;
            } else {
                throw err;
            }
        }
    }

    return id;
}

/**
 * Removes the pid file for the given service name and identifier.
 *
 * @param {string} name - name of the service whose pid file to remove
 * @param {number} id - increment-based identifier of the pid file
 * @param {ILogger} logger - logger instance
 * @param {string} [path] - directory the pid file is stored in
 */
export function forgetPid(
    name: string,
    id: number,
    logger: ILogger,
    path: string = IMQ_PID_DIR,
): void {
    try {
        unlinkSync(`${path}/${name}-${id}.pid`);
    } catch {
        /* ignore */
    }
}
