begin;
-- Resolve revision ancestry only inside the authenticated owner's library. Paid
-- access records also preserve the root when an older version was deleted.
create or replace function public.siteai_project_lineage(p_user uuid)
returns table(id text,family_id text,payload jsonb,updated_at timestamptz,deleted_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 with recursive owned as materialized (
  select p.id,p.payload,p.updated_at,p.deleted_at,a.root_id,
   case when p.payload->>'parentProjectId' ~ '^[a-zA-Z0-9-]{1,80}$' then p.payload->>'parentProjectId' end as parent
  from projects p left join buildly_project_access a on a.id=p.id and a.user_id=p_user where p.user_id=p_user
 ), walk as (
  select p.id as leaf,p.id as node,p.parent,array[p.id]as path,0 as depth from owned p where p.root_id is null
  union all
  select w.leaf,p.id,p.parent,w.path||p.id,w.depth+1 from walk w join owned p on p.id=w.parent where w.depth<63 and not p.id=any(w.path)
 ), roots as (
  select distinct on(w.leaf) w.leaf,
   case when w.parent=any(w.path) then (select min(x)from unnest(w.path)x)
   when w.parent is not null and not exists(select 1 from owned p where p.id=w.parent) then w.parent else w.node end as root
  from walk w order by w.leaf,w.depth desc
 )
 select p.id,coalesce(p.root_id,r.root,p.id),p.payload,p.updated_at,p.deleted_at from owned p left join roots r on r.leaf=p.id;
$$;
create or replace function public.siteai_project_catalog(p_user uuid,p_limit integer default 20,p_offset integer default 0,p_project text default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with lineage as materialized(select * from siteai_project_lineage(p_user)),
 live as (select * from lineage where deleted_at is null),
 members as(select p.family_id,array_agg(p.id order by p.id)as ids from live p group by p.family_id),
 leaves as(
  select p.* from live p where not exists(select 1 from live c where c.family_id=p.family_id and c.payload->>'parentProjectId'=p.id and c.id<>p.id)
 ), candidates as(
  select * from leaves union all select p.* from live p where not exists(select 1 from leaves l where l.family_id=p.family_id)
 ), latest as(
  select distinct on(p.family_id) p.* from candidates p
  order by p.family_id,case when p.payload->>'createdAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$' then p.payload->>'createdAt' else '' end desc,p.updated_at desc,p.id
 ), scoped as(
  select p.*,m.ids from latest p join members m on m.family_id=p.family_id
  where p_project is null or p.family_id=(select l.family_id from lineage l where l.id=p_project)
 ), page as(
  select p.payload||jsonb_build_object('id',p.id,'familyId',p.family_id,'familyMembers',to_jsonb(p.ids))as payload
  from scoped p order by p.updated_at desc,p.family_id limit greatest(1,least(coalesce(p_limit,20),100)) offset greatest(0,coalesce(p_offset,0))
 )
 select jsonb_build_object('projects',coalesce((select jsonb_agg(p.payload)from page p),'[]'::jsonb),'total',(select count(*)from scoped));
$$;
-- Tombstone the whole logical project atomically before any file is removed.
-- Retrying cleanup cannot make an older revision reappear as a new project.
create or replace function public.siteai_mark_family_deleted(p_user uuid,p_project text)
returns text[] language plpgsql security definer set search_path=public,pg_temp as $$
declare family text;ids text[];
begin
 perform pg_advisory_xact_lock(hashtextextended('buildly_global_jobs',0));
 select l.family_id into family from siteai_project_lineage(p_user)l where l.id=p_project;
 if family is null then return array[]::text[];end if;
 select array_agg(l.id)into ids from siteai_project_lineage(p_user)l where l.family_id=family;
 if exists(select 1 from buildly_jobs j where j.user_id=p_user and (j.source_id=any(ids) or j.result_id=any(ids) or j.id::text=any(ids)) and j.state in('running','image_saved') and j.expires_at>now())then raise exception 'REQUEST_IN_PROGRESS';end if;
 update projects p set deleted_at=coalesce(p.deleted_at,now())where p.user_id=p_user and p.id=any(ids);
 return ids;
end $$;
revoke all on function public.siteai_project_lineage(uuid),public.siteai_project_catalog(uuid,integer,integer,text),public.siteai_mark_family_deleted(uuid,text)from public,anon,authenticated;
grant execute on function public.siteai_project_lineage(uuid),public.siteai_project_catalog(uuid,integer,integer,text),public.siteai_mark_family_deleted(uuid,text)to service_role;
commit;
