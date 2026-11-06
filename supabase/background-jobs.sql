-- Durable inputs and worker leases. Apply after production.sql and billing.sql.
begin;
create table if not exists public.siteai_job_queue(
 job_id uuid primary key references public.buildly_jobs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload_text text,
 status text not null default 'queued' check(status in('queued','working','done','failed')),
 attempts integer not null default 0,
 lease uuid,
 due_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 check(payload_text is null or octet_length(payload_text)<=4400000)
);
create index if not exists siteai_job_queue_due on public.siteai_job_queue(due_at) where status in('queued','working');
alter table public.siteai_job_queue enable row level security;
revoke all on public.siteai_job_queue from public,anon,authenticated;
grant all on public.siteai_job_queue to service_role;
create or replace function public.siteai_enqueue_job(p_user uuid,p_id uuid,p_kind text,p_source text,p_hash text,p_input text,p_daily integer,p_global integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_input is null or octet_length(p_input)>4400000 or p_hash<>encode(sha256(convert_to(p_kind||E'\n'||p_input,'UTF8')),'hex') then raise exception 'INVALID_JOB'; end if;
 result:=buildly_claim_job(p_user,p_id,p_kind,p_source,p_hash,p_daily,p_global);
 if (result->>'claimed')::boolean then
  insert into siteai_job_queue(job_id,user_id,payload_text) values(p_id,p_user,p_input);
 end if;
 return result;
end $$;
create or replace function public.siteai_claim_queued_job(p_id uuid,p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.siteai_job_queue;j public.buildly_jobs; r record; durable text;
begin
 select * into q from siteai_job_queue where job_id=p_id for update skip locked;
 if not found or q.status not in('queued','working') or q.due_at>now() then return null; end if;
 select * into j from buildly_jobs where id=q.job_id and user_id=q.user_id for update;
 if not found then return null; end if;
 if j.state='complete' then update siteai_job_queue set status='done',payload_text=null,lease=null where job_id=p_id;return null;end if;
 if exists(select 1 from buildly_account_state where user_id=q.user_id and deleting_at is not null) then
  update siteai_job_queue set status='failed',payload_text=null,lease=null where job_id=p_id;return null;
 end if;
 -- A terminated worker cannot keep a token reserved or cause another image to be charged.
 -- Its 320-second lease exceeds the function's 300-second execution limit.
 if q.attempts>0 then
  durable:=j.result_id;
  if durable is null then select id into durable from projects where id=p_id::text and user_id=q.user_id and deleted_at is null; end if;
  for r in select id from buildly_reservations where user_id=q.user_id and request_id=p_id and state='pending' loop
   perform buildly_finish(q.user_id,r.id,durable is not null,durable);
  end loop;
  if durable is not null then update buildly_jobs set result_id=durable,state='image_saved' where id=p_id; end if;
 end if;
 if q.attempts>=3 or q.created_at<now()-interval '30 minutes' then
  update siteai_job_queue set status='failed',payload_text=null,lease=null where job_id=p_id;
  update buildly_jobs set state='failed',failure_code='background_timeout',failure_message='Your request could not finish. Your saved design is kept. Contact support for help.',updated_at=now() where id=p_id;
  return null;
 end if;
 update siteai_job_queue set status='working',attempts=attempts+1,lease=p_lease,due_at=now()+interval '320 seconds' where job_id=p_id returning * into q;
 update buildly_jobs set state=case when result_id is null then 'running' else 'image_saved' end,expires_at=now()+interval '7 minutes',failure_code=null,failure_message=null,updated_at=now() where id=p_id returning * into j;
 return jsonb_build_object('job',to_jsonb(j),'input',q.payload_text,'attempt',q.attempts);
end $$;
create or replace function public.siteai_finish_queued_job(p_id uuid,p_lease uuid,p_retry boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.siteai_job_queue;j public.buildly_jobs;
begin
 select * into q from siteai_job_queue where job_id=p_id and lease=p_lease for update;
 if not found then return; end if;
 select * into j from buildly_jobs where id=p_id;
 if j.state='complete' then
  update siteai_job_queue set status='done',payload_text=null,lease=null where job_id=p_id;
 elsif p_retry and q.attempts<3 then
  update siteai_job_queue set status='queued',lease=null,due_at=now()+interval '15 seconds' where job_id=p_id;
  update buildly_jobs set state=case when result_id is null then 'running' else 'image_saved' end,failure_code=case when result_id is null then null else 'background_plan' end,expires_at=now()+interval '7 minutes' where id=p_id;
 else
  update siteai_job_queue set status='failed',payload_text=null,lease=null where job_id=p_id;
  if j.state in('running','image_saved') then update buildly_jobs set state='failed',failure_code=coalesce(failure_code,'background_failed'),failure_message=coalesce(failure_message,'Your request could not finish. Contact support for help.'),updated_at=now() where id=p_id;end if;
 end if;
end $$;
revoke all on function public.siteai_enqueue_job(uuid,uuid,text,text,text,text,integer,integer),public.siteai_claim_queued_job(uuid,uuid),public.siteai_finish_queued_job(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.siteai_enqueue_job(uuid,uuid,text,text,text,text,integer,integer),public.siteai_claim_queued_job(uuid,uuid),public.siteai_finish_queued_job(uuid,uuid,boolean) to service_role;
commit;
