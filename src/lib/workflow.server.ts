/**
 * Server-only vendor workflow: portal state, drafts, uploads, submission, verification and follow-ups.
 * Uses the service-role client, so every entry point must validate the invitation token or the caller's
 * workspace membership before touching data.
 */
import { getRequestUrl } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  allFields,
  isFileList,
  type FileRef,
  type FormSnapshot,
  type FormValues,
} from "./form-schema";
import { normaliseValues, offlineChecks, type Check, MAX_UPLOAD_BYTES } from "./verification-rules";
import { externalChecks } from "./external-checks.server";
import { decisionEmail, followUpEmail, readyForReviewEmail, sendEmail } from "./email.server";
import { ACCEPTED_UPLOAD_TYPES } from "./field-library";
import { normaliseId } from "./validators";
import { TIMELINE_LABELS, type SubmissionStatus } from "./status";

export const BUCKET = "vendor-documents";

export function appUrl(): string {
  const configured = process.env["APP_URL"]?.replace(/\/+$/, "");
  if (configured) return configured;
  try {
    return getRequestUrl().origin;
  } catch {
    return "";
  }
}

export const portalLink = (token: string) => `${appUrl()}/v/${token}`;
export const reviewLink = (invitationId: string) => `${appUrl()}/vendors/${invitationId}`;

