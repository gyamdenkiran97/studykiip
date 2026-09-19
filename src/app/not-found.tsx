import Link from "next/link";

/** Root-level 404 for anything outside the storefront tree. */
export default function RootNotFound() {
  return (
    <html lang="en-GB">
      <body className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted uppercase">404</p>
          <h1 className="mt-4 font-display text-3xl">Page not found</h1>
          <p className="mt-3 text-sm text-muted">That address does not match anything here.</p>
          <Link
            href="/"
            className="mt-6 inline-block bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink-soft"
          >
            Back to Kwidus21
          </Link>
        </div>
      </body>
    </html>
  );
}
