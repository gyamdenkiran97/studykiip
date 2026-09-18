import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/server/auth/session";
import { getSearchInsights } from "@/server/analytics/reports";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Search insights", robots: { index: false, follow: false } };

export default async function SearchInsightsPage() {
  await requirePermission("dashboard:read");
  const { popular, empty } = await getSearchInsights(20);

  return (
    <>
      <PageHeader
        title="Search insights"
        description="What people look for, and — more usefully — what they look for and do not find."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Most searched" description="Searches that returned results.">
          {popular.length === 0 ? (
            <EmptyState title="No searches recorded yet" />
          ) : (
            <Table className="min-w-0">
              <thead>
                <tr>
                  <Th>Query</Th>
                  <Th align="right">Searches</Th>
                  <Th align="right">Results</Th>
                </tr>
              </thead>
              <tbody>
                {popular.map((row) => (
                  <tr key={row.query}>
                    <Td>
                      <Link href={`/search?q=${encodeURIComponent(row.query)}`} className="hover:underline">
                        {row.query}
                      </Link>
                    </Td>
                    <Td align="right" className="tabular">
                      {row.searches}
                    </Td>
                    <Td align="right" className="tabular text-muted">
                      {row.results}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Found nothing"
          description="Each of these is either a product you could stock or a synonym you could add."
        >
          {empty.length === 0 ? (
            <EmptyState title="Every search found something" />
          ) : (
            <Table className="min-w-0">
              <thead>
                <tr>
                  <Th>Query</Th>
                  <Th align="right">Searches</Th>
                </tr>
              </thead>
              <tbody>
                {empty.map((row) => (
                  <tr key={row.query}>
                    <Td className="text-danger">{row.query}</Td>
                    <Td align="right" className="tabular">
                      {row.searches}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
