"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddressForm, COUNTRIES, type AddressView } from "@/components/checkout/address-form";
import { deleteAddressAction } from "@/server/actions/account";

export function AddressBook({ addresses }: { addresses: AddressView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressView | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  async function remove(id: string) {
    const result = await deleteAddressAction({ id });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Address removed");
    setConfirmingDelete(null);
    router.refresh();
  }

  if (adding || editing) {
    return (
      <div className="mt-8 max-w-xl border border-line p-6">
        <h2 className="font-display text-lg">{editing ? "Edit address" : "Add an address"}</h2>
        <div className="mt-5">
          <AddressForm
            address={editing}
            type={editing?.type ?? "SHIPPING"}
            onSaved={() => {
              setAdding(false);
              setEditing(null);
              toast.success("Address saved");
              router.refresh();
            }}
            onCancel={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {addresses.length === 0 ? (
        <div className="border border-line p-10 text-center">
          <p className="font-display text-lg">No addresses saved</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add one now, or save it when you next check out.
          </p>
          <Button className="mt-5" onClick={() => setAdding(true)}>
            <Plus size={16} strokeWidth={1.8} />
            Add an address
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <li key={address.id} className="border border-line p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-medium">{address.fullName}</p>
                  {address.isDefault ? <Badge tone="quiet">Default</Badge> : null}
                </div>
                <address className="mt-2 text-[13.5px] leading-relaxed text-muted not-italic">
                  {[address.line1, address.line2, address.city, address.region, address.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                  <br />
                  {COUNTRIES.find((country) => country.code === address.countryCode)?.name ?? address.countryCode}
                  {address.phone ? (
                    <>
                      <br />
                      {address.phone}
                    </>
                  ) : null}
                </address>

                {confirmingDelete === address.id ? (
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" variant="danger" onClick={() => remove(address.id)}>
                      Confirm removal
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(address)}
                      className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
                    >
                      <Pencil size={14} strokeWidth={1.6} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(address.id)}
                      className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-danger"
                    >
                      <Trash2 size={14} strokeWidth={1.6} />
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <Button className="mt-6" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} strokeWidth={1.8} />
            Add another address
          </Button>
        </>
      )}
    </div>
  );
}
