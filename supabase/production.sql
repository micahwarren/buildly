-- Apply after setup.sql. No purchase, price, credit or receipt tables are changed.
begin;
create table if not exists public.buildly_account_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 deleting_at timestamptz
);
create table if not exists public.buildly_jobs (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('design','refine','plan')),
 source_id text,
 request_hash text not null,
 state text not null default 'running' check(state in ('running','image_saved','complete','failed','interrupted')),
 result_id text,
 failure_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 minutes'
);
create index if not exists buildly_jobs_user_created on public.buildly_jobs(user_id,created_at desc);
create index if not exists buildly_jobs_created on public.buildly_jobs(created_at);
alter table public.buildly_account_state enable row level security;
alter table public.buildly_jobs enable row level security;
revoke all on public.buildly_account_state,public.buildly_jobs from anon,authenticated;
grant all on public.buildly_account_state,public.buildly_jobs to service_role;
alter table public.projects add column if not exists deleted_at timestamptz;
drop policy if exists owners_read_projects on public.projects;
create policy owners_read_projects on public.projects for select to authenticated using ((select auth.uid())=user_id and deleted_at is null);
-- Claim + limits are one transaction, shared across server instances.
create or replace function public.buildly_claim_job(p_user uuid,p_id uuid,p_kind text,p_source text,p_hash text,p_daily integer default 20,p_global integer default 200)
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.buildly_jobs; begin
 if p_kind not in ('design','refine','plan') or p_daily not between 1 and 100 or p_global not between 1 and 10000 then raise exception 'INVALID_JOB'; end if;
 perform pg_advisory_xact_lock(hashtextextended('buildly_global_jobs',0));
 if exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null) then raise exception 'ACCOUNT_DELETING'; end if;
 select * into job from buildly_jobs where id=p_id;
 if found then
  if job.user_id<>p_user then raise exception 'JOB_NOT_FOUND'; end if;
  if job.request_hash<>p_hash or job.kind<>p_kind then raise exception 'JOB_CONFLICT'; end if;
  if job.state in ('running','image_saved') and job.expires_at<now() then
   update buildly_jobs set state='interrupted',updated_at=now() where id=p_id returning * into job;
  end if;
  return jsonb_build_object('claimed',false,'job',to_jsonb(job));
 end if;
 update buildly_jobs set state='interrupted',updated_at=now() where user_id=p_user and state in ('running','image_saved') and expires_at<now();
 if exists(select 1 from buildly_jobs where user_id=p_user and state in ('running','image_saved')) then raise exception 'REQUEST_IN_PROGRESS'; end if;
 if p_source is not null and not exists(select 1 from projects where id=p_source and user_id=p_user and deleted_at is null) then raise exception 'PROJECT_NOT_FOUND'; end if;
 if (select count(*) from buildly_jobs where state in ('running','image_saved') and expires_at>now())>=5 then raise exception 'SERVICE_BUSY'; end if;
 if (select count(*) from buildly_jobs where user_id=p_user and created_at>now()-interval '15 minutes')>=6 then raise exception 'SHORT_LIMIT'; end if;
 if (select count(*) from buildly_jobs where user_id=p_user and created_at>now()-interval '24 hours')>=p_daily then raise exception 'DAILY_LIMIT'; end if;
 if (select count(*) from buildly_jobs where created_at>now()-interval '24 hours')>=p_global then raise exception 'SERVICE_LIMIT'; end if;
 insert into buildly_jobs(id,user_id,kind,source_id,request_hash) values(p_id,p_user,p_kind,p_source,p_hash) returning * into job;
 return jsonb_build_object('claimed',true,'job',to_jsonb(job));
end $$;
create or replace function public.buildly_begin_deletion(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('buildly_global_jobs',0));
 if exists(select 1 from buildly_jobs where user_id=p_user and state in ('running','image_saved') and expires_at>now()) then raise exception 'REQUEST_IN_PROGRESS'; end if;
 insert into buildly_account_state(user_id,deleting_at) values(p_user,now()) on conflict(user_id) do update set deleting_at=excluded.deleting_at;
