import { NewsletterForm } from "../newsletter-form";
import { Reveal } from "@/components/motion/reveal";

export function NewsletterSection({ title, subtitle }: { title: string | null; subtitle: string | null }) {
  return (
    <section className="border-t border-line bg-ink text-paper" aria-labelledby="newsletter-title">
      <div className="shell grid gap-8 py-16 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-20">
        <Reveal>
          <span className="eyebrow text-paper/50">Newsletter</span>
          <h2 id="newsletter-title" className="mt-4 text-display-3 text-balance">
            {title ?? "The Thursday letter"}
          </h2>
          {subtitle ? <p className="mt-4 max-w-md text-[15px] leading-relaxed text-paper/70">{subtitle}</p> : null}
        </Reveal>
        <Reveal delay={100} className="lg:justify-self-end lg:pl-10">
          <div className="max-w-sm [&_input]:text-paper [&_input]:placeholder:text-paper/40 [&_p]:text-paper/55 [&_svg]:text-paper">
            <div className="[&_div]:border-paper/30 [&_div]:focus-within:border-paper">
              <NewsletterForm />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
