import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These are integration tests sharing one live `dpm sandbox` ledger
    // (see test/orgs.test.ts) — running test files in parallel workers
    // races on shared ledger state (e.g. two files' beforeAll both
    // allocating the stable-hint "PlatformOperator" party at once). Small
    // suite, not worth the concurrency.
    fileParallelism: false,
  },
});
