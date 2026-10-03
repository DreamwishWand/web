-- In-Game Results are trusted private records, not user-entered competition claims.

alter table public.dreamsnap_official_results
  add column if not exists source_kind text,
  add column if not exists source_reference text,
  add column if not exists source_observed_at timestamptz;

update public.dreamsnap_official_results
set source_kind='legacy_unverified'
where source_kind is null;

alter table public.dreamsnap_official_results
  alter column source_kind set not null;

alter table public.dreamsnap_official_results
  drop constraint if exists dreamsnap_official_results_source_kind_check;
alter table public.dreamsnap_official_results
  add constraint dreamsnap_official_results_source_kind_check
  check (source_kind in ('save','official_evidence','legacy_unverified'));

alter table public.dreamsnap_official_results
  drop constraint if exists dreamsnap_official_results_source_reference_check;
alter table public.dreamsnap_official_results
  add constraint dreamsnap_official_results_source_reference_check
  check (
    source_reference is null
    or (
      source_reference=btrim(source_reference)
      and char_length(source_reference) between 1 and 512
    )
  );

drop function if exists public.community_dreamsnap_record_official_result_v1(
  uuid,uuid,numeric,integer,bigint,bigint,jsonb
);

create or replace function public.community_dreamsnap_ingest_ingame_result_v1(
  p_auth_subject uuid,
  p_entry_id uuid,
  p_score numeric,
  p_rank integer,
  p_moonstones bigint,
  p_pixel_dust bigint,
  p_source_kind text,
  p_source_reference text,
  p_source_observed_at timestamptz,
  p_official_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_state text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  if p_source_kind not in ('save','official_evidence') then
    raise exception 'In-Game Result requires trusted save or official-evidence provenance';
  end if;
  if p_source_reference is null
     or p_source_reference<>btrim(p_source_reference)
     or char_length(p_source_reference) not between 1 and 512 then
    raise exception 'In-Game Result source reference is required';
  end if;
  if p_source_observed_at is null then
    raise exception 'In-Game Result source observation time is required';
  end if;

  select * into v_entry
  from public.dreamsnap_entries
  where entry_id=p_entry_id
  for update;
  if v_entry.entry_id is not null then
    select lifecycle_state into v_state
    from public.dreamsnap_challenges
    where challenge_id=v_entry.challenge_id;
  end if;

  if v_entry.entry_id is null then raise exception 'DreamSnaps entry not found'; end if;
  if v_entry.account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps entry'; end if;
  if v_state not in ('results','closed') then raise exception 'In-Game Result is not available before Results'; end if;
  if p_rank is not null and p_rank<=0 then raise exception 'In-Game rank must be positive'; end if;
  if p_moonstones is not null and p_moonstones<0 then raise exception 'Moonstones cannot be negative'; end if;
  if p_pixel_dust is not null and p_pixel_dust<0 then raise exception 'Pixel Dust cannot be negative'; end if;

  insert into public.dreamsnap_official_results(
    entry_id,account_id,score,rank,moonstones,pixel_dust,official_payload,
    source_kind,source_reference,source_observed_at,updated_at
  ) values(
    p_entry_id,v_account_id,p_score,p_rank,p_moonstones,p_pixel_dust,
    coalesce(p_official_payload,'{}'::jsonb),
    p_source_kind,p_source_reference,p_source_observed_at,now()
  )
  on conflict(entry_id) do update set
    score=excluded.score,
    rank=excluded.rank,
    moonstones=excluded.moonstones,
    pixel_dust=excluded.pixel_dust,
    official_payload=excluded.official_payload,
    source_kind=excluded.source_kind,
    source_reference=excluded.source_reference,
    source_observed_at=excluded.source_observed_at,
    updated_at=now();

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.ingame_result_ingested',v_entry.work_id,
    jsonb_build_object(
      'entryId',p_entry_id,
      'challengeId',v_entry.challenge_id,
      'sourceKind',p_source_kind,
      'sourceReference',p_source_reference
    )
  );

  return jsonb_build_object(
    'entryId',p_entry_id,
    'recorded',true,
    'sourceKind',p_source_kind,
    'sourceObservedAt',p_source_observed_at
  );
