import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db";
import { conflict, notFound, outOfStock } from "../errors";
import { logger } from "../logger";

/**
 * Inventory.
 *
 * `onHand` is physical stock; `reserved` is stock promised to in-flight orders.
 * Sellable stock is `onHand - reserved`.
 *
 * Reservation, commit and release all run inside a transaction that takes
 * `SELECT ... FOR UPDATE` row locks, acquired in a deterministic order
 * (by inventory item id) so concurrent checkouts serialise instead of
 * deadlocking. Database CHECK constraints make negative or over-reserved
 * stock impossible even if this code were wrong.
 */

export type StockLine = { variantId: string; quantity: number };

export type Availability = {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  isLowStock: boolean;
  allowBackorder: boolean;
};

type Tx = Prisma.TransactionClient;

export async function getAvailability(variantIds: readonly string[]): Promise<Map<string, Availability>> {
  if (variantIds.length === 0) return new Map();
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...variantIds] } },
    select: {
      id: true,
      lowStockThreshold: true,
      allowBackorder: true,
      inventory: { select: { onHand: true, reserved: true } },
    },
  });

  return new Map(
    variants.map((variant) => {
      const onHand = variant.inventory.reduce((total, item) => total + item.onHand, 0);
      const reserved = variant.inventory.reduce((total, item) => total + item.reserved, 0);
      const available = onHand - reserved;
      return [
        variant.id,
        {
          variantId: variant.id,
          onHand,
          reserved,
          available,
          isLowStock: available > 0 && available <= variant.lowStockThreshold,
          allowBackorder: variant.allowBackorder,
        },
      ];
    }),
  );
}

/** Locks the inventory rows for the given variants, in a stable order. */
async function lockInventoryRows(tx: Tx, variantIds: readonly string[]) {
  if (variantIds.length === 0) return [];
  return tx.$queryRaw<Array<{ id: string; variant_id: string; on_hand: number; reserved: number }>>`
    SELECT id, "variantId" AS variant_id, "onHand" AS on_hand, reserved
    FROM inventory_items
    WHERE "variantId" = ANY(${[...variantIds]}::text[])
    ORDER BY id
    FOR UPDATE
  `;
}

/**
 * Reserve stock for an order. Throws OUT_OF_STOCK (with the offending variants)
 * if any line cannot be satisfied — the whole transaction then rolls back, so
 * a partial reservation can never be left behind.
 */
export async function reserveStock(
  tx: Tx,
  lines: readonly StockLine[],
  context: { orderId?: string; actorId?: string | null },
): Promise<void> {
  const variantIds = lines.map((line) => line.variantId);
  const rows = await lockInventoryRows(tx, variantIds);

  const byVariant = new Map<string, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    const list = byVariant.get(row.variant_id) ?? [];
    list.push(row);
    byVariant.set(row.variant_id, list);
  }

  const backorderable = new Set(
    (
      await tx.productVariant.findMany({
        where: { id: { in: variantIds }, allowBackorder: true },
        select: { id: true },
      })
    ).map((v) => v.id),
  );

  const shortfalls: Array<{ variantId: string; requested: number; available: number }> = [];

  for (const line of lines) {
    const items = byVariant.get(line.variantId) ?? [];
    const available = items.reduce((total, item) => total + (item.on_hand - item.reserved), 0);
    if (available < line.quantity && !backorderable.has(line.variantId)) {
      shortfalls.push({ variantId: line.variantId, requested: line.quantity, available });
    }
  }

  if (shortfalls.length > 0) {
    throw outOfStock("Some items are no longer available in the quantity requested.", { shortfalls });
  }

  for (const line of lines) {
    const items = (byVariant.get(line.variantId) ?? []).sort(
      (a, b) => b.on_hand - b.reserved - (a.on_hand - a.reserved),
    );
    if (items.length === 0) throw notFound(`No inventory record for variant ${line.variantId}`);

    let remaining = line.quantity;
    for (const item of items) {
      if (remaining <= 0) break;
      const capacity = Math.max(0, item.on_hand - item.reserved);
      // Backorders draw from the default (first) location once stock runs out.
      const take = capacity > 0 ? Math.min(capacity, remaining) : remaining;
      remaining -= take;

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { reserved: { increment: take } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          reservedDelta: take,
          reason: "RESERVATION",
          orderId: context.orderId ?? null,
          actorId: context.actorId ?? null,
        },
      });
    }
  }
}

