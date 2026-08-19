# Changelog

Notable changes to `@imqueue/rpc`. Entries start at 3.3.1 — the first release
whose behavior changes needed a written record; earlier history is in the git
log.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A response that arrives with no pending call left is now visible in the
  log.** The line is written through the configured logger on every such
  response, names the service, the method and the request id, and never the
  arguments, the request or the response object (which echoes the whole
  request back) or an error text. It tells a late reply apart from a service
  that never answered, and after a restart it names the backlog the previous
  process left behind.

  A reply that could not be written to the caller's queue is reported by
  `@imqueue/core` itself, as part of its write-failure episode reporting, so
  this package adds no reporting of its own there. A call that got no
  response within `callTimeout` is not logged here either: the caller
  receives the `IMQ_RPC_CALL_TIMEOUT` rejection and decides how to report it.

### Changed

- **`@logged()` now names the class and the method instead of dumping the
  error.** The line reads `Class.method() failed, code <code>`. The code is
  never taken from the error as it is: only an allow-listed code is printed —
  an `IMQ_`-prefixed framework code, a system `E…` code, a small integer, a
  known redis reply code or one of a few known redis-client failure messages
  mapped to codes of our own; everything else, the error's class name
  included, is reported as `unknown`. The caught value itself, its message and its
  stack are no longer printed: an application error may carry personal data,
  and an imq error carries the call arguments in its properties. The method
  name now also reaches the line under standard (TC39) decorators, where it was
  previously unavailable. Everything else is unchanged, including which logger
  is resolved, `doNotThrow`, the re-thrown value and the fact that a throwing
  logger replaces the original error.

## [3.4.4] - 2026-07-26

### Changed

- Raised the `@imqueue/core` dependency to `^3.2.4`, which stops a destroyed
  queue's reader from swallowing one message addressed to the next owner of its
  queue name. That is the same failure 3.4.2 addressed from this side, and the
  two are complementary: 3.4.2 stops a queue name being handed over within a
  process at all, while core 3.2.4 removes the stale consumer however the name
  changes hands — including from another process, which nothing here can
  prevent.

## [3.4.3] - 2026-07-26

### Changed

- Raised the `@imqueue/core` dependency to `^3.2.3`.

## [3.4.2] - 2026-07-26

### Fixed

- **A client created after another one was destroyed lost its first reply.**
  `pid()` allocates the lowest free identifier, and that identifier is the only
  part of a client's queue name that separates two clients of the same service
  on one host — so an identifier released by `forgetPid()` handed the whole
  queue name to the next client. The reader of the destroyed client stays
  blocked on that queue past `destroy()`, consumes the first message addressed
  to its successor and discards it, leaving the caller waiting forever with no
  error. Identifiers this process has given back are no longer re-used.

  This is what made `IMQClient.create()` look broken: generating a client
  starts a temporary client to read the service description and destroys it, so
  the first call through *any* client built afterwards in that process — a
  runtime-generated one or a statically generated one — never returned. The
  second call onwards worked, because only one message is swallowed.

  Identifiers freed by another process, or left behind by one that died, are
  still re-used as before.

## [3.4.0] - 2026-07-26

### Changed

- **On a delayed call, a trailing `undefined` is never delivered.** Every
  trailing placeholder is now dropped, and the drop runs *after* both framework
  slots have been stripped. 3.3.1 dropped exactly one, and did it before the
  metadata slot was taken, so whether a placeholder reached the service depended
  on whether metadata was also passed:

  | call | 3.3.1 sends | now sends |
  | --- | --- | --- |
  | `m(a, undefined, undefined, delay)` | `[a, null]` | `[a]` |
  | `m(a, undefined, metadata, delay)` | `[a, null]` | `[a]` |

  A declared optional or defaulted parameter skipped this way therefore falls
  back to its default instead of receiving `null`. If a handler persisted such a
  parameter, it now writes the default rather than `null`.

  Unchanged: calls without a delay never drop anything, declared arguments
  holding real values are always delivered, and every shape 3.3.1 fixed keeps
  working.

## [3.3.1] - 2026-07-25

### Fixed

- A delayed call no longer requires inventing a metadata bag.
  `method(data, undefined, delay)` previously failed with
  `IMQ_RPC_INVALID_ARGS_COUNT`, because the two trailing framework parameters are
  stripped by identity rather than by position and the explicit `undefined`
  travelled on as a real call argument. One trailing `undefined` is now dropped
  once a delay has been popped.
- The client generator stripped only one framework parameter that a service had
  declared itself, so a service declaring both emitted a client with a
  duplicated metadata parameter.

### Changed

Behavior deltas against 3.3.0. All three need a cast or plain JavaScript to
reach — the generated signatures reject them under `tsc` — but on 3.3.0 the cast
form was the only way to delay a call while skipping an optional parameter, so
that spelling does occur in real code:

- `method(undefined, delay)`, on a method whose declared parameters are all
  required, previously delivered `null` and now fails with
  `IMQ_RPC_INVALID_ARGS_COUNT`. Pass a real value.
- `method(a, undefined, delay as any)`, on a method with an optional declared
  parameter, previously delivered `null` for it and now omits it, so a defaulted
  parameter falls back to its default. This one is silent: no error, a different
  value.
- For a service that declares its own `IMQMetadata` parameter, metadata passed
  positionally into that slot now arrives as `request.metadata`, leaving the
  service's own parameter `undefined`.

Note that on 3.3.1 the drop applies only to *delayed* calls: `method(a,
undefined)` without a delay still delivers `null`, on every version.
