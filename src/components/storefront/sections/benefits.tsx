import { Reveal } from "@/components/motion/reveal";

/** Service promises as a hairline-divided row, not a set of icon cards. */
export function Benefits({
  title,
  items,
}: {
  title: string | null;
  items: Array<{ title: string; body: string }>;
}) {
  if (items.length === 0) return null;

  return (
    <section className="border-t border-line" aria-label={title ?? "Our promises"}>
      <div className="shell grid sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <Reveal
            key={item.title}
            delay={index * 60}
            className="border-line py-10 not-first:border-t sm:px-6 sm:not-first:border-t-0 sm:[&:nth-child(n+3)]:border-t sm:[&:nth-child(odd)]:border-l-0 sm:[&:nth-child(even)]:border-l lg:border-t-0 lg:border-l lg:first:border-l-0 lg:[&:nth-child(n+3)]:border-t-0 lg:[&:nth-child(odd)]:border-l lg:[&:nth-child(1)]:border-l-0 lg:[&>div]:pl-0 lg:not-first:[&>div]:pl-6"
          >
            <p className="tabular text-[11px] text-muted-soft">{String(index + 1).padStart(2, "0")}</p>
            <h3 className="mt-3 font-display text-lg leading-tight">{item.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{item.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
