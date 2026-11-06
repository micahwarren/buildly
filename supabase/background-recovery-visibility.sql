begin;
alter table public.buildly_jobs add column if not exists dismissed_at timestamptz;
commit;
