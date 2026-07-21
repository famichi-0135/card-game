import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

type TestEnvironment = CloudflareBindings & {
  TEST_MIGRATIONS: D1Migration[];
};

const testEnvironment = env as TestEnvironment;

await applyD1Migrations(testEnvironment.DB, testEnvironment.TEST_MIGRATIONS);
