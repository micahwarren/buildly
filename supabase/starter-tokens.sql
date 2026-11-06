-- One-time launch grants and future verified-identity/device starter grants.
-- Run after setup.sql, billing.sql, production.sql and receipt-fingerprints.sql.
begin;
create table if not exists public.siteai_starter_campaign(
 singleton boolean primary key default true check(singleton),
 cohort_cutoff timestamptz not null default now()
);
insert into public.siteai_starter_campaign(singleton) values(true) on conflict do nothing;
create table if not exists public.siteai_starter_claims(
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 account_hash text not null unique check(account_hash ~ '^[a-f0-9]{64}$'),
 identity_hashes text[] not null,
 state text not null default 'pending' check(state in('pending','verified','granted')),
 cohort boolean not null default false,
 device_linked boolean not null default false,
 attempt_day date not null default current_date,
 attempts integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.siteai_starter_identities(
 identity_hash text primary key check(identity_hash ~ '^[a-f0-9]{64}$'),
 claim_id uuid not null references public.siteai_starter_claims(id)
);
create table if not exists public.siteai_starter_mutex(
 singleton boolean primary key default true check(singleton),
 lease uuid,
 expires_at timestamptz
);
insert into public.siteai_starter_mutex(singleton) values(true) on conflict do nothing;
alter table public.siteai_starter_campaign enable row level security;
alter table public.siteai_starter_claims enable row level security;
alter table public.siteai_starter_identities enable row level security;
alter table public.siteai_starter_mutex enable row level security;
revoke all on public.siteai_starter_campaign,public.siteai_starter_claims,public.siteai_starter_identities,public.siteai_starter_mutex from public,anon,authenticated;
grant all on public.siteai_starter_campaign,public.siteai_starter_claims,public.siteai_starter_identities,public.siteai_starter_mutex to service_role;

create or replace function public.siteai_starter_begin(p_user uuid,p_account text,p_identities text[],p_lease uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.siteai_starter_claims; h text;
begin
 if p_account !~ '^[a-f0-9]{64}$' or coalesce(array_length(p_identities,1),0) not between 1 and 8
 or exists(select 1 from unnest(p_identities) as supplied(value) where supplied.value is null or supplied.value !~ '^[a-f0-9]{64}$') then raise exception 'INVALID_STARTER_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from auth.users where id=p_user) or exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null) then raise exception 'ACCOUNT_DELETING'; end if;
 insert into siteai_starter_claims(user_id,account_hash,identity_hashes) values(p_user,p_account,p_identities) on conflict(account_hash) do nothing;
 select * into c from siteai_starter_claims where account_hash=p_account and user_id=p_user for update;
 if not found then raise exception 'STARTER_OWNER'; end if;
 if c.state='granted' then
  foreach h in array p_identities loop insert into siteai_starter_identities values(h,c.id) on conflict do nothing; end loop;
  if c.device_linked then return jsonb_build_object('state','granted','id',c.id); end if;
 elsif exists(select 1 from siteai_starter_identities i join siteai_starter_claims other on other.id=i.claim_id where i.identity_hash=any(p_identities) and other.account_hash<>p_account and other.state in('verified','granted')) then
  return jsonb_build_object('state','used','id',c.id);
 end if;
 update siteai_starter_mutex set lease=p_lease,expires_at=now()+interval '90 seconds'
 where singleton and (expires_at is null or expires_at<now());
 if not found then return jsonb_build_object('state','busy'); end if;
 if c.state<>'verified' and c.attempt_day=current_date and c.attempts>=5 then
  update siteai_starter_mutex set lease=null,expires_at=null where lease=p_lease;
  return jsonb_build_object('state','limited');
 end if;
 update siteai_starter_claims set attempts=case when attempt_day=current_date then attempts+1 else 1 end,
 attempt_day=current_date,identity_hashes=(select array_agg(distinct x) from unnest(identity_hashes||p_identities)x)
 where id=c.id;
 return jsonb_build_object('id',c.id,'state',c.state,'cohort',c.cohort,'lease',true);
end $$;

create or replace function public.siteai_starter_verify(p_user uuid,p_claim uuid,p_lease uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c public.siteai_starter_claims; h text;
begin
 if not exists(select 1 from siteai_starter_mutex where lease=p_lease and expires_at>now()) then raise exception 'STARTER_LEASE_EXPIRED'; end if;
 select * into c from siteai_starter_claims where id=p_claim and user_id=p_user for update;
 if not found then raise exception 'STARTER_OWNER'; end if;
 foreach h in array c.identity_hashes loop
  if exists(select 1 from siteai_starter_identities where identity_hash=h and claim_id<>c.id) and c.state<>'granted' then raise exception 'STARTER_ALREADY_USED'; end if;
  insert into siteai_starter_identities values(h,c.id) on conflict do nothing;
 end loop;
 update siteai_starter_claims set device_linked=true,state=case when state='granted' then state else 'verified' end where id=c.id;
end $$;

create or replace function public.siteai_starter_complete(p_user uuid,p_claim uuid,p_lease uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c public.siteai_starter_claims;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from siteai_starter_mutex where lease=p_lease and expires_at>now()) then raise exception 'STARTER_LEASE_EXPIRED'; end if;
 if exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null) then raise exception 'ACCOUNT_DELETING'; end if;
 select * into c from siteai_starter_claims where id=p_claim and user_id=p_user for update;
 if not found then raise exception 'STARTER_OWNER'; end if;
 if c.state not in('verified','granted') or not c.device_linked then raise exception 'STARTER_NOT_VERIFIED'; end if;
 if c.state<>'granted' then
  perform buildly_purchase_pack(p_user,'STARTER:'||c.id::text,1,false);
  update siteai_starter_claims set state='granted' where id=c.id;
 end if;
end $$;

create or replace function public.siteai_starter_release(p_lease uuid)
returns void language plpgsql security definer set search_path=public as $$
begin update siteai_starter_mutex set lease=null,expires_at=null where lease=p_lease; end $$;

create or replace function public.siteai_starter_seed(p_user uuid,p_account text,p_identities text[])
returns boolean language plpgsql security definer set search_path=public as $$
declare c public.siteai_starter_claims; h text;
begin
 if not exists(select 1 from auth.users u cross join siteai_starter_campaign s where u.id=p_user and u.created_at<=s.cohort_cutoff) then return false; end if;
 if exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null) then return false; end if;
 if p_account !~ '^[a-f0-9]{64}$' or coalesce(array_length(p_identities,1),0) not between 1 and 8
 or exists(select 1 from unnest(p_identities) as supplied(value) where supplied.value is null or supplied.value !~ '^[a-f0-9]{64}$') then raise exception 'INVALID_STARTER_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 insert into siteai_starter_claims(user_id,account_hash,identity_hashes,cohort) values(p_user,p_account,p_identities,true) on conflict(account_hash) do nothing;
 select * into c from siteai_starter_claims where account_hash=p_account and user_id=p_user for update;
 if not found then raise exception 'STARTER_OWNER'; end if;
 if c.state='granted' then return false; end if;
 foreach h in array p_identities loop insert into siteai_starter_identities values(h,c.id) on conflict do nothing; end loop;
 perform buildly_purchase_pack(p_user,'STARTER:'||c.id::text,1,false);
 update siteai_starter_claims set state='granted',cohort=true where id=c.id;
 return true;
end $$;
revoke all on function public.siteai_starter_begin(uuid,text,text[],uuid),public.siteai_starter_verify(uuid,uuid,uuid),public.siteai_starter_complete(uuid,uuid,uuid),public.siteai_starter_release(uuid),public.siteai_starter_seed(uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.siteai_starter_begin(uuid,text,text[],uuid),public.siteai_starter_verify(uuid,uuid,uuid),public.siteai_starter_complete(uuid,uuid,uuid),public.siteai_starter_release(uuid),public.siteai_starter_seed(uuid,text,text[]) to service_role;
commit;
