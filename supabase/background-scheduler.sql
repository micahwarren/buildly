-- Install pg_cron and pg_net first. Save a dedicated worker credential in Vault
-- as siteai_background_worker_token and the matching Vercel production variable
-- SITEAI_JOB_WORKER_TOKEN. This migration contains no secret value.
create or replace function public.siteai_kick_worker() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare worker_token text;sent bigint;nonce uuid;signature text;
begin
 if not exists(select 1 from public.siteai_job_queue where status in('queued','working') and due_at<=now())
 and not exists(select 1 from public.siteai_job_queue where status='done' and not notification_checked)
 and not exists(select 1 from public.siteai_push_outbox where state in('pending','sending','accepted') and due_at<=now()) then return;end if;
 select decrypted_secret into worker_token from vault.decrypted_secrets where name='siteai_background_worker_token' limit 1;
 if worker_token is null then raise warning 'Site AI background worker is not configured';return;end if;
 sent:=floor(extract(epoch from clock_timestamp()))::bigint;
 nonce:=gen_random_uuid();
 signature:=encode(extensions.hmac(convert_to(sent::text||'.'||nonce::text,'UTF8'),convert_to(worker_token,'UTF8'),'sha256'),'hex');
 perform net.http_post(url:='https://site-ai-nomapps.vercel.app/api/jobs/worker',headers:=jsonb_build_object('Content-Type','application/json','x-siteai-time',sent::text,'x-siteai-nonce',nonce::text,'x-siteai-signature',signature),body:='{}'::jsonb,timeout_milliseconds:=5000);
end $$;
revoke all on function public.siteai_kick_worker() from public,anon,authenticated;
grant execute on function public.siteai_kick_worker() to service_role;
-- Named jobs are updated idempotently. Activate only after the signed worker
-- endpoint and matching credential have been verified on the live deployment.
select cron.schedule('siteai-background-jobs','* * * * *','select public.siteai_kick_worker();');
select cron.alter_job(job_id:=jobid,active:=false) from cron.job where jobname='siteai-background-jobs';