export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function referenceNumber(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Array.from(
    crypto.getRandomValues(new Uint8Array(3)),
    (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
  ).join("");
  return `TTV-${ymd}-${rand}`;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export async function audit(
  orgId: string,
  entityId: string,
  action: string,
  actorLabel: string,
  details: Record<string, unknown> = {},
  actor: string | null = null,
) {
  await supabaseAdmin.from("audit_logs").insert({
    organisation_id: orgId,
    entity_type: "invitation",
    entity_id: entityId,
    action,
    actor,
    actor_label: actorLabel,
    details: details as Json,
  });
}

// ---------------------------------------------------------------- loading

async function loadInvitation(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error("This link is not valid.");
  const { data: inv } = await supabaseAdmin
    .from("invitations")
    .select(
      "id, organisation_id, form_id, form_version_id, vendor_name, vendor_email, token, status, expires_at, opened_at, draft_values",
    )
    .eq("token", token)
    .maybeSingle();
  if (!inv) throw new Error("This link is not valid. Ask the company to send you a new one.");
  return inv;
}

async function loadSnapshot(formVersionId: string | null): Promise<FormSnapshot> {
  if (!formVersionId) throw new Error("This form has not been published yet.");
  const { data } = await supabaseAdmin
    .from("form_versions")
    .select("snapshot")
    .eq("id", formVersionId)
    .single();
  return data!.snapshot as unknown as FormSnapshot;
}

async function loadSubmission(invitationId: string) {
  const { data } = await supabaseAdmin
    .from("submissions")
    .select(
      "id, organisation_id, status, reference_number, values_snapshot, submitted_at, updated_at, vendor_name, vendor_email, form_snapshot",
    )
    .eq("invitation_id", invitationId)
    .maybeSingle();
  return data;
}

async function latestFails(
  submissionId: string,
): Promise<{ field_key: string | null; message: string }[]> {
  const { data: run } = await supabaseAdmin
    .from("verification_runs")
    .select("id")
    .eq("submission_id", submissionId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run) return [];
  const { data: checks } = await supabaseAdmin
    .from("verification_checks")
    .select("field_key, explanation, result")
    .eq("run_id", run.id)
    .eq("result", "fail");
  return (checks ?? []).map((c) => ({ field_key: c.field_key, message: c.explanation }));
}

export async function timeline(invitationId: string) {
  const { data } = await supabaseAdmin
    .from("audit_logs")
    .select("action, actor_label, created_at, details")
    .eq("entity_id", invitationId)
    .order("created_at", { ascending: true });
  return (data ?? [])
    .filter((e) => TIMELINE_LABELS[e.action])
    .map((e) => ({
      at: e.created_at,
      label: TIMELINE_LABELS[e.action] ?? e.action,
      by: e.actor_label ?? "",
    }));
}

export async function portalState(token: string) {
  const inv = await loadInvitation(token);
  const [{ data: org }, snapshot, sub] = await Promise.all([
    supabaseAdmin
      .from("organisations")
      .select("name, contact_email")
      .eq("id", inv.organisation_id)
      .single(),
    loadSnapshot(inv.form_version_id),
    loadSubmission(inv.id),
  ]);
  const expired = new Date(inv.expires_at) < new Date();

  if (!inv.opened_at && inv.status === "sent" && !expired) {
    await supabaseAdmin
      .from("invitations")
      .update({ status: "opened", opened_at: new Date().toISOString() })
      .eq("id", inv.id);
    await audit(inv.organisation_id, inv.id, "opened", inv.vendor_name);
    inv.status = "opened";
  }

  const issues = sub && sub.status === "correction_requested" ? await latestFails(sub.id) : [];
  const canEdit =
    inv.status !== "revoked" && !expired && (!sub || sub.status === "correction_requested");
  const values = (
    canEdit && Object.keys((inv.draft_values as object) ?? {}).length
      ? inv.draft_values
      : (sub?.values_snapshot ?? inv.draft_values ?? {})
  ) as FormValues;

  return {
    organisation: { name: org?.name ?? "", contactEmail: org?.contact_email ?? "" },
    vendor: { name: inv.vendor_name, email: inv.vendor_email },
    invitation: { status: inv.status, expiresAt: inv.expires_at, expired },
    form: snapshot,
    values,
    submission: sub
      ? {
          status: sub.status as SubmissionStatus,
          reference: sub.reference_number,
          submittedAt: sub.submitted_at,
          updatedAt: sub.updated_at,
        }
      : null,
    issues,
    canEdit,
    timeline: await timeline(inv.id),
  };
}

export type PortalState = Awaited<ReturnType<typeof portalState>>;

// ---------------------------------------------------------------- vendor actions

function assertEditable(inv: Awaited<ReturnType<typeof loadInvitation>>) {
  if (inv.status === "revoked") throw new Error("This link has been withdrawn by the company.");
  if (new Date(inv.expires_at) < new Date())
    throw new Error("This link has expired. Ask the company to resend it.");
}

export async function saveDraft(token: string, values: FormValues) {
  const inv = await loadInvitation(token);
  assertEditable(inv);
  const sub = await loadSubmission(inv.id);
  if (sub && sub.status !== "correction_requested")
    throw new Error("This form has already been submitted.");
  await supabaseAdmin
    .from("invitations")
    .update({ draft_values: values as Json, updated_at: new Date().toISOString() })
    .eq("id", inv.id);
  return { savedAt: new Date().toISOString() };
}

export async function createUpload(
  token: string,
  fieldKey: string,
  fileName: string,
  mime: string,
  size: number,
) {
  const inv = await loadInvitation(token);
  assertEditable(inv);
  const snapshot = await loadSnapshot(inv.form_version_id);
  const field = allFields(snapshot).find((f) => f.key === fieldKey && f.input_type === "file");
  if (!field) throw new Error("Unknown upload field.");
  if (!ACCEPTED_UPLOAD_TYPES[mime]) throw new Error("Only PDF, JPG and PNG files are accepted.");
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new Error("Files must be smaller than 10 MB.");
  const safe = fileName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
  const path = `${inv.organisation_id}/${inv.id}/${fieldKey}/${newToken().slice(0, 12)}-${safe}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not prepare the upload.");
  return { path: data.path, uploadToken: data.token, bucket: BUCKET };
}

/** Keep only file references that point at this invitation's folder. */
function sanitiseFiles(values: FormValues, snapshot: FormSnapshot, prefix: string): FormValues {
  const out = { ...values };
  for (const f of allFields(snapshot)) {
    if (f.input_type !== "file") continue;
    const v = out[f.key];
    if (!Array.isArray(v)) {
      delete out[f.key];
      continue;
    }
    out[f.key] = (v as FileRef[])
      .filter((x) => x && typeof x.path === "string" && x.path.startsWith(`${prefix}/${f.key}/`))
      .map((x) => ({
        path: x.path,
        name: String(x.name).slice(0, 200),
        mime: String(x.mime),
        size: Number(x.size) || 0,
      }));
  }
  return out;
}

export async function submit(token: string, rawValues: FormValues) {
  const inv = await loadInvitation(token);
  assertEditable(inv);
  const snapshot = await loadSnapshot(inv.form_version_id);
  const existing = await loadSubmission(inv.id);
  if (existing && existing.status !== "correction_requested")
    throw new Error("This form has already been submitted.");

  const values = normaliseValues(
    snapshot,
    sanitiseFiles(rawValues, snapshot, `${inv.organisation_id}/${inv.id}`),
  );
  const now = new Date().toISOString();
  let submissionId: string;

  if (existing) {
    submissionId = existing.id;
    await supabaseAdmin
      .from("submissions")
      .update({ values_snapshot: values as Json, status: "resubmitted", updated_at: now })
      .eq("id", existing.id);
    await audit(inv.organisation_id, inv.id, "resubmitted", inv.vendor_name);
  } else {
    const { data, error } = await supabaseAdmin
      .from("submissions")
      .insert({
        organisation_id: inv.organisation_id,
        form_id: inv.form_id,
        form_version_id: inv.form_version_id,
        invitation_id: inv.id,
        vendor_name: inv.vendor_name,
        vendor_email: inv.vendor_email,
        reference_number: referenceNumber(),
        status: "submitted",
        form_snapshot: snapshot as unknown as Json,
        values_snapshot: values as Json,
        submitted_at: now,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save your submission.");
    submissionId = data.id;
    await audit(inv.organisation_id, inv.id, "submitted", inv.vendor_name);
  }

  await supabaseAdmin
    .from("invitations")
    .update({ status: "submitted", submitted_at: now, draft_values: {} as Json, updated_at: now })
    .eq("id", inv.id);

  // Field values (one row per field) and document records.
  const rows = Object.entries(values).map(([field_key, value]) => ({
    submission_id: submissionId,
    field_key,
    value: (value ?? null) as Json,
  }));
  if (rows.length)
    await supabaseAdmin
      .from("submission_values")
      .upsert(rows, { onConflict: "submission_id,field_key" });
  await supabaseAdmin.from("documents").delete().eq("submission_id", submissionId);
  const docs = allFields(snapshot)
    .filter((f) => f.input_type === "file" && isFileList(values[f.key]))
    .flatMap((f) =>
      (values[f.key] as FileRef[]).map((file) => ({
        submission_id: submissionId,
        organisation_id: inv.organisation_id,
        field_key: f.key,
        storage_path: file.path,
        file_name: file.name,
        mime_type: file.mime,
        size_bytes: file.size,
      })),
    );
  if (docs.length) await supabaseAdmin.from("documents").insert(docs);

  await verifySubmission(submissionId, existing ? "resubmission" : "initial");
  return portalState(token);
}

// ---------------------------------------------------------------- verification

async function duplicateChecks(
  orgId: string,
  submissionId: string,
  values: FormValues,
): Promise<Check[]> {
  const checks: Check[] = [];
  const probes: [string, string][] = [
    ["pan", normaliseId(values["pan"])],
    ["gstin", normaliseId(values["gstin"])],
    [
      "account_number",
      typeof values["account_number"] === "string"
        ? values["account_number"].replace(/\s+/g, "")
        : "",
    ],
  ];
  for (const [key, val] of probes) {
    if (!val || !/^[A-Z0-9]+$/.test(val)) continue;
    const { data } = await supabaseAdmin
      .from("submissions")
      .select("vendor_name, reference_number")
      .eq("organisation_id", orgId)
      .neq("id", submissionId)
      .eq(`values_snapshot->>${key}`, val)
      .limit(3);
    const label = key === "account_number" ? "bank account number" : key.toUpperCase();
    checks.push({
      category: "Duplicates",
      check_name: `${label} not already registered`,
      result: data?.length ? "warning" : "pass",
      explanation: data?.length
        ? `The same ${label} appears on: ${data.map((d) => `${d.vendor_name} (${d.reference_number})`).join(", ")}.`
        : `No other vendor in this workspace uses this ${label}.`,
      field_key: key,
      source: "workspace records",
    });
  }
  return checks;
}

export async function verifySubmission(
  submissionId: string,
  runType: "initial" | "resubmission" | "manual",
) {
  const { data: sub } = await supabaseAdmin
    .from("submissions")
    .select(
      "id, organisation_id, invitation_id, vendor_name, vendor_email, form_snapshot, values_snapshot, status",
    )
    .eq("id", submissionId)
    .single();
  if (!sub) throw new Error("Submission not found.");
  const snapshot = sub.form_snapshot as unknown as FormSnapshot;
  const values = sub.values_snapshot as FormValues;

  await supabaseAdmin
    .from("submissions")
    .update({ status: "verification_in_progress" })
    .eq("id", sub.id);
  const { data: run } = await supabaseAdmin
    .from("verification_runs")
    .insert({ submission_id: sub.id, run_type: runType, status: "running" })
    .select("id")
    .single();

  const keys = new Set(allFields(snapshot).map((f) => f.key));
  const checks = [
    ...offlineChecks(snapshot, values),
    ...(await externalChecks(values, keys)),
    ...(await duplicateChecks(sub.organisation_id, sub.id, values)),
  ];

  await supabaseAdmin.from("verification_checks").insert(
    checks.map((c) => ({
      run_id: run!.id,
      submission_id: sub.id,
      category: c.category,
      check_name: c.check_name,
      result: c.result,
      explanation: c.explanation,
      field_key: c.field_key ?? null,
      source: c.source,
    })),
  );
  await supabaseAdmin
    .from("verification_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", run!.id);

  const fails = checks.filter((c) => c.result === "fail");
  const status: SubmissionStatus = fails.length ? "correction_requested" : "under_manual_review";
  await supabaseAdmin
    .from("submissions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  if (sub.invitation_id) {
    await audit(
      sub.organisation_id,
      sub.invitation_id,
      fails.length ? "checks_failed" : "checks_passed",
      "Automated checks",
      {
        fails: fails.length,
        warnings: checks.filter((c) => c.result === "warning").length,
        not_verified: checks.filter((c) => c.result === "not_verified").length,
      },
    );
    if (fails.length)
      await sendFollowUp(
        sub.id,
        fails.map((f) => f.explanation),
      );
    else await notifyCompanyReady(sub.organisation_id, sub.invitation_id, sub.vendor_name);
  }
  return { status, fails: fails.length };
}

export async function sendFollowUp(submissionId: string, issues: string[]) {
  const { data: sub } = await supabaseAdmin
    .from("submissions")
    .select("id, organisation_id, invitation_id, vendor_name, vendor_email")
    .eq("id", submissionId)
    .single();
  if (!sub?.invitation_id) return;
  const issuesHash = hash([...issues].sort().join("|"));
  const { data: last } = await supabaseAdmin
    .from("follow_up_communications")
    .select("issues_hash")
    .eq("submission_id", submissionId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.issues_hash === issuesHash) return; // same list already sent — don't spam the vendor

  const [{ data: inv }, { data: org }] = await Promise.all([
    supabaseAdmin.from("invitations").select("token").eq("id", sub.invitation_id).single(),
    supabaseAdmin
      .from("organisations")
      .select("name, contact_email")
      .eq("id", sub.organisation_id)
      .single(),
  ]);
  const mail = followUpEmail({
    orgName: org!.name,
    vendorName: sub.vendor_name,
    link: portalLink(inv!.token),
    issues,
  });
  const res = await sendEmail(sub.vendor_email, mail.subject, mail.html, org?.contact_email);
  await supabaseAdmin.from("follow_up_communications").insert({
    submission_id: sub.id,
    organisation_id: sub.organisation_id,
    email_type: "correction_request",
    issues_hash: issuesHash,
    email_to: sub.vendor_email,
    email_id: res.id ?? (res.sent ? null : `not-sent: ${res.error}`),
    link_token: inv!.token,
  });
}

async function notifyCompanyReady(orgId: string, invitationId: string, vendorName: string) {
  const { data: org } = await supabaseAdmin
    .from("organisations")
    .select("name, contact_email")
    .eq("id", orgId)
    .single();
  if (!org?.contact_email) return;
  const mail = readyForReviewEmail({
    orgName: org.name,
    vendorName,
    link: reviewLink(invitationId),
  });
  await sendEmail(org.contact_email, mail.subject, mail.html);
}

export async function notifyDecision(
  submissionId: string,
  approved: boolean,
  reason: string | null,
) {
  const { data: sub } = await supabaseAdmin
    .from("submissions")
    .select("organisation_id, invitation_id, vendor_name, vendor_email")
    .eq("id", submissionId)
    .single();
  if (!sub?.invitation_id) return { sent: false };
  const [{ data: inv }, { data: org }] = await Promise.all([
    supabaseAdmin.from("invitations").select("token").eq("id", sub.invitation_id).single(),
    supabaseAdmin
      .from("organisations")
      .select("name, contact_email")
      .eq("id", sub.organisation_id)
      .single(),
  ]);
  const mail = decisionEmail({
    orgName: org!.name,
    vendorName: sub.vendor_name,
    link: portalLink(inv!.token),
    approved,
    reason,
  });
  return sendEmail(sub.vendor_email, mail.subject, mail.html, org?.contact_email);
}
