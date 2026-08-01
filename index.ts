/*!
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
 * Type-safe RPC over a message queue — services, clients and the decorators that
 * describe them, built on `@imqueue/core`.
 *
 * Write a service by extending `IMQService` and marking each remotely callable
 * method with `@expose()`. Complex argument and return types need a class-level
 * `@classType()` (or `@indexed()`) plus `@property()` on each field. Then generate a
 * typed client for that service with `IMQClient.create()`, which reads the running
 * service's own description.
 *
 * @remarks
 * Decorator protocol. This package targets standard (TC39) decorators.
 * Consuming projects must compile with `experimentalDecorators: false`,
 * `removeComments: false`, and `esnext.decorators` in `lib`. The decorators still
 * work under legacy compilation, but behaviour differs — see `classType`, which is
 * required under standard decorators and a no-op under legacy, and `expose`, whose
 * registration is deferred to first construction under standard decorators.
 *
 * `removeComments: false` is not optional: standard decorators provide no runtime
 * type reflection, so an exposed method's JSDoc is the only source of argument
 * and return types for the generated client, and the documented `@param` list is
 * what the service's argument-count check validates.
 *
 * Importing this package installs a global `Symbol.metadata` polyfill, which
 * standard decorator metadata depends on.
 *
 * Re-exports. This package re-exports the entire `@imqueue/core` surface, so
 * core types and helpers can be imported from either package. The one exception is
 * core's default-exported `IMQ` factory: `export *` never forwards a default, so
 * `import IMQ from '@imqueue/rpc'` yields `undefined` — import it from
 * `@imqueue/core` directly.
 *
 * @example
 * ```typescript
 * import { IMQService, IMQClient, expose } from '@imqueue/rpc';
 *
 * class UserService extends IMQService {
 *     // NOTE: a real service needs a JSDoc block here with typed
 *     // @param / @returns tags — that is where the generated client
 *     // gets its types from
 *     @expose()
 *     public async count(active: boolean): Promise<number> {
 *         return 42;
 *     }
 * }
 *
 * await new UserService().start();
 *
 * // elsewhere — generates and loads a typed client
 * const ns = await IMQClient.create('UserService');
 * const client = new ns.UserClient();
 *
 * await client.start();
 * console.log(await client.count(true));
 * ```
 *
 * @packageDocumentation
 */
export * from './src/index.js';
export * from '@imqueue/core';
