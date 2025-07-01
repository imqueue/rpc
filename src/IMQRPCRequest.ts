/*!
 * IMQ-RPC Interfaces: IMQRPCRequest
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
import { JsonObject } from '@imqueue/core';
import { IMQMetadata } from './IMQMetadata';

/**
 * Request message data structure expected to be handled by a service
 */
export interface IMQRPCRequest extends JsonObject {
    from: string;
    method: string;
    args: any[];
    metadata?: IMQMetadata;
}
