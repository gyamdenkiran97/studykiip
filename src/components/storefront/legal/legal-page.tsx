import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Shared frame for policy and information pages.
 *
 * `requiresReview` renders a visible, non-dismissable notice. These templates
 * are a starting point written to be readable, not legal advice — the real
 * business must have them reviewed before launch, and saying so in the page
 * itself is more honest than a line in a README nobody reads.
 */
export function LegalPage({
  title,
  updated,
  intro,
  requiresReview = true,
  children,
}: {
  title: string;
  updated?: string;
  intro?: string;
  requiresReview?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="shell py-12 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-display-2">{title}</h1>
        {updated ? (
          <p className="mt-3 text-[13px] text-muted">
            Last updated <time dateTime={updated}>{new Date(updated).toLocaleDateString("en-GB", { dateStyle: "long" })}</time>
          </p>
        ) : null}
        {intro ? <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">{intro}</p> : null}

        {requiresReview ? (
          <aside
            role="note"
            className="mt-8 flex gap-3 border border-warning/30 bg-warning/[0.06] px-4 py-3.5 text-[13px] leading-relaxed"
          >
            <AlertTriangle size={17} strokeWidth={1.6} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              <strong className="font-semibold">Template pending legal review.</strong> This wording is a
              readable starting point for a demonstration store. It is not legal advice and must be reviewed
              and adapted by a qualified adviser — with the real trading entity, jurisdiction and terms — before
              this store sells anything.
            </p>
          </aside>
        ) : null}

        <div className="legal-prose mt-10">{children}</div>

        <p className="mt-14 border-t border-line pt-6 text-[13px] text-muted">
          Questions about this page?{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-ink">
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
