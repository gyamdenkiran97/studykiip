import { config } from "dotenv";

// Load .env then .env.test so a test run never points at the development database.
config({ path: ".env", quiet: true });
config({ path: ".env.test", override: true, quiet: true });

// Vitest already sets NODE_ENV=test; the remaining defaults keep tests hermetic.
process.env.PAYMENT_PROVIDER ??= "mock";
process.env.BETTER_AUTH_SECRET ??= "test-secret-must-be-at-least-32-characters-long";
process.env.LOG_LEVEL ??= "error";
