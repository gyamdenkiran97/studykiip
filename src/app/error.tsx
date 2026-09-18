"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Shows a recoverable message and the digest — enough for support to find the
 * matching server log — while the actual error detail stays on the server.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side visibility only; the server already logged the real cause.
    console.error("Route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="shell grid min-h-[60dvh] place-items-center py-20 text-center">
      <div>
        <p className="eyebrow text-clay">Something went wrong</p>
        <h1 className="mt-5 font-display text-3xl">We could not load that</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
          The problem has been logged. Trying again often works; if it does not, our support team can look it
          up with the reference below.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink-soft"
          >
            Try again
          </button>
          <a
            href="/contact"
            className="border border-ink/25 px-5 py-3 text-sm font-medium hover:border-ink"
          >
            Contact support
          </a>
        </div>
        {error.digest ? (
          <p className="mt-6 font-mono text-[11px] text-muted-soft">Reference {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
