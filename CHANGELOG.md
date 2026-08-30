# Changelog

Notable changes to `@imqueue/rpc`. Entries start at 3.3.1 — the first release
whose behavior changes needed a written record; earlier history is in the git
log.

A released version absent from this file changed no behavior — it was a
documentation or CI-only release. Dependency bumps do get an entry, because a
raised `@imqueue/core` floor is how most fixes in the transport reach a service.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Opt-in graceful shutdown draining.** With `IMQ_DRAIN_ENABLE=1` — or the new
  `drain` service option — `SIGTERM` and `SIGINT` now stop consuming, wait for
  the requests already being handled, publish their replies, tear the transport
  down and exit `0`, in that order. The order is the feature: `stop()` drops the
  reader connection only, so the writer that in-flight replies need stays up
  until `destroy()` runs *after* the wait. Previously the signal handler started
  `destroy()` without awaiting it and force-exited on a fixed timer, so a
  handler still running was abandoned, no reply was ever published, and its
  caller was left holding a promise that never settled — silently, with exit
  code 0.
- **`IMQ_DRAIN_TIMEOUT` / the `drainTimeout` option**, the drain budget in
  milliseconds, default `4000`. The wait is always bounded: whatever has not
  finished by then is abandoned and logged, and the process exits `0` anyway.
  The default is set by the `imq stop` CLI, which signals the process group,
  polls for about five seconds, then sends `SIGKILL` — a budget above that would
  make the local CLI harsher than a Kubernetes deployment, whose
  `terminationGracePeriodSeconds` defaults to 30 s.

  Both variables are read numerically, consistent with the rest of the `IMQ_*`
  family, but a non-numeric value throws at construction instead of falling back
  to the default — `IMQ_DRAIN_ENABLE=true` coerces to `NaN` under that
  convention, and a feature flag that quietly reads as *off* is the failure mode
  worth being loud about.

### Changed

- With draining enabled, requests are tracked at the single point where an
  incoming message is dispatched, so every `@expose()`d method is covered
  automatically — no per-method wrapper to add and none to forget. Bookkeeping
  attaches to a *derived* promise, leaving a handler's rejection its caller's to
  handle and never producing an unhandled rejection of its own.
- With draining enabled, a service forces `handleSignals: false` on its queue
  and its drain takes over the signal handlers this package registered —
  `IMQService`'s own, and any `IMQClient`'s in the same process — each by the
  exact function reference that was registered, so handlers belonging to
  unrelated libraries are left in place. A second signal during a drain forces
  an immediate exit.
- **Nothing changes with `IMQ_DRAIN_ENABLE` unset or `0`**, which is the
  default: the signal handlers, the timing and the dispatch path are what they
  were, down to the tracking set that is never allocated. Covered by a
  regression test that signals a real process mid-handler and asserts the
  handler is still abandoned.

  Delivery remains at-least-once in every mode. A drain narrows the window in
  which in-flight work is lost, it does not close it: `SIGKILL`, an OOM kill or
  a lost node still take it, and handlers still need to be idempotent.

## [3.7.1] - 2026-08-22

### Changed

- Raised the `@imqueue/core` dependency to `^3.4.2`. Recorded because this file's
  rule is that dependency bumps get an entry — but unlike the previous floor
  raise, this one carries nothing from the transport: `3.4.1` and `3.4.2` were a
  documentation and packaging pair, a licence badge that linked through the
  long-dead `rawgit.com` and a `repository.url` that used `git://`, which stopped
  resolving when GitHub retired its git daemon. A reader comparing floors should
  know this one moves no behavior.

### Fixed

- `repository.url` read `git@github.com/imqueue/rpc.git` — no colon after the
  host, so it was not a valid SSH URL or a valid URL of any other kind. npm
  normalised it on publish to `git+ssh://git@github.com/imqueue/rpc.git`, which
  resolves only for someone holding a key on the account, while npm renders this
  field as the package's Repository link for anonymous readers. It is now
  `git+https://github.com/imqueue/rpc.git`.

## [3.7.0] - 2026-08-20

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

- Raised the `@imqueue/core` dependency to `^3.4.0`, which reports the
  transport's previously silent failures through the configured logger — among
  them a reply that could not be written back to the caller's queue, which is
  why this package adds no reporting of its own there.

