-- One-time access for projects saved during the private beta, before paid
-- project creation. Keep their plan recovery usable without a new purchase.
-- The fixed cutoff makes reapplying this safe after billing is enabled.
-- No balance or receipt is created, and existing paid access is never changed.
begin;
insert into public.buildly_project_access(id,user_id,root_id,revisions)
select id,user_id,id,3 from public.projects
where deleted_at is null and created_at < timestamptz '2026-11-04T00:35:40Z'
on conflict (id) do nothing;
commit;
