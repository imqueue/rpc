/*!
 * IMQ-RPC helpers: osUuid
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
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/**
 * Returns the base path to the Windows registry query tool, accounting for
 * 32-bit processes running on 64-bit Windows (which must go through the
 * "sysnative" redirector to reach the real System32).
 *
 * @returns {string}
 */
function winRegBase(): string {
    const useSysnative =
        process.arch === 'ia32' &&
        Object.prototype.hasOwnProperty.call(
            process.env,
            'PROCESSOR_ARCHITEW6432',
        );

    return useSysnative
        ? '%windir%\\sysnative\\cmd.exe /c %windir%\\System32'
        : '%windir%\\System32';
}

/**
 * Returns the platform-specific shell command that emits the raw machine
 * identifier. Mirrors the commands used by the node-machine-id package.
 *
 * @returns {string}
 */
function idCommand(): string {
    switch (process.platform) {
        case 'darwin':
            return 'ioreg -rd1 -c IOPlatformExpertDevice';
        case 'win32':
            return (
                `${winRegBase()}\\REG.exe QUERY ` +
                'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography ' +
                '/v MachineGuid'
            );
        case 'linux':
            return (
                '( cat /var/lib/dbus/machine-id /etc/machine-id ' +
                '2> /dev/null || hostname ) | head -n 1 || :'
            );
        case 'freebsd':
            return 'kenv -q smbios.system.uuid || sysctl -n kern.hostuuid';
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

/**
 * Extracts the bare GUID from the raw command output for the current platform.
 *
 * @param {string} raw - unprocessed command output
 * @returns {string}
 */
function parseId(raw: string): string {
    switch (process.platform) {
        case 'darwin':
            return raw
                .split('IOPlatformUUID')[1]
                .split('\n')[0]
                .replace(/=|\s+|"/gi, '')
                .toLowerCase();
        case 'win32':
            return raw
                .split('REG_SZ')[1]
                .replace(/\r+|\n+|\s+/gi, '')
                .toLowerCase();
        default: // linux, freebsd
            return raw.replace(/\r+|\n+|\s+/gi, '').toLowerCase();
    }
}

/**
 * Returns the OS machine identifier synchronously, replicating the approach
 * used by the node-machine-id package: it runs the platform-specific command,
 * parses out the GUID, and, unless the original id is requested, returns its
 * sha256 hash.
 *
 * @param {boolean} [original] - when true returns the raw machine GUID,
 *  otherwise returns its sha256 hash
 * @returns {string}
 */
function machineIdSync(original?: boolean): string {
    const id = parseId(execSync(idCommand()).toString());

    return original ? id : createHash('sha256').update(id).digest('hex');
}

// The machine id cannot change while the process is running, so it is
// resolved once and memoized: osUuid() is called from every client
// constructor, and shelling out each time would needlessly slow startup.
let cachedUuid: string | undefined;

/**
 * Returns the machine UUID. The underlying platform command runs only once
 * per process; subsequent calls return the memoized value.
 *
 * @returns {string}
 */
export function osUuid(): string {
    if (cachedUuid === undefined) {
        cachedUuid = machineIdSync(true);
    }

    return cachedUuid;
}
