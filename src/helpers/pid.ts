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
import { resolve } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { type ILogger } from '@imqueue/core';

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
 * Identifiers this process has already allocated and given back, per pid file
 * location. They are never handed out again while the process lives.
 *
 * The identifier is the only part of a client's queue name that distinguishes
 * two clients of the same service on the same host, so re-using one re-uses the
 * queue name. Handing a name back within the same process is not safe: the
 * queue of the client that just released it still has a reader blocked on it,
 * which outlives `destroy()` and consumes the first message addressed to the
 * new owner — that reply is then lost, and its caller waits forever.
 *
 * Identifiers freed by another process (or left behind by one that died) are
 * still re-used, which is what keeps names dense across restarts.
 */
const retiredIds = new Map<string, Set<number>>();

/**
 * Returns the key under which retired identifiers are tracked. Includes the
 * path so that pid files kept in different directories cannot influence each
 * other.
 *
 * @param name - name of the service
 * @param path - directory the pid files are stored in
 */
function retiredKey(name: string, path: string): string {
    return `${path}/${name}`;
}

/**
 * Returns an increment-based process identifier for the given service name,
 * creating the corresponding pid file under the given directory.
 *
 * Identifiers this process has released through `forgetPid()` are skipped, see
 * `retiredIds`.
 *
 * @param name - name of the service to create the pid file for
 * @param path - directory to store the pid file in
 * @returns the allocated increment-based identifier
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

    const retired = retiredIds.get(retiredKey(name, path));
    let id: number = 0;
    let done: boolean = false;

    while (!done) {
        if (retired?.has(id)) {
            id++;

            continue;
        }

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
 * Removes the pid file for the given service name and identifier, and records
 * the identifier as retired so that `pid()` does not hand it out again for the
 * lifetime of this process, see `retiredIds`.
 *
 * @param name - name of the service whose pid file to remove
 * @param id - increment-based identifier of the pid file
 * @param logger - logger instance
 * @param path - directory the pid file is stored in
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

    const key = retiredKey(name, path);
    const retired = retiredIds.get(key);

    if (retired) {
        retired.add(id);
    } else {
        retiredIds.set(key, new Set([id]));
    }
}
