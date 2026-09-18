import type { Metadata } from "next";
import { requirePermission } from "@/server/auth/session";
import { listAudit } from "@/server/audit";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Audit log", robots: { index: false, follow: false } };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  await requirePermission("audit:read");
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const entries = await listAudit({ take: 100, skip: (page - 1) * 100, entityType: params.entity });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who changed what, when, and from where. Metadata is scrubbed of secrets before it is written."
      />

      <Panel>
        {entries.length === 0 ? (
          <EmptyState title="Nothing recorded yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Details</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td className="tabular whitespace-nowrap text-[12px] text-muted">
                    {entry.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </Td>
                  <Td className="text-[12.5px]">
                    {entry.actor?.name ?? "System"}
                    <span className="block text-[11px] text-muted">{entry.actorEmail ?? ""}</span>
                  </Td>
                  <Td className="font-mono text-[11.5px]">{entry.action}</Td>
                  <Td className="text-[12px] text-muted">
                    {entry.entityType}
                    {entry.entityId ? (
                      <span className="block max-w-[10rem] truncate font-mono text-[10.5px]">{entry.entityId}</span>
                    ) : null}
                  </Td>
                  <Td className="max-w-[18rem] truncate font-mono text-[11px] text-muted">
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </Td>
                  <Td className="font-mono text-[11px] text-muted">{entry.ipAddress ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
