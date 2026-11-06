import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import { formatDate, useWorkspace } from "@/lib/workspace";
import { isFileList, type FormValues } from "@/lib/form-schema";

export const Route = createFileRoute("/_authenticated/approved")({
  head: () => ({ meta: [{ title: "Approved vendors — TendToVend" }] }),
  component: ApprovedPage,
});

const s = (v: unknown) =>
  typeof v === "string"
    ? v
    : typeof v === "boolean"
      ? v
        ? "Yes"
        : "No"
      : Array.isArray(v) && !isFileList(v as never)
        ? (v as string[]).join("; ")
        : "";

/** Column layout for importing into accounting software (Zoho Books, Tally via Excel, etc.). */
const BOOKS_COLUMNS: [string, (p: FormValues, row: Row) => string][] = [
  ["Display Name", (p, r) => s(p["display_name"]) || r.vendor_name],
  ["Company Name", (p, r) => s(p["legal_business_name"]) || r.vendor_name],
  ["Trade Name", (p) => s(p["trade_name"])],
  ["Contact Name", (p) => s(p["primary_contact_person"])],
  ["Email", (p, r) => s(p["primary_contact_email"]) || r.vendor_email],
  ["Phone", (p) => s(p["primary_phone"])],
  ["Secondary Contact", (p) => s(p["secondary_contact_person"])],
  ["Secondary Email", (p) => s(p["secondary_contact_email"])],
  ["Invoice Email", (p) => s(p["default_invoice_email"])],
  ["Business Type", (p) => s(p["business_type"])],
  ["PAN", (p) => s(p["pan"])],
  ["GSTIN", (p) => s(p["gstin"])],
  ["GST Registration Type", (p) => s(p["gst_registration_type"])],
  ["Tax Preference", (p) => s(p["tax_preference"])],
  ["Billing Address", (p) => s(p["registered_address"])],
  ["Billing City", (p) => s(p["city"])],
  ["Billing State", (p) => s(p["state"])],
  ["Billing PIN Code", (p) => s(p["pin_code"])],
  ["Billing Country", (p) => s(p["country"]) || "India"],
  ["Bank Account Holder", (p) => s(p["account_holder_name"])],
  ["Bank Name", (p) => s(p["bank_name"])],
  ["Bank Account Number", (p) => s(p["account_number"])],
  ["IFSC", (p) => s(p["ifsc"])],
  ["Account Type", (p) => s(p["account_type"])],
  ["Website", (p) => s(p["website"])],
  ["Approved On", (_p, r) => r.approved_at.slice(0, 10)],
  ["TendToVend Reference", (_p, r) => r.reference ?? ""],
];

type Row = {
  id: string;
  vendor_name: string;
  vendor_email: string;
  approved_at: string;
  profile: FormValues;
  reference: string | undefined;
  invitation_id: string | null | undefined;
};

function toCsv(header: string[], rows: string[][]) {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [header, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ApprovedPage() {
  const { data: ws } = useWorkspace();
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["approved", ws?.org.id],
    enabled: Boolean(ws),
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("approved_vendors")
        .select(
          "id, vendor_name, vendor_email, approved_at, profile, submission:submissions(reference_number, invitation_id)",
        )
        .eq("organisation_id", ws!.org.id)
        .order("approved_at", { ascending: false });
      return (data ?? []).map((d) => {
        const sub = d.submission as unknown as {
          reference_number: string;
          invitation_id: string | null;
        } | null;
        return {
          id: d.id,
          vendor_name: d.vendor_name,
          vendor_email: d.vendor_email,
          approved_at: d.approved_at,
          profile: (d.profile ?? {}) as FormValues,
          reference: sub?.reference_number,
          invitation_id: sub?.invitation_id,
        };
      });
    },
  });

  const shown = rows.filter(
    (r) =>
      !q ||
      JSON.stringify([
        r.vendor_name,
        r.vendor_email,
        r.profile["gstin"],
        r.profile["pan"],
        r.profile["city"],
      ])
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const date = new Date().toISOString().slice(0, 10);

  function exportBooks() {
    downloadFile(
      `approved-vendors-books-${date}.csv`,
      toCsv(
        BOOKS_COLUMNS.map((c) => c[0]),
        shown.map((r) => BOOKS_COLUMNS.map(([, fn]) => fn(r.profile, r))),
      ),
    );
  }

  function exportAll() {
    const keys = Array.from(new Set(shown.flatMap((r) => Object.keys(r.profile)))).filter(
      (k) => !shown.some((r) => isFileList(r.profile[k])),
    );
    downloadFile(
      `approved-vendors-all-fields-${date}.csv`,
      toCsv(
        ["vendor_name", "vendor_email", "approved_at", "reference", ...keys],
        shown.map((r) => [
          r.vendor_name,
          r.vendor_email,
          r.approved_at,
          r.reference ?? "",
          ...keys.map((k) => s(r.profile[k])),
        ]),
      ),
    );
  }

  return (
    <div>
      <PageHeader
        title="Approved vendors"
        description="Your verified vendor database. Export it to load into your accounting software."
        actions={
          <>
            <Button variant="outline" onClick={exportAll} disabled={!shown.length}>
              <Download className="mr-1.5 h-4 w-4" /> All fields CSV
            </Button>
            <Button onClick={exportBooks} disabled={!shown.length} className="font-semibold">
              <Download className="mr-1.5 h-4 w-4" /> Books import CSV
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, GSTIN, PAN, city"
            className="pl-9"
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : !shown.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              {rows.length
                ? "No vendors match."
                : "No approved vendors yet. Approve a vendor from the Vendors page and they'll appear here."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">GSTIN</th>
                    <th className="hidden px-4 py-3 md:table-cell">PAN</th>
                    <th className="hidden px-4 py-3 lg:table-cell">City / State</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Bank</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Approved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        {r.invitation_id ? (
                          <Link
                            to="/vendors/$invitationId"
                            params={{ invitationId: r.invitation_id }}
                            className="font-medium hover:underline"
                          >
                            {s(r.profile["display_name"]) || r.vendor_name}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.vendor_name}</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {s(r.profile["primary_contact_email"]) || r.vendor_email}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {s(r.profile["gstin"]) || "—"}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">
                        {s(r.profile["pan"]) || "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {[s(r.profile["city"]), s(r.profile["state"])].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {s(r.profile["bank_name"])
                          ? `${s(r.profile["bank_name"])} · ${s(r.profile["ifsc"])}`
                          : "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                        {formatDate(r.approved_at)}
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
