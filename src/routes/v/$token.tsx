import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TtvLogo } from "@/components/ttv-logo";
import { Button } from "@/components/ui/button";
import { VendorForm } from "@/components/vendor-form";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import {
  createPortalUpload,
  getPortal,
  savePortalDraft,
  submitPortal,
} from "@/lib/portal.functions";
import { vendorStatus } from "@/lib/status";
import {
  allFields,
  isEmptyValue,
  type FieldValue,
  type FormValues,
  type SnapshotField,
} from "@/lib/form-schema";
import { quickFieldError } from "@/lib/validators";
import { formatDate } from "@/lib/workspace";

export const Route = createFileRoute("/v/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vendor registration — TendToVend" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VendorPortal,
});

function VendorPortal() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal", token],
    queryFn: () => getPortal({ data: { token } }),
    retry: false,
    refetchOnWindowFocus: true,
    // keep the status live while the company is reviewing
    refetchInterval: (q) => (q.state.data && !q.state.data.canEdit ? 30_000 : false),
  });

  const [values, setValues] = useState<FormValues>({});
  const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const stamp = `${data.submission?.status ?? "none"}:${data.submission?.updatedAt ?? ""}`;
    if (loadedFor.current !== stamp) {
      loadedFor.current = stamp;
      setValues(data.values ?? {});
      dirty.current = false;
    }
  }, [data]);

  // Autosave a draft a moment after the vendor stops typing.
  useEffect(() => {
    if (!data?.canEdit || !dirty.current) return;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        await savePortalDraft({ data: { token, values } });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [values, token, data?.canEdit]);

  const serverIssues = useMemo(() => {
    const byField: Record<string, string[]> = {};
    const general: string[] = [];
    for (const i of data?.issues ?? []) {
      if (i.field_key) (byField[i.field_key] ??= []).push(i.message);
      else general.push(i.message);
    }
    return { byField, general };
  }, [data?.issues]);

  if (isLoading)
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your form…
        </div>
      </Shell>
    );
  if (error || !data)
    return (
      <Shell>
        <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">This link isn't working</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error
              ? error.message
              : "Ask the company that invited you to send a new link."}
          </p>
        </div>
      </Shell>
    );

  const view = vendorStatus(
    { status: data.invitation.status as never, expires_at: data.invitation.expiresAt },
    data.submission,
  );
  const fields = allFields(data.form);
  const issuesByField: Record<string, string[]> = { ...serverIssues.byField };
  for (const [k, v] of Object.entries(localErrors)) issuesByField[k] = v;
  // Hide a server issue once the vendor has changed that field.
  const editedSinceCheck = (k: string) =>
    JSON.stringify(values[k] ?? null) !== JSON.stringify((data.values ?? {})[k] ?? null);
  for (const k of Object.keys(serverIssues.byField))
    if (editedSinceCheck(k) && !localErrors[k]) delete issuesByField[k];

  function onChange(key: string, v: FieldValue) {
    dirty.current = true;
    setSaveState("idle");
    setValues((p) => ({ ...p, [key]: v }));
    if (localErrors[key]) setLocalErrors(({ [key]: _, ...rest }) => rest);
  }

  async function upload(field: SnapshotField, file: File) {
    const t = await createPortalUpload({
      data: { token, fieldKey: field.key, fileName: file.name, mime: file.type, size: file.size },
    });
    const { error } = await supabase.storage
      .from(t.bucket)
      .uploadToSignedUrl(t.path, t.uploadToken, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return { path: t.path, name: file.name, mime: file.type, size: file.size };
  }

  async function submit() {
    const errs: Record<string, string[]> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (f.required && isEmptyValue(f, v))
        errs[f.key] = [
          f.input_type === "file" ? "Please upload this document." : "This field is required.",
        ];
      else {
        const e = quickFieldError(f.key, f.input_type, v);
        if (e) errs[f.key] = [e];
      }
    }
    if (Object.keys(errs).length) {
      setLocalErrors(errs);
      toast.error(`${Object.keys(errs).length} field(s) need attention before you can submit.`);
      document
        .getElementById(`f-${Object.keys(errs)[0]}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const next = await submitPortal({ data: { token, values } });
      qc.setQueryData(["portal", token], next);
      dirty.current = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (next.submission?.status === "correction_requested")
        toast.warning("Submitted — a few things need fixing. See the list at the top.");
      else toast.success("Submitted. All automated checks passed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  const StatusIcon =
    view.tone === "success"
      ? CheckCircle2
      : view.tone === "warning"
        ? AlertTriangle
        : view.tone === "danger"
          ? XCircle
          : view.label === "Ready for approval"
            ? ShieldCheck
            : Clock;
  const issueCount = (data.issues ?? []).length;

  return (
    <Shell orgName={data.organisation.name}>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Vendor registration for {data.organisation.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{data.form.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              For {data.vendor.name} · {data.vendor.email}
            </p>
          </div>

          <div className="flex gap-4 rounded-xl border border-border bg-card p-5">
            <StatusIcon
              className={`h-6 w-6 shrink-0 ${view.tone === "success" ? "text-success" : view.tone === "warning" ? "text-warning" : view.tone === "danger" ? "text-destructive" : "text-navy"}`}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={view.label} tone={view.tone} />
                {data.submission && (
                  <span className="font-mono text-xs text-muted-foreground">
                    Ref {data.submission.reference}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm">{view.vendorHint}</p>
              {data.canEdit && !data.submission && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Your answers save automatically — you can close this page and come back with the
                  same link until {formatDate(data.invitation.expiresAt)}.
                </p>
              )}
            </div>
          </div>

          {issueCount > 0 && data.canEdit && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" /> {issueCount} thing
                {issueCount === 1 ? "" : "s"} to fix
              </h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
                {(data.issues ?? []).map((i, n) => (
                  <li key={n}>
                    {i.field_key ? (
                      <button
                        className="text-left hover:underline"
                        onClick={() =>
                          document
                            .getElementById(`f-${i.field_key}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" })
                        }
                      >
                        <b>{fields.find((f) => f.key === i.field_key)?.label}:</b> {i.message}
                      </button>
                    ) : (
                      i.message
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <VendorForm
            snapshot={data.form}
            values={values}
            onChange={onChange}
            issues={issuesByField}
            readOnly={!data.canEdit}
            upload={data.canEdit ? upload : undefined}
          />

          {data.canEdit && (
            <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:px-5">
              <span className="text-xs text-muted-foreground">
                {saveState === "saving"
                  ? "Saving draft…"
                  : saveState === "saved"
                    ? "Draft saved"
                    : "Your answers are only shared when you submit."}
              </span>
              <Button size="lg" onClick={submit} disabled={submitting} className="font-semibold">
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {submitting
                  ? "Submitting and checking…"
                  : data.submission
                    ? "Resubmit corrections"
                    : "Submit"}
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Progress</h2>
            <Timeline events={data.timeline.map((e) => ({ at: e.at, label: e.label }))} />
          </section>
          <section className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
            <p>
              Questions? Contact {data.organisation.name}
              {data.organisation.contactEmail && (
                <>
                  {" "}
                  at{" "}
                  <a
                    className="font-medium text-foreground underline"
                    href={`mailto:${data.organisation.contactEmail}`}
                  >
                    {data.organisation.contactEmail}
                  </a>
                </>
              )}
              .
            </p>
            <p className="mt-2">
              Your documents are stored privately and shared only with {data.organisation.name}.
            </p>
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children, orgName }: { children: React.ReactNode; orgName?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <TtvLogo variant="light" size={26} />
          {orgName && (
            <span className="truncate text-xs font-semibold text-white/80">{orgName}</span>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