end $$;
revoke all on function public.buildly_claim_job(uuid,uuid,text,text,text,integer,integer), public.buildly_begin_deletion(uuid) from public,anon,authenticated;
grant execute on function public.buildly_claim_job(uuid,uuid,text,text,text,integer,integer), public.buildly_begin_deletion(uuid) to service_role;
-- Atomic project deletion uses the same lock as operation claims.
create or replace function public.buildly_mark_project_deleted(p_user uuid,p_project text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('buildly_global_jobs',0));
 if exists(select 1 from buildly_jobs where user_id=p_user and (source_id=p_project or result_id=p_project or id::text=p_project) and state in ('running','image_saved') and expires_at>now()) then raise exception 'REQUEST_IN_PROGRESS'; end if;
 update projects set deleted_at=now() where id=p_project and user_id=p_user;
 return found;
end $$;
revoke all on function public.buildly_mark_project_deleted(uuid,text) from public,anon,authenticated;
grant execute on function public.buildly_mark_project_deleted(uuid,text) to service_role;
create table if not exists public.buildly_diagnostics (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete cascade,
 code text not null check(code in ('screen_error','connection_error')),
 platform text not null check(platform in ('ios','android','web')),
 release text not null,
 fingerprint text not null,
 created_at timestamptz not null default now()
);
create index if not exists buildly_diagnostics_created on public.buildly_diagnostics(created_at);
alter table public.buildly_diagnostics enable row level security;
revoke all on public.buildly_diagnostics from anon,authenticated;
grant all on public.buildly_diagnostics to service_role;
create or replace function public.buildly_report_diagnostic(p_user uuid,p_code text,p_platform text,p_release text,p_fingerprint text) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('buildly_diagnostic_'||p_user::text,0));
 if (select count(*) from buildly_diagnostics where user_id=p_user and created_at>now()-interval '1 day')>=10 then return; end if;
 insert into buildly_diagnostics(user_id,code,platform,release,fingerprint) values(p_user,p_code,p_platform,left(p_release,40),left(p_fingerprint,64));
end $$;
revoke all on function public.buildly_report_diagnostic(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.buildly_report_diagnostic(uuid,text,text,text,text) to service_role;

-- A deleting account cannot upload new photos or rewrite tombstoned rows.
create or replace function public.buildly_account_writable() returns boolean
language plpgsql volatile security definer set search_path=public as $$
begin
 -- Serialize direct client writes with deletion claims. A write authorized before
 -- deletion must commit before cleanup starts; later writes see the deletion fence.
 perform pg_advisory_xact_lock(hashtextextended('buildly_global_jobs',0));
 return auth.uid() is not null
  and exists(select 1 from auth.users where id=auth.uid())
  and not exists(select 1 from buildly_account_state where user_id=auth.uid() and deleting_at is not null);
end $$;
revoke all on function public.buildly_account_writable() from public,anon;
grant execute on function public.buildly_account_writable() to authenticated,service_role;
drop policy if exists owners_insert_projects on public.projects;
create policy owners_insert_projects on public.projects for insert to authenticated
 with check ((select auth.uid())=user_id and deleted_at is null and (select buildly_account_writable()));
drop policy if exists owners_update_projects on public.projects;
create policy owners_update_projects on public.projects for update to authenticated
 using ((select auth.uid())=user_id and deleted_at is null and (select buildly_account_writable()))
 with check ((select auth.uid())=user_id and deleted_at is null and (select buildly_account_writable()));
drop policy if exists owners_insert_project_images on storage.objects;
create policy owners_insert_project_images on storage.objects for insert to authenticated
 with check (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text and (select buildly_account_writable()));
drop policy if exists owners_update_project_images on storage.objects;
create policy owners_update_project_images on storage.objects for update to authenticated
 using (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text and (select buildly_account_writable()))
 with check (bucket_id='project-images' and (storage.foldername(name))[1]=(select auth.uid())::text and (select buildly_account_writable()));
commit;
