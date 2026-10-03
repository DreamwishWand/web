-- DreamSnaps integrity and real-pool closure.
-- Round thresholds stay data-driven. SEED-DREAMSNAPS may configure 24 entries / 12 creators,
-- while staging acceptance can use smaller rollback-only values.

alter table public.dreamsnap_challenges
  add column if not exists minimum_real_eligible_creators integer;

update public.dreamsnap_challenges
set minimum_real_eligible_creators=
  least(greatest(minimum_real_eligible_entries,1),12)
where minimum_real_eligible_creators is null;

alter table public.dreamsnap_challenges
  alter column minimum_real_eligible_creators set not null;

alter table public.dreamsnap_challenges
  drop constraint if exists dreamsnap_challenges_minimum_real_eligible_creators_check;
alter table public.dreamsnap_challenges
  add constraint dreamsnap_challenges_minimum_real_eligible_creators_check
  check (
    minimum_real_eligible_creators>0
    and minimum_real_eligible_creators<=minimum_real_eligible_entries
  );

alter table public.dreamsnap_work_revisions
  add column if not exists suspicion_flags text[] not null default array[]::text[],
  add column if not exists integrity_reason text;

alter table public.dreamsnap_work_revisions
  drop constraint if exists dreamsnap_work_revisions_integrity_reason_check;
alter table public.dreamsnap_work_revisions
  add constraint dreamsnap_work_revisions_integrity_reason_check
  check (
    integrity_reason is null
    or (
      integrity_reason=btrim(integrity_reason)
      and char_length(integrity_reason) between 1 and 1000
    )
  );

create unique index if not exists work_revision_media_one_dreamsnap_competition_image_uq
  on public.work_revision_media(work_revision_id)
  where role='dreamsnap';

create or replace function private.dreamsnap_real_entry_floor_met(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select coalesce((
    select
      count(*) >= c.minimum_real_eligible_entries
      and count(distinct w.creator_profile_id) >= c.minimum_real_eligible_creators
    from public.dreamsnap_challenges c
    join public.dreamsnap_entries e on e.challenge_id=c.challenge_id
    join public.community_works w on w.work_id=e.work_id
    join public.dreamsnap_work_revisions dr on dr.revision_id=e.entry_revision_id
    where c.challenge_id=p_challenge_id
      and e.entry_state='entered'
      and e.eligibility_state='eligible'
      and e.origin_kind='user'
      and w.moderation_state='clear'
      and dr.integrity_state='eligible'
    group by c.minimum_real_eligible_entries,c.minimum_real_eligible_creators
  ),false)
$$;

revoke execute on function private.dreamsnap_real_entry_floor_met(uuid)
from public,anon,authenticated,service_role;

create or replace function public.community_dreamsnap_apply_integrity_assessment_v1(
  p_revision_id uuid,
  p_integrity_state text,
  p_suspicion_flags text[] default array[]::text[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_revision public.dreamsnap_work_revisions%rowtype;
  v_work_id uuid;
  v_entry_id uuid;
  v_entry_state text;
begin
  if p_integrity_state not in ('eligible','under_review','rejected') then
    raise exception 'Unsupported DreamSnaps integrity state';
  end if;
  if p_reason is not null
     and (
       p_reason<>btrim(p_reason)
       or char_length(p_reason) not between 1 and 1000
     ) then
    raise exception 'DreamSnaps integrity reason must be 1-1000 trimmed characters';
  end if;
  if exists(
    select 1
    from unnest(coalesce(p_suspicion_flags,array[]::text[])) f
    where char_length(btrim(f)) not between 1 and 120
  ) then
    raise exception 'DreamSnaps suspicion flags must be 1-120 characters';
  end if;

  select * into v_revision
  from public.dreamsnap_work_revisions
  where revision_id=p_revision_id
  for update;
  if v_revision.revision_id is null then
    raise exception 'DreamSnaps revision not found';
  end if;

  select r.work_id into v_work_id
  from public.community_work_revisions r
  where r.revision_id=p_revision_id;

  update public.dreamsnap_work_revisions
  set integrity_state=p_integrity_state,
      suspicion_flags=coalesce(p_suspicion_flags,array[]::text[]),
      integrity_reason=p_reason,
      integrity_checks=integrity_checks || jsonb_build_object(
        'assessmentState',p_integrity_state,
        'assessedAt',clock_timestamp(),
        'suspicionFlagCount',cardinality(coalesce(p_suspicion_flags,array[]::text[]))
      )
  where revision_id=p_revision_id
  returning * into v_revision;

  select e.entry_id into v_entry_id
  from public.dreamsnap_entries e
  where e.entry_revision_id=p_revision_id
    and e.entry_state='entered'
  limit 1;

  if v_entry_id is not null then
    v_entry_state:=case p_integrity_state
      when 'eligible' then 'eligible'
      when 'under_review' then 'under_review'
      else 'ineligible'
    end;

    if p_integrity_state='eligible' and exists(
      select 1 from public.community_works w
      where w.work_id=v_work_id and w.moderation_state<>'clear'
    ) then
      v_entry_state:='ineligible';
    end if;

    update public.dreamsnap_entries
    set eligibility_state=v_entry_state,updated_at=now()
    where entry_id=v_entry_id;
  end if;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    null,'dreamsnap.integrity_assessed',v_work_id,
    jsonb_build_object(
      'revisionId',p_revision_id,
      'integrityState',p_integrity_state,
      'suspicionFlags',to_jsonb(coalesce(p_suspicion_flags,array[]::text[])),
      'entryId',v_entry_id
    )
  );

  return jsonb_build_object(
    'revisionId',p_revision_id,
    'workId',v_work_id,
    'entryId',v_entry_id,
    'integrityState',p_integrity_state,
    'entryEligibilityState',v_entry_state,
    'suspicionFlags',to_jsonb(coalesce(p_suspicion_flags,array[]::text[]))
  );
end
$$;

revoke execute on function public.community_dreamsnap_apply_integrity_assessment_v1(uuid,text,text[],text)
from public,anon,authenticated;
grant execute on function public.community_dreamsnap_apply_integrity_assessment_v1(uuid,text,text[],text)
to service_role;
