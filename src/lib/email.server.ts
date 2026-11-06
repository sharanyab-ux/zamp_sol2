/**
 * Transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY (and optionally EMAIL_FROM) as secrets in Lovable Cloud.
 * Without a key, nothing is sent and callers fall back to showing a copyable link.
 */

export interface SendResult {
  sent: boolean;
  id?: string | undefined;
  error?: string | undefined;
}

export function emailConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<SendResult> {
  const key = process.env["RESEND_API_KEY"];
  if (!key)
    return { sent: false, error: "Email sending is not configured (RESEND_API_KEY missing)." };
  const from = process.env["EMAIL_FROM"] || "TendToVend <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok)
      return { sent: false, error: body.message ?? `Email provider returned ${res.status}` };
    return { sent: true, id: body.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Email request failed" };
  }
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function layout(title: string, body: string, ctaUrl?: string, ctaLabel?: string) {
  return `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#102849">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-size:20px;font-weight:700;margin-bottom:24px">TendTo<span style="color:#CA9A04">Vend</span></div>
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
      ${body}
      ${
        ctaUrl
          ? `<p style="margin:28px 0 8px"><a href="${esc(ctaUrl)}" style="background:#FACC15;color:#102849;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">${esc(ctaLabel ?? "Open")}</a></p>
      <p style="font-size:12px;color:#64748B;word-break:break-all">Or paste this link into your browser: ${esc(ctaUrl)}</p>`
          : ""
      }
    </div>
    <p style="font-size:12px;color:#94A3B8;margin-top:20px">Sent via TendToVend vendor onboarding.</p>
  </div></body></html>`;
}

export function invitationEmail(p: {
  orgName: string;
  vendorName: string;
  link: string;
  expiresAt: string;
}) {
  const exp = new Date(p.expiresAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    subject: `${p.orgName} has invited you to register as a vendor`,
    html: layout(
      `Vendor registration for ${p.orgName}`,
      `<p>Hello ${esc(p.vendorName)},</p>
       <p>${esc(p.orgName)} would like to onboard you as a vendor. Please fill in your business, tax and bank details and upload the requested documents using the secure link below.</p>
       <p>You can save your progress and come back later. The link is valid until <b>${esc(exp)}</b>.</p>`,
      p.link,
      "Fill in the vendor form",
    ),
  };
}

export function followUpEmail(p: {
  orgName: string;
  vendorName: string;
  link: string;
  issues: string[];
}) {
  return {
    subject: `Action needed: ${p.issues.length} item(s) to fix on your ${p.orgName} vendor registration`,
    html: layout(
      "A few things need fixing",
      `<p>Hello ${esc(p.vendorName)},</p>
       <p>Thanks for submitting your details to ${esc(p.orgName)}. Our checks found the following, all in one place:</p>
       <ol style="padding-left:20px;line-height:1.6">${p.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>
       <p>Open your form, correct these and resubmit. Everything else you entered is saved.</p>`,
      p.link,
      "Fix and resubmit",
    ),
  };
}

export function decisionEmail(p: {
  orgName: string;
  vendorName: string;
  link: string;
  approved: boolean;
  reason?: string | null;
}) {
  return {
    subject: p.approved
      ? `You're now an approved vendor of ${p.orgName}`
      : `Update on your ${p.orgName} vendor registration`,
    html: layout(
      p.approved ? "Registration approved" : "Registration not approved",
      `<p>Hello ${esc(p.vendorName)},</p>
       <p>${p.approved ? `${esc(p.orgName)} has approved your vendor registration. No further action is needed.` : `${esc(p.orgName)} has not approved your vendor registration.`}</p>
       ${p.reason ? `<p><b>Note from ${esc(p.orgName)}:</b> ${esc(p.reason)}</p>` : ""}`,
      p.link,
      "View status",
    ),
  };
}

export function readyForReviewEmail(p: { orgName: string; vendorName: string; link: string }) {
  return {
    subject: `${p.vendorName} is ready for approval`,
    html: layout(
      "Vendor ready for approval",
      `<p>${esc(p.vendorName)} has submitted their registration to ${esc(p.orgName)} and every automated check has passed.</p>`,
      p.link,
      "Review vendor",
    ),
  };
}
