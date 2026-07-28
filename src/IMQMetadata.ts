/*!
 * IMQMetadata implementation
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
import { type AnyJson, type JsonObject } from '@imqueue/core';

/**
 * Arbitrary, JSON-serializable metadata bag carried alongside an IMQ request.
 * Each property value must be a valid JSON value.
 */
export class IMQMetadata {
    /**
     * Any string key mapping to any JSON value.
     *
     * @remarks
     * The constructor performs a shallow copy of the source object's own
     * enumerable string keys — symbol keys and inherited properties are not copied,
     * and nested objects are shared by reference until serialization.
     */
    [property: string]: AnyJson;

    /**
     * @param metadata - source object whose own enumerable
     *                                properties are copied into this instance
     */
    constructor(metadata: JsonObject) {
        for (const property of Object.keys(metadata)) {
            this[property] = metadata[property];
        }
    }
}
