import Link from "next/link";
import { prisma } from "@/server/db";
import { getCategoryTree } from "@/server/catalog/queries";
import { NewsletterForm } from "./newsletter-form";

/**
 * Footer. A directory rather than a link dump: departments on the left,
 * customer care and company in the middle, and the newsletter given room to
 * breathe on the right.
 */
export async function Footer() {
  const [tree, store] = await Promise.all([
    getCategoryTree(),
    prisma.siteSetting.findUnique({ where: { key: "store" } }),
  ]);

  const storeInfo = (store?.value ?? {}) as {
    name?: string;
    supportEmail?: string;
    addressLines?: string[];
  };

  return (
    <footer className="mt-24 border-t border-line bg-paper-deep">
      <div className="shell py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <p className="font-display text-2xl leading-none font-semibold tracking-[-0.04em]">Kiip</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              A department store for things worth keeping. Eleven floors, one basket, and a returns
              policy written in plain English.
            </p>
            {storeInfo.addressLines ? (
              <address className="mt-5 text-[13px] leading-relaxed text-muted not-italic">
                {storeInfo.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : null}
          </div>

          <FooterColumn title="Departments">
            {tree.slice(0, 7).map((department) => (
              <FooterLink key={department.slug} href={`/category/${department.slug}`}>
                {department.name}
              </FooterLink>
            ))}
            <FooterLink href="/shop">Everything</FooterLink>
          </FooterColumn>

          <FooterColumn title="Customer care">
            <FooterLink href="/contact">Contact us</FooterLink>
            <FooterLink href="/faq">Frequently asked</FooterLink>
            <FooterLink href="/shipping">Delivery</FooterLink>
            <FooterLink href="/returns">Returns &amp; refunds</FooterLink>
            <FooterLink href="/account/orders">Track an order</FooterLink>
            <FooterLink href="/about">About Kiip</FooterLink>
          </FooterColumn>

          <div>
            <h2 className="eyebrow mb-4">The Thursday letter</h2>
            <p className="mb-4 text-sm text-muted">
              One email a week: what arrived, what is leaving, and the occasional workshop visit.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line-strong pt-6 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {storeInfo.name ?? "Kiip Mall"}. A demonstration store — company
            details are placeholders.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/returns" className="hover:text-ink">
              Refunds
            </Link>
            <Link href="/shipping" className="hover:text-ink">
              Shipping
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="eyebrow mb-4">{title}</h2>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-[14px] text-ink-soft transition-colors hover:text-ink">
        {children}
      </Link>
    </li>
  );
}
