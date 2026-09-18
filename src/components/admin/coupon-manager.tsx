"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, parseMoneyInput, toMoneyInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel, Table, Td, Th } from "./ui";
import { saveCouponAction, toggleCouponAction } from "@/server/actions/admin/marketing";

type CouponRow = {
  id: string;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  discountValue: number;
  minSubtotalCents: number | null;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  timesUsed: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  redemptions: number;
  scope: string;
  targetId: string;
};

/**
 * Coupon management.
 *
 * Percentages are entered as whole percents and stored as basis points; fixed
 * amounts are entered in pounds and stored in pence. The conversion happens
 * once, here, and the server validates the result again.
 */
export function CouponManager({
  coupons,
  categories,
  brands,
}: {
  coupons: CouponRow[];
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [discountType, setDiscountType] = useState<CouponRow["discountType"]>("PERCENTAGE");
  const [scope, setScope] = useState("");

  function startEdit(coupon: CouponRow) {
    setDiscountType(coupon.discountType);
    setScope(coupon.scope);
    setEditing(coupon);
  }

  function startCreate() {
    setDiscountType("PERCENTAGE");
    setScope("");
    setCreating(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawValue = String(formData.get("discountValue") ?? "0");

    // Percent → basis points; pounds → pence; free shipping carries no value.
    const discountValue =
      discountType === "PERCENTAGE"
        ? Math.round(Number(rawValue) * 100)
        : discountType === "FIXED_AMOUNT"
          ? (parseMoneyInput(rawValue) ?? 0)
          : 0;

    const minSubtotal = String(formData.get("minSubtotal") ?? "");
    const maxDiscount = String(formData.get("maxDiscount") ?? "");

    setPending(true);
    const result = await saveCouponAction({
      id: editing?.id,
      code: String(formData.get("code") ?? ""),
      description: String(formData.get("description") ?? ""),
      discountType,
      discountValue,
      minSubtotalCents: minSubtotal ? parseMoneyInput(minSubtotal) : null,
      maxDiscountCents: maxDiscount ? parseMoneyInput(maxDiscount) : null,
      usageLimit: formData.get("usageLimit") ? Number(formData.get("usageLimit")) : null,
      usageLimitPerUser: formData.get("usageLimitPerUser") ? Number(formData.get("usageLimitPerUser")) : null,
      startsAt: String(formData.get("startsAt") ?? ""),
      endsAt: String(formData.get("endsAt") ?? ""),
      isActive: formData.get("isActive") === "on",
      scope,
      targetId: String(formData.get("targetId") ?? ""),
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Coupon saved");
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  function describe(coupon: CouponRow): string {
    if (coupon.discountType === "PERCENTAGE") return `${(coupon.discountValue / 100).toFixed(0)}% off`;
    if (coupon.discountType === "FIXED_AMOUNT") return `${formatMoney(coupon.discountValue)} off`;
    return "Free delivery";
  }

  if (editing || creating) {
    const dateValue = (value: string | null) => (value ? value.slice(0, 10) : "");

    return (
      <Panel title={editing ? `Edit ${editing.code}` : "New coupon"}>
        <form onSubmit={save} className="grid max-w-3xl gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Code" htmlFor="code" hint="Shown to customers exactly as typed, in capitals.">
            <Input id="code" name="code" required defaultValue={editing?.code} maxLength={40} className="uppercase" />
          </Field>

          <Field label="Type" htmlFor="discountType">
            <Select
              id="discountType"
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as CouponRow["discountType"])}
            >
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED_AMOUNT">Fixed amount off</option>
              <option value="FREE_SHIPPING">Free delivery</option>
            </Select>
          </Field>

          {discountType !== "FREE_SHIPPING" ? (
            <Field
              label={discountType === "PERCENTAGE" ? "Percent off" : "Amount off (£)"}
              htmlFor="discountValue"
            >
              <Input
                id="discountValue"
                name="discountValue"
                inputMode="decimal"
                required
                defaultValue={
                  editing
                    ? editing.discountType === "PERCENTAGE"
                      ? String(editing.discountValue / 100)
                      : toMoneyInput(editing.discountValue)
                    : ""
                }
              />
            </Field>
          ) : (
            <div />
          )}

          <Field label="Description" htmlFor="description">
            <Input id="description" name="description" defaultValue={editing?.description} maxLength={200} />
          </Field>

          <Field label="Minimum spend (£)" htmlFor="minSubtotal" hint="Blank for no minimum.">
            <Input
              id="minSubtotal"
              name="minSubtotal"
              inputMode="decimal"
              defaultValue={editing?.minSubtotalCents ? toMoneyInput(editing.minSubtotalCents) : ""}
            />
          </Field>

          <Field label="Maximum discount (£)" htmlFor="maxDiscount" hint="Caps a percentage discount.">
            <Input
              id="maxDiscount"
              name="maxDiscount"
              inputMode="decimal"
              defaultValue={editing?.maxDiscountCents ? toMoneyInput(editing.maxDiscountCents) : ""}
            />
          </Field>

          <Field label="Total uses" htmlFor="usageLimit" hint="Blank for unlimited.">
            <Input
              id="usageLimit"
              name="usageLimit"
              inputMode="numeric"
              defaultValue={editing?.usageLimit ?? ""}
            />
          </Field>

          <Field label="Uses per customer" htmlFor="usageLimitPerUser">
            <Input
              id="usageLimitPerUser"
              name="usageLimitPerUser"
              inputMode="numeric"
              defaultValue={editing?.usageLimitPerUser ?? ""}
            />
          </Field>

          <Field label="Starts" htmlFor="startsAt">
            <Input id="startsAt" name="startsAt" type="date" defaultValue={dateValue(editing?.startsAt ?? null)} />
          </Field>

          <Field label="Ends" htmlFor="endsAt">
            <Input id="endsAt" name="endsAt" type="date" defaultValue={dateValue(editing?.endsAt ?? null)} />
          </Field>

          <Field label="Restrict to" htmlFor="scope">
            <Select id="scope" value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="">Everything</option>
              <option value="CATEGORY">A category</option>
              <option value="BRAND">A brand</option>
            </Select>
          </Field>

          {scope ? (
            <Field label={scope === "CATEGORY" ? "Category" : "Brand"} htmlFor="targetId">
              <Select id="targetId" name="targetId" defaultValue={editing?.targetId}>
                <option value="">Choose one</option>
                {(scope === "CATEGORY" ? categories : brands).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div />
          )}

          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing?.isActive ?? true}
              className="h-4 w-4 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
            />
            Active
          </label>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save coupon"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Panel>
    );
  }

  return (
    <Panel
      title={`${coupons.length} coupons`}
      actions={
        <Button size="sm" variant="outline" onClick={startCreate}>
          <Plus size={14} strokeWidth={2} />
          New coupon
        </Button>
      }
    >
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Discount</Th>
            <Th>Conditions</Th>
            <Th align="center">Used</Th>
            <Th>Window</Th>
            <Th>Status</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id} className="hover:bg-paper-deep">
              <Td>
                <span className="font-mono text-[12.5px] font-medium">{coupon.code}</span>
                {coupon.description ? (
                  <span className="block text-[11.5px] text-muted">{coupon.description}</span>
                ) : null}
              </Td>
              <Td className="text-[12.5px]">{describe(coupon)}</Td>
              <Td className="text-[11.5px] text-muted">
                {coupon.minSubtotalCents ? `Min ${formatMoney(coupon.minSubtotalCents)}` : "No minimum"}
                {coupon.maxDiscountCents ? ` · Max ${formatMoney(coupon.maxDiscountCents)}` : ""}
                {coupon.scope ? ` · ${coupon.scope.toLowerCase()} only` : ""}
              </Td>
              <Td align="center" className="tabular">
                {coupon.timesUsed}
                {coupon.usageLimit ? <span className="text-muted">/{coupon.usageLimit}</span> : null}
              </Td>
              <Td className="tabular text-[11.5px] text-muted">
                {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString("en-GB") : "—"} →{" "}
                {coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString("en-GB") : "—"}
              </Td>
              <Td>
                <Badge tone={coupon.isActive ? "success" : "out"}>{coupon.isActive ? "active" : "paused"}</Badge>
              </Td>
              <Td align="right">
                <span className="flex justify-end gap-3 text-[12px]">
                  <button type="button" className="text-muted hover:text-ink" onClick={() => startEdit(coupon)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-muted hover:text-ink"
                    onClick={async () => {
                      const result = await toggleCouponAction({ couponId: coupon.id, isActive: !coupon.isActive });
                      if (!result.ok) {
                        toast.error(result.message);
                        return;
                      }
                      toast.success(coupon.isActive ? "Coupon paused" : "Coupon activated");
                      router.refresh();
                    }}
                  >
                    {coupon.isActive ? "Pause" : "Activate"}
                  </button>
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}
