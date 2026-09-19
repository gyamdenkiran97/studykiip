import { ZodError } from "zod";

/**
 * Application error taxonomy. Every thrown AppError carries a stable code that
 * the UI can translate; `message` is safe to show to an end user.
 * Internal detail belongs in `cause`, which is logged but never serialised
 * to the client.
 */

export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "INVALID_TRANSITION"
  | "PAYMENT_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  INVALID_TRANSITION: 409,
  PAYMENT_FAILED: 402,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options?.details;
  }
}

export const validationError = (message: string, details?: Record<string, unknown>) =>
  new AppError("VALIDATION", message, { details });
export const unauthenticated = (message = "Please sign in to continue.") =>
  new AppError("UNAUTHENTICATED", message);
export const forbidden = (message = "You do not have access to this resource.") =>
  new AppError("FORBIDDEN", message);
export const notFound = (message = "Not found.") => new AppError("NOT_FOUND", message);
export const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppError("CONFLICT", message, { details });
export const outOfStock = (message: string, details?: Record<string, unknown>) =>
  new AppError("OUT_OF_STOCK", message, { details });
export const rateLimited = (message = "Too many requests. Please try again shortly.") =>
  new AppError("RATE_LIMITED", message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Shape returned to clients: never leaks stack traces or internal causes. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string; details?: Record<string, unknown> };

export function toActionError(error: unknown): ActionResult<never> {
  if (isAppError(error)) {
    return { ok: false, code: error.code, message: error.message, details: error.details };
  }

  /**
   * A schema rejection is the customer's input being wrong, not the server
   * being broken, and it must not be reported as "something went wrong" — that
   * tells someone with a mistyped postcode to retry an action that will fail
   * identically every time.
   *
   * The issues are flattened to one message per field so a form can put each
   * one beside the input it belongs to. Only the first issue per field is kept:
   * three complaints about the same box is noise, not help.
   */
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".");
      if (field && !(field in fieldErrors)) fieldErrors[field] = issue.message;
    }
    const count = Object.keys(fieldErrors).length;
    return {
      ok: false,
      code: "VALIDATION",
      message:
        count === 1
          ? "Please correct the highlighted field."
          : "Please correct the highlighted fields.",
      details: { fieldErrors },
    };
  }

  return {
    ok: false,
    code: "INTERNAL",
    message: "Something went wrong. Please try again.",
  };
}