end
$$;

create or replace function private.dreamsnap_public_official_result(p_entry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_result public.dreamsnap_official_results%rowtype;
  v_fields text[];
  v_json jsonb:='{}'::jsonb;
begin
  select * into v_result
  from public.dreamsnap_official_results
  where entry_id=p_entry_id
    and source_kind in ('save','official_evidence');

  select public_fields into v_fields
  from public.dreamsnap_official_result_publication
  where entry_id=p_entry_id;

  if v_result.entry_id is null or coalesce(cardinality(v_fields),0)=0 then
    return null;
  end if;

  if 'score'=any(v_fields) then v_json:=v_json || jsonb_build_object('score',v_result.score); end if;
  if 'rank'=any(v_fields) then v_json:=v_json || jsonb_build_object('rank',v_result.rank); end if;
  if 'moonstones'=any(v_fields) then v_json:=v_json || jsonb_build_object('moonstones',v_result.moonstones); end if;
  if 'pixel_dust'=any(v_fields) then v_json:=v_json || jsonb_build_object('pixelDust',v_result.pixel_dust); end if;

  return jsonb_strip_nulls(v_json);
end
$$;

create or replace function public.community_dreamsnap_set_official_result_publication_v1(
  p_auth_subject uuid,
  p_entry_id uuid,
  p_public_fields text[]
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_state text;
  v_fields text[];
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select * into v_entry
  from public.dreamsnap_entries
  where entry_id=p_entry_id;
  if v_entry.entry_id is not null then
    select lifecycle_state into v_state
    from public.dreamsnap_challenges
    where challenge_id=v_entry.challenge_id;
  end if;

  if v_entry.entry_id is null then raise exception 'DreamSnaps entry not found'; end if;
  if v_entry.account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps entry'; end if;
  if v_state not in ('results','closed') then raise exception 'In-Game Result cannot be published before Results'; end if;
  if not exists(
    select 1 from public.dreamsnap_official_results
    where entry_id=p_entry_id
      and source_kind in ('save','official_evidence')
  ) then
    raise exception 'Trusted In-Game Result is not recorded';
  end if;

  select coalesce(array_agg(distinct x order by x),array[]::text[])
  into v_fields
  from unnest(coalesce(p_public_fields,array[]::text[])) x
  where x in ('score','rank','moonstones','pixel_dust');

  if cardinality(v_fields)<>cardinality(coalesce(p_public_fields,array[]::text[])) then
    raise exception 'Unsupported In-Game Result public field';
  end if;

  insert into public.dreamsnap_official_result_publication(
    entry_id,public_fields,published_at,updated_at
  ) values(
    p_entry_id,v_fields,case when cardinality(v_fields)>0 then now() else null end,now()
  )
  on conflict(entry_id) do update set
    public_fields=excluded.public_fields,
    published_at=case
      when cardinality(excluded.public_fields)>0
        then coalesce(dreamsnap_official_result_publication.published_at,now())
      else null
    end,
    updated_at=now();

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.ingame_result_publication_changed',v_entry.work_id,
    jsonb_build_object('entryId',p_entry_id,'publicFields',to_jsonb(v_fields))
  );

  return jsonb_build_object('entryId',p_entry_id,'publicFields',to_jsonb(v_fields));
end
$$;

revoke execute on function public.community_dreamsnap_ingest_ingame_result_v1(
  uuid,uuid,numeric,integer,bigint,bigint,text,text,timestamptz,jsonb
) from public,anon,authenticated;
grant execute on function public.community_dreamsnap_ingest_ingame_result_v1(
  uuid,uuid,numeric,integer,bigint,bigint,text,text,timestamptz,jsonb
) to service_role;

revoke execute on function private.dreamsnap_public_official_result(uuid)
from public,anon,authenticated,service_role;

revoke execute on function public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])
from public,anon,authenticated;
grant execute on function public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])
to service_role;
