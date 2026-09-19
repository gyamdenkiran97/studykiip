import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { testDb } from "./helpers/setup";
import { createCustomer } from "./helpers/fixtures";

/**
 * Credential storage.
 *
 * Better Auth owns the hashing (scrypt), but "the library handles it" is not
 * evidence. These tests assert the property directly against the row that is
 * actually written: the column must not contain the password, and it must not
 * be reversible or comparable by equality.
 */

const PASSWORD = "correct horse battery staple";

async function createCredentialAccount(userId: string, password: string) {
  return testDb.account.create({
    data: {
      userId,
      accountId: userId,
      providerId: "credential",
      password: await hashPassword(password),
    },
  });
}

describe("credential storage", () => {
  it("never stores the password itself", async () => {
    const user = await createCustomer();
    await createCredentialAccount(user.id, PASSWORD);

    const account = await testDb.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toBe(PASSWORD);
    expect(account.password!.toLowerCase()).not.toContain("battery");
  });

  it("salts, so the same password stored twice does not look the same", async () => {
    const first = await createCustomer();
    const second = await createCustomer();
    await createCredentialAccount(first.id, PASSWORD);
    await createCredentialAccount(second.id, PASSWORD);

    const rows = await testDb.account.findMany({ where: { userId: { in: [first.id, second.id] } } });
    expect(rows).toHaveLength(2);
    expect(rows[0].password).not.toBe(rows[1].password);
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const user = await createCustomer();
    await createCredentialAccount(user.id, PASSWORD);
    const account = await testDb.account.findFirstOrThrow({ where: { userId: user.id } });

    expect(await verifyPassword({ hash: account.password!, password: PASSWORD })).toBe(true);
    expect(await verifyPassword({ hash: account.password!, password: "correct horse battery stapl" })).toBe(false);
    expect(await verifyPassword({ hash: account.password!, password: "" })).toBe(false);
  });

  it("cannot be matched by looking the hash up as a value", async () => {
    // The shape of an attack that works against unsalted or plaintext storage:
    // hash the guess, look for a row that equals it.
    const user = await createCustomer();
    await createCredentialAccount(user.id, PASSWORD);

    const guess = await hashPassword(PASSWORD);
    const match = await testDb.account.findFirst({ where: { password: guess } });
    expect(match).toBeNull();
  });
});
