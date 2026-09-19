"use client";

/** Last-resort boundary: the root layout itself failed, so this ships its own html. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#FBF9F5",
          color: "#14120F",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Kwidus21 is temporarily unavailable</h1>
          <p style={{ marginTop: "0.75rem", color: "#6F6759" }}>
            Something failed while loading the page. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#14120F",
              color: "#FBF9F5",
              border: 0,
              padding: "0.8rem 1.25rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontFamily: "monospace", fontSize: "0.7rem", color: "#938A79" }}>
              Reference {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
