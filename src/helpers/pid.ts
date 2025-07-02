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
import * as path from 'path';
import * as fs from 'fs';
import { ILogger } from '@imqueue/core';

export const SIGNALS: string[] = [
    'SIGTERM',
    'SIGINT',
    'SIGHUP',
    'SIGQUIT',
];
export const IMQ_TMP_DIR = process.env.TMPDIR ||
    // istanbul ignore next
    '/tmp';
export const IMQ_PID_DIR = path.resolve(IMQ_TMP_DIR, '.imq-rpc');

/**
 * Returns increment-based process identifier for a given name
 *
 * @param {string} name - name of a service to create pid file for
 * @param {string} path - directory to
 * @returns {number}
 */
export function pid(
    name: string,
    // istanbul ignore next
    path: string = IMQ_PID_DIR
): number {
    const pidFile = `${path}/${name}`;
    const pidOpts: {
        encoding: string;
        mode?: string | number | undefined;
        flag?: string | undefined;
    } = { encoding: 'utf8', flag: 'wx' };

    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }

    let id: number = 0;
    let done: boolean = false;

    while (!done) {
        try {
            fs.writeFileSync(
                `${pidFile}-${id}.pid`,
                process.pid + '',
                pidOpts as any,
            );
            done = true;
        }

        catch (err) {
            // istanbul ignore next
            if (err.code === 'EEXIST') {
                id++;
            }

            else {
                throw err;
            }
        }
    }

    return id;
}

/**
 * Removes pid file for a given name and id
 *
 * @param {string} name
 * @param {number} id
 * @param {ILogger} logger
 * @param {string} [path]
 */
export function forgetPid(
    name: string,
    id: number,
    logger: ILogger,
    // istanbul ignore next
    path: string = IMQ_PID_DIR
) {
    try {
        fs.unlinkSync(`${path}/${name}-${id}.pid`);
    }

    catch (err) { /* ignore */ }
}
