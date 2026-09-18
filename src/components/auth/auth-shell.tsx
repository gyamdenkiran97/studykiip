import Link from "next/link";

/** Shared frame for the authentication pages: narrow measure, generous space. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="shell flex justify-center py-14 lg:py-20">
      <div className="w-full max-w-[26rem]">
        <h1 className="text-display-3">{title}</h1>
        {subtitle ? <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-8 border-t border-line pt-6 text-[13.5px] text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
      {children}
    </Link>
  );
}
