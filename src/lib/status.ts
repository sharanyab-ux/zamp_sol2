export type SubmissionStatus =
  | "submitted"
  | "verification_in_progress"
  | "correction_requested"
  | "resubmitted"
  | "under_manual_review"
  | "approved"
  | "rejected";

export type InvitationStatus = "sent" | "opened" | "submitted" | "expired" | "revoked";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusView {
  label: string;
  tone: Tone;
  /** What the company sees as the next step. */
  companyHint: string;
  /** What the vendor sees as the next step. */
  vendorHint: string;
}

export function vendorStatus(
  inv: { status: InvitationStatus; expires_at?: string },
  sub?: { status: SubmissionStatus } | null,
): StatusView {
  if (sub) {
    switch (sub.status) {
      case "submitted":
      case "verification_in_progress":
      case "resubmitted":
        return {
          label: "Checking",
          tone: "info",
          companyHint: "Automated checks are running.",
          vendorHint: "We're checking your details. This usually takes a few seconds.",
        };
      case "correction_requested":
        return {
          label: "Waiting on vendor",
          tone: "warning",
          companyHint: "The vendor has been asked to fix the listed issues.",
          vendorHint: "A few things need your attention. Fix them below and resubmit.",
        };
      case "under_manual_review":
        return {
          label: "Ready for approval",
          tone: "info",
          companyHint: "All automated checks passed. Review and approve.",
          vendorHint: "All checks passed. The company is doing a final review.",
        };
      case "approved":
        return {
          label: "Approved",
          tone: "success",
          companyHint: "Added to your approved vendor database.",
          vendorHint: "You're an approved vendor. No further action needed.",
        };
      case "rejected":
        return {
          label: "Rejected",
          tone: "danger",
          companyHint: "This vendor was rejected.",
          vendorHint: "The company has not approved this registration.",
        };
    }
  }
  if (inv.status === "revoked")
    return {
      label: "Revoked",
      tone: "neutral",
      companyHint: "Link revoked.",
      vendorHint: "This link has been withdrawn by the company.",
    };
  if (inv.status === "expired" || (inv.expires_at && new Date(inv.expires_at) < new Date()))
    return {
      label: "Link expired",
      tone: "neutral",
      companyHint: "Resend to issue a fresh link.",
      vendorHint: "This link has expired. Ask the company to resend it.",
    };
  if (inv.status === "opened")
    return {
      label: "Opened",
      tone: "neutral",
      companyHint: "The vendor has opened the form.",
      vendorHint: "Fill in the form and submit.",
    };
  return {
    label: "Invited",
    tone: "neutral",
    companyHint: "Waiting for the vendor to open the link.",
    vendorHint: "Fill in the form and submit.",
  };
}

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-navy/10 text-navy",
  warning: "bg-warning/20 text-warning-foreground",
  success: "bg-success/15 text-success",
  danger: "bg-destructive/10 text-destructive",
};

export const TIMELINE_LABELS: Record<string, string> = {
  invitation_sent: "Invitation sent",
  invitation_resent: "Invitation re-sent",
  opened: "Form opened by vendor",
  submitted: "Submitted by vendor",
  resubmitted: "Corrections resubmitted",
  checks_failed: "Checks found items to fix",
  checks_passed: "All automated checks passed",
  changes_requested: "Company requested changes",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Link revoked",
};
