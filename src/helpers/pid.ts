/*!
 * IMQ-RPC helpers: pid, forgetPid
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
import * as path from 'path';
import * as fs from 'fs';
import { ILogger } from '@imqueue/core';

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
    const pidOpts = { encoding: 'utf8', flag: 'wx' };

    if (!fs.existsSync(path)) {
        fs.mkdirSync(path);
    }

    let id: number = 0;
    let done: boolean = false;

    while (!done) {
        try {
            fs.writeFileSync(`${pidFile}-${id}.pid`, process.pid, pidOpts);
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
