/*!
 * IMQ-RPC Decorators: expose
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
import { parse, type Comment, type Options } from 'acorn';
import {
    type ArgDescription,
    type ReturnValueDescription,
    IMQRPCDescription,
} from '../index.js';

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
};

const descriptions: ClassDescriptions = {};

const RX_ARG_NAMES = /^(\S+)([=\s]+.*?)?$/;
const RX_COMMA_SPLIT = /\s*,\s*/;
const RX_MULTILINE_CLEANUP = /\*?\n +\* ?/g;
const RX_DESCRIPTION = /^([\s\S]*?)@/;
const RX_TAG = /(@[^@]+)/g;
const RX_TYPE = /\{([\s\S]+)\}/;
const RX_LI_CLEANUP = /^\s*-\s*/;
const RX_SPACE_SPLIT = / /;
const RX_OPTIONAL = /^\[(.*?)\]$/;

/**
 * Lookup and returns a list of argument names for a given function
 *
 * @param {(...args: any[]) => any} fn
 * @return {string[]}
 */
function argumentNames(fn: (...args: any[]) => any): string[] {
    let src: string = fn.toString();
    return src
        .slice(src.indexOf('(') + 1, src.indexOf(')'))
        .split(RX_COMMA_SPLIT)
        .map(arg => arg.trim().replace(RX_ARG_NAMES, '$1'))
        .filter(arg => arg);
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
            tsType: '',
        },
    };
    let match,
        tags = [];

    data.description = String(
        (cleanSrc.match(RX_DESCRIPTION) || [])[1] || '',
    ).trim();

    while ((match = RX_TAG.exec(cleanSrc))) {
        tags.push(match[1].trim());
    }

    for (let tag of tags) {
        let parts = tag.split(RX_SPACE_SPLIT);
        let tagName = parts.shift();
        let tagDef = parts.join(' ');
        let typeMatch = tagDef.match(RX_TYPE);
        let tsType = '',
            name = '',
            description = '',
            type = '';
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
                    isOptional,
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
 * Finds and parses methods and their comment blocks for a given class.
 *
 * The class source (from `Function.prototype.toString`) is always compiled
 * JavaScript, so it is parsed with acorn; a method's doc is the last block
 * comment between the previous class member (or the class body start) and
 * the method itself, i.e. the last block comment in its leading trivia.
 *
 * @param {string} name - class name
 * @param {string} src - class source code
 */
function parseDescriptions(name: string, src: string): void {
    const comments: Comment[] = [];
    const options: Options = {
        // 'latest' so we can parse whatever modern syntax the configured
        // compilation target emits into the class source we introspect
        ecmaVersion: 'latest',
        allowReserved: true,
        onComment: comments,
    };

    // the local `inherits` is a placeholder only: the public description's
    // `inherits` is derived from the runtime prototype chain in
    // buildMethodDescription(), never from the parsed source (standard
    // decorators compile the heritage clause to a helper like `_classSuper`,
    // so the source name is unusable)
    descriptions[name] = {
        inherits: 'Function',
    };

    let body: any[];

    try {
        body = (parse(src, options) as any).body;
    } catch {
        // tolerate unparseable sources (e.g. bound or native functions) the
        // same way the previous error-tolerant parsers did
        return;
    }

    for (const node of body) {
        if (
            !(
                node &&
                node.type === 'ClassDeclaration' &&
                node.id &&
                node.id.name === name &&
                node.body &&
                node.body.type === 'ClassBody'
            )
        ) {
            continue;
        }

        const members: any[] = node.body.body;

        for (let i = 0; i < members.length; i++) {
            const member = members[i];

            // plain (non-accessor, non-constructor) methods with literal
            // identifier names only — same filter the previous
            // implementations applied
            if (
                member.type !== 'MethodDefinition' ||
                member.kind !== 'method' ||
                member.computed ||
                !member.key ||
                member.key.type !== 'Identifier'
            ) {
                continue;
            }

            // the doc block must lie after the previous member of any kind
            // (so comments inside earlier bodies and field initializers can
            // never match) and before the method itself
            const lowerBound: number = i
                ? members[i - 1].end
                : node.body.start + 1;
            const blocks = comments.filter(
                comment =>
                    comment.type === 'Block' &&
                    comment.start >= lowerBound &&
                    comment.end <= member.start,
            );

            if (!blocks.length) {
                continue;
            }

            descriptions[name][member.key.name] = {
                // acorn comment values exclude the /* and */ delimiters
                comment: parseComment(blocks[blocks.length - 1].value),
            };
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
    method: string,
    defaults: T,
): T {
    if (descriptions[className] && descriptions[className][method]) {
        let comment = (<CommentBlockMetadata>descriptions[className][method])
            .comment;

        if (comment[prop]) {
            return <any>comment[prop];
        }
    }

    return defaults;
}

/**
 * Builds and registers the RPC description for a single exposed method.
 *
 * Types are taken from the method's JSDoc (parsed from the class source,
 * preserved by `removeComments: false`); standard decorators provide no
 * runtime `design:type` metadata, so JSDoc is the sole type source.
 *
 * @param {Function} ctor - class that declares the method
 * @param {string} methodName - exposed method name
 * @param {(...args: any[]) => any} fn - the method implementation
 */
function buildMethodDescription(
    ctor: Function,
    methodName: string,
    fn: (...args: any[]) => any,
): void {
    const className: string = ctor.name;
    const argNames: string[] = argumentNames(fn);

    if (!descriptions[className]) {
        parseDescriptions(className, ctor.toString());
    }

    const args: ArgDescription[] = get<ArgDescription[]>(
        'params',
        className,
        methodName,
        [],
    );
    const ret: ReturnValueDescription = get<ReturnValueDescription>(
        'returns',
        className,
        methodName,
        {
            description: '',
            type: '',
            tsType: '',
        },
    );

    if (!args || !args.length) {
        for (let i = 0, s = argNames.length; i < s; i++) {
            args[i] = {
                description: '',
                name: argNames[i],
                type: '',
                tsType: '',
                isOptional: false,
            };
        }
    }

    // JSDoc is the sole type source; mirror the parsed tsType into `type`
    // (the only consumer of `type` is the client generator's
    // IMQDelay/IMQMetadata stripping) and default any undocumented type to
    // 'any' so generated clients are always valid TypeScript
    for (const arg of args) {
        arg.tsType = arg.tsType || 'any';
        arg.type = arg.type || arg.tsType;
    }

    ret.tsType = ret.tsType || 'any';
    ret.type = ret.type || ret.tsType;

    // derive the parent from the runtime prototype chain rather than the
    // parsed source: standard-decorator output aliases the `extends` clause
    // to a helper (e.g. `extends _classSuper`), so the source name is unusable
    const parent: any = Object.getPrototypeOf(ctor);
    const inherits: string = parent && parent.name ? parent.name : 'Function';

    IMQRPCDescription.serviceDescription[className] = IMQRPCDescription
        .serviceDescription[className] || {
        inherits,
        methods: {},
    };
    IMQRPCDescription.serviceDescription[className].methods[methodName] = {
        description: get<string>('description', className, methodName, ''),
        arguments: args,
        returns: ret,
    };
}

/**
 * Expose decorator factory. Applied to a service method, it registers that
 * method in the RPC service description. (Complex argument/return types are
 * registered separately via the '@classType' decorator on those classes.)
 *
 * @return {(value: any, context: ClassMethodDecoratorContext) => void}
 */
export function expose(): any {
    // Dual-mode: standard (TC39) invocations pass a context object with a
    // `kind` property; legacy ones pass (target, propertyKey, descriptor).
    return function exposeDecorator(
        target: any,
        context: any,
        descriptor?: any,
    ): any {
        if (context && typeof context === 'object' && 'kind' in context) {
            const value: any = target;
            const methodName: string = String(context.name);

            // the class is not available at decoration time, so defer to an
            // initializer that runs at construction, where `this` is known
            context.addInitializer(function (this: any): void {
                // register the method under the class that actually declares
                // it (inherited methods are described under the base class,
                // matching decoration-time behavior)
                let proto: any = this.constructor.prototype;

                while (
                    proto &&
                    !Object.prototype.hasOwnProperty.call(proto, methodName)
                ) {
                    proto = Object.getPrototypeOf(proto);
                }

                const ctor: Function = proto
                    ? proto.constructor
                    : this.constructor;

                buildMethodDescription(ctor, methodName, value);
            });

            return;
        }

        // legacy: `target` is the prototype, so its constructor is the class
        // that declares the method — available immediately at decoration time
        buildMethodDescription(
            target.constructor,
            String(context),
            descriptor.value,
        );

        return descriptor;
    };
}
