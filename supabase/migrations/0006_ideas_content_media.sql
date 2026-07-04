-- Nox 0006 — free-flow ideas: block content on ideas + an images storage bucket.
-- Ideas become iOS-Notes-style documents (text/links/images/voice). Apply after 0001–0005.

-- ── Ideas: block-JSON content ────────────────────────────────────────────────
alter table public.ideas
  add column if not exists content jsonb not null default '[]'::jsonb;

-- Carry existing plain descriptions into the new editor as a first paragraph block.
update public.ideas
  set content = jsonb_build_array(jsonb_build_object('type', 'paragraph', 'text', description))
  where content = '[]'::jsonb and description is not null and description <> '';

-- ── Images bucket (private; note/idea photos) ────────────────────────────────
-- Path convention: {user_id}/{parent_id}/<file>. Owner-only, mirroring 0003.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists images_owner on storage.objects;
create policy images_owner on storage.objects
  for all
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
