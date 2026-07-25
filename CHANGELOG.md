# Changelog

Notable changes to `@imqueue/rpc`. Entries start at 3.3.1 — the first release
whose behavior changes needed a written record; earlier history is in the git
log.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
