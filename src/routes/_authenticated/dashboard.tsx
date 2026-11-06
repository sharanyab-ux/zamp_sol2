import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { useWorkspace, formatDate } from "@/lib/workspace";
import { vendorStatus, type InvitationStatus, type SubmissionStatus } from "@/lib/status";
import { integrationStatus } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — TendToVend" },
      { name: "description", content: "Your TendToVend vendor onboarding workspace." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: ws, isLoading } = useWorkspace();
  const orgId = ws?.org.id;

  const { data } = useQuery({
    queryKey: ["overview", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [forms, invites, approved] = await Promise.all([
        supabase.from("forms").select("id, status").eq("organisation_id", orgId!),
        supabase
          .from("invitations")
          .select(
            "id, vendor_name, status, expires_at, updated_at, submissions(status, updated_at)",
          )
          .eq("organisation_id", orgId!)
          .order("updated_at", { ascending: false }),
        supabase
          .from("approved_vendors")
          .select("id", { count: "exact", head: true })
          .eq("organisation_id", orgId!),
      ]);
      return {
        forms: forms.data ?? [],
        invites: invites.data ?? [],
        approvedCount: approved.count ?? 0,
      };
    },
  });

  const { data: integ } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => integrationStatus(),
  });

  if (isLoading)
    return <p className="p-8 text-sm text-muted-foreground">Loading your workspace…</p>;
  if (!ws)
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">Your workspace is being set up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find a workspace linked to your account yet. Try signing out and in again.
        </p>
      </div>
    );

  const rows = (data?.invites ?? []).map((i) => {
    const sub =
      (
        i.submissions as unknown as { status: SubmissionStatus; updated_at: string }[] | null
      )?.[0] ?? null;
    return {
      ...i,
      sub,
      view: vendorStatus({ status: i.status as InvitationStatus, expires_at: i.expires_at }, sub),
    };
  });
  const count = (label: string) => rows.filter((r) => r.view.label === label).length;
  const published = (data?.forms ?? []).filter((f) => f.status === "published").length;

  const metrics = [
    { label: "Invited, not submitted", value: count("Invited") + count("Opened"), to: "/vendors" },
    { label: "Waiting on vendor", value: count("Waiting on vendor"), to: "/vendors" },
    { label: "Ready for approval", value: count("Ready for approval"), to: "/vendors" },
    { label: "Approved vendors", value: data?.approvedCount ?? 0, to: "/approved" },
  ];

  const steps = [
    {
      done: published > 0,
      title: "Build and publish your vendor form",
      body: "Pick Contact, Identity, Tax and Document fields — or add your own.",
      to: "/forms",
      cta: "Open forms",
    },
    {
      done: rows.length > 0,
      title: "Invite your vendors",
      body: "Enter vendor emails; each gets a secure, expiring link.",
      to: "/forms",
      cta: "Invite",
    },
    {
      done: (data?.approvedCount ?? 0) > 0,
      title: "Review and approve",
      body: "Submissions are auto-checked; approve the ones that pass.",
      to: "/vendors",
      cta: "Review",
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${ws.displayName}`}
        description={`${ws.org.name} · vendor onboarding overview`}
      />
      <div className="space-y-8 px-4 py-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => (
            <Link
              key={m.label}
              to={m.to}
              className="card-hover rounded-xl border border-border bg-card p-5"
            >
              <div className="text-3xl font-bold tabular-nums">{m.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{m.label}</div>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2">
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                )}
                <h3 className="text-base font-semibold">{s.title}</h3>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.body}</p>
              <Button asChild variant="outline" size="sm" className="mt-4 self-start">
                <Link to={s.to}>
                  {s.cta} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {integ && (!integ.email || !integ.gst) && (
          <div className="rounded-xl border border-warning/50 bg-warning/10 p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <CircleAlert className="h-4 w-4" /> Finish setup to automate everything
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
              {!integ.email && (
                <li>
                  <b className="text-foreground">Email is off.</b> Invitations and follow-ups won't
                  be emailed — you'll get a link to copy and send yourself. Add a{" "}
                  <code>RESEND_API_KEY</code> secret to turn it on.
                </li>
              )}
              {!integ.gst && (
                <li>
                  <b className="text-foreground">GSTIN government lookup is off.</b> GSTINs are
                  still checked for format, check digit and PAN match, but not against GST records.
                  Add a <code>GSTIN_API_KEY</code> secret to turn it on.
                </li>
              )}
            </ul>
          </div>
        )}

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Recent vendor activity</h2>
            <Link
              to="/vendors"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No vendors invited yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <Link
                    to="/vendors/$invitationId"
                    params={{ invitationId: r.id }}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{r.vendor_name}</span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDate(r.sub?.updated_at ?? r.updated_at)}
                      </span>
                      <StatusBadge label={r.view.label} tone={r.view.tone} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
