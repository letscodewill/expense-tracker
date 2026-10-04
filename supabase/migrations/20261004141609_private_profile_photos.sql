insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos','profile-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy profile_photos_read_own on storage.objects for select to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy profile_photos_insert_own on storage.objects for insert to authenticated
with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy profile_photos_delete_own on storage.objects for delete to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
