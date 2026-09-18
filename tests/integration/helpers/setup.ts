import { beforeAll, beforeEach, afterAll } from "vitest";
import { disconnect, ensureSchema, resetDatabase, testDb } from "./db";

/**
 * Shared integration lifecycle. Imported for its side effects by each
 * integration test file.
 */

beforeAll(() => {
  ensureSchema();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await disconnect();
});

export { testDb };
