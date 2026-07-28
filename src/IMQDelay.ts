/*!
 * IMQDelay implementation
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
/**
 * Represents a delay expressed as a numeric timer value in a given time unit.
 * Used to defer IMQ request processing.
 */
export class IMQDelay {
    /**
     * Returns {@link IMQDelay.timer} converted to milliseconds.
     *
     * @remarks
     * Not rounded, so a fractional `timer` yields a fractional result. If
     * {@link IMQDelay.unit} has been set to a value outside the supported set —
     * possible from untyped callers — the result is `undefined`; a client treats any
     * non-finite or negative value as no delay.
     */
    public get ms(): number {
        switch (this.unit) {
            case 'ms':
                return this.timer;
            case 's':
                return this.timer * 1000;
            case 'm':
                return this.timer * 60000;
            case 'h':
                return this.timer * 3600000;
            case 'd':
                return this.timer * 86400000;
        }
    }

    /**
     * @param timer - delay value expressed in the given unit
     * @param unit - time unit of the timer value; defaults to `'ms'`
     */
    constructor(
        /**
         * The delay magnitude, expressed in {@link IMQDelay.unit}. Mutable after
         * construction, and read by {@link IMQDelay.ms}.
         */
        public timer: number,
        /**
         * Time unit of {@link IMQDelay.timer} — milliseconds, seconds, minutes,
         * hours or days. Defaults to `'ms'`, meaning `timer` is already a
         * millisecond count.
         */
        public unit: 'ms' | 's' | 'm' | 'h' | 'd' = 'ms',
    ) {}
}
