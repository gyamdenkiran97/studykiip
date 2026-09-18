import type { Metadata } from "next";
import Link from "next/link";
import { getCategoryTree } from "@/server/catalog/queries";
import { ProductImage } from "@/components/ui/product-image";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Why Kiip Mall exists, how we choose what to sell, and what we will not do.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const tree = await getCategoryTree();
  const featured = tree.filter((department) => department.isFeatured).slice(0, 3);

  return (
    <div className="pb-8">
      <section className="shell pt-14 pb-16 lg:pt-20">
        <div className="max-w-3xl">
          <p className="eyebrow text-clay">About</p>
          <h1 className="mt-5 text-display-1 text-balance">Things worth keeping</h1>
          <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-soft">
            Kiip is a department store organised around a single question: will this still be in use in five
            years? It is a harder test than it sounds, and it rules out most of what a shop like this could
            stock.
          </p>
        </div>
      </section>

      <section className="border-y border-line bg-paper-deep py-16 lg:py-20">
        <div className="shell grid gap-12 lg:grid-cols-3">
          {[
            {
              title: "We buy from workshops we can name",
              body: "Every brand here has a person we can call. Where something is made, and by whom, is on the product page rather than buried in a certification badge.",
            },
            {
              title: "Fewer products, chosen properly",
              body: "Eleven departments, not eleven thousand lines. If two products do the same job, we stock the better one rather than both and a filter.",
            },
            {
              title: "The price is the price",
              body: "No countdown timers, no invented was-prices, no urgency banners. When something is reduced it is because we reduced it, and the original price is what it actually sold for.",
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={index * 80}>
              <p className="tabular text-[11px] text-muted-soft">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-3 font-display text-xl leading-tight">{item.title}</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="shell py-16 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-display-3">How the store works</h2>
          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-soft">
            <p>
              Stock is real. When a product page says four left, four is what is on the shelf minus what is
              already promised to other people's open orders. Nothing is oversold while you are typing your
              address.
            </p>
            <p>
              Returns are thirty days and the form is three clicks from the order. We would rather you sent
              something back than kept a thing you do not use.
            </p>
            <p>
              Reviews are moderated before they appear, and verified-purchase status is worked out from
              delivered orders rather than claimed by the reviewer.
            </p>
          </div>
          <Button asChild className="mt-8">
            <Link href="/shop">Browse the mall</Link>
          </Button>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="shell pb-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {featured.map((department) => (
              <Link key={department.slug} href={`/category/${department.slug}`} className="group block">
                <div className="relative aspect-4/3 overflow-hidden bg-paper-deep">
                  <ProductImage
                    src={department.imageUrl}
                    alt={department.imageAlt ?? ""}
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                </div>
                <h3 className="mt-3 font-display text-lg">{department.name}</h3>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="shell pb-16">
        <div className="max-w-2xl border-t border-line pt-8 text-[13px] leading-relaxed text-muted">
          <p>
            Kiip Mall is a demonstration store. The brands, products and company details on this site are
            invented for the purpose of showing the software, and the imagery is generated artwork rather than
            product photography.
          </p>
        </div>
      </section>
    </div>
  );
}
