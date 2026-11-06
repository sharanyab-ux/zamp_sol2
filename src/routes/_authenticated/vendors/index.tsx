import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, useWorkspace } from "@/lib/workspace";
import { vendorStatus, type InvitationStatus, type SubmissionStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vendors/")({
  head: () => ({ meta: [{ title: "Vendors — TendToVend" }] }),
  component: VendorsPage,
});

const FILTERS = [
  "All",
  "Invited",
  "Opened",
  "Waiting on vendor",
  "Ready for approval",
  "Approved",
  "Rejected",
] as const;

function VendorsPage() {
  const { data: ws } = useWorkspace();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", ws?.org.id],
    enabled: Boolean(ws),
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("invitations")
        .select(
          "id, vendor_name, vendor_email, status, expires_at, created_at, updated_at, form:forms(name), submissions(status, reference_number, updated_at)",
        )
        .eq("organisation_id", ws!.org.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const rows = useMemo(
    () =>
      (data ?? []).map((i) => {
        const sub =
          (
            i.submissions as unknown as
              { status: SubmissionStatus; reference_number: string; updated_at: string }[] | null
          )?.[0] ?? null;
        return {
          ...i,
          sub,
          view: vendorStatus(
            { status: i.status as InvitationStatus, expires_at: i.expires_at },
            sub,
          ),
        };
      }),
    [data],
  );

  const shown = rows.filter(
    (r) =>
      (filter === "All" || r.view.label === filter) &&
      (!q ||
        `${r.vendor_name} ${r.vendor_email} ${r.sub?.reference_number ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Every vendor you've invited, and exactly where they are. Updates automatically."
        actions={
          <Button asChild className="font-semibold">
            <Link to="/forms">Invite vendors</Link>
          </Button>
        }
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const n = f === "All" ? rows.length : rows.filter((r) => r.view.label === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    filter === f
                      ? "border-navy bg-navy text-white"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, reference"
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : !shown.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {rows.length
                ? "No vendors match."
                : "No vendors yet. Publish a form and invite your first vendor."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="hidden px-4 py-3 md:table-cell">Form</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Reference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Next step</th>
                    <th className="hidden px-4 py-3 md:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link
                          to="/vendors/$invitationId"
                          params={{ invitationId: r.id }}
                          className="font-medium hover:underline"
                        >
                          {r.vendor_name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.vendor_email}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {(r.form as { name: string } | null)?.name}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs sm:table-cell">
                        {r.sub?.reference_number ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={r.view.label} tone={r.view.tone} />
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                        {r.view.companyHint}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                        {formatDate(r.sub?.updated_at ?? r.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
