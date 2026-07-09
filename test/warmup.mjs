/*!
 * Test preload (wired via `node --import ./test/warmup.mjs`).
 *
 * Registers all module mocks (side effect of the mocks index) and then
 * fully loads the ES module graph of @imqueue/core BEFORE any spec file
 * runs. CommonJS specs may then require('@imqueue/core') synchronously:
 * require(esm) of an already-evaluated module returns its bound namespace,
 * whereas evaluating a graph that contains node:test module mocks through
 * the synchronous require(esm) path leaves the mock exports unbound (the
 * mocks evaluate asynchronously), which manifests as
 * "TypeError: core_1.Redis is not a constructor".
 */
import './mocks/index.js';

await import('@imqueue/core');
