-- ============ Vendor workflow: drafts, one submission per invitation, document storage ============

-- Vendors can save a half-filled form and come back to it from the same link.
alter table public.invitations add column if not exists draft_values jsonb not null default '{}'::jsonb;

-- One live submission per invitation; corrections update it instead of creating duplicates.
create unique index if not exists uniq_submissions_invitation
  on public.submissions(invitation_id)
  where invitation_id is not null;

create index if not exists idx_audit_entity on public.audit_logs(entity_id, created_at);

-- Private bucket for vendor documents. Objects are stored as {organisation_id}/{invitation_id}/{field_key}/{file}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-documents', 'vendor-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Workspace members can read (download) their own organisation's vendor documents.
-- Vendors upload through short-lived signed upload URLs issued by the server, so no anon policy is needed.
drop policy if exists "vendor_docs_member_read" on storage.objects;
create policy "vendor_docs_member_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vendor-documents'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
