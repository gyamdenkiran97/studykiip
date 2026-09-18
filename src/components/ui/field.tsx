"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";

/**
 * Form field primitives. Errors are associated with their input through
 * aria-describedby and announced politely, so a screen reader hears the message
 * rather than just a red border.
 */

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("block text-[13px] font-medium text-ink-soft", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xs border border-line-strong bg-surface px-3.5 text-sm text-ink",
        "placeholder:text-muted-soft focus:border-ink focus:outline-none",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xs border border-line-strong bg-surface px-3.5 py-3 text-sm text-ink",
        "placeholder:text-muted-soft focus:border-ink focus:outline-none aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-xs border border-line-strong bg-surface px-3.5 pr-9 text-sm text-ink",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22none%22 stroke=%22%236F6759%22 stroke-width=%221.5%22><path d=%22M6 8l4 4 4-4%22/></svg>')] bg-[length:18px] bg-[right_0.6rem_center] bg-no-repeat",
        "focus:border-ink focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] text-danger">
      {children}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-[12px] text-muted">{hint}</p> : null}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
    </div>
  );
}
