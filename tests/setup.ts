import { config } from "dotenv";

// Load .env then .env.test so a test run never points at the development database.
config({ path: ".env", quiet: true });
config({ path: ".env.test", override: true, quiet: true });

// Vitest already sets NODE_ENV=test; the remaining defaults keep tests hermetic.
process.env.PAYMENT_PROVIDER ??= "mock";

// Integration tests run against their own database so a failed run can never
// touch development data.
process.env.TEST_DATABASE_URL ??=
  process.env.DATABASE_URL?.replace(/\/([^/?]+)(\?|$)/, "/kiipmall_test$2") ??
  "postgresql://kiip:kiip_dev_password@127.0.0.1:5432/kiipmall_test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= "test-secret-must-be-at-least-32-characters-long";
process.env.LOG_LEVEL ??= "error";
