begin;
create or replace function public.siteai_project_progress(p_user uuid,p_project text,p_step integer,p_title text,p_done boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare doc jsonb; ids integer[]; n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('buildly_global_jobs',0));
 if exists(select 1 from buildly_account_state where user_id=p_user and deleting_at is not null)then raise exception 'ACCOUNT_DELETING';end if;
 select payload into doc from projects where user_id=p_user and id=p_project and deleted_at is null for update;
 if not found then raise exception 'PROJECT_NOT_FOUND';end if;
 n=jsonb_array_length(case when jsonb_typeof(doc->'steps')='array' then doc->'steps' else '[]'::jsonb end);
 if p_step is null or p_done is null or p_step<0 or p_step>=n or (doc->'steps'->p_step->>'title')is distinct from p_title then raise exception 'PLAN_CHANGED';end if;
 if jsonb_typeof(doc->'completedSteps')='array' then
  select coalesce(array_agg(distinct i order by i),'{}') into ids from (
   select case when value::text~'^[0-9]{1,3}$' then value::text::integer else -1 end as i from jsonb_array_elements(doc->'completedSteps')
  )s where i>=0 and i<n;
 else
  select coalesce(array_agg(i),'{}')into ids from generate_series(0,case when doc->>'completed'~'^[0-9]{1,3}$' then least((doc->>'completed')::integer,n)else 0 end-1)i;
 end if;
 if p_done then ids=array_append(ids,p_step);else ids=array_remove(ids,p_step);end if;
 select coalesce(array_agg(distinct i order by i),'{}')into ids from unnest(ids)i;
 update projects set payload=payload||jsonb_build_object('completedSteps',to_jsonb(ids),'completed',cardinality(ids)),updated_at=now() where user_id=p_user and id=p_project;
 return jsonb_build_object('completedSteps',to_jsonb(ids));
end $$;
revoke all on function public.siteai_project_progress(uuid,text,integer,text,boolean)from public,anon,authenticated;
grant execute on function public.siteai_project_progress(uuid,text,integer,text,boolean)to service_role;
commit;