## [3.6.1] - 2026-08-18

### Changed

- Raised the `@imqueue/core` dependency to `^3.3.3`, which stops a starting
  queue overwriting the server-global `notify-keyspace-events` configuration.

## [3.6.0] - 2026-08-18

### Fixed

- **A `@lock()`'d call could resolve waiters with another call's result, and one
  waiter's timeout rejected all of them.** `IMQLock.deadlockTimeout` rejected
  through `release()`, which does two things a timeout has no business doing: it
  deleted the holder's lock while the holder was still running, and it drained
  the whole queue.

  The first let a later call acquire the freed key and run alongside the original
  holder — and when that holder finally finished, its release landed on the *new*
  holder's lock, resolving waiters with a result computed for a call they had
  nothing to do with and freeing a lock still in use, letting a third call in
  behind it. Silently wrong values, under exactly the overlapping load that
  coalescing `@lock()` exists to collapse. The second meant a call that arrived
  a moment ago died for an older call's patience.

  Locks now carry a token. `release()` takes it as an optional fourth argument
  and is ignored when a different call owns the key; an unowned key is not a
  conflict, so a straggler can still satisfy waiters nobody else will. `lock()`
  reads the token and passes it, so every decorator user is covered with no code
  change, and a release without a token behaves exactly as before. The timer now
  splices out its own task and rejects only that waiter, while still freeing the
  key — a holder that never releases would otherwise poison it for the life of
  the process.

## [3.5.4] - 2026-08-09

### Fixed

- **Tracing hooks installed on the default options could patch a copy nothing
  ever called.** `DEFAULT_IMQ_SERVICE_OPTIONS` and `DEFAULT_IMQ_CLIENT_OPTIONS`
  were plain module-scope objects, so a process that evaluated this module twice
  held two copies — which is what a loader handling ESM and CJS through separate
  pipelines does: under `tsx`, `require('@imqueue/rpc')` and
  `import('@imqueue/rpc')` return distinct instances.

  Anything that installs behavior by mutating those objects then patched a copy
  the application never calls. `@imqueue/opentelemetry` attaches its
  `beforeCall`/`afterCall`/`wrapCall` hooks that way, and produced no spans at
  all under such a loader — with no error, since the patch itself succeeded.

  Both are now keyed on `Symbol.for`, making them singletons per process rather
  than per module evaluation, so a mutation through any instance is visible to
  all. This also removes the "duplicate installs at different tree depths"
  caveat the instrumentation documents.

## [3.5.3] - 2026-08-04

### Changed

- Raised the `@imqueue/core` dependency to `^3.3.2`.

## [3.5.2] - 2026-08-01

### Changed

- Raised the `@imqueue/core` dependency to `^3.3.0`, which keeps safe-delivery
  lease recovery and the cleanup sweep alive after a transient sweep failure,
  and drops the unresolvable `./debug` export subpath.

## [3.5.0] - 2026-07-28

### Fixed

- **A concrete service subclass that exposed nothing of its own answered
  nothing.** `getClassMethods()` looked its class up in the description registry
  by name and dereferenced `classInfo.inherits` with no guard, but `@expose()`
  registers only the class that *declares* a method — so such a subclass had no
  registry entry at all and `describe()` threw a `TypeError` on it.

  The failure was silent and total: `processRequest()` calls `describe()` on
  every request and the constructor's `.catch` sends the rejection to the logger,
  so the service returned no error response and no rejection. Callers hung until
  their own `callTimeout`, which is unset by default.

  Guarding the lookup alone would have traded the hang for a different wrong
  answer — the walk follows the registry's `inherits` links, so it would have
  stopped at the gap and lost every ancestor's exposed methods, denying all calls
  with `IMQ_RPC_NO_ACCESS`. The function now walks the runtime prototype chain,
  which has no gaps, applying each link root-first so a subclass method still
  overrides a same-named parent one. `getClassMethods` is module-private, so the
  signature change is not an API change.

- **The metrics endpoint advertised `plain/text`**, which is not a valid MIME
  type, so scrapers keying on content type saw an unknown one. It is now
  `text/plain`.

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
