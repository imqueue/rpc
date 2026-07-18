# Design: Dev-mode type introspection (on-disk JSDoc fallback)

**Date:** 2026-07-18
**Branch:** `feat/dev-mode-type-introspection` (based on `fix/expose-jsdoc-type-brace-parsing`)
**Status:** Approved

## Problem

`@expose()` derives argument/return types exclusively from JSDoc parsed out of
`Class.toString()` — the **runtime** class source. When a service runs from
`.ts` directly via a transpiler that strips comments (`tsx`, `ts-node` with
esbuild/swc transforms), the JSDoc is gone at runtime and every exposed method
degrades to `any` in the service description and generated clients. The type
contract silently depends on the developer's launcher.

(Node's native `--experimental-strip-types` keeps comments; compiled
`node dist/index.js` with `removeComments: false` keeps them too — those paths
already work.)

## Decision (user-approved)

**Option 1a — keep the JSDoc contract; add an on-disk source fallback:**

- **Precedence:** runtime source wins whenever it yields JSDoc for the class.
  The on-disk file is consulted **only when the runtime class source contains
  no JSDoc comment blocks**. No freshness checks, no env flags.
- Zero new dependencies. Production path (`ctor.toString()` → acorn) is
  unchanged.
- Worst case (source not locatable / no JSDoc on disk) degrades to the current
  behavior (`any`), never worse.

Rejected alternatives: parsing TS type annotations with the `typescript`
compiler (adds a heavy runtime dependency for a dev concern); carrying types as
decorator arguments (bulletproof but taxes every method with boilerplate and
requires migrating existing services).

## Mechanism

### 1. Source-file capture

`@expose()` factory executions happen at class-definition time, physically in
the defining module. Capture `new Error().stack` inside the factory, take the
first frame whose path is not rpc's own `expose` module, normalize
(`file://` URL → path), and remember it. With `tsx` / `--experimental-strip-types`
(source maps on) the frame points at the on-disk `.ts`; with compiled code it
points at the `.js` (which normally carries JSDoc anyway).

The captured path is stored per decorated method and associated with the class
when the description is built (`buildMethodDescription`), keyed by class name.

### 2. Fallback trigger

`parseDescriptions(className, ctor.toString())` currently populates
`descriptions[className]` from the runtime source. After it runs, if the
parsed class yielded **no JSDoc comment metadata at all** (no method has a
comment block) and a captured source path exists and is readable, run the
fallback extraction against the file contents.

### 3. Textual JSDoc extraction from `.ts`

The on-disk file may be TypeScript, which acorn cannot parse — extraction is
textual, not AST:

- Narrow the search to the class body: from `class <className>` to the next
  top-level `class ` declaration or EOF (tolerate `export`/`default`
  modifiers).
- For each exposed method name, match the **last** `/** … */` block that
  precedes `methodName(` allowing decorators (`@word(...)`), modifiers
  (`public|protected|private|static|async`), generics (`<...>`), and
  whitespace between the block and the method name.
- Feed the block body to the existing `parseComment()` (which, after the
  balanced-brace fix, handles object-literal types and braces in
  descriptions).
- Any extraction miss for a method leaves that method as-is (current
  behavior).

File reads are cached per absolute path (`fs.readFileSync`, sync — decoration
is startup-time work, same as today's parsing).

## Accepted limitations (documented, not bugs)

- Compiled `.js` with `removeComments: true`: the stack points at the
  comment-less `.js`; fallback finds no JSDoc → `any`, as today. Mapping
  `.js → .ts` is out of scope.
- Bundled single-file builds without source maps may defeat frame capture →
  current behavior.
- A stale process whose on-disk `.ts` has drifted can yield newer types than
  the running code — inherent to reading the disk; runtime-first precedence
  keeps this to the dev-only fallback path.
- Textual extraction is heuristic; pathological sources (method-name strings
  inside earlier comments, etc.) may miss — degrading to `any`, never
  corrupting existing parses.

## Files

- Modify: `src/decorators/expose.ts` — stack capture in the factory; fallback
  in `buildMethodDescription`; textual extractor (exported for tests).
- Test: `test/decorators/expose.spec.ts` — simulate a comment-stripped runtime
  class (`toString` override) whose on-disk source carries JSDoc; unit-test the
  textual extractor against TS-syntax source (decorators, modifiers,
  object-literal types); regression: runtime-JSDoc-present path must not read
  the disk.

## Verification

- New tests RED before implementation, GREEN after.
- Full suite passes (198 tests at branch base + new ones).
- Manual sanity: types recovered for a stripped-runtime class in tests equal
  the JSDoc on disk.
