"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { changePasswordAction, revokeOtherSessionsAction, updateProfileAction } from "@/server/actions/account";

/** Profile details, password change and session management. */
export function ProfileForms({
  name,
  email,
  phone,
  marketingOptIn,
  emailVerified,
  memberSince,
  activeSessions,
}: {
  name: string;
  email: string;
  phone: string | null;
  marketingOptIn: boolean;
  emailVerified: boolean;
  memberSince: string;
  activeSessions: number;
}) {
  const router = useRouter();
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  return (
    <div className="mt-8 max-w-xl space-y-12">
      <section aria-labelledby="details">
        <h2 id="details" className="font-display text-lg">
          Your details
        </h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setSavingProfile(true);
            const result = await updateProfileAction({
              name: String(formData.get("name") ?? ""),
              phone: String(formData.get("phone") ?? ""),
              marketingOptIn: formData.get("marketingOptIn") === "on",
            });
            setSavingProfile(false);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success("Profile updated");
            router.refresh();
          }}
        >
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" defaultValue={name} required minLength={2} maxLength={120} />
          </Field>

          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-ink-soft">
              Email address
            </label>
            <div className="mt-1.5 flex items-center gap-3">
              <Input id="email" value={email} readOnly disabled className="flex-1" />
              {emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="low">Unverified</Badge>}
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Contact support to change the address on an account with orders.
            </p>
          </div>

          <Field label="Phone (for delivery updates)" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} maxLength={32} />
          </Field>

          <label className="flex items-start gap-2.5 text-[13.5px] text-ink-soft">
            <input
              type="checkbox"
              name="marketingOptIn"
              defaultChecked={marketingOptIn}
              className="mt-0.5 h-4 w-4 shrink-0 appearance-none border border-line-strong bg-surface checked:border-ink checked:bg-ink"
            />
            Send me the Thursday letter — one email a week, unsubscribe in one click.
          </label>

          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </section>

      <section aria-labelledby="password">
        <h2 id="password" className="font-display text-lg">
          Password
        </h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPasswordError(null);
            const form = event.currentTarget;
            const formData = new FormData(form);
            const next = String(formData.get("newPassword") ?? "");
            const confirm = String(formData.get("confirmPassword") ?? "");

            if (next !== confirm) {
              setPasswordError("Those passwords do not match.");
              return;
            }

            setSavingPassword(true);
            const result = await changePasswordAction({
              currentPassword: String(formData.get("currentPassword") ?? ""),
              newPassword: next,
            });
            setSavingPassword(false);

            if (!result.ok) {
              setPasswordError(result.message);
              return;
            }
            form.reset();
            toast.success("Password changed. Other devices have been signed out.");
          }}
        >
          <Field label="Current password" htmlFor="currentPassword">
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" htmlFor="newPassword" hint="At least 10 characters.">
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword">
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          {passwordError ? (
            <p role="alert" className="text-[13px] text-danger">
              {passwordError}
            </p>
          ) : null}
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating…" : "Change password"}
          </Button>
        </form>
      </section>

      <section aria-labelledby="sessions">
        <h2 id="sessions" className="font-display text-lg">
          Signed-in devices
        </h2>
        <p className="mt-2 text-[13.5px] text-muted">
          {activeSessions} active {activeSessions === 1 ? "session" : "sessions"}. Member since{" "}
          {new Date(memberSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={async () => {
            const result = await revokeOtherSessionsAction();
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(
              result.data.revoked === 0
                ? "No other sessions were active."
                : `Signed out of ${result.data.revoked} other ${result.data.revoked === 1 ? "device" : "devices"}.`,
            );
            router.refresh();
          }}
        >
          Sign out of other devices
        </Button>
      </section>
    </div>
  );
}
