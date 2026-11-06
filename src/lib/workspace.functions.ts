/**
 * Signed-in company actions that need the server (emails, verification, approvals).
 * Membership is enforced by reading through the caller's own RLS-scoped client first.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

const uuid = z.string().uuid();

async function memberLabel(supabase: Db, orgId: string, userId: string): Promise<string> {
  const { data } = await supabase
    .from("organisation_members")
    .select("display_name")
    .eq("organisation_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.display_name ?? "Team member";
}

export const sendInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        formId: uuid,
        vendors: z
          .array(
            z.object({ name: z.string().trim().min(1).max(200), email: z.string().trim().email() }),
          )
          .min(1)
          .max(200),
        expiresInDays: z.number().int().min(1).max(90).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const w = await import("./workflow.server");
    const { sendEmail, invitationEmail, emailConfigured } = await import("./email.server");

    const { data: form } = await supabase
      .from("forms")
      .select("id, organisation_id, status, current_version")
      .eq("id", data.formId)
      .maybeSingle();
    if (!form) throw new Error("Form not found.");
    if (form.status !== "published" || !form.current_version)
      throw new Error("Publish the form before inviting vendors.");
    const { data: version } = await supabase
      .from("form_versions")
      .select("id")
      .eq("form_id", form.id)
      .eq("version", form.current_version)
      .single();
    const { data: org } = await supabase
      .from("organisations")
      .select("name, contact_email")
      .eq("id", form.organisation_id)
      .single();
    const by = await memberLabel(supabase, form.organisation_id, userId);

    const results: {
      name: string;
      email: string;
      link: string;
      emailed: boolean;
      error?: string | undefined;
    }[] = [];
    for (const v of data.vendors) {
      const token = w.newToken();
      const expires = new Date(Date.now() + data.expiresInDays * 864e5).toISOString();
      const { data: inv, error } = await supabase
        .from("invitations")
        .insert({
          organisation_id: form.organisation_id,
          form_id: form.id,
          form_version_id: version!.id,
          vendor_name: v.name,
          vendor_email: v.email.toLowerCase(),
          token,
          expires_at: expires,
          status: "sent",
        })
        .select("id")
        .single();
      if (error || !inv) {
        results.push({
          name: v.name,
          email: v.email,
          link: "",
          emailed: false,
          error: error?.message ?? "Could not create invitation",
        });
        continue;
      }
      const link = w.portalLink(token);
      const mail = invitationEmail({
        orgName: org!.name,
        vendorName: v.name,
        link,
        expiresAt: expires,
      });
      const sent = emailConfigured()
        ? await sendEmail(v.email, mail.subject, mail.html, org?.contact_email)
        : { sent: false, error: "Email not configured" };
      await supabase
        .from("invitations")
        .update({ sent_at: new Date().toISOString(), last_email_id: sent.id ?? null })
        .eq("id", inv.id);
      await w.audit(
        form.organisation_id,
        inv.id,
        "invitation_sent",
        by,
        { emailed: sent.sent },
        userId,
      );
      results.push({
        name: v.name,
        email: v.email,
        link,
        emailed: sent.sent,
        error: sent.sent ? undefined : sent.error,
      });
    }
    return { results, emailConfigured: emailConfigured() };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ invitationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const w = await import("./workflow.server");
    const { sendEmail, invitationEmail } = await import("./email.server");
    const { data: inv } = await supabase
      .from("invitations")
      .select(
        "id, organisation_id, vendor_name, vendor_email, token, expires_at, status, resend_count",
      )
      .eq("id", data.invitationId)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found.");
    const expired = new Date(inv.expires_at) < new Date();
    const expires =
      expired || inv.status === "revoked"
        ? new Date(Date.now() + 30 * 864e5).toISOString()
        : inv.expires_at;
    const status = inv.status === "revoked" || inv.status === "expired" ? "sent" : inv.status;
    const { data: org } = await supabase
      .from("organisations")
      .select("name, contact_email")
      .eq("id", inv.organisation_id)
      .single();
    const link = w.portalLink(inv.token);
    const mail = invitationEmail({
      orgName: org!.name,
      vendorName: inv.vendor_name,
      link,
      expiresAt: expires,
    });
    const sent = await sendEmail(inv.vendor_email, mail.subject, mail.html, org?.contact_email);
    await supabase
      .from("invitations")
      .update({
        expires_at: expires,
        status,
        resend_count: inv.resend_count + 1,
        sent_at: new Date().toISOString(),
        last_email_id: sent.id ?? null,
      })
      .eq("id", inv.id);
    await w.audit(
      inv.organisation_id,
      inv.id,
      "invitation_resent",
      await memberLabel(supabase, inv.organisation_id, userId),
      { emailed: sent.sent },
      userId,
    );
    return { link, emailed: sent.sent, error: sent.error };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ invitationId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const w = await import("./workflow.server");
    const { data: inv, error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId)
      .select("id, organisation_id")
      .maybeSingle();
    if (error || !inv)
      throw new Error(error?.message ?? "Only owners and admins can revoke links.");
    await w.audit(
      inv.organisation_id,
      inv.id,
      "revoked",
      await memberLabel(supabase, inv.organisation_id, userId),
      {},
      userId,
    );
    return { ok: true };
  });

async function visibleSubmission(supabase: Db, submissionId: string) {
  const { data } = await supabase
    .from("submissions")
    .select(
      "id, organisation_id, invitation_id, vendor_name, vendor_email, values_snapshot, form_snapshot, status",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (!data) throw new Error("Submission not found.");
  return data;
}

export const rerunVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ submissionId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await visibleSubmission(context.supabase, data.submissionId);
    if (sub.status === "approved" || sub.status === "rejected")
      throw new Error("This vendor has already been decided.");
    const w = await import("./workflow.server");
    return w.verifySubmission(sub.id, "manual");
  });

export const requestChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        submissionId: uuid,
        notes: z.array(z.string().trim().min(3).max(500)).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sub = await visibleSubmission(supabase, data.submissionId);
    const w = await import("./workflow.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: run } = await supabaseAdmin
      .from("verification_runs")
      .insert({
        submission_id: sub.id,
        run_type: "manual",
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const by = await memberLabel(supabase, sub.organisation_id, userId);
    await supabaseAdmin.from("verification_checks").insert(
      data.notes.map((n) => ({
        run_id: run!.id,
        submission_id: sub.id,
        category: "Reviewer",
        check_name: "Requested by reviewer",
        result: "fail" as const,
        explanation: n,
        source: by,
      })),
    );
    await supabaseAdmin
      .from("submissions")
      .update({ status: "correction_requested", updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (sub.invitation_id)
      await w.audit(
        sub.organisation_id,
        sub.invitation_id,
        "changes_requested",
        by,
        { notes: data.notes },
        userId,
      );
    await w.sendFollowUp(sub.id, data.notes);
    return { ok: true };
  });

export const decideSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        submissionId: uuid,
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sub = await visibleSubmission(supabase, data.submissionId);
    if (sub.status === "approved" || sub.status === "rejected")
      throw new Error("This vendor has already been decided.");
    const { data: me } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", sub.organisation_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (data.decision === "approved" && me?.role === "reviewer")
      throw new Error("Only owners and admins can approve vendors.");
    const now = new Date().toISOString();
    const { error } = await supabase.from("vendor_approvals").insert({
      submission_id: sub.id,
      organisation_id: sub.organisation_id,
      decided_by: userId,
      decision: data.decision,
      reason: data.reason || null,
    });
    if (error) throw new Error(error.message);
    if (data.decision === "approved") {
      const { error: e2 } = await supabase.from("approved_vendors").insert({
        organisation_id: sub.organisation_id,
        submission_id: sub.id,
        vendor_name: sub.vendor_name,
        vendor_email: sub.vendor_email,
        profile: sub.values_snapshot as Json,
        approved_at: now,
      });
      if (e2)
        throw new Error(
          e2.message.includes("row-level")
            ? "Only owners and admins can approve vendors."
            : e2.message,
        );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("submissions")
      .update({ status: data.decision, updated_at: now })
      .eq("id", sub.id);
    const w = await import("./workflow.server");
    if (sub.invitation_id)
      await w.audit(
        sub.organisation_id,
        sub.invitation_id,
        data.decision,
        await memberLabel(supabase, sub.organisation_id, userId),
        { reason: data.reason ?? null },
        userId,
      );
    const mail = await w.notifyDecision(sub.id, data.decision === "approved", data.reason ?? null);
    return { ok: true, emailed: mail.sent };
  });

export const integrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { emailConfigured } = await import("./email.server");
    const { gstProviderConfigured } = await import("./external-checks.server");
    return { email: emailConfigured(), gst: gstProviderConfigured() };
  });
