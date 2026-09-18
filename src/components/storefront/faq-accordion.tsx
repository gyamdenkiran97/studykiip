"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";

/** FAQ list. Radix handles the ARIA wiring; the plus rotates into a minus. */
export function FaqAccordion({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <Accordion.Root type="multiple" className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <Accordion.Item key={item.question} value={item.question}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-start justify-between gap-6 py-4 text-left">
              <span className="text-[15px] font-medium">{item.question}</span>
              <Plus
                size={17}
                strokeWidth={1.6}
                className="mt-0.5 shrink-0 text-muted transition-transform duration-300 group-data-[state=open]:rotate-45"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[fade-out_140ms_ease-in] data-[state=open]:animate-[fade-in_220ms_ease-out]">
            <p className="max-w-xl pr-10 pb-5 text-[14.5px] leading-relaxed text-muted">{item.answer}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
