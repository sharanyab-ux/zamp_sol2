import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckBadge, StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { canEdit, formatDate, useWorkspace } from "@/lib/workspace";
import {
  TIMELINE_LABELS,
  vendorStatus,
  type InvitationStatus,
  type SubmissionStatus,
} from "@/lib/status";
import { displayValue, isFileList, type FormSnapshot, type FormValues } from "@/lib/form-schema";
import { decideSubmission, requestChanges, rerunVerification } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vendors/$invitationId")({
  head: () => ({ meta: [{ title: "Vendor — TendToVend" }] }),
  component: VendorDetailPage,
});

const RESULT_ORDER: Record<string, number> = {
  fail: 0,
  warning: 1,
  not_verified: 2,
  manual_review: 3,
  pass: 4,
};

function VendorDetailPage() {
  const { invitationId } = Route.useParams();
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<null | "approve" | "reject" | "changes">(null);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor", invitationId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: inv } = await supabase
        .from("invitations")
        .select(
          "id, vendor_name, vendor_email, token, status, expires_at, created_at, form:forms(id, name)",
        )
        .eq("id", invitationId)
        .maybeSingle();
      if (!inv) return null;
      const [{ data: sub }, { data: events }] = await Promise.all([
        supabase
          .from("submissions")
          .select(
            "id, status, reference_number, submitted_at, updated_at, values_snapshot, form_snapshot",
          )
          .eq("invitation_id", invitationId)
          .maybeSingle(),
        supabase
          .from("audit_logs")
          .select("action, actor_label, created_at, details")
          .eq("entity_id", invitationId)
          .order("created_at"),
      ]);
      let checks: {
        category: string;
        check_name: string;
        result: string;
        explanation: string;
        source: string;
        field_key: string | null;
      }[] = [];
      let runAt: string | null = null;
      let followUps: { sent_at: string; email_id: string | null }[] = [];
      if (sub) {
        const { data: run } = await supabase
          .from("verification_runs")
          .select("id, started_at")
          .eq("submission_id", sub.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (run) {
          runAt = run.started_at;
          const { data: c } = await supabase
            .from("verification_checks")
            .select("category, check_name, result, explanation, source, field_key")
            .eq("run_id", run.id);
          checks = (c ?? []).sort(
            (a, b) => (RESULT_ORDER[a.result] ?? 9) - (RESULT_ORDER[b.result] ?? 9),
          );
        }
        const { data: f } = await supabase
          .from("follow_up_communications")
          .select("sent_at, email_id")
          .eq("submission_id", sub.id)
          .order("sent_at");
        followUps = f ?? [];
      }
      return { inv, sub, events: events ?? [], checks, runAt, followUps };
    },
  });

  if (isLoading) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="p-8 text-sm text-muted-foreground">Vendor not found.</p>;

  const { inv, sub, events, checks, runAt } = data;
  const view = vendorStatus(
    { status: inv.status as InvitationStatus, expires_at: inv.expires_at },
    sub ? { status: sub.status as SubmissionStatus } : null,
  );
  const decided = sub?.status === "approved" || sub?.status === "rejected";
  const link = `${window.location.origin}/v/${inv.token}`;
  const snapshot = sub?.form_snapshot as unknown as FormSnapshot | undefined;
  const values = (sub?.values_snapshot ?? {}) as FormValues;
  const counts = (r: string) => checks.filter((c) => c.result === r).length;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setWorking(true);
    try {
      await fn();
      toast.success(ok);
      setDialog(null);
      setText("");
      qc.invalidateQueries({ queryKey: ["vendor", invitationId] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setWorking(false);
    }
  }

  async function download(path: string) {
    const { data: signed, error } = await supabase.storage
      .from("vendor-documents")
      .createSignedUrl(path, 300);
    if (error || !signed) {
      toast.error(error?.message ?? "Could not open file");
      return;
    }
    window.open(signed.signedUrl, "_blank", "noopener");
  }

  return (
    <div>
      <div className="border-b border-border bg-card px-4 py-6 sm:px-8">
        <Link
          to="/vendors"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All vendors
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{inv.vendor_name}</h1>
              <StatusBadge label={view.label} tone={view.tone} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {inv.vendor_email} · {(inv.form as { name: string } | null)?.name}
              {sub && (
                <>
                  {" "}
                  · Ref <span className="font-mono">{sub.reference_number}</span>
                </>
              )}
            </p>
            <p className="mt-2 text-sm">{view.companyHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Vendor link copied");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Vendor link
            </Button>
            {sub && !decided && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={working}
                  onClick={() =>
                    run(
                      () => rerunVerification({ data: { submissionId: sub.id } }),
                      "Checks re-run",
                    )
                  }
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-run checks
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDialog("changes")}>
                  Request changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDialog("reject")}
                >
                  Reject
                </Button>
                {canEdit(ws) && (
                  <Button size="sm" className="font-semibold" onClick={() => setDialog("approve")}>
                    Approve vendor
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {!sub ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              The vendor hasn't submitted yet. Their details and the automated check results will
              appear here as soon as they do.
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold">Verification</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-destructive">{counts("fail")} to fix</span>·
                    <span>{counts("warning")} to review</span>·
                    <span>{counts("not_verified")} not verified</span>·
                    <span className="text-success">{counts("pass")} passed</span>
                    {runAt && <span>· run {formatDate(runAt, true)}</span>}
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {checks.map((c, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:gap-4"
                    >
                      <div className="sm:w-28 sm:shrink-0">
                        <CheckBadge result={c.result} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{c.check_name}</div>
                        <div className="text-sm text-muted-foreground">{c.explanation}</div>
                      </div>
                      <div className="text-xs text-muted-foreground sm:w-40 sm:shrink-0 sm:text-right">
                        {c.category}
                        <br />
                        {c.source}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {snapshot?.sections.map((s) => (
                <section key={s.title} className="rounded-xl border border-border bg-card">
                  <h2 className="border-b border-border px-5 py-4 text-base font-semibold">
                    {s.title}
                  </h2>
                  <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
                    {s.fields.map((f) => {
                      const v = values[f.key];
                      const flagged = checks.some(
                        (c) =>
                          c.field_key === f.key && (c.result === "fail" || c.result === "warning"),
                      );
                      return (
                        <div
                          key={f.key}
                          className={cn("min-w-0", f.input_type === "file" && "sm:col-span-2")}
                        >
                          <dt className="text-xs text-muted-foreground">{f.label}</dt>
                          <dd
                            className={cn(
                              "mt-0.5 break-words text-sm font-medium",
                              flagged && "text-destructive",
                            )}
                          >
                            {f.input_type === "file" && isFileList(v) ? (
                              <ul className="space-y-1">
                                {v.map((file) => (
                                  <li key={file.path}>
                                    <button
                                      onClick={() => download(file.path)}
                                      className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:underline"
                                    >
                                      <Download className="h-3.5 w-3.5" /> {file.name}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span
                                className={cn(
                                  ["pan", "gstin", "ifsc", "account_number"].includes(f.key) &&
                                    "font-mono",
                                )}
                              >
                                {displayValue(f, v)}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}
            </>
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Timeline</h2>
            <Timeline
              events={events
                .filter((e) => TIMELINE_LABELS[e.action])
                .map((e) => {
                  const d = (e.details ?? {}) as Record<string, unknown>;
                  let note: string | undefined;
                  if (e.action === "checks_failed") note = `${d["fails"]} item(s) sent to vendor`;
                  if (Array.isArray(d["notes"])) note = (d["notes"] as string[]).join(" · ");
                  if (typeof d["reason"] === "string" && d["reason"]) note = d["reason"];
                  if (d["emailed"] === false) note = "Not emailed — link shared manually";
                  return {
                    at: e.created_at,
                    label: TIMELINE_LABELS[e.action] ?? e.action,
                    by: e.actor_label ?? "",
                    note: note ?? "",
                  };
                })}
            />
          </section>
          <section className="rounded-xl border border-border bg-card p-5 text-sm">
            <h2 className="mb-3 text-base font-semibold">Link</h2>
            <p className="text-muted-foreground">Expires {formatDate(inv.expires_at)}</p>
            <p className="mt-1 text-muted-foreground">Invited {formatDate(inv.created_at)}</p>
            {data.followUps.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {data.followUps.length} follow-up email(s)
              </p>
            )}
          </section>
        </aside>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "approve"
                ? "Approve vendor"
                : dialog === "reject"
                  ? "Reject vendor"
                  : "Ask the vendor for changes"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "approve" &&
                (counts("fail") + counts("warning") + counts("not_verified") > 0
                  ? `Heads up: ${counts("fail")} failing, ${counts("warning")} review and ${counts("not_verified")} unverified check(s) remain. Approving adds ${inv.vendor_name} to your approved vendor database anyway.`
                  : `${inv.vendor_name} passed every check. Approving adds them to your approved vendor database and emails them.`)}
              {dialog === "reject" &&
                "The vendor will be told their registration was not approved."}
              {dialog === "changes" &&
                "Write one item per line. They're emailed to the vendor in a single message and shown on their form; the form unlocks so they can fix and resubmit."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={dialog === "changes" ? 5 : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              dialog === "changes"
                ? "Upload a clearer scan of the cancelled cheque\nAdd your FSSAI licence"
                : "Optional note to the vendor"
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            {dialog === "changes" ? (
              <Button
                disabled={working || !text.trim()}
                onClick={() =>
                  run(
                    () =>
                      requestChanges({
                        data: {
                          submissionId: sub!.id,
                          notes: text
                            .split("\n")
                            .map((l) => l.trim())
                            .filter((l) => l.length >= 3),
                        },
                      }),
                    "Sent to vendor",
                  )
                }
              >
                Send to vendor
              </Button>
            ) : (
              <Button
                variant={dialog === "reject" ? "destructive" : "default"}
                className="font-semibold"
                disabled={working}
                onClick={() =>
                  run(
                    () =>
                      decideSubmission({
                        data: {
                          submissionId: sub!.id,
                          decision: dialog === "approve" ? "approved" : "rejected",
                          reason: text.trim() || undefined,
                        },
                      }),
                    dialog === "approve" ? "Vendor approved" : "Vendor rejected",
                  )
                }
              >
                {dialog === "approve" ? "Approve" : "Reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
