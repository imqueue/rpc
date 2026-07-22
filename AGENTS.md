# AGENTS.md — orientation for coding agents

This file is for AI coding agents (and humans who like density) working on
`@imqueue/rpc`. It captures how the codebase is built, tested and structured,
plus the invariants that are easy to get wrong. Read it before making changes.
For contribution *process/terms* see [CONTRIBUTING.md](./CONTRIBUTING.md); for
end-user docs see the [README](./README.md) and https://imqueue.org/.

## What this is

`@imqueue/rpc` is the typed RPC layer of the @imqueue framework. It provides the
abstract base classes and decorators to build **self-describing services** and
the machinery to **generate strongly-typed clients** from them — all over the
Redis-backed message queue in [`@imqueue/core`](https://github.com/imqueue/core).
No service discovery, no load balancer, no hand-written HTTP layer: a service
describes itself and its client is generated from that description.

## Toolchain & invariants (do not fight these)

- **ESM only**, `"type": "module"`. Use `import`, not `require()`. Import
  sibling modules with the **`.js`** extension (NodeNext resolves it to the
  `.ts` source).
- **TypeScript, `module`/`moduleResolution: nodenext`**, `target: es2024`,
  `verbatimModuleSyntax: true`, `isolatedModules: true`, `strict: true`
  (`strictPropertyInitialization: false`). Use `import type` for type-only
  imports.
- **Standard (TC39) decorators** — `experimentalDecorators` is **false** and the
  `esnext.decorators` lib is enabled. There is **no `emitDecoratorMetadata`**,
  so there is **no runtime type reflection**.
- **Types are derived from JSDoc.** Because decorators carry no type metadata,
  the RPC layer parses JSDoc `@param`/`@returns` tags (via `acorn`) to build a
  service's description and its generated client's types. Consequences:
  `removeComments` MUST stay **`false`**, and every exposed method MUST carry
  accurate JSDoc — undocumented params fall back to `any` in generated clients.
- **Node ≥ 22.12.**
- Runtime deps: `@imqueue/core`, `acorn` (JSDoc/source parsing for client
  generation), `typescript` (compiling generated clients on the fly).
- **Lint/format:** `oxlint` + `oxfmt`. Run `npm run format` before committing;
  CI checks `npm run format:check`.
- Build **emits `.js`/`.d.ts`/`.js.map` next to sources**; **gitignored, not
  committed**. `build` runs `build:deps` (builds `../core` if present) then
  `clean-compiled` then `tsc`.

## Commands

```bash
npm install
npm run build          # build ../core (if present) + clean + tsc
npm test               # build + node:test over every test/**/*.spec.js
npm run lint           # oxlint
npm run format         # oxfmt (write)  |  npm run format:check (verify)
npm run test-coverage  # tests + experimental coverage
```

Tests use the native `node:test` runner with
`--experimental-test-module-mocks` and preload `./test/warmup.mjs`; timeout is
15s. A local Redis on `localhost:6379` is expected for the integration-style
specs.

## Layout

| Path | Role |
|---|---|
| `index.ts` | `export * from './src/index.js'` **and** `export * from '@imqueue/core'` — consumers get core's queue API re-exported. |
| `src/IMQService.ts` | `IMQService` abstract base — extend it and decorate methods with `@expose()`. |
| `src/IMQClient.ts` | `IMQClient` base + `IMQClient.create()` — generates/compiles/loads a client from a running service's description. |
| `src/decorators/expose.ts` | `@expose()` — marks a service method remotely callable. |
| `src/decorators/remote.ts` | `@remote()` — marks a hand-written client method. |
| `src/decorators/classType.ts`, `property.ts`, `indexed.ts` | Complex-type registration: `@classType()` on the class, `@property('type', optional?)` on fields. |
| `src/decorators/cache.ts`, `lock.ts`, `logged.ts`, `metadata.ts` | Cross-cutting method decorators. |
| `src/cache/` (`ICache`, `RedisCache`) | Caching layer for RPC results. |
| `src/helpers/signature.ts` | JSDoc/source signature extraction (acorn). |
| `src/IMQRPCDescription.ts`, `IMQRPCRequest.ts`, `IMQRPCResponse.ts`, `IMQRPCError.ts`, `IMQDelay.ts`, `IMQLock.ts`, `IMQMetadata.ts`, `IMQRequestContext.ts` | RPC wire types & context. |

## Authoring rules (behavioural invariants that generated clients depend on)

- **Only `@expose()`-decorated methods are remotely callable.** Non-exposed
  methods stay private to the service.
- **Arguments and return values must be JSON-serializable.**
- **No spread/rest params on exposed methods** — the generated client will not
  compile. Pass an array instead: `foo(args: any[])`, not `foo(...args: any[])`.
- **Complex types need `@classType()` on the class** *and* `@property()` on each
  field, or they will not appear in generated clients. `@indexed()` registers
  `@property` fields too.
- **JSDoc is load-bearing**, not documentation-only (see toolchain note). Keep
  `@param`/`@returns` types accurate.

## Using this package correctly (for consumer-facing code an agent writes)

```typescript
import { IMQService, expose } from '@imqueue/rpc';

export class UserService extends IMQService {
    /**
     * Returns a user by id
     * @param {string} id - user identifier
     * @return {Promise<{ id: string; name: string } | null>}
     */
    @expose()
    public async get(id: string): Promise<{ id: string; name: string } | null> {
        return { id, name: 'Jane Doe' };
    }
}
```

Generate the client with `@imqueue/cli` (`imq client generate UserService`) or
at runtime with `IMQClient.create('UserService')`, then
`const c = new UserServiceClient(); await c.start(); await c.get('42');`.

## License

GPL-3.0. Commercial licensing for closed-source products: https://imqueue.com/.
