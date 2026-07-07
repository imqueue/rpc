/*!
 * IMQ-RPC Decorators: Symbol.metadata polyfill
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
 * Standard (TC39) decorator metadata relies on the well-known
 * `Symbol.metadata`. Node.js does not implement it natively yet, so without
 * this polyfill the compiler emits `context.metadata` as `undefined` and
 * decorator metadata (used by @property/@expose/@indexed to collect complex
 * type definitions) is unavailable.
 *
 * This module must be imported before any decorated class is defined; it is
 * imported first by the decorator barrel, which every decorator consumer
 * loads transitively.
 */
if (!(Symbol as { metadata?: symbol }).metadata) {
    Object.defineProperty(Symbol, 'metadata', {
        value: Symbol.for('Symbol.metadata'),
        writable: false,
        enumerable: false,
        configurable: true,
    });
}
