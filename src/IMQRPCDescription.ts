/*!
 * IMQRPCDescription implementation
 *
 * Copyright (c) 2018, imqueue.com <support@imqueue.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
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
    };
}

export class IMQRPCDescription {

    public static serviceDescription: ServiceDescription = {};
    public static typesDescription: TypesDescription = {};

}
