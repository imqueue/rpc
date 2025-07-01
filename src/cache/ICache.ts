/*!
 * IMQCache interfaces
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
export interface ICacheConstructor {
    new (name?: string): ICache;
}

export interface ICache {

    name: string;
    ready: boolean;

    init(options?: any): void;
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    purge(keyMask: string): Promise<boolean>;

}

export type ICacheAdapter = ICacheConstructor | ICache | string;
