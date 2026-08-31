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
npm test               # build + node:test over test/**/*.spec.js, minus test/integration
npm run test-integration  # build + test/integration/**/*.spec.js (real redis)
npm run lint           # oxlint
npm run format         # oxfmt (write)  |  npm run format:check (verify)
npm run test-coverage  # tests + experimental coverage
```

Tests use the native `node:test` runner with
`--experimental-test-module-mocks` and preload `./test/warmup.mjs`; timeout is
15s. A local Redis on `localhost:6379` is expected for the integration-style
specs.

**`test/integration/` is different, and must stay outside `npm test`.** Those
specs run *unmocked* — the preload replaces `ioredis` wholesale, which is fine
for every option except `tls`, whose whole point is a handshake a mock does not
perform. `test/integration/tlsBroker.ts` issues a throwaway CA and certificates
with `openssl`, then starts `redis-server` on a port picked at run time with
`--port 0 --tls-port <n>`: with no plaintext listener at all, a connection that
reaches it has demonstrably gone over TLS.

**They skip, never fail, when the machine cannot host a broker.**
`startTlsBroker()` returns a reason string instead of throwing when
`redis-server` or `openssl` is missing, or when redis will not start with TLS,
and that reason becomes the suite's `skip`. CI has no redis and must stay
green, so keep that contract: report a skip reason, do not throw, keep the
`npm test` glob excluding `test/integration`, and do not add these specs to a
runner CI invokes. The harness is a copy of the one in `@imqueue/core` — a
package's `test/` is not published, so there is nothing to import; keep the two
in step.

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
| `src/helpers/drain.ts` | Graceful-drain config (`IMQ_DRAIN_ENABLE`, `IMQ_DRAIN_TIMEOUT`) and the registry of signal handlers this package installed. |
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
- **Graceful draining is opt-in and must stay that way.** `IMQ_DRAIN_ENABLE`
  (or the `drain` option) defaults to off, and with it off the dispatch path,
  the signal handlers and the shutdown timing must be exactly what they were —
  there is a regression test that signals a real child process mid-handler to
  hold that line. When on, `IMQService` drains: `stop()`, bounded wait,
  `destroy()`, `exit(0)`, in that order, because `destroy()` closes the writer
  the in-flight replies still need.

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

Generate the client with `@imqueue/cli`. The name is the service's **class**
name, because that is also its queue name:

```bash
imq client generate UserService ./src/clients
```

The generated module exports exactly one symbol: a namespace named after the
service with a lower-case first letter, holding a client class whose trailing
`Service` is replaced by `Client` (see `clientName`/`namespaceName` in
[`src/IMQClient.ts`](./src/IMQClient.ts)). The class itself has no top-level
export, so importing it by name does not resolve:

```typescript
import { userService } from './src/clients/UserService.js';

// callTimeout is unset by default, which means calls wait forever.
const client = new userService.UserClient({ callTimeout: 5000 });

await client.start();
await client.get('42');
```

`IMQClient.create('UserService')` does the same at runtime, and resolves to that
namespace object — not to a client instance.

## License

GPL-3.0. Commercial licensing for closed-source products: https://imqueue.com/.
