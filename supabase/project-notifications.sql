begin;
alter table public.siteai_job_queue add column if not exists notification_checked boolean not null default false;
create table if not exists public.siteai_push_devices(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 token text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in('ios','android')),
 enabled boolean not null default true,
 registered_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists siteai_push_devices_owner on public.siteai_push_devices(user_id);
create table if not exists public.siteai_push_outbox(
 job_id uuid not null references public.buildly_jobs(id) on delete cascade,
 device_hash text not null references public.siteai_push_devices(token_hash) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 project_id text not null,
 state text not null default 'pending' check(state in('pending','sending','accepted','sent','failed')),
 lease uuid,
 attempts integer not null default 0,
 ticket text,
 error_code text,
 due_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(project_id,device_hash),
 primary key(job_id,device_hash)
);
alter table public.siteai_push_devices enable row level security;
alter table public.siteai_push_outbox enable row level security;
revoke all on public.siteai_push_devices,public.siteai_push_outbox from public,anon,authenticated;
grant all on public.siteai_push_devices,public.siteai_push_outbox to service_role;
create or replace function public.siteai_register_push(p_user uuid,p_hash text,p_token text,p_platform text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{16,255}\]$' or p_platform is null or p_platform not in('ios','android') then raise exception 'INVALID_PUSH'; end if;
 perform pg_advisory_xact_lock(hashtextextended('siteai_push_'||p_user::text,0));
 if not exists(select 1 from auth.users where id=p_user) or exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null) then raise exception 'ACCOUNT_DELETING'; end if;
 -- One installation belongs to the currently signed-in account only.
 insert into siteai_push_devices(token_hash,token,user_id,platform) values(p_hash,p_token,p_user,p_platform)
 on conflict(token_hash) do update set user_id=excluded.user_id,token=excluded.token,platform=excluded.platform,enabled=true,registered_at=case when siteai_push_devices.user_id<>excluded.user_id then now() else siteai_push_devices.registered_at end,updated_at=now();
 update siteai_push_devices set enabled=false where token_hash in(select token_hash from siteai_push_devices where user_id=p_user and enabled order by updated_at desc offset 5);
end $$;
create or replace function public.siteai_notify_ready(p_user uuid,p_id uuid,p_project text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from siteai_job_queue where job_id=p_id and user_id=p_user and not notification_checked for update;
 if not found then return;end if;
 if not exists(select 1 from buildly_jobs j join projects p on p.id=j.result_id and p.user_id=j.user_id where j.id=p_id and j.user_id=p_user and j.result_id=p_project and j.state='complete' and p.deleted_at is null and p.payload->>'planStatus'='design-based') then return; end if;
 if exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null) then return;end if;
 insert into siteai_push_outbox(job_id,device_hash,user_id,project_id)
 select p_id,d.token_hash,p_user,p_project from siteai_push_devices d join buildly_jobs j on j.id=p_id
 where d.user_id=p_user and d.enabled and d.updated_at>now()-interval '30 days' and j.created_at>=d.registered_at-interval '5 minutes'
 on conflict do nothing;
 update siteai_job_queue set notification_checked=true where job_id=p_id;
end $$;
create or replace function public.siteai_claim_push(p_lease uuid)
returns setof jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;
begin
 update siteai_push_outbox set state='failed',error_code='delivery_timeout' where (state in('pending','sending') and attempts>=4 and due_at<=now()) or (state='accepted' and created_at<now()-interval '24 hours');
 for r in select o.* from siteai_push_outbox o where o.state in('pending','sending') and o.due_at<=now() and o.attempts<4 order by o.created_at for update skip locked limit 10 loop
  if not exists(select 1 from siteai_push_devices where token_hash=r.device_hash and user_id=r.user_id and enabled) or exists(select 1 from buildly_account_state where user_id=r.user_id and deleting_at is not null) then
   update siteai_push_outbox set state='failed',error_code='inactive' where job_id=r.job_id and device_hash=r.device_hash;
   continue;
  end if;
  update siteai_push_outbox set state='sending',lease=p_lease,attempts=attempts+1,due_at=now()+interval '90 seconds' where job_id=r.job_id and device_hash=r.device_hash;
  return next jsonb_build_object('jobId',r.job_id,'projectId',r.project_id,'userId',r.user_id,'deviceHash',r.device_hash,'token',(select token from siteai_push_devices where token_hash=r.device_hash),'attempt',r.attempts+1);
 end loop;
end $$;
revoke all on function public.siteai_register_push(uuid,text,text,text),public.siteai_notify_ready(uuid,uuid,text),public.siteai_claim_push(uuid) from public,anon,authenticated;
grant execute on function public.siteai_register_push(uuid,text,text,text),public.siteai_notify_ready(uuid,uuid,text),public.siteai_claim_push(uuid) to service_role;
commit;
