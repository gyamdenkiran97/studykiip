import { describe, expect, it } from "vitest";
import { testDb } from "./helpers/setup";
import { availableStock, createProduct, createWarehouse } from "./helpers/fixtures";
import { adjustStock, commitReservation, getAvailability, releaseReservation, reserveStock } from "@/server/inventory";
import { AppError } from "@/server/errors";

/**
 * Inventory is the part of a shop that must not be approximately right.
 * These tests use the real database because row locks and CHECK constraints
 * are exactly what is being verified.
 */

async function makeOrderShell(variantId: string) {
  const user = await testDb.user.create({
    data: { name: "Buyer", email: `buyer-${Math.random().toString(36).slice(2)}@example.test` },
  });
  return testDb.order.create({
    data: {
      orderNumber: `KM-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      email: user.email,
      currency: "GBP",
      subtotalCents: 1000,
      totalCents: 1000,
      items: {
        create: {
          variantId,
          productTitle: "Test",
          variantTitle: "Standard",
          sku: "TEST",
          quantity: 1,
          unitPriceCents: 1000,
          totalCents: 1000,
        },
      },
    },
  });
}

describe("inventory", () => {
  it("reserving stock reduces what is available without moving physical stock", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 10 });
    const order = await makeOrderShell(variant.id);

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 3 }], { orderId: order.id }),
    );

    const item = await testDb.inventoryItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.onHand).toBe(10);
    expect(item.reserved).toBe(3);
    expect(await availableStock(variant.id)).toBe(7);
  });

  it("records a transaction for every stock movement", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 5 });
    const order = await makeOrderShell(variant.id);

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 2 }], { orderId: order.id }),
    );
    await testDb.$transaction((tx) => commitReservation(tx, order.id));

    const transactions = await testDb.inventoryTransaction.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });

    expect(transactions.map((entry) => entry.reason)).toEqual(["RESERVATION", "SALE"]);
    expect(transactions[0].reservedDelta).toBe(2);
    expect(transactions[1].onHandDelta).toBe(-2);
  });

  it("refuses to reserve more than is available", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 2 });
    const order = await makeOrderShell(variant.id);

    await expect(
      testDb.$transaction((tx) =>
        reserveStock(tx, [{ variantId: variant.id, quantity: 3 }], { orderId: order.id }),
      ),
    ).rejects.toThrow(AppError);

    // The failed attempt must leave nothing behind.
    expect(await availableStock(variant.id)).toBe(2);
    expect(await testDb.inventoryTransaction.count()).toBe(0);
  });

  it("does not oversell the last unit under concurrent checkouts", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 1 });
    const [orderA, orderB] = await Promise.all([makeOrderShell(variant.id), makeOrderShell(variant.id)]);

    // Both transactions race for the same single unit.
    const results = await Promise.allSettled([
      testDb.$transaction((tx) => reserveStock(tx, [{ variantId: variant.id, quantity: 1 }], { orderId: orderA.id })),
      testDb.$transaction((tx) => reserveStock(tx, [{ variantId: variant.id, quantity: 1 }], { orderId: orderB.id })),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(await availableStock(variant.id)).toBe(0);

    const item = await testDb.inventoryItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.reserved).toBe(1);
  });

  it("allows a backorder variant to be reserved beyond stock", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 0, allowBackorder: true });
    const order = await makeOrderShell(variant.id);

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 2 }], { orderId: order.id }),
    );

    const item = await testDb.inventoryItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.reserved).toBe(2);
  });

  it("releasing an uncommitted reservation returns the stock", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 6 });
    const order = await makeOrderShell(variant.id);

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 4 }], { orderId: order.id }),
    );
    expect(await availableStock(variant.id)).toBe(2);

    await testDb.$transaction((tx) => releaseReservation(tx, order.id));
    expect(await availableStock(variant.id)).toBe(6);

    const item = await testDb.inventoryItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.onHand).toBe(6);
    expect(item.reserved).toBe(0);
  });

  it("releasing after a commit puts the units back on the shelf", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 6 });
    const order = await makeOrderShell(variant.id);

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 4 }], { orderId: order.id }),
    );
    await testDb.$transaction((tx) => commitReservation(tx, order.id));
    expect(await availableStock(variant.id)).toBe(2);

    await testDb.$transaction((tx) => releaseReservation(tx, order.id));
    expect(await availableStock(variant.id)).toBe(6);
  });

  it("commit and release are idempotent", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 5 });
    const order = await makeOrderShell(variant.id);

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 2 }], { orderId: order.id }),
    );
    await testDb.$transaction((tx) => commitReservation(tx, order.id));
    await testDb.$transaction((tx) => commitReservation(tx, order.id));
    expect(await availableStock(variant.id)).toBe(3);

    await testDb.$transaction((tx) => releaseReservation(tx, order.id));
    await testDb.$transaction((tx) => releaseReservation(tx, order.id));
    expect(await availableStock(variant.id)).toBe(5);
  });

  it("manual adjustments cannot take stock below what is reserved", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 5 });
    const order = await makeOrderShell(variant.id);
    const staff = await testDb.user.create({
      data: { name: "Staff", email: `staff-${Math.random().toString(36).slice(2)}@example.test`, role: "MANAGER" },
    });

    await testDb.$transaction((tx) =>
      reserveStock(tx, [{ variantId: variant.id, quantity: 4 }], { orderId: order.id }),
    );

    await expect(
      adjustStock({ variantId: variant.id, onHandDelta: -3, reason: "DAMAGE", actorId: staff.id }),
    ).rejects.toThrow(/already reserved/i);

    const item = await testDb.inventoryItem.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(item.onHand).toBe(5);
  });

  it("the database refuses negative stock even if the service is bypassed", async () => {
    const warehouse = await createWarehouse();
    const { inventory } = await createProduct({ warehouseId: warehouse.id, stock: 1 });

    await expect(
      testDb.inventoryItem.update({ where: { id: inventory.id }, data: { onHand: -1 } }),
    ).rejects.toThrow();
  });

  it("reports low stock against the variant's own threshold", async () => {
    const warehouse = await createWarehouse();
    const { variant } = await createProduct({ warehouseId: warehouse.id, stock: 3, lowStockThreshold: 5 });

    const availability = await getAvailability([variant.id]);
    expect(availability.get(variant.id)).toMatchObject({ available: 3, isLowStock: true });
  });
});
