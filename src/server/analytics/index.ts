import "server-only";
import { logger } from "../logger";

/**
 * Analytics abstraction.
 *
 * Events are named after the standard ecommerce vocabulary so any provider can
 * consume them, but nothing here is tied to a provider: the default sink is the
 * structured log. Swap `sink` for a real destination without touching call
 * sites. No personal data is included — only ids and counts.
 */

export type AnalyticsEvent =
  | "view_item"
  | "view_item_list"
  | "search"
  | "add_to_cart"
  | "remove_from_cart"
  | "add_to_wishlist"
  | "begin_checkout"
  | "purchase"
  | "refund";

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsSink {
  readonly name: string;
  track(event: AnalyticsEvent, payload: AnalyticsPayload): Promise<void> | void;
}

class LogSink implements AnalyticsSink {
  readonly name = "log";
  track(event: AnalyticsEvent, payload: AnalyticsPayload) {
    logger.info(`analytics.${event}`, payload);
  }
}

let sink: AnalyticsSink = new LogSink();

export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

/** Never throws: analytics must not be able to break a purchase. */
export async function trackServerEvent(
  event: AnalyticsEvent,
  payload: AnalyticsPayload = {},
): Promise<void> {
  try {
    await sink.track(event, payload);
  } catch (error) {
    logger.warn("analytics.track_failed", { event, error });
  }
}
