-- Apply after billing.sql. Adds replay protection without changing customer balances,
-- existing account deletion, or the legacy/beta reservation functions.
begin;
create table if not exists public.siteai_purchase_fingerprints (
 transaction_hash bytea primary key,
 account_hash bytea not null
);
alter table public.siteai_purchase_fingerprints enable row level security;
revoke all on public.siteai_purchase_fingerprints from public,anon,authenticated;
grant all on public.siteai_purchase_fingerprints to service_role;
insert into public.siteai_purchase_fingerprints(transaction_hash,account_hash)
select sha256(convert_to(transaction_id,'UTF8')),sha256(convert_to(user_id::text,'UTF8'))
from public.buildly_receipts on conflict do nothing;
-- Preserve the deployed function's implementation and permissions. In particular,
-- do not reapply billing.sql and accidentally replace later reservation upgrades.
do $migration$
declare original text; updated text;
 needle text := 'perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));';
begin
 original := pg_get_functiondef('public.buildly_purchase_pack(uuid,text,integer,boolean)'::regprocedure);
 if position('siteai_purchase_fingerprints' in original)=0 then
  updated := replace(original,needle,needle || $guard$
 perform pg_advisory_xact_lock(hashtextextended('siteai_receipt:'||p_transaction,0));
 if exists(select 1 from public.siteai_purchase_fingerprints
  where transaction_hash=sha256(convert_to(p_transaction,'UTF8'))
  and account_hash<>sha256(convert_to(p_user::text,'UTF8')))
 then raise exception 'RECEIPT_RETIRED: Receipt owner mismatch'; end if;
 insert into public.siteai_purchase_fingerprints(transaction_hash,account_hash)
 values(sha256(convert_to(p_transaction,'UTF8')),sha256(convert_to(p_user::text,'UTF8')))
 on conflict do nothing;
$guard$);
  if updated=original then raise exception 'Purchase function requires a reviewed migration'; end if;
  execute updated;
 end if;
end $migration$;
commit;
