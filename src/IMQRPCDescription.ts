/*!
 * IMQRPCDescription implementation
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
 * Method argument description
 */
export interface ArgDescription {
    description: string;
    name: string;
    type: string;
    tsType: string;
    isOptional: boolean;
}

/**
 * Return value description
 */
export interface ReturnValueDescription {
    description: string;
    type: string;
    tsType: string;
}

/**
 * Method description
 */
export interface MethodDescription {
    description: string;
    arguments: ArgDescription[];
    returns: ReturnValueDescription;
}

/**
 * Methods collection description
 */
export interface MethodsCollectionDescription {
    [methodName: string]: MethodDescription;
}

/**
 * Service class description
 */
export interface ServiceClassDescription {
    inherits: string;
    methods: MethodsCollectionDescription;
}

/**
 * Service description
 */
export interface ServiceDescription {
    [className: string]: ServiceClassDescription;
}

/**
 * Service type description
 */
export interface PropertyDescription {
    type: string;
    isOptional: boolean
}

/**
 * Service types description
 */
export interface TypeDescription {
    [propertyName: string]: PropertyDescription;
}

/**
 * Entire service types metadata structure
 */
export interface TypesDescription {
    [typeName: string]: {
        properties: TypeDescription,
        inherits: string,
        indexType?: string,
    };
}

export class IMQRPCDescription {

    public static serviceDescription: ServiceDescription = {};
    public static typesDescription: TypesDescription = {};

}
