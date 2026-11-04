begin;
create table if not exists public.buildly_credits(user_id uuid primary key references auth.users(id) on delete cascade, balance integer not null default 0 check(balance>=0));
create table if not exists public.buildly_receipts(transaction_id text primary key, user_id uuid not null references auth.users(id) on delete cascade, refunded boolean not null default false);
create table if not exists public.buildly_project_access(id text primary key, user_id uuid not null references auth.users(id) on delete cascade, root_id text not null, revisions integer not null default 3 check(revisions>=0));
create table if not exists public.buildly_reservations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade, project_id text not null, kind text not null, charge text not null, created_at timestamptz not null default now(), state text not null default 'pending');
alter table public.buildly_receipts add column if not exists allocated_to text;
alter table public.buildly_receipts add column if not exists created_at timestamptz not null default now();
alter table public.buildly_receipts add column if not exists units integer not null default 1 check(units in (1,2,4));
create table if not exists public.buildly_purchase_units (
 transaction_id text not null references public.buildly_receipts(transaction_id) on delete cascade,
 unit_index integer not null check(unit_index between 1 and 4),
 user_id uuid not null references auth.users(id) on delete cascade,
 allocated_to text,
 primary key(transaction_id,unit_index)
);
insert into public.buildly_purchase_units(transaction_id,unit_index,user_id,allocated_to)
select transaction_id,1,user_id,allocated_to from public.buildly_receipts where units=1
on conflict do nothing;
create index if not exists buildly_unallocated_units on public.buildly_purchase_units(user_id) where allocated_to is null;
alter table public.buildly_project_access add column if not exists purchase_transaction text references public.buildly_receipts(transaction_id);
alter table public.buildly_project_access add column if not exists purchase_unit integer;
update public.buildly_project_access set purchase_unit=1 where purchase_transaction is not null and purchase_unit is null
and exists(select 1 from public.buildly_receipts r where r.transaction_id=purchase_transaction and r.units=1);
alter table public.buildly_reservations add column if not exists request_id uuid;
alter table public.buildly_credits enable row level security;
alter table public.buildly_receipts enable row level security;
alter table public.buildly_project_access enable row level security;
alter table public.buildly_reservations enable row level security;
alter table public.buildly_purchase_units enable row level security;
revoke all on public.buildly_purchase_units from anon,authenticated;
grant all on public.buildly_purchase_units to service_role;
-- Keep the original API callable by older servers; new servers also supply the
-- durable request ID. Every balance/access mutation is service-role-only.
create or replace function public.buildly_purchase_pack(p_user uuid,p_transaction text,p_units integer,p_refund boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare existing public.buildly_receipts; unused integer; begin
 if p_units not in (1,2,4) then raise exception 'Invalid pack size'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 insert into buildly_credits(user_id) values(p_user) on conflict do nothing;
 select * into existing from buildly_receipts where transaction_id=p_transaction;
 if found then
  if existing.user_id<>p_user then raise exception 'Receipt owner mismatch'; end if;
  if existing.units<>p_units then raise exception 'Receipt pack mismatch'; end if;
  if p_refund and not existing.refunded then
   update buildly_receipts set refunded=true where transaction_id=p_transaction;
   select count(*) into unused from buildly_purchase_units where transaction_id=p_transaction and allocated_to is null;
   update buildly_credits set balance=greatest(0,balance-unused) where user_id=p_user;
  end if;
 else
  insert into buildly_receipts(transaction_id,user_id,refunded,units) values(p_transaction,p_user,p_refund,p_units);
  insert into buildly_purchase_units(transaction_id,unit_index,user_id) select p_transaction,n,p_user from generate_series(1,p_units) n;
  if not p_refund then update buildly_credits set balance=balance+p_units where user_id=p_user; end if;
 end if;
end $$;
create or replace function public.buildly_purchase(p_user uuid,p_transaction text,p_refund boolean default false) returns void language plpgsql security definer set search_path=public as $$
begin perform buildly_purchase_pack(p_user,p_transaction,1,p_refund); end $$;
create or replace function public.buildly_reserve_job(p_user uuid,p_project text,p_kind text,p_request uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare access public.buildly_project_access; charge_type text:='none'; rid uuid; stale public.buildly_reservations; transaction text; unit integer; durable boolean; begin
 if p_kind not in ('design','plan','chat') then raise exception 'Invalid operation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 for stale in select * from buildly_reservations where user_id=p_user and state='pending' and created_at<now()-interval '10 minutes' loop
  durable:=false;
  if stale.request_id is not null then
   if to_regclass('public.projects') is not null then
    execute 'select exists(select 1 from public.projects where id::text=$1 and user_id=$2)' into durable using stale.request_id::text,p_user;
   end if;
   if not durable and to_regclass('public.buildly_jobs') is not null then
    execute 'select exists(select 1 from public.buildly_jobs where id=$1 and user_id=$2 and result_id is not null)' into durable using stale.request_id,p_user;
   end if;
  end if;
  perform buildly_finish(p_user,stale.id,durable,case when durable and stale.kind='design' then stale.request_id::text else null end);
 end loop;
 if exists(select 1 from buildly_reservations where user_id=p_user and state='pending') then raise exception 'REQUEST_IN_PROGRESS'; end if;
 if (select count(*) from buildly_reservations where user_id=p_user and created_at>now()-interval '1 day' and state<>'released')>=100 then raise exception 'DAILY_LIMIT'; end if;
 select * into access from buildly_project_access where id=p_project and user_id=p_user;
 if not found then
  if p_kind='chat' then raise exception 'PAYMENT_REQUIRED'; end if;
  if exists(select 1 from buildly_project_access where id=p_project) then raise exception 'PROJECT_OWNER'; end if;
  update buildly_credits set balance=balance-1 where user_id=p_user and balance>0;
  if not found then raise exception 'PAYMENT_REQUIRED'; end if;
  select u.transaction_id,u.unit_index into transaction,unit from buildly_purchase_units u join buildly_receipts r using(transaction_id)
   where u.user_id=p_user and not r.refunded and u.allocated_to is null order by r.created_at,u.transaction_id,u.unit_index limit 1 for update of u;
  if transaction is null then raise exception 'PAYMENT_REQUIRED'; end if;
  update buildly_purchase_units set allocated_to=p_project where transaction_id=transaction and unit_index=unit;
  update buildly_receipts set allocated_to=p_project where transaction_id=transaction and units=1;
  insert into buildly_project_access(id,user_id,root_id,purchase_transaction,purchase_unit) values(p_project,p_user,p_project,transaction,unit);
  charge_type:='credit';
 else
  if exists(select 1 from buildly_project_access root join buildly_receipts receipt on root.purchase_transaction=receipt.transaction_id where root.id=access.root_id and root.user_id=p_user and receipt.refunded) then raise exception 'PROJECT_REFUNDED'; end if;
  if p_kind='design' then
   update buildly_project_access set revisions=revisions-1 where id=access.root_id and user_id=p_user and revisions>0;
   if not found then raise exception 'REVISIONS_USED'; end if;
   charge_type:='revision';
  end if;
 end if;
 insert into buildly_reservations(user_id,project_id,kind,charge,request_id) values(p_user,p_project,p_kind,charge_type,p_request) returning id into rid;
 return rid;
end $$;
create or replace function public.buildly_reserve(p_user uuid,p_project text,p_kind text) returns uuid language plpgsql security definer set search_path=public as $$
begin return buildly_reserve_job(p_user,p_project,p_kind,null); end $$;
create or replace function public.buildly_finish(p_user uuid,p_reservation uuid,p_success boolean,p_result text default null) returns void language plpgsql security definer set search_path=public as $$
declare reservation public.buildly_reservations; root text; transaction text; unit integer; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into reservation from buildly_reservations where id=p_reservation and user_id=p_user and state='pending' for update;
 if not found then return; end if;
 select root_id,purchase_transaction,purchase_unit into root,transaction,unit from buildly_project_access where id=reservation.project_id and user_id=p_user;
 if not p_success then
  if reservation.charge='credit' then
   if transaction is null or exists(select 1 from buildly_receipts where transaction_id=transaction and not refunded) then update buildly_credits set balance=balance+1 where user_id=p_user; end if;
   if transaction is not null then
    update buildly_purchase_units set allocated_to=null where transaction_id=transaction and unit_index=unit;
    update buildly_receipts set allocated_to=null where transaction_id=transaction and units=1;
   end if;
   delete from buildly_project_access where id=reservation.project_id and user_id=p_user;
  elsif reservation.charge='revision' then update buildly_project_access set revisions=revisions+1 where id=root and user_id=p_user; end if;
 elsif p_result is not null and p_result<>reservation.project_id then
  insert into buildly_project_access(id,user_id,root_id,revisions) values(p_result,p_user,root,0) on conflict(id) do nothing;
 end if;
 update buildly_reservations set state=case when p_success then 'complete' else 'released' end where id=p_reservation;
end $$;
revoke all on function public.buildly_purchase_pack(uuid,text,integer,boolean), public.buildly_purchase(uuid,text,boolean), public.buildly_reserve(uuid,text,text), public.buildly_reserve_job(uuid,text,text,uuid), public.buildly_finish(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.buildly_purchase_pack(uuid,text,integer,boolean), public.buildly_purchase(uuid,text,boolean), public.buildly_reserve(uuid,text,text), public.buildly_reserve_job(uuid,text,text,uuid), public.buildly_finish(uuid,uuid,boolean,text) to service_role;
commit;
