import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { isStaffRole } from "@/server/auth/permissions";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?next=/account");

  return (
    <div className="shell py-10 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-16">
        <div>
          <p className="eyebrow">Account</p>
          <p className="mt-2 font-display text-xl">{actor.name}</p>
          <p className="mt-0.5 text-[13px] text-muted">{actor.email}</p>
          <AccountNav isStaff={isStaffRole(actor.role)} />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
