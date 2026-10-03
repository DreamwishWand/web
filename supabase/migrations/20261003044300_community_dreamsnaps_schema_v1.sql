-- DreamSnaps full-lifecycle domain foundation.
-- Competition rights are WandAccount-scoped; DDV Profile Workspaces are context only.

create table public.dreamsnap_challenges (
  challenge_id uuid primary key default gen_random_uuid(),
  challenge_key text not null unique
    check (challenge_key=btrim(challenge_key) and char_length(challenge_key) between 1 and 120),
  title text not null
    check (title=btrim(title) and char_length(title) between 1 and 240),
  description text check (description is null or char_length(description)<=20000),
  lifecycle_state text not null default 'upcoming'
    check (lifecycle_state in (
      'upcoming','submission_open','submission_closed',
      'judging_open','judging_closed','results','closed'
    )),
  submission_opens_at timestamptz not null,
  submission_closes_at timestamptz not null,
  judging_opens_at timestamptz not null,
  judging_closes_at timestamptz not null,
  results_at timestamptz not null,
  closes_at timestamptz not null,
  formal_vote_allowance integer not null check (formal_vote_allowance>0),
  special_pick_allowance integer not null check (special_pick_allowance>=0),
  minimum_real_eligible_entries integer not null check (minimum_real_eligible_entries>0),
  allow_post_formal_browse boolean not null default true,
  allow_special_picks boolean not null default false,
  result_algorithm text check (
    result_algorithm is null
    or (result_algorithm=btrim(result_algorithm) and char_length(result_algorithm) between 1 and 64)
  ),
  required_aspect_numerator integer check (required_aspect_numerator is null or required_aspect_numerator>0),
  required_aspect_denominator integer check (required_aspect_denominator is null or required_aspect_denominator>0),
  minimum_width integer check (minimum_width is null or minimum_width>0),
  minimum_height integer check (minimum_height is null or minimum_height>0),
  is_synthetic boolean not null default false,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (submission_opens_at<=submission_closes_at),
  check (submission_closes_at<=judging_opens_at),
  check (judging_opens_at<=judging_closes_at),
  check (judging_closes_at<=results_at),
  check (results_at<=closes_at),
  check (
    (required_aspect_numerator is null and required_aspect_denominator is null)
    or (required_aspect_numerator is not null and required_aspect_denominator is not null)
  )
);

create index dreamsnap_challenges_state_time_idx
  on public.dreamsnap_challenges(lifecycle_state,submission_opens_at desc,challenge_id);

create table public.dreamsnap_works (
  work_id uuid primary key references public.community_works(work_id) on delete cascade,
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id),
  source_workspace_id uuid references public.ddv_profile_workspaces(workspace_id) on delete set null,
  workspace_relationship_kind text not null
    check (workspace_relationship_kind in ('self','parent_guardian_managed')),
  managed_under13 boolean not null,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (managed_under13=(workspace_relationship_kind='parent_guardian_managed'))
);

create index dreamsnap_works_challenge_idx
  on public.dreamsnap_works(challenge_id,registered_at,work_id);

create table public.dreamsnap_work_revisions (
  revision_id uuid primary key references public.community_work_revisions(revision_id) on delete cascade,
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id),
  game_screenshot_attested boolean not null,
  no_external_edits_attested boolean not null,
  integrity_state text not null
    check (integrity_state in ('eligible','under_review','rejected')),
  integrity_checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (not (integrity_state='eligible') or (game_screenshot_attested and no_external_edits_attested))
);

create index dreamsnap_work_revisions_challenge_idx
  on public.dreamsnap_work_revisions(challenge_id,created_at,revision_id);

create table public.dreamsnap_entries (
  entry_id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id),
  work_id uuid not null references public.dreamsnap_works(work_id) on delete cascade,
  account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  workspace_id uuid references public.ddv_profile_workspaces(workspace_id) on delete set null,
  managed_under13 boolean not null default false,
  entry_revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  entry_state text not null default 'entered'
    check (entry_state in ('entered','withdrawn','removed')),
  eligibility_state text not null default 'eligible'
    check (eligibility_state in ('eligible','under_review','ineligible')),
  origin_kind text not null
    check (origin_kind in ('user','staff_public','engineering_fixture','moderation_test_fixture','synthetic')),
  joined_at timestamptz not null default now(),
  frozen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id,account_id),
  unique(entry_id,challenge_id)
);

