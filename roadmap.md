# TendToVend — Build Roadmap

B2B vendor onboarding & verification SaaS for Indian businesses. Spec: user-uploaded markdown (Build_TendToVend).

## Phase 1 — Foundation
- [x] Enable Lovable Cloud (database, auth, storage)
- [x] Roadmap created
- [ ] Database schema: organisations, organisation_members, forms, form_versions, form_sections, form_fields, invitations, submissions, submission_values, documents, verification_runs, verification_checks, follow_up_communications, approved_vendors, vendor_approvals, audit_logs, integrations — with RLS + GRANTs + indexes
- [ ] Auth: company signup (company name, email, contact person, phone, password), org owner auto-created, roles (owner/admin/reviewer), team invites
- [ ] Design system (navy #102849, yellow #FACC15, bg #F8FAFC) in src/styles.css

## Phase 2 — App surfaces
- [ ] Landing page (/): hero, features, how-it-works, footer, CTAs
- [ ] Auth pages: sign in, sign up, reset password
- [ ] Dashboard shell: sidebar (Overview, Forms, Vendors, Verification Queue, Team, Integrations, Settings), real metrics
- [ ] Forms list + three-panel form builder (field library, preview, config) with custom sections/fields, required toggles, reorder, drafts, publish, versioning
- [ ] Invitations: single, bulk, CSV upload, statuses, resend, revoke

## Phase 3 — Vendor side
- [ ] Vendor portal via secure expiring token: branded form, sections order, required marks, uploads (PDF/JPG/PNG), save & return, review screen, reference number, status timeline
- [ ] Resend email delivery via connector (invitation + follow-ups + approval)

## Phase 4 — Verification & review
- [ ] Verification engine (server-side): completeness, format validation (PAN/GSTIN/IFSC/PIN/phone), GSTIN checksum + embedded PAN, cross-document consistency, name comparisons, duplicate detection, OCR extraction via Lovable AI Gateway, external-verification provider hook (explicitly "not externally verified" when unconfigured)
- [ ] Follow-up workflow: consolidated issue email, correction link, resubmission re-runs, no duplicate follow-ups
- [ ] Verification queue + detailed report UI, manual corrections retaining originals, exceptions with reason/reviewer/timestamp + second approval for sensitive
- [ ] Approve/reject + approved vendor registry, CSV export, integrations page (labelled unconfigured until connected)

## Phase 5 — Quality
- [ ] End-to-end browser test: signup → form → invite → vendor submit → verification → follow-up → approve → export
- [ ] Head metadata on all routes, build clean
