"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { conflict, notFound, toActionError, validationError, type ActionResult } from "@/server/errors";
import { requestIp, requirePermission } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";
import { transitionOrder } from "@/server/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/server/orders/state-machine";
import { refundOrder } from "@/server/payments/service";
import { sendEmail } from "@/server/email/transport";
import { cancellationTemplate, deliveryTemplate, returnStatusTemplate, shipmentTemplate } from "@/server/email/templates";
import { env } from "@/server/env";
import { cuid } from "@/server/validation/common";

/**
 * Administrative order operations.
 *
 * Every action: check permission → validate → apply → audit. The permission
 * check is server-side and independent of whatever the UI chose to render.
 */

export async function updateOrderStatusAction(input: unknown): Promise<ActionResult<{ status: OrderStatus }>> {
  try {
    const { orderId, status, note } = z
      .object({
        orderId: cuid,
        status: z.enum(ORDER_STATUSES),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input);

    const actor = await requirePermission("order:write");

    const before = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, orderNumber: true, email: true, id: true },
    });
    if (!before) throw notFound("Order not found");

    await transitionOrder({ orderId, to: status, actorId: actor.id, note });

    await recordAudit({
      actor,
      action: "order.status_changed",
      entityType: "Order",
      entityId: orderId,
      metadata: { from: before.status, to: status, note },
      ipAddress: await requestIp(),
    });

    // Customer-facing notifications for the statuses they care about.
    const url = `${env.NEXT_PUBLIC_APP_URL}/account/orders/${orderId}`;
    if (status === "DELIVERED") {
      await sendEmail({ to: before.email, ...deliveryTemplate({ orderNumber: before.orderNumber, url }) });
    } else if (status === "CANCELLED") {
      await sendEmail({
        to: before.email,
        ...cancellationTemplate({ orderNumber: before.orderNumber, reason: note, url }),
      });
    }

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true, data: { status } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createShipmentAction(input: unknown): Promise<ActionResult<{ shipmentId: string }>> {
  try {
    const parsed = z
      .object({
        orderId: cuid,
        carrier: z.string().trim().min(2).max(80),
        trackingNumber: z.string().trim().max(120).optional(),
        trackingUrl: z.url().max(500).optional().or(z.literal("")),
        markShipped: z.boolean().default(true),
      })
      .parse(input);

    const actor = await requirePermission("order:write");

    const order = await prisma.order.findUnique({
      where: { id: parsed.orderId },
      select: { id: true, status: true, orderNumber: true, email: true },
    });
    if (!order) throw notFound("Order not found");

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: parsed.carrier,
        trackingNumber: parsed.trackingNumber || null,
        trackingUrl: parsed.trackingUrl || null,
        status: "IN_TRANSIT",
        shippedAt: new Date(),
        events: {
          create: {
            status: "DISPATCHED",
            description: "Parcel handed to the carrier",
            occurredAt: new Date(),
          },
        },
      },
    });

    if (parsed.markShipped && order.status !== "SHIPPED") {
      await transitionOrder({
        orderId: order.id,
        to: "SHIPPED",
        actorId: actor.id,
        note: `Shipped with ${parsed.carrier}`,
      });
    }

    await sendEmail({
      to: order.email,
      ...shipmentTemplate({
        orderNumber: order.orderNumber,
        carrier: parsed.carrier,
        trackingNumber: parsed.trackingNumber,
        trackingUrl: parsed.trackingUrl || null,
        url: `${env.NEXT_PUBLIC_APP_URL}/account/orders/${order.id}`,
      }),
    });

    await recordAudit({
      actor,
      action: "order.shipment_created",
      entityType: "Order",
      entityId: order.id,
      metadata: { carrier: parsed.carrier, trackingNumber: parsed.trackingNumber },
      ipAddress: await requestIp(),
    });

    revalidatePath(`/admin/orders/${order.id}`);
    return { ok: true, data: { shipmentId: shipment.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function refundOrderAction(input: unknown): Promise<ActionResult<{ refundId: string }>> {
  try {
    const parsed = z
      .object({
        orderId: cuid,
        amountCents: z.number().int().min(1),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input);

    // Refunds move money: a separate, higher permission than order editing.
    const actor = await requirePermission("refund:write");

    const refund = await refundOrder({
      orderId: parsed.orderId,
      amountCents: parsed.amountCents,
      reason: parsed.reason,
      actorId: actor.id,
    });

    await recordAudit({
      actor,
      action: "order.refunded",
      entityType: "Order",
      entityId: parsed.orderId,
      metadata: { amountCents: parsed.amountCents, reason: parsed.reason },
      ipAddress: await requestIp(),
    });

    revalidatePath(`/admin/orders/${parsed.orderId}`);
    return { ok: true, data: { refundId: refund.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateReturnRequestAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const parsed = z
      .object({
        returnId: cuid,
        status: z.enum(["APPROVED", "REJECTED", "IN_TRANSIT", "RECEIVED", "REFUNDED", "CANCELLED"]),
        resolution: z.string().trim().max(500).optional(),
      })
      .parse(input);

    const actor = await requirePermission("order:write");

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: parsed.returnId },
      include: { order: { select: { id: true, orderNumber: true, email: true, status: true } } },
    });
    if (!returnRequest) throw notFound("Return request not found");

    await prisma.returnRequest.update({
      where: { id: parsed.returnId },
      data: { status: parsed.status, resolution: parsed.resolution },
    });

    // Receiving the goods back is what puts stock on the shelf again.
    if (parsed.status === "RECEIVED" && returnRequest.order.status === "RETURN_REQUESTED") {
      await transitionOrder({
        orderId: returnRequest.order.id,
        to: "RETURNED",
        actorId: actor.id,
        note: "Return received",
      });
    }

    await sendEmail({
      to: returnRequest.order.email,
      ...returnStatusTemplate({
        orderNumber: returnRequest.order.orderNumber,
        status: parsed.status,
        resolution: parsed.resolution,
        url: `${env.NEXT_PUBLIC_APP_URL}/account/orders/${returnRequest.order.id}`,
      }),
    });

    await recordAudit({
      actor,
      action: "return.updated",
      entityType: "ReturnRequest",
      entityId: parsed.returnId,
      metadata: { status: parsed.status },
      ipAddress: await requestIp(),
    });

    revalidatePath(`/admin/orders/${returnRequest.order.id}`);
    return { ok: true, data: { status: parsed.status } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function addOrderNoteAction(input: unknown): Promise<ActionResult<{ saved: true }>> {
  try {
    const { orderId, note } = z.object({ orderId: cuid, note: z.string().trim().max(2000) }).parse(input);
    const actor = await requirePermission("order:write");

    await prisma.order.update({ where: { id: orderId }, data: { adminNote: note } });
    await recordAudit({
      actor,
      action: "order.note_updated",
      entityType: "Order",
      entityId: orderId,
      ipAddress: await requestIp(),
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, data: { saved: true } };
  } catch (error) {
    return toActionError(error);
  }
}
