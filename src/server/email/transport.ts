import "server-only";
import { Resend } from "resend";
import { env } from "../env";
import { logger } from "../logger";
import { prisma } from "../db";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  template: string;
};

export interface EmailTransport {
  readonly name: string;
  send(email: OutgoingEmail): Promise<{ id: string | null }>;
}

/** Development/CI transport: records the email, never sends it anywhere. */
class LogTransport implements EmailTransport {
  readonly name = "log";
  async send(email: OutgoingEmail) {
    logger.info("email.suppressed", { to: email.to, template: email.template, subject: email.subject });
    return { id: null };
  }
}

class ResendTransport implements EmailTransport {
  readonly name = "resend";
  private client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async send(email: OutgoingEmail) {
    const result = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data?.id ?? null };
  }
}

let cached: EmailTransport | null = null;

export function getEmailTransport(): EmailTransport {
  if (!cached) {
    cached = env.RESEND_API_KEY ? new ResendTransport(env.RESEND_API_KEY) : new LogTransport();
  }
  return cached;
}

/** For tests. */
export function setEmailTransport(transport: EmailTransport | null): void {
  cached = transport;
}

/**
 * Send and record. Delivery failures are logged and persisted but never thrown
 * into a checkout or signup path — an order must not fail because a mail
 * provider is having a bad day.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const transport = getEmailTransport();
  try {
    const { id } = await transport.send(email);
    await prisma.emailLog.create({
      data: { to: email.to, template: email.template, subject: email.subject, providerRef: id, status: "SENT" },
    });
  } catch (error) {
    logger.error("email.failed", { to: email.to, template: email.template, error });
    await prisma.emailLog
      .create({
        data: {
          to: email.to,
          template: email.template,
          subject: email.subject,
          status: "FAILED",
          error: error instanceof Error ? error.message : "unknown",
        },
      })
      .catch(() => undefined);
  }
}
