/*!
 * IMQ-RPC Decorators: expose
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
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
import 'reflect-metadata';
import * as acorn from 'acorn';
import {
    ArgDescription,
    ReturnValueDescription,
    IMQRPCDescription
} from '..';

require('acorn-es7-plugin')(acorn);

const TS_TYPES = [
    'object',
    'string',
    'number',
    'boolean',
    'null',
    'undefined'
];

type CommentMetadata = {
    [key: string]: string | ArgDescription[] | ReturnValueDescription;
    description: string;
    params: ArgDescription[];
    returns: ReturnValueDescription;
};

type CommentBlockMetadata = {
    comment: CommentMetadata;
};

type ClassDescriptions = {
    [className: string]: {
        [key: string]: string | CommentBlockMetadata;
        inherits: string;
    };
}

const descriptions: ClassDescriptions = {};

const RX_ARG_NAMES = /^(\S+)([=\s]+.*?)?$/;
const RX_COMMA_SPLIT = /\s*,\s*/;
const RX_MULTILINE_CLEANUP = /\*?\n +\* ?/g;
const RX_DESCRIPTION = /^([\s\S]*?)@/;
const RX_TAG = /(@[^@]+)/g;
// noinspection RegExpRedundantEscape
const RX_TYPE = /\{([\s\S]+)\}/;
const RX_LI_CLEANUP = /^\s*-\s*/;
const RX_SPACE_SPLIT = / /;
// noinspection RegExpRedundantEscape
const RX_OPTIONAL = /^\[(.*?)\]$/;

/**
 * Lookup and returns a list of argument names for a given function
 *
 * @param {Function} fn
 * @return {string[]}
 */
function argumentNames(fn: Function): string[] {
    let src: string = fn.toString();
    return src.slice(
        src.indexOf('(') + 1, src.indexOf(')')
    ).split(RX_COMMA_SPLIT).map(arg =>
        arg.trim().replace(RX_ARG_NAMES, '$1')
    ).filter(arg => arg);
}

/**
 * Parses given multi-line comment block
 *
 * @param {string} src - class source code
 * @return {CommentMetadata}
 */
function parseComment(src: string): CommentMetadata {
    let cleanSrc = src.replace(RX_MULTILINE_CLEANUP, '\n').trim();
    let data: CommentMetadata = {
        description: '',
        params: [],
        returns: {
            description: '',
            type: '',
            tsType: ''
        }
    };
    let match, tags = [];

    // istanbul ignore next
    data.description = String(
        (cleanSrc.match(RX_DESCRIPTION) || [])[1] || ''
    ).trim();

    while (match = RX_TAG.exec(cleanSrc)) {
        tags.push(match[1].trim());
    }

    for (let tag of tags) {
        let parts = tag.split(RX_SPACE_SPLIT);
        let tagName = parts.shift();
        let tagDef = parts.join(' ');
        let typeMatch = tagDef.match(RX_TYPE);
        let tsType = '', name = '', description = '', type = '';
        let isOptional = false;

        if (typeMatch) {
            tsType = typeMatch[1];
            tagDef = tagDef.replace(RX_TYPE, '').trim();
            parts = tagDef.split(/ /);
        }

        name = (parts.shift() || '').replace(RX_LI_CLEANUP, '');
        description = parts.join(' ').replace(RX_LI_CLEANUP, '');

        switch (tagName) {
            case '@param':
            case '@params': {
                let opMatch = name.match(RX_OPTIONAL);

                if (opMatch) {
                    name = opMatch[1];
                    isOptional = true;
                }

                data.params.push({
                    description,
                    name,
                    tsType,
                    type,
                    isOptional
                });
                break;
            }

            case '@return':
            case '@returns': {
                description = [name, description].join(' ').trim();
                data.returns = { description, type, tsType };
                break;
            }
        }
    }

    return data;
}

/**
 * Finds and parses methods and their comment blocks for a given class
 *
 * @param {string} name - class name
 * @param {string} src - class source code
 */