/** Convert reservations into a physical decrement once payment succeeds. */
export async function commitReservation(tx: Tx, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, inventoryCommitted: true, inventoryReleased: true },
  });
  if (!order) throw notFound("Order not found");
  if (order.inventoryCommitted || order.inventoryReleased) return; // idempotent

  const reservations = await tx.inventoryTransaction.findMany({
    where: { orderId, reason: "RESERVATION" },
    select: { inventoryItemId: true, reservedDelta: true },
  });

  for (const reservation of reservations) {
    await tx.inventoryItem.update({
      where: { id: reservation.inventoryItemId },
      data: {
        reserved: { decrement: reservation.reservedDelta },
        onHand: { decrement: reservation.reservedDelta },
      },
    });
    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: reservation.inventoryItemId,
        reservedDelta: -reservation.reservedDelta,
        onHandDelta: -reservation.reservedDelta,
        reason: "SALE",
        orderId,
      },
    });
  }

  await tx.order.update({ where: { id: orderId }, data: { inventoryCommitted: true } });
}

/** Release reservations for an order that was cancelled or expired. */
export async function releaseReservation(tx: Tx, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, inventoryCommitted: true, inventoryReleased: true },
  });
  if (!order) throw notFound("Order not found");
  if (order.inventoryReleased) return; // idempotent

  if (order.inventoryCommitted) {
    // Stock already left the shelf: put it back rather than unreserving.
    const sales = await tx.inventoryTransaction.findMany({
      where: { orderId, reason: "SALE" },
      select: { inventoryItemId: true, onHandDelta: true },
    });
    for (const sale of sales) {
      const quantity = Math.abs(sale.onHandDelta);
      await tx.inventoryItem.update({
        where: { id: sale.inventoryItemId },
        data: { onHand: { increment: quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: sale.inventoryItemId,
          onHandDelta: quantity,
          reason: "RETURN",
          orderId,
        },
      });
    }
  } else {
    const reservations = await tx.inventoryTransaction.findMany({
      where: { orderId, reason: "RESERVATION" },
      select: { inventoryItemId: true, reservedDelta: true },
    });
    for (const reservation of reservations) {
      await tx.inventoryItem.update({
        where: { id: reservation.inventoryItemId },
        data: { reserved: { decrement: reservation.reservedDelta } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: reservation.inventoryItemId,
          reservedDelta: -reservation.reservedDelta,
          reason: "RELEASE",
          orderId,
        },
      });
    }
  }

  await tx.order.update({ where: { id: orderId }, data: { inventoryReleased: true } });
}

/** Manual adjustment from the admin panel. Always writes a transaction row. */
export async function adjustStock(input: {
  variantId: string;
  warehouseId?: string;
  onHandDelta: number;
  reason: "RESTOCK" | "DAMAGE" | "CORRECTION" | "RETURN" | "INITIAL";
  note?: string;
  actorId: string;
}): Promise<Availability> {
  const { variantId, onHandDelta, reason, note, actorId } = input;
  if (!Number.isInteger(onHandDelta) || onHandDelta === 0) {
    throw conflict("Adjustment must be a non-zero whole number.");
  }

  return prisma.$transaction(async (tx) => {
    const warehouseId =
      input.warehouseId ??
      (await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } }))?.id;
    if (!warehouseId) throw notFound("No warehouse configured");

    const item = await tx.inventoryItem.upsert({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      create: { variantId, warehouseId, onHand: 0, reserved: 0 },
      update: {},
      select: { id: true, onHand: true, reserved: true },
    });

    if (item.onHand + onHandDelta < item.reserved) {
      throw conflict("Cannot reduce stock below the quantity already reserved for orders.");
    }

    const updated = await tx.inventoryItem.update({
      where: { id: item.id },
      data: { onHand: { increment: onHandDelta } },
      select: { onHand: true, reserved: true },
    });

    await tx.inventoryTransaction.create({
      data: { inventoryItemId: item.id, onHandDelta, reason, note, actorId },
    });

    logger.info("inventory.adjusted", { variantId, onHandDelta, reason, actorId });

    const variant = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { lowStockThreshold: true, allowBackorder: true },
    });
    const available = updated.onHand - updated.reserved;
    return {
      variantId,
      onHand: updated.onHand,
      reserved: updated.reserved,
      available,
      isLowStock: available > 0 && available <= variant.lowStockThreshold,
      allowBackorder: variant.allowBackorder,
    };
  });
}

export async function listLowStock(limit = 25) {
  const items = await prisma.inventoryItem.findMany({
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          title: true,
          lowStockThreshold: true,
          product: { select: { id: true, title: true, slug: true } },
        },
      },
      warehouse: { select: { name: true, code: true } },
    },
    orderBy: { onHand: "asc" },
    take: 200,
  });

  return items
    .map((item) => ({
      ...item,
      available: item.onHand - item.reserved,
    }))
    .filter((item) => item.available <= item.variant.lowStockThreshold)
    .slice(0, limit);
}
