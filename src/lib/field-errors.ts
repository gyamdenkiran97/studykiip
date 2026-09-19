/**
 * Per-field validation messages, as a form renders them.
 *
 * Deliberately here rather than in `server/errors.ts`: a client component that
 * imports from there drags Zod and the whole server error module into the
 * browser bundle for the sake of one object lookup.
 */

export type FieldErrors = Record<string, string>;

/** Pull per-field messages out of an action result, for a form to render. */
export function fieldErrorsOf(result: { details?: Record<string, unknown> }): FieldErrors {
  const raw = result.details?.fieldErrors;
  if (!raw || typeof raw !== "object") return {};
  return raw as FieldErrors;
}
