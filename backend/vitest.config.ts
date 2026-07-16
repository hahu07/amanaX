import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These are integration tests sharing one live `dpm sandbox` ledger
    // (see test/orgs.test.ts) — running test files in parallel workers
    // races on shared ledger state (e.g. two files' beforeAll both
    // allocating the stable-hint "PlatformOperator" party at once). Small
    // suite, not worth the concurrency.
    fileParallelism: false,
    // Default timeouts (5s test / 10s hook) are too tight for tests that
    // chain many sequential ledger round-trips (e.g. the full Shariah ->
    // Trustee review lifecycle is 10+ commands in one test), especially
    // against a long-running dev sandbox carrying hours of accumulated
    // contracts. These are integration tests against a real ledger, not
    // unit tests — generous timeouts are the right trade-off here.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