create index dreamsnap_entries_pool_idx
  on public.dreamsnap_entries(challenge_id,entry_state,eligibility_state,entry_id);

create table public.dreamsnap_entry_revision_history (
  binding_id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.dreamsnap_entries(entry_id) on delete cascade,
  revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  bound_at timestamptz not null default now(),
  unbound_at timestamptz,
  check (unbound_at is null or unbound_at>=bound_at)
);

create unique index dreamsnap_entry_revision_active_uq
  on public.dreamsnap_entry_revision_history(entry_id)
  where unbound_at is null;

create table public.dreamsnap_formal_votes (
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id) on delete cascade,
  voter_account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  entry_id uuid not null,
  entry_revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  voter_origin_kind text not null
    check (voter_origin_kind in ('user','staff_public','engineering_fixture','moderation_test_fixture','synthetic')),
  created_at timestamptz not null default now(),
  primary key(challenge_id,voter_account_id,entry_id),
  foreign key(entry_id,challenge_id)
    references public.dreamsnap_entries(entry_id,challenge_id) on delete cascade
);

create index dreamsnap_formal_votes_entry_idx
  on public.dreamsnap_formal_votes(entry_id,created_at);

create table public.dreamsnap_special_picks (
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id) on delete cascade,
  account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  entry_id uuid not null,
  entry_revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  actor_origin_kind text not null
    check (actor_origin_kind in ('user','staff_public','engineering_fixture','moderation_test_fixture','synthetic')),
  created_at timestamptz not null default now(),
  primary key(challenge_id,account_id,entry_id),
  foreign key(entry_id,challenge_id)
    references public.dreamsnap_entries(entry_id,challenge_id) on delete cascade
);

create table public.dreamsnap_wand_results (
  entry_id uuid primary key references public.dreamsnap_entries(entry_id) on delete cascade,
  challenge_id uuid not null references public.dreamsnap_challenges(challenge_id) on delete cascade,
  entry_revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  placement integer not null check (placement>0),
  formal_score numeric not null,
  result_payload jsonb not null default '{}'::jsonb,
  finalized_at timestamptz not null default now()
);

create index dreamsnap_wand_results_round_idx
  on public.dreamsnap_wand_results(challenge_id,placement,entry_id);

