-- Run once in your Supabase project's SQL Editor. This creates new application
-- resources only; it does not modify Supabase auth.users or require a service key.
begin;
create table if not exists public.projects (
 id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id)
);
create index if not exists projects_user_updated_idx on public.projects(user_id,updated_at desc);
alter table public.projects enable row level security;
revoke all on public.projects from anon;
grant select,insert,update,delete on public.projects to authenticated;
drop policy if exists "owners_read_projects" on public.projects;
create policy "owners_read_projects" on public.projects for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "owners_insert_projects" on public.projects;
create policy "owners_insert_projects" on public.projects for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "owners_update_projects" on public.projects;
create policy "owners_update_projects" on public.projects for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "owners_delete_projects" on public.projects;
create policy "owners_delete_projects" on public.projects for delete to authenticated using ((select auth.uid())=user_id);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('project-images','project-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
do $$
begin
 if exists(select 1 from storage.buckets where id='project-images' and public=true) then
  raise exception 'project-images already exists as a public bucket. Make it private before applying this setup.';
 end if;
end $$;
drop policy if exists "owners_read_project_images" on storage.objects;
create policy "owners_read_project_images" on storage.objects for select to authenticated using (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "owners_insert_project_images" on storage.objects;
create policy "owners_insert_project_images" on storage.objects for insert to authenticated with check (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "owners_update_project_images" on storage.objects;
create policy "owners_update_project_images" on storage.objects for update to authenticated using (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "owners_delete_project_images" on storage.objects;
create policy "owners_delete_project_images" on storage.objects for delete to authenticated using (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
