import "server-only";

/**
 * Structured JSON logging. Keys listed in REDACT are replaced before output so
 * that a careless call site cannot leak a password, token or card detail into
 * the log stream.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "clientsecret",
  "client_secret",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "cardnumber",
  "card_number",
  "cvc",
  "cvv",
  "iban",
  "stripesecretkey",
]);

const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level | undefined) ?? "info";

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth-limit]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACT.has(key.toLowerCase()) ? "[redacted]" : redact(item, depth + 1);
  }
  return output;
}

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
  /** Escape hatch for tests that need to assert on redaction. */
  _redact: redact,
};