create table public.dreamsnap_official_results (
  entry_id uuid primary key references public.dreamsnap_entries(entry_id) on delete cascade,
  account_id uuid not null references public.wand_accounts(account_id) on delete cascade,
  score numeric,
  rank integer check (rank is null or rank>0),
  moonstones bigint check (moonstones is null or moonstones>=0),
  pixel_dust bigint check (pixel_dust is null or pixel_dust>=0),
  official_payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dreamsnap_official_result_publication (
  entry_id uuid primary key references public.dreamsnap_official_results(entry_id) on delete cascade,
  public_fields text[] not null default array[]::text[],
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  check (public_fields <@ array['score','rank','moonstones','pixel_dust']::text[])
);

create table public.dreamsnap_gallery_publications (
  work_id uuid primary key references public.dreamsnap_works(work_id) on delete cascade,
  entry_id uuid not null unique references public.dreamsnap_entries(entry_id) on delete cascade,
  revision_id uuid not null references public.dreamsnap_work_revisions(revision_id),
  publication_state text not null default 'published'
    check (publication_state in ('published','unpublished')),
  comments_enabled boolean not null default true,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dreamsnap_gallery_publications_state_idx
  on public.dreamsnap_gallery_publications(publication_state,published_at desc,work_id);

alter table public.dreamsnap_challenges enable row level security;
alter table public.dreamsnap_works enable row level security;
alter table public.dreamsnap_work_revisions enable row level security;
alter table public.dreamsnap_entries enable row level security;
alter table public.dreamsnap_entry_revision_history enable row level security;
alter table public.dreamsnap_formal_votes enable row level security;
alter table public.dreamsnap_special_picks enable row level security;
alter table public.dreamsnap_wand_results enable row level security;
alter table public.dreamsnap_official_results enable row level security;
alter table public.dreamsnap_official_result_publication enable row level security;
alter table public.dreamsnap_gallery_publications enable row level security;

revoke all on public.dreamsnap_challenges from public,anon,authenticated;
revoke all on public.dreamsnap_works from public,anon,authenticated;
revoke all on public.dreamsnap_work_revisions from public,anon,authenticated;
revoke all on public.dreamsnap_entries from public,anon,authenticated;
revoke all on public.dreamsnap_entry_revision_history from public,anon,authenticated;
revoke all on public.dreamsnap_formal_votes from public,anon,authenticated;
revoke all on public.dreamsnap_special_picks from public,anon,authenticated;
revoke all on public.dreamsnap_wand_results from public,anon,authenticated;
revoke all on public.dreamsnap_official_results from public,anon,authenticated;
revoke all on public.dreamsnap_official_result_publication from public,anon,authenticated;
revoke all on public.dreamsnap_gallery_publications from public,anon,authenticated;

grant select,insert,update,delete on public.dreamsnap_challenges to service_role;
grant select,insert,update,delete on public.dreamsnap_works to service_role;
grant select,insert,update,delete on public.dreamsnap_work_revisions to service_role;
grant select,insert,update,delete on public.dreamsnap_entries to service_role;
grant select,insert,update,delete on public.dreamsnap_entry_revision_history to service_role;
grant select,insert,update,delete on public.dreamsnap_formal_votes to service_role;
grant select,insert,update,delete on public.dreamsnap_special_picks to service_role;
grant select,insert,update,delete on public.dreamsnap_wand_results to service_role;
grant select,insert,update,delete on public.dreamsnap_official_results to service_role;
grant select,insert,update,delete on public.dreamsnap_official_result_publication to service_role;
grant select,insert,update,delete on public.dreamsnap_gallery_publications to service_role;

insert into private.community_action_rate_policies(
  bucket,window_seconds,max_actions,enabled,updated_at
) values
  ('dreamsnap_write',3600,60,true,now()),
  ('dreamsnap_judge',3600,300,true,now()),
  ('dreamsnap_signal',3600,300,true,now())
on conflict(bucket) do update
set window_seconds=excluded.window_seconds,
    max_actions=excluded.max_actions,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at;

create or replace function private.dreamsnap_real_entry_floor_met(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select coalesce((
    select count(*) >= c.minimum_real_eligible_entries
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
    group by c.minimum_real_eligible_entries
  ),false)
$$;

revoke execute on function private.dreamsnap_real_entry_floor_met(uuid)
from public,anon,authenticated,service_role;

create or replace function private.dreamsnap_validate_media(
  p_account_id uuid,
  p_media_id uuid,
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_media public.media_assets%rowtype;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_aspect_ok boolean:=true;
begin
  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id;
  if v_challenge.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;

  select * into v_media
  from public.media_assets
  where media_id=p_media_id
    and owner_account_id=p_account_id
    and processing_state='ready'
    and moderation_state='clear'
    and purged_at is null;
  if v_media.media_id is null then
    raise exception 'DreamSnaps media must be owner-controlled and READY';
  end if;
  if v_media.mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'DreamSnaps competitive media must be an image';
  end if;
  if v_media.width is null or v_media.height is null or v_media.width<=0 or v_media.height<=0 then
    raise exception 'DreamSnaps image dimensions are required';
  end if;
  if v_challenge.minimum_width is not null and v_media.width<v_challenge.minimum_width then
    raise exception 'DreamSnaps image width is below round policy';
  end if;
  if v_challenge.minimum_height is not null and v_media.height<v_challenge.minimum_height then
    raise exception 'DreamSnaps image height is below round policy';
  end if;
  if v_challenge.required_aspect_numerator is not null then
    v_aspect_ok:=
      (v_media.width::bigint*v_challenge.required_aspect_denominator)
      =(v_media.height::bigint*v_challenge.required_aspect_numerator);
    if not v_aspect_ok then
      raise exception 'DreamSnaps image aspect ratio does not match round policy';
    end if;
  end if;

  return jsonb_build_object(
    'mimeType',v_media.mime_type,
    'width',v_media.width,
    'height',v_media.height,
    'requiredAspectNumerator',v_challenge.required_aspect_numerator,
    'requiredAspectDenominator',v_challenge.required_aspect_denominator,
    'minimumWidth',v_challenge.minimum_width,
    'minimumHeight',v_challenge.minimum_height,
    'aspectValidated',v_challenge.required_aspect_numerator is not null
  );
end
$$;

revoke execute on function private.dreamsnap_validate_media(uuid,uuid,uuid)
from public,anon,authenticated,service_role;

create or replace function private.guard_dreamsnap_work_publication()
returns trigger
language plpgsql
set search_path=pg_catalog,public,private
as $$
begin
  if new.work_type='dreamsnap' and new.visibility='public' then
    if new.lifecycle_state<>'published'
       or not exists(
         select 1
         from public.dreamsnap_gallery_publications gp
         join public.dreamsnap_entries e on e.entry_id=gp.entry_id
         join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
         where gp.work_id=new.work_id
           and gp.publication_state='published'
           and c.lifecycle_state in ('results','closed')
           and e.entry_state='entered'
           and e.eligibility_state='eligible'
       ) then
      raise exception 'DreamSnaps Gallery publication is not allowed in the current round state';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists community_works_dreamsnap_publication_guard on public.community_works;
create trigger community_works_dreamsnap_publication_guard
before insert or update of visibility,lifecycle_state
on public.community_works
for each row execute function private.guard_dreamsnap_work_publication();

create or replace function private.sync_dreamsnap_gallery_publication_state()
returns trigger
language plpgsql
set search_path=pg_catalog,public,private
as $$
begin
  if new.work_type='dreamsnap'
     and (new.visibility<>'public' or new.lifecycle_state<>'published') then
    update public.dreamsnap_gallery_publications
    set publication_state='unpublished',updated_at=now()
    where work_id=new.work_id and publication_state='published';
  end if;
  return new;
end
$$;

drop trigger if exists community_works_dreamsnap_publication_sync on public.community_works;
create trigger community_works_dreamsnap_publication_sync
after update of visibility,lifecycle_state
on public.community_works
for each row execute function private.sync_dreamsnap_gallery_publication_state();

create or replace function public.community_dreamsnap_transition_challenge_v1(
  p_challenge_id uuid,
  p_expected_version bigint,
  p_target_state text,
  p_effective_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v public.dreamsnap_challenges%rowtype;
  v_required timestamptz;
begin
  select * into v
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id
  for update;
  if v.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;

  if v.lifecycle_state=p_target_state then
    return jsonb_build_object(
      'challengeId',v.challenge_id,'state',v.lifecycle_state,
      'rowVersion',v.row_version,'replayed',true
    );
  end if;
  if v.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;

  if not (
    (v.lifecycle_state='upcoming' and p_target_state='submission_open')
    or (v.lifecycle_state='submission_open' and p_target_state='submission_closed')
    or (v.lifecycle_state='submission_closed' and p_target_state='judging_open')
    or (v.lifecycle_state='judging_open' and p_target_state='judging_closed')
    or (v.lifecycle_state='judging_closed' and p_target_state='results')
    or (v.lifecycle_state='results' and p_target_state='closed')
  ) then
    raise exception 'Invalid DreamSnaps challenge lifecycle transition';
  end if;

  v_required:=case p_target_state
    when 'submission_open' then v.submission_opens_at
    when 'submission_closed' then v.submission_closes_at
    when 'judging_open' then v.judging_opens_at
    when 'judging_closed' then v.judging_closes_at
    when 'results' then v.results_at
    when 'closed' then v.closes_at
  end;

  if p_effective_at<v_required then
    raise exception 'DreamSnaps challenge transition is before configured round time';
  end if;

  update public.dreamsnap_challenges
  set lifecycle_state=p_target_state,
      row_version=row_version+1,
      updated_at=clock_timestamp()
  where challenge_id=p_challenge_id
  returning * into v;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    null,'dreamsnap.challenge_transition',null,
    jsonb_build_object(
      'challengeId',v.challenge_id,
      'state',v.lifecycle_state,
      'effectiveAt',p_effective_at
    )
  );

  return jsonb_build_object(
    'challengeId',v.challenge_id,'state',v.lifecycle_state,
    'rowVersion',v.row_version,'replayed',false
  );
end
$$;

revoke execute on function public.community_dreamsnap_transition_challenge_v1(uuid,bigint,text,timestamptz)
from public,anon,authenticated;
grant execute on function public.community_dreamsnap_transition_challenge_v1(uuid,bigint,text,timestamptz)
to service_role;