function parseDescriptions(name: string, src: string) {
    const comments: acorn.Comment[] = [];
    const options: acorn.Options = {
        ecmaVersion: 7,
        locations: true,
        ranges: true,
        allowReserved: true,
        onComment: comments,
        plugins: {
            asyncawait: true
        }
    };
    const nodes = acorn.parse(src, options).body;

    descriptions[name] = {
        inherits: 'Function'
    };

    for (let node of nodes) {
        // istanbul ignore if
        if (!(
            node && node.type === 'ClassDeclaration' &&
            node.id && node.id.name === name &&
            node.body.type === 'ClassBody'
        )) {
            continue;
        }

        if (node.superClass) {
            // istanbul ignore next
            if (node.superClass.type === 'MemberExpression') {
                descriptions[name].inherits =
                    (<any>node.superClass.property).name;
            }

            else if (node.superClass.type === 'Identifier') {
                descriptions[name].inherits = node.superClass.name;
            }
        }

        for (let method of node.body.body) {
            // istanbul ignore if
            if (method.type !== 'MethodDefinition') {
                continue;
            }

            const methodName: string = (<any>method.key).name;
            const blocks: acorn.Comment[] = comments.filter(comment =>
                comment.type === 'Block');

            if (!blocks.length) {
                continue;
            }

            const methodStart: number = (<any>method).start;
            let commentEnd: number = blocks[0].end;
            let lastDif: number = methodStart - blocks[0].end;
            let foundBlock: acorn.Comment = blocks[0];

            for (let comment of blocks) {
                const dif: number = methodStart - comment.end;

                if (dif < 0) {
                    break;
                }

                if (dif >= lastDif) {
                    continue;
                }

                lastDif = dif;
                commentEnd = comment.end;
                foundBlock = comment;
            }

            let expr = acorn.parseExpressionAt(src, commentEnd, options);

            if (expr.type === 'Identifier' && expr.name === 'async') {
                expr = acorn.parseExpressionAt(
                    src, (<any>expr).range[1], options
                );
            }

            if (
                expr.type === 'CallExpression' &&
                (<any>expr.callee).name === methodName
            ) {
                // it's a method comment block!!!!
                descriptions[name][methodName] = {
                    comment: parseComment(foundBlock.value)
                };
            }
        }
    }
}

/**
 * Helper function to make easy descriptions parts extractions
 *
 * @param {string} prop - property name to extract
 * @param {string} className - class name to lookup
 * @param {string} method - method name to lookup
 * @param {any} defaults - a default value to use if nothing found
 * @return {T} - found value
 */
function get<T>(
    prop: string,
    className: string,
    method: string | symbol,
    defaults: T
): T {
    if (descriptions[className] && descriptions[className][method]) {
        let comment = (
            <CommentBlockMetadata>descriptions[className][method]
        ).comment;

        // istanbul ignore else
        if (comment[prop]) {
            return <any>comment[prop];
        }
    }

    return defaults;
}

/**
 * Converts JavaScript type to most close possible TypeScript type
 *
 * @param type
 * @returns {string}
 */
function cast(type: string) {
    let tsType = String(type).toLowerCase();

    if (tsType === 'undefined') {
        tsType = 'void';
    }

    else if (tsType === 'array') {
        tsType = 'any[]';
    }

    else if (!~TS_TYPES.indexOf(tsType)) {
        tsType = type;
    }

    return tsType;
}

/**
 * Expose decorator factory
 *
 * @return {(
 *    target: object,
 *    methodName: (string|symbol),
 *    descriptor: TypedPropertyDescriptor<Function>
 * ) => void} - decorator function
 */
export function expose(): Function {
    return function(
        target: any,
        methodName: string | symbol,
        descriptor: TypedPropertyDescriptor<Function>
    ) {
        let className: string = target.constructor.name;
        let argNames: string[] = argumentNames(<Function>descriptor.value);
        let retType = Reflect.getMetadata(
            'design:returntype',
            target,
            methodName
        );
        let retTypeName: string = retType ? retType.name : String(retType);

        if (!descriptions[className]) {
            parseDescriptions(className, target.constructor.toString());
        }

        let args: ArgDescription[] = get<ArgDescription[]>(
            'params', className, methodName, []);
        let ret: ReturnValueDescription = get<ReturnValueDescription>(
            'returns', className, methodName, {
                description: '',
                type: retTypeName,
                tsType: cast(retTypeName)
            });

        ret.type = retTypeName;

        if (!args || !args.length) {
            for (let i = 0, s = argNames.length; i < s; i++) {
                args[i] = {
                    description: '',
                    name: argNames[i],
                    type: '',
                    tsType: '',
                    isOptional : false
                };
            }
        }

        Reflect.getMetadata(
            'design:paramtypes',
            target,
            methodName
        ).forEach((typeConstructor: any, i: number) => {
            args[i].type = args[i].type || typeConstructor.name;
            args[i].tsType = args[i].tsType || cast(args[i].type);
        });

        IMQRPCDescription.serviceDescription[className] =
        IMQRPCDescription.serviceDescription[className] || {
            inherits: descriptions[className].inherits,
            methods: {}
        };
        IMQRPCDescription.serviceDescription[className].methods[methodName] = {
            description: get<string>('description', className, methodName, ''),
            arguments: args,
            returns: ret
        };
    }
}
