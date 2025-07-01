/*!
 * IMQ-RPC Interfaces: IMQServiceOptions
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
import { DEFAULT_IMQ_OPTIONS, IMQOptions } from '@imqueue/core';
import { IMQRPCRequest } from './IMQRPCRequest';
import { IMQRPCResponse } from './IMQRPCResponse';
import { IMQService } from './IMQService';
import { IMQClient } from './IMQClient';

export interface IMQBeforeCall<T> {
    (req?: IMQRPCRequest, res?: IMQRPCResponse): Promise<void>;
}

export interface IMQAfterCall<T> {
    (req: IMQRPCRequest, res?: IMQRPCResponse): Promise<void>;
}

export interface IMQServiceOptions extends IMQOptions {
    multiProcess: boolean;
    childrenPerCore: number;
    beforeCall?: IMQBeforeCall<IMQService>;
    afterCall?: IMQAfterCall<IMQService>;
}

export interface IMQClientOptions extends IMQOptions {
    path: string;
    compile: boolean;
    timeout: number;
    write: boolean;
    beforeCall?: IMQBeforeCall<IMQClient>;
    afterCall?: IMQAfterCall<IMQClient>;
    singleQueue?: boolean;
}

/**
 * Default service options
 *
 * @type {IMQServiceOptions}
 */
export const DEFAULT_IMQ_SERVICE_OPTIONS: IMQServiceOptions = {
    ...DEFAULT_IMQ_OPTIONS,
    cleanup: true,
    cleanupFilter: '*:client',
    multiProcess: false,
    childrenPerCore: 1,
};

/**
 * Default client options
 *
 * @type {IMQClientOptions}
 */
export const DEFAULT_IMQ_CLIENT_OPTIONS: IMQClientOptions = {
    ...DEFAULT_IMQ_OPTIONS,
    cleanup: true,
    cleanupFilter: '*:client',
    path: './src/clients',
    compile: true,
    timeout: 30000,
    write: true,
};
