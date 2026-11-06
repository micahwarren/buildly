begin;
create table if not exists public.siteai_worker_replays(
 nonce uuid primary key,
 used_at timestamptz not null default now()
);
alter table public.siteai_worker_replays enable row level security;
revoke all on public.siteai_worker_replays from public,anon,authenticated;
grant all on public.siteai_worker_replays to service_role;
create or replace function public.siteai_worker_once(p_nonce uuid,p_sent bigint)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_nonce is null or p_sent is null or abs(extract(epoch from clock_timestamp())-p_sent)>120 then return false;end if;
 delete from siteai_worker_replays where used_at<now()-interval '5 minutes';
 insert into siteai_worker_replays(nonce) values(p_nonce) on conflict do nothing;
 return found;
end $$;
revoke all on function public.siteai_worker_once(uuid,bigint) from public,anon,authenticated;
grant execute on function public.siteai_worker_once(uuid,bigint) to service_role;
commit;
