import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { hasPermission, permissionsForRole } from "@/server/auth/permissions";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Admin gate.
 *
 * This layout blocks the whole /admin tree, but it is not the security
 * boundary on its own: every admin server action and query re-checks the
 * required permission. Hiding a link is presentation, not authorisation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  if (!actor) redirect("/sign-in?next=/admin");
  if (!hasPermission(actor.role, "admin:access", actor.grants)) {
    // Deliberately a 404-style dead end rather than a "you lack permission"
    // page: a customer probing /admin learns nothing about what exists.
    redirect("/");
  }

  const granted = new Set<string>([...permissionsForRole(actor.role), ...actor.grants]);

  return (
    <AdminShell
      actor={{ name: actor.name, email: actor.email, role: actor.role }}
      permissions={[...granted]}
    >
      {children}
    </AdminShell>
  );
}
