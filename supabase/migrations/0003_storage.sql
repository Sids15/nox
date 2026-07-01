-- Nox 0003 — private Storage buckets for note media + owner-only access policies.
-- Object path convention: {user_id}/{note_id}/<file>. The first path segment must equal
-- the caller's uid, so users can only touch their own files. MIME + size limits enforced here.

-- TODO(Phase 3): align allowed_mime_types with what expo-audio actually emits/infers for .m4a
-- (e.g. 'audio/x-m4a'); 'audio/m4a' is non-standard and may not match, rejecting uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio',    'audio',    false, 52428800, array['audio/m4a','audio/mp4','audio/aac','audio/mpeg']),
  ('sketches', 'sketches', false, 10485760, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare b text;
begin
  foreach b in array array['audio','sketches'] loop
    execute format('drop policy if exists %I_owner on storage.objects', b);
    execute format(
      'create policy %I_owner on storage.objects
         for all
         using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
         with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)',
      b, b, b);
  end loop;
end $$;
