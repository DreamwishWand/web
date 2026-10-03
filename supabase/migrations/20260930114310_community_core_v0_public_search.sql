create extension if not exists pg_trgm with schema extensions;

create index if not exists search_documents_title_trgm_idx
  on public.search_documents
  using gin (lower(title) extensions.gin_trgm_ops);

create index if not exists search_documents_text_trgm_idx
  on public.search_documents
  using gin (lower(text_content) extensions.gin_trgm_ops);

create index if not exists search_documents_public_cursor_idx
  on public.search_documents(published_at desc,work_id desc);

create or replace function public.community_search_public(
  p_query text default null,
  p_work_type public.work_type default null,
  p_creator_profile_id uuid default null,
  p_tags text[] default null,
  p_limit integer default 20,
  p_before_published_at timestamptz default null,
  p_before_work_id uuid default null
)
returns table(
  entity_id uuid,
  work_id uuid,
  work_type public.work_type,
  creator_profile_id uuid,
  title text,
  text_content text,
  tags text[],
  facets jsonb,
  published_at timestamptz
)
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,extensions
as $$
declare
  v_query text;
  v_pattern text;
  v_limit integer;
begin
  v_query:=nullif(btrim(p_query),'');
  if v_query is not null and char_length(v_query)>100 then
    raise exception 'Search query must be at most 100 characters';
  end if;

  if p_tags is not null and cardinality(p_tags)>20 then
    raise exception 'Search supports at most 20 tags';
  end if;

  if (p_before_published_at is null) <> (p_before_work_id is null) then
    raise exception 'Search cursor requires both published_at and work_id';
  end if;

  v_limit:=least(greatest(coalesce(p_limit,20),1),50);

  if v_query is not null then
    v_pattern:='%' ||
      replace(
        replace(
          replace(lower(v_query),'\','\\'),
          '%','\%'
        ),
        '_','\_'
      ) || '%';
  end if;

  return query
  select
    d.entity_id,
    d.work_id,
    d.work_type,
    d.creator_profile_id,
    d.title,
    d.text_content,
    d.tags,
    d.facets,
    d.published_at
  from public.search_documents d
  where
    (
      v_query is null
      or lower(d.title) ilike v_pattern escape '\'
      or lower(d.text_content) ilike v_pattern escape '\'
    )
    and (p_work_type is null or d.work_type=p_work_type)
    and (p_creator_profile_id is null or d.creator_profile_id=p_creator_profile_id)
    and (p_tags is null or d.tags @> p_tags)
    and (
      p_before_published_at is null
      or (d.published_at,d.work_id) < (p_before_published_at,p_before_work_id)
    )
  order by d.published_at desc,d.work_id desc
  limit v_limit;
end;
$$;

revoke execute on function public.community_search_public(
  text,public.work_type,uuid,text[],integer,timestamptz,uuid
) from public;

grant execute on function public.community_search_public(
  text,public.work_type,uuid,text[],integer,timestamptz,uuid
) to anon,authenticated;
