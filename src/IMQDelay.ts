/*!
 * IMQDelay implementation
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
export class IMQDelay {
    public get ms() {
        switch (this.unit) {
            case 'ms': return this.timer;
            case 's': return this.timer * 1000;
            case 'm': return this.timer * 60000;
            case 'h': return this.timer * 3600000;
            case 'd': return this.timer * 86400000;
        }
    }

    constructor(
        public timer: number,
        public unit: 'ms' | 's' | 'm' | 'h' | 'd' = 'ms'
    ) {}
}
