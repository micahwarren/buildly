begin;
create table if not exists public.buildly_credits(user_id uuid primary key references auth.users(id) on delete cascade, balance integer not null default 0 check(balance>=0));
create table if not exists public.buildly_receipts(transaction_id text primary key, user_id uuid not null references auth.users(id) on delete cascade, refunded boolean not null default false);
create table if not exists public.buildly_project_access(id text primary key, user_id uuid not null references auth.users(id) on delete cascade, root_id text not null, revisions integer not null default 3 check(revisions>=0));
create table if not exists public.buildly_reservations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade, project_id text not null, kind text not null, charge text not null, created_at timestamptz not null default now(), state text not null default 'pending');
alter table public.buildly_credits enable row level security;
alter table public.buildly_receipts enable row level security;
alter table public.buildly_project_access enable row level security;
alter table public.buildly_reservations enable row level security;
-- All mutations happen through the authenticated application server, never the public key.
create or replace function public.buildly_purchase(p_user uuid,p_transaction text,p_refund boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare existing public.buildly_receipts; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 insert into buildly_credits(user_id) values(p_user) on conflict do nothing;
 select * into existing from buildly_receipts where transaction_id=p_transaction;
 if found then
  if existing.user_id<>p_user then raise exception 'Receipt owner mismatch'; end if;
  if p_refund and not existing.refunded then
   update buildly_receipts set refunded=true where transaction_id=p_transaction;
   update buildly_credits set balance=greatest(0,balance-1) where user_id=p_user;
  end if;
 else
  insert into buildly_receipts values(p_transaction,p_user,p_refund);
  if not p_refund then update buildly_credits set balance=balance+1 where user_id=p_user; end if;
 end if;
end $$;
create or replace function public.buildly_reserve(p_user uuid,p_project text,p_kind text) returns uuid language plpgsql security definer set search_path=public as $$
declare access public.buildly_project_access; charge_type text:='none'; rid uuid; stale uuid; begin
 if p_kind not in ('design','plan','chat') then raise exception 'Invalid operation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 for stale in select id from buildly_reservations where user_id=p_user and state='pending' and created_at<now()-interval '10 minutes' loop
  perform buildly_finish(p_user,stale,false,null);
 end loop;
 if exists(select 1 from buildly_reservations where user_id=p_user and state='pending') then raise exception 'REQUEST_IN_PROGRESS'; end if;
 if (select count(*) from buildly_reservations where user_id=p_user and created_at>now()-interval '1 day' and state<>'released')>=100 then raise exception 'DAILY_LIMIT'; end if;
 select * into access from buildly_project_access where id=p_project and user_id=p_user;
 if not found then
  if p_kind='chat' then raise exception 'PAYMENT_REQUIRED'; end if;
  if exists(select 1 from buildly_project_access where id=p_project) then raise exception 'PROJECT_OWNER'; end if;
  update buildly_credits set balance=balance-1 where user_id=p_user and balance>0;
  if not found then raise exception 'PAYMENT_REQUIRED'; end if;
  insert into buildly_project_access(id,user_id,root_id) values(p_project,p_user,p_project);
  charge_type:='credit';
 elsif p_kind='design' then
  update buildly_project_access set revisions=revisions-1 where id=access.root_id and user_id=p_user and revisions>0;
  if not found then raise exception 'REVISIONS_USED'; end if;
  charge_type:='revision';
 end if;
 insert into buildly_reservations(user_id,project_id,kind,charge) values(p_user,p_project,p_kind,charge_type) returning id into rid;
 return rid;
end $$;
create or replace function public.buildly_finish(p_user uuid,p_reservation uuid,p_success boolean,p_result text default null) returns void language plpgsql security definer set search_path=public as $$
declare reservation public.buildly_reservations; root text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into reservation from buildly_reservations where id=p_reservation and user_id=p_user and state='pending' for update;
 if not found then return; end if;
 select root_id into root from buildly_project_access where id=reservation.project_id and user_id=p_user;
 if not p_success then
  if reservation.charge='credit' then
   update buildly_credits set balance=balance+1 where user_id=p_user;
   delete from buildly_project_access where id=reservation.project_id and user_id=p_user;
  elsif reservation.charge='revision' then update buildly_project_access set revisions=revisions+1 where id=root and user_id=p_user; end if;
 elsif p_result is not null and p_result<>reservation.project_id then
  insert into buildly_project_access(id,user_id,root_id,revisions) values(p_result,p_user,root,0);
 end if;
 update buildly_reservations set state=case when p_success then 'complete' else 'released' end where id=p_reservation;
end $$;
revoke all on function public.buildly_purchase(uuid,text,boolean), public.buildly_reserve(uuid,text,text), public.buildly_finish(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.buildly_purchase(uuid,text,boolean), public.buildly_reserve(uuid,text,text), public.buildly_finish(uuid,uuid,boolean,text) to service_role;
commit;
