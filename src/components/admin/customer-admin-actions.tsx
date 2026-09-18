"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ROLE_LABELS, USER_ROLES, type Role } from "@/server/auth/permissions";
import { updateCustomerAction, updateUserRoleAction } from "@/server/actions/admin/moderation";

/** Account status, internal notes and (for super administrators) role changes. */
export function CustomerAdminActions({
  userId,
  status,
  role,
  adminNotes,
  canChangeRole,
}: {
  userId: string;
  status: string;
  role: Role;
  adminNotes: string | null;
  canChangeRole: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(
    operation: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) {
    setPending(true);
    const result = await operation();
    setPending(false);
    if (!result.ok) {
      toast.error(result.message ?? "That did not work.");
      return;
    }
    toast.success(success);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Panel title="Account">
        <form
          className="space-y-3 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void run(
              () =>
                updateCustomerAction({
                  userId,
                  status: String(formData.get("status")),
                  adminNotes: String(formData.get("adminNotes") ?? ""),
                }),
              "Account updated",
            );
          }}
        >
          <Field label="Status" htmlFor="status" hint="Suspending an account ends its sessions immediately.">
            <Select id="status" name="status" defaultValue={status}>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
            </Select>
          </Field>

          <Field label="Internal notes" htmlFor="adminNotes" hint="Never shown to the customer.">
            <Textarea id="adminNotes" name="adminNotes" rows={4} defaultValue={adminNotes ?? ""} maxLength={2000} />
          </Field>

          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
        </form>
      </Panel>

      {canChangeRole ? (
        <Panel title="Role" description="Changing a role signs that account out everywhere.">
          <form
            className="space-y-3 px-5 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void run(
                () => updateUserRoleAction({ userId, role: String(formData.get("role")) }),
                "Role updated",
              );
            }}
          >
            <Field label="Role" htmlFor="role">
              <Select id="role" name="role" defaultValue={role}>
                {USER_ROLES.map((entry) => (
                  <option key={entry} value={entry}>
                    {ROLE_LABELS[entry]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Change role
            </Button>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}
