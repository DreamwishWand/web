-- Dreamwish Wand Community Core v0
-- Target adapter: Supabase PostgreSQL.
-- Logical model remains provider-neutral; auth provider identity is mapped through auth_identities.

create extension if not exists pgcrypto;

do $$ begin
  create type account_status as enum ('active','restricted','suspended','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visibility_state as enum ('private','unlisted','public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_state as enum ('clear','under_review','restricted','removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_lifecycle_state as enum ('draft','published','unpublished','deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_type as enum ('gallery','preset','dreamsnap','question','tip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type community_entity_type as enum (
    'creator_profile','community_work','preset_artifact','media_asset','comment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_processing_state as enum ('quarantined','processing','ready','rejected');
exception when duplicate_object then null; end $$;

create table if not exists wand_accounts (
  account_id uuid primary key default gen_random_uuid(),
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists auth_identities (
  auth_identity_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references wand_accounts(account_id),
  provider text not null,
  provider_subject text not null,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz null,
  unique (provider, provider_subject)
);

create table if not exists account_roles (
  account_id uuid not null references wand_accounts(account_id),
  role text not null check (role in ('moderator','admin')),
  created_at timestamptz not null default now(),
  primary key (account_id, role)
);

create table if not exists community_entities (
  entity_id uuid primary key default gen_random_uuid(),
  entity_type community_entity_type not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists creator_profiles (
  creator_profile_id uuid primary key references community_entities(entity_id),
  owner_account_id uuid not null unique references wand_accounts(account_id),
  handle text not null,
  handle_normalized text generated always as (lower(btrim(handle))) stored,
  display_name text not null,
  avatar_media_id uuid null,
  bio text null,
  profile_visibility visibility_state not null default 'public',
  moderation_state moderation_state not null default 'clear',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (handle_normalized)
);

create table if not exists ddv_profiles (
  ddv_profile_id uuid primary key default gen_random_uuid(),
  binding_state text not null default 'unverified'
    check (binding_state in ('unverified','verified','revoked')),
  binding_key_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ddv_profiles_binding_key_hash_uq
  on ddv_profiles(binding_key_hash)
  where binding_key_hash is not null and binding_state = 'verified';

create table if not exists wand_account_ddv_profiles (
  account_id uuid not null references wand_accounts(account_id),
  ddv_profile_id uuid not null unique references ddv_profiles(ddv_profile_id),
  verification_evidence_ref text null,
  linked_at timestamptz not null default now(),
  primary key (account_id, ddv_profile_id)
);

create table if not exists community_works (
  work_id uuid primary key references community_entities(entity_id),
  owner_account_id uuid not null references wand_accounts(account_id),
  creator_profile_id uuid not null references creator_profiles(creator_profile_id),
  work_type work_type not null,
  lifecycle_state work_lifecycle_state not null default 'draft',
  visibility visibility_state not null default 'private',
  moderation_state moderation_state not null default 'clear',
  current_published_revision_id uuid null,
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null
);

create table if not exists community_work_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  work_id uuid not null references community_works(work_id),
  revision_number integer not null check (revision_number > 0),
  created_by_account_id uuid not null references wand_accounts(account_id),
  shared_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (work_id, revision_number)
);

alter table community_works
  drop constraint if exists community_works_current_published_revision_fk;
alter table community_works
  add constraint community_works_current_published_revision_fk
  foreign key (current_published_revision_id)
  references community_work_revisions(revision_id)
  deferrable initially deferred;

create table if not exists gallery_works (
  work_id uuid primary key references community_works(work_id),
  gallery_kind text not null check (
    gallery_kind in ('outdoor','indoor','dreamsnap','tom_furniture','tom_clothing')
  )
);

create table if not exists gallery_work_revisions (
  revision_id uuid primary key references community_work_revisions(revision_id),
  title text not null,
  description text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists media_assets (
  media_id uuid primary key references community_entities(entity_id),
  owner_account_id uuid not null references wand_accounts(account_id),
  storage_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  width integer null check (width is null or width > 0),
  height integer null check (height is null or height > 0),
  checksum_sha256 text not null,
  processing_state media_processing_state not null default 'quarantined',
  moderation_state moderation_state not null default 'clear',
  created_at timestamptz not null default now()
);

alter table creator_profiles
  drop constraint if exists creator_profiles_avatar_media_fk;
alter table creator_profiles
  add constraint creator_profiles_avatar_media_fk
  foreign key (avatar_media_id) references media_assets(media_id);

create table if not exists artifact_blobs (
  blob_id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references wand_accounts(account_id),
  storage_key text not null unique,
  schema_version integer not null check (schema_version > 0),
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum_sha256 text not null,
  created_at timestamptz not null default now()
);

create table if not exists preset_artifacts (
  preset_artifact_id uuid primary key references community_entities(entity_id),
  owner_account_id uuid not null references wand_accounts(account_id),
  creator_profile_id uuid not null references creator_profiles(creator_profile_id),
  community_work_id uuid null unique references community_works(work_id),
  preset_type text not null check (
    preset_type in ('scene','biome','floating_island','tom_furniture','tom_clothing')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists preset_revisions (
  preset_revision_id uuid primary key default gen_random_uuid(),
  preset_artifact_id uuid not null references preset_artifacts(preset_artifact_id),
  revision_number integer not null check (revision_number > 0),
  artifact_blob_id uuid not null references artifact_blobs(blob_id),
  metadata jsonb not null default '{}'::jsonb,
  created_by_account_id uuid not null references wand_accounts(account_id),
  created_at timestamptz not null default now(),
  unique (preset_artifact_id, revision_number)
);

create table if not exists preset_revision_publications (
  work_revision_id uuid primary key references community_work_revisions(revision_id),
  preset_revision_id uuid not null references preset_revisions(preset_revision_id)
);

create table if not exists gallery_revision_presets (
  gallery_revision_id uuid not null references gallery_work_revisions(revision_id),
  preset_revision_id uuid not null references preset_revisions(preset_revision_id),
  primary key (gallery_revision_id, preset_revision_id)
);

create table if not exists work_revision_media (
  work_revision_id uuid not null references community_work_revisions(revision_id),
  media_id uuid not null references media_assets(media_id),
  ordinal integer not null check (ordinal >= 0),
  role text not null default 'gallery',
  primary key (work_revision_id, media_id),
  unique (work_revision_id, ordinal)
);

create table if not exists saved_items (
  account_id uuid not null references wand_accounts(account_id),
  target_entity_id uuid not null references community_entities(entity_id),
  created_at timestamptz not null default now(),
  primary key (account_id, target_entity_id)
);

create table if not exists follows (
  follower_account_id uuid not null references wand_accounts(account_id),
  creator_profile_id uuid not null references creator_profiles(creator_profile_id),
  created_at timestamptz not null default now(),
  primary key (follower_account_id, creator_profile_id)
);

create table if not exists reactions (
  account_id uuid not null references wand_accounts(account_id),
  target_entity_id uuid not null references community_entities(entity_id),
  reaction_kind text not null,
  created_at timestamptz not null default now(),
  primary key (account_id, target_entity_id, reaction_kind)
);

create table if not exists comments (
  comment_id uuid primary key references community_entities(entity_id),
  target_entity_id uuid not null references community_entities(entity_id),
  author_account_id uuid not null references wand_accounts(account_id),
  creator_profile_id uuid not null references creator_profiles(creator_profile_id),
  parent_comment_id uuid null references comments(comment_id),
  body text not null check (char_length(body) between 1 and 10000),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active','edited','deleted')),
  moderation_state moderation_state not null default 'clear',
  row_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists idempotency_keys (
  account_id uuid not null references wand_accounts(account_id),
  idempotency_key text not null,
  command_name text not null,
  request_hash text not null,
  response jsonb null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  primary key (account_id, idempotency_key)
);

create table if not exists outbox_events (
  outbox_id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text null unique,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz null,
  attempt_count integer not null default 0 check (attempt_count >= 0)
);

create table if not exists notification_events (
  notification_event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_account_id uuid null references wand_accounts(account_id),
  target_entity_id uuid null references community_entities(entity_id),
  source_outbox_id uuid null unique references outbox_events(outbox_id),
  created_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  notification_event_id uuid not null references notification_events(notification_event_id),
  recipient_account_id uuid not null references wand_accounts(account_id),
  delivery_state text not null default 'unread'
    check (delivery_state in ('unread','read','suppressed')),
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  primary key (notification_event_id, recipient_account_id)
);

create table if not exists reports (
  report_id uuid primary key default gen_random_uuid(),
  reporter_account_id uuid not null references wand_accounts(account_id),
  target_entity_id uuid not null references community_entities(entity_id),
  target_revision_id uuid null references community_work_revisions(revision_id),
  reason_code text not null,
  detail text null check (detail is null or char_length(detail) <= 5000),
  status text not null default 'open'
    check (status in ('open','triaged','closed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moderation_cases (
  case_id uuid primary key default gen_random_uuid(),
  target_entity_id uuid not null references community_entities(entity_id),
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moderation_case_reports (
  case_id uuid not null references moderation_cases(case_id),
  report_id uuid not null unique references reports(report_id),
  primary key (case_id, report_id)
);

create table if not exists moderation_actions (
  action_id uuid primary key default gen_random_uuid(),
  case_id uuid not null references moderation_cases(case_id),
  actor_account_id uuid not null references wand_accounts(account_id),
  action_type text not null check (
    action_type in ('close','restrict','remove','restore','restrict_account','suspend_account')
  ),
  reason text not null,
  prior_state jsonb not null,
  resulting_state jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  actor_account_id uuid null references wand_accounts(account_id),
  action_type text not null,
  target_entity_id uuid null references community_entities(entity_id),
  request_correlation_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists search_documents (
  entity_id uuid primary key references community_entities(entity_id),
  work_id uuid not null unique references community_works(work_id),
  work_type work_type not null,
  creator_profile_id uuid not null references creator_profiles(creator_profile_id),
  title text not null default '',
  text_content text not null default '',
  tags text[] not null default '{}',
  facets jsonb not null default '{}'::jsonb,
  published_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists community_works_discovery_idx
  on community_works(lifecycle_state, visibility, moderation_state, published_at desc);
create index if not exists community_works_creator_idx
  on community_works(creator_profile_id, updated_at desc);
create index if not exists comments_target_idx
  on comments(target_entity_id, created_at);
create index if not exists notifications_recipient_idx
  on notification_deliveries(recipient_account_id, delivery_state, created_at desc);
create index if not exists reports_target_status_idx
  on reports(target_entity_id, status, created_at desc);
create index if not exists moderation_cases_status_idx
  on moderation_cases(status, updated_at);
create index if not exists outbox_pending_idx
  on outbox_events(created_at)
  where dispatched_at is null;
create index if not exists media_owner_processing_idx
  on media_assets(owner_account_id, processing_state, created_at desc);
create index if not exists search_documents_creator_idx
  on search_documents(creator_profile_id, published_at desc);
create index if not exists search_documents_tags_gin
  on search_documents using gin(tags);

create or replace function enforce_ddv_profile_limit()
returns trigger language plpgsql as $$
begin
  -- Serialize link-count checks per Wand Account so concurrent inserts cannot
  -- both observe fewer than three links and exceed the account boundary.
  perform pg_advisory_xact_lock(hashtextextended(new.account_id::text, 0));

  if (
    select count(*)
    from wand_account_ddv_profiles
    where account_id = new.account_id
      and ddv_profile_id <> new.ddv_profile_id
  ) >= 3 then
    raise exception 'A Wand Account may link at most three DDV Profiles';
  end if;
  return new;
end;
$$;

drop trigger if exists wand_account_ddv_profiles_limit on wand_account_ddv_profiles;
create trigger wand_account_ddv_profiles_limit
before insert or update of account_id on wand_account_ddv_profiles
for each row execute function enforce_ddv_profile_limit();

create or replace function prevent_immutable_revision_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Published/revision records are immutable; create a new revision instead';
end;
$$;

drop trigger if exists community_work_revisions_immutable on community_work_revisions;
create trigger community_work_revisions_immutable
before update or delete on community_work_revisions
for each row execute function prevent_immutable_revision_mutation();

drop trigger if exists gallery_work_revisions_immutable on gallery_work_revisions;
create trigger gallery_work_revisions_immutable
before update or delete on gallery_work_revisions
for each row execute function prevent_immutable_revision_mutation();

drop trigger if exists preset_revisions_immutable on preset_revisions;
create trigger preset_revisions_immutable
before update or delete on preset_revisions
for each row execute function prevent_immutable_revision_mutation();

drop trigger if exists artifact_blobs_immutable on artifact_blobs;
create trigger artifact_blobs_immutable
before update or delete on artifact_blobs
for each row execute function prevent_immutable_revision_mutation();

create or replace function validate_current_published_revision()
returns trigger language plpgsql as $$
begin
  if new.current_published_revision_id is not null and not exists (
    select 1
    from community_work_revisions r
    where r.revision_id = new.current_published_revision_id
      and r.work_id = new.work_id
  ) then
    raise exception 'current_published_revision_id must belong to the same work';
  end if;

  if new.lifecycle_state = 'published' and new.current_published_revision_id is null then
    raise exception 'Published work requires current_published_revision_id';
  end if;

  return new;
end;
$$;

drop trigger if exists community_works_current_revision_guard on community_works;
create constraint trigger community_works_current_revision_guard
after insert or update on community_works
deferrable initially deferred
for each row execute function validate_current_published_revision();

create or replace function validate_comment_parent_target()
returns trigger language plpgsql as $$
declare
  parent_target uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select target_entity_id into parent_target
  from comments
  where comment_id = new.parent_comment_id;

  if parent_target is null or parent_target <> new.target_entity_id then
    raise exception 'Reply parent must target the same CommunityEntity';
  end if;

  return new;
end;
$$;

drop trigger if exists comments_parent_target_guard on comments;
create trigger comments_parent_target_guard
before insert or update of parent_comment_id, target_entity_id on comments
for each row execute function validate_comment_parent_target();

create or replace function public.current_wand_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ai.account_id
  from auth_identities ai
  where ai.provider = 'supabase'
    and ai.provider_subject = auth.uid()::text
  limit 1
$$;

create or replace function public.is_staff(p_account_id uuid default public.current_wand_account_id())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from account_roles ar
    where ar.account_id = p_account_id
      and ar.role in ('moderator','admin')
  )
$$;

create or replace function public.entity_owner_account_id(p_entity_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind community_entity_type;
  owner_id uuid;
begin
  select entity_type into kind
  from community_entities
  where entity_id = p_entity_id and deleted_at is null;

  case kind
    when 'creator_profile' then
      select owner_account_id into owner_id
      from creator_profiles where creator_profile_id = p_entity_id;
    when 'community_work' then
      select owner_account_id into owner_id
      from community_works where work_id = p_entity_id;
    when 'preset_artifact' then
      select owner_account_id into owner_id
      from preset_artifacts where preset_artifact_id = p_entity_id;
    when 'media_asset' then
      select owner_account_id into owner_id
      from media_assets where media_id = p_entity_id;
    when 'comment' then
      select author_account_id into owner_id
      from comments where comment_id = p_entity_id;
    else
      owner_id := null;
  end case;

  return owner_id;
end;
$$;

create or replace function public.is_discoverable_work(p_work_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from community_works w
    join community_entities e on e.entity_id = w.work_id
    where w.work_id = p_work_id
      and e.deleted_at is null
      and w.lifecycle_state = 'published'
      and w.visibility = 'public'
      and w.moderation_state = 'clear'
      and w.current_published_revision_id is not null
  )
$$;

create or replace function public.can_access_work(
  p_work_id uuid,
  p_account_id uuid default public.current_wand_account_id()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from community_works w
    join community_entities e on e.entity_id = w.work_id
    where w.work_id = p_work_id
      and e.deleted_at is null
      and (
        w.owner_account_id = p_account_id
        or public.is_staff(p_account_id)
        or (
          w.lifecycle_state = 'published'
          and w.current_published_revision_id is not null
          and w.visibility in ('public','unlisted')
          and w.moderation_state = 'clear'
        )
      )
  )
$$;

create or replace function public.can_access_entity(
  p_entity_id uuid,
  p_account_id uuid default public.current_wand_account_id()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind community_entity_type;
  linked_work uuid;
  comment_target uuid;
begin
  select entity_type into kind
  from community_entities
  where entity_id = p_entity_id and deleted_at is null;

  if kind is null then return false; end if;
  if public.entity_owner_account_id(p_entity_id) = p_account_id then return true; end if;
  if public.is_staff(p_account_id) then return true; end if;

  if kind = 'community_work' then
    return public.can_access_work(p_entity_id, p_account_id);
  elsif kind = 'creator_profile' then
    return exists (
      select 1 from creator_profiles c
      where c.creator_profile_id = p_entity_id
        and c.profile_visibility in ('public','unlisted')
        and c.moderation_state = 'clear'
    );
  elsif kind = 'preset_artifact' then
    select community_work_id into linked_work
    from preset_artifacts where preset_artifact_id = p_entity_id;
    return linked_work is not null and public.can_access_work(linked_work, p_account_id);
  elsif kind = 'comment' then
    select target_entity_id into comment_target
    from comments
    where comment_id = p_entity_id
      and lifecycle_state <> 'deleted'
      and moderation_state = 'clear';
    return comment_target is not null and public.can_access_entity(comment_target, p_account_id);
  elsif kind = 'media_asset' then
    return exists (
      select 1
      from work_revision_media wrm
      join community_works w
        on w.current_published_revision_id = wrm.work_revision_id
      where wrm.media_id = p_entity_id
        and public.can_access_work(w.work_id, p_account_id)
        and exists (
          select 1 from media_assets m
          where m.media_id = p_entity_id
            and m.processing_state = 'ready'
            and m.moderation_state = 'clear'
        )
    );
  end if;

  return false;
end;
$$;

revoke all on function public.current_wand_account_id() from public;
revoke all on function public.is_staff(uuid) from public;
revoke all on function public.entity_owner_account_id(uuid) from public;
revoke all on function public.is_discoverable_work(uuid) from public;
revoke all on function public.can_access_work(uuid, uuid) from public;
revoke all on function public.can_access_entity(uuid, uuid) from public;

grant execute on function public.current_wand_account_id() to anon, authenticated;
grant execute on function public.is_staff(uuid) to anon, authenticated;
grant execute on function public.entity_owner_account_id(uuid) to anon, authenticated;
grant execute on function public.is_discoverable_work(uuid) to anon, authenticated;
grant execute on function public.can_access_work(uuid, uuid) to anon, authenticated;
grant execute on function public.can_access_entity(uuid, uuid) to anon, authenticated;

alter table wand_accounts enable row level security;
alter table auth_identities enable row level security;
alter table account_roles enable row level security;
alter table community_entities enable row level security;
alter table creator_profiles enable row level security;
alter table ddv_profiles enable row level security;
alter table wand_account_ddv_profiles enable row level security;
alter table community_works enable row level security;
alter table community_work_revisions enable row level security;
alter table gallery_works enable row level security;
alter table gallery_work_revisions enable row level security;
alter table media_assets enable row level security;
alter table artifact_blobs enable row level security;
alter table preset_artifacts enable row level security;
alter table preset_revisions enable row level security;
alter table preset_revision_publications enable row level security;
alter table gallery_revision_presets enable row level security;
alter table work_revision_media enable row level security;
alter table saved_items enable row level security;
alter table follows enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;
alter table idempotency_keys enable row level security;
alter table outbox_events enable row level security;
alter table notification_events enable row level security;
alter table notification_deliveries enable row level security;
alter table reports enable row level security;
alter table moderation_cases enable row level security;
alter table moderation_case_reports enable row level security;
alter table moderation_actions enable row level security;
alter table audit_events enable row level security;
alter table search_documents enable row level security;

drop policy if exists wand_accounts_self_read on wand_accounts;
create policy wand_accounts_self_read on wand_accounts for select
using (account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists auth_identities_self_read on auth_identities;
create policy auth_identities_self_read on auth_identities for select
using (account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists creator_profiles_accessible_read on creator_profiles;
create policy creator_profiles_accessible_read on creator_profiles for select
using (
  owner_account_id = public.current_wand_account_id()
  or public.is_staff()
  or (profile_visibility in ('public','unlisted') and moderation_state = 'clear')
);

drop policy if exists community_entities_accessible_read on community_entities;
create policy community_entities_accessible_read on community_entities for select
using (public.can_access_entity(entity_id));

drop policy if exists community_works_accessible_read on community_works;
create policy community_works_accessible_read on community_works for select
using (public.can_access_work(work_id));

drop policy if exists community_work_revisions_accessible_read on community_work_revisions;
create policy community_work_revisions_accessible_read on community_work_revisions for select
using (public.can_access_work(work_id));

drop policy if exists gallery_works_accessible_read on gallery_works;
create policy gallery_works_accessible_read on gallery_works for select
using (public.can_access_work(work_id));

drop policy if exists gallery_work_revisions_accessible_read on gallery_work_revisions;
create policy gallery_work_revisions_accessible_read on gallery_work_revisions for select
using (
  exists (
    select 1 from community_work_revisions r
    where r.revision_id = gallery_work_revisions.revision_id
      and public.can_access_work(r.work_id)
  )
);

drop policy if exists preset_artifacts_accessible_read on preset_artifacts;
create policy preset_artifacts_accessible_read on preset_artifacts for select
using (public.can_access_entity(preset_artifact_id));

drop policy if exists preset_revisions_accessible_read on preset_revisions;
create policy preset_revisions_accessible_read on preset_revisions for select
using (
  exists (
    select 1 from preset_artifacts p
    where p.preset_artifact_id = preset_revisions.preset_artifact_id
      and public.can_access_entity(p.preset_artifact_id)
  )
);

drop policy if exists media_assets_accessible_read on media_assets;
create policy media_assets_accessible_read on media_assets for select
using (public.can_access_entity(media_id));

drop policy if exists saved_items_self_read on saved_items;
create policy saved_items_self_read on saved_items for select
using (account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists follows_self_read on follows;
create policy follows_self_read on follows for select
using (follower_account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists reactions_self_read on reactions;
create policy reactions_self_read on reactions for select
using (account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists comments_accessible_read on comments;
create policy comments_accessible_read on comments for select
using (
  author_account_id = public.current_wand_account_id()
  or public.is_staff()
  or (
    lifecycle_state <> 'deleted'
    and moderation_state = 'clear'
    and public.can_access_entity(target_entity_id)
  )
);

drop policy if exists notification_deliveries_self_read on notification_deliveries;
create policy notification_deliveries_self_read on notification_deliveries for select
using (recipient_account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists notification_events_recipient_read on notification_events;
create policy notification_events_recipient_read on notification_events for select
using (
  public.is_staff()
  or exists (
    select 1 from notification_deliveries d
    where d.notification_event_id = notification_events.notification_event_id
      and d.recipient_account_id = public.current_wand_account_id()
  )
);

drop policy if exists reports_self_read on reports;
create policy reports_self_read on reports for select
using (reporter_account_id = public.current_wand_account_id() or public.is_staff());

drop policy if exists moderation_cases_staff_read on moderation_cases;
create policy moderation_cases_staff_read on moderation_cases for select
using (public.is_staff());

drop policy if exists moderation_case_reports_staff_read on moderation_case_reports;
create policy moderation_case_reports_staff_read on moderation_case_reports for select
using (public.is_staff());

drop policy if exists moderation_actions_staff_read on moderation_actions;
create policy moderation_actions_staff_read on moderation_actions for select
using (public.is_staff());

drop policy if exists audit_events_staff_read on audit_events;
create policy audit_events_staff_read on audit_events for select
using (public.is_staff());

drop policy if exists search_documents_public_read on search_documents;
create policy search_documents_public_read on search_documents for select
using (public.is_discoverable_work(work_id));

-- No direct client INSERT/UPDATE/DELETE policies are created for canonical
-- community state. Mutations go through authenticated server commands using
-- the service role, which performs authorization, optimistic concurrency,
-- idempotency and state-change + outbox atomicity in one transaction.
-- RLS therefore acts as defense-in-depth and as the public/read boundary.


-- Additional relational integrity guards for the shared ownership boundary.

create or replace function validate_work_creator_owner()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from creator_profiles c
    where c.creator_profile_id = new.creator_profile_id
      and c.owner_account_id = new.owner_account_id
  ) then
    raise exception 'CommunityWork creator must belong to owner account';
  end if;
  return new;
end;
$$;

drop trigger if exists community_works_creator_owner_guard on community_works;
create trigger community_works_creator_owner_guard
before insert or update of owner_account_id, creator_profile_id on community_works
for each row execute function validate_work_creator_owner();

create or replace function validate_preset_creator_owner()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from creator_profiles c
    where c.creator_profile_id = new.creator_profile_id
      and c.owner_account_id = new.owner_account_id
  ) then
    raise exception 'PresetArtifact creator must belong to owner account';
  end if;
  return new;
end;
$$;

drop trigger if exists preset_artifacts_creator_owner_guard on preset_artifacts;
create trigger preset_artifacts_creator_owner_guard
before insert or update of owner_account_id, creator_profile_id on preset_artifacts
for each row execute function validate_preset_creator_owner();

create or replace function prevent_self_follow()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from creator_profiles c
    where c.creator_profile_id = new.creator_profile_id
      and c.owner_account_id = new.follower_account_id
  ) then
    raise exception 'Self-follow is not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists follows_no_self_follow on follows;
create trigger follows_no_self_follow
before insert or update on follows
for each row execute function prevent_self_follow();

create or replace function validate_comment_target_type()
returns trigger language plpgsql as $$
declare
  kind community_entity_type;
begin
  select entity_type into kind
  from community_entities
  where entity_id = new.target_entity_id
    and deleted_at is null;

  if kind not in ('community_work','preset_artifact') then
    raise exception 'Comments may target CommunityWork or PresetArtifact only';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_target_type_guard on comments;
create trigger comments_target_type_guard
before insert or update of target_entity_id on comments
for each row execute function validate_comment_target_type();

create or replace function validate_work_revision_media_owner()
returns trigger language plpgsql as $$
declare
  work_owner uuid;
  media_owner uuid;
begin
  select w.owner_account_id into work_owner
  from community_work_revisions r
  join community_works w on w.work_id = r.work_id
  where r.revision_id = new.work_revision_id;

  select m.owner_account_id into media_owner
  from media_assets m
  where m.media_id = new.media_id;

  if work_owner is null or media_owner is null or work_owner <> media_owner then
    raise exception 'Published work revision may reference only owner-controlled media';
  end if;
  return new;
end;
$$;

drop trigger if exists work_revision_media_owner_guard on work_revision_media;
create trigger work_revision_media_owner_guard
before insert or update on work_revision_media
for each row execute function validate_work_revision_media_owner();

create or replace function validate_preset_revision_blob_owner()
returns trigger language plpgsql as $$
declare
  preset_owner uuid;
  blob_owner uuid;
begin
  select p.owner_account_id into preset_owner
  from preset_artifacts p
  where p.preset_artifact_id = new.preset_artifact_id;

  select b.owner_account_id into blob_owner
  from artifact_blobs b
  where b.blob_id = new.artifact_blob_id;

  if preset_owner is null or blob_owner is null or preset_owner <> blob_owner then
    raise exception 'Preset revision may reference only owner-controlled artifact blobs';
  end if;
  return new;
end;
$$;

drop trigger if exists preset_revisions_blob_owner_guard on preset_revisions;
create trigger preset_revisions_blob_owner_guard
before insert or update on preset_revisions
for each row execute function validate_preset_revision_blob_owner();

create or replace function validate_gallery_revision_type()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
    from community_work_revisions r
    join community_works w on w.work_id = r.work_id
    join gallery_works g on g.work_id = w.work_id
    where r.revision_id = new.revision_id
      and w.work_type = 'gallery'
  ) then
    raise exception 'GalleryWorkRevision must belong to a Gallery CommunityWork';
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_work_revisions_type_guard on gallery_work_revisions;
create trigger gallery_work_revisions_type_guard
before insert or update on gallery_work_revisions
for each row execute function validate_gallery_revision_type();

create or replace function validate_preset_publication_mapping()
returns trigger language plpgsql as $$
declare
  published_work uuid;
  preset_work uuid;
begin
  select work_id into published_work
  from community_work_revisions
  where revision_id = new.work_revision_id;

  select p.community_work_id into preset_work
  from preset_revisions pr
  join preset_artifacts p on p.preset_artifact_id = pr.preset_artifact_id
  where pr.preset_revision_id = new.preset_revision_id;

  if published_work is null or preset_work is null or published_work <> preset_work then
    raise exception 'Preset publication must map the Preset revision to its own CommunityWork revision';
  end if;
  return new;
end;
$$;

drop trigger if exists preset_revision_publications_mapping_guard on preset_revision_publications;
create trigger preset_revision_publications_mapping_guard
before insert or update on preset_revision_publications
for each row execute function validate_preset_publication_mapping();

create or replace function increment_work_row_version()
returns trigger language plpgsql as $$
begin
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists community_works_row_version on community_works;
create trigger community_works_row_version
before update on community_works
for each row execute function increment_work_row_version();

create or replace function increment_comment_row_version()
returns trigger language plpgsql as $$
begin
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists comments_row_version on comments;
create trigger comments_row_version
before update on comments
for each row execute function increment_comment_row_version();

drop trigger if exists moderation_actions_immutable on moderation_actions;
create trigger moderation_actions_immutable
before update or delete on moderation_actions
for each row execute function prevent_immutable_revision_mutation();

drop trigger if exists audit_events_immutable on audit_events;
create trigger audit_events_immutable
before update or delete on audit_events
for each row execute function prevent_immutable_revision_mutation();

drop policy if exists ddv_profiles_owner_read on ddv_profiles;
create policy ddv_profiles_owner_read on ddv_profiles for select
using (
  public.is_staff()
  or exists (
    select 1 from wand_account_ddv_profiles l
    where l.ddv_profile_id = ddv_profiles.ddv_profile_id
      and l.account_id = public.current_wand_account_id()
  )
);

drop policy if exists wand_account_ddv_profiles_owner_read on wand_account_ddv_profiles;
create policy wand_account_ddv_profiles_owner_read on wand_account_ddv_profiles for select
using (account_id = public.current_wand_account_id() or public.is_staff());


create or replace function validate_work_lifecycle_transition()
returns trigger language plpgsql as $$
begin
  if old.lifecycle_state = new.lifecycle_state then
    return new;
  end if;

  if old.lifecycle_state = 'draft'
     and new.lifecycle_state in ('published','deleted') then
    return new;
  end if;

  if old.lifecycle_state = 'published'
     and new.lifecycle_state in ('unpublished','deleted') then
    return new;
  end if;

  if old.lifecycle_state = 'unpublished'
     and new.lifecycle_state in ('published','deleted') then
    return new;
  end if;

  raise exception 'Invalid CommunityWork lifecycle transition: % -> %',
    old.lifecycle_state, new.lifecycle_state;
end;
$$;

drop trigger if exists community_works_lifecycle_guard on community_works;
create trigger community_works_lifecycle_guard
before update of lifecycle_state on community_works
for each row execute function validate_work_lifecycle_transition();

create or replace function validate_gallery_work_type()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
    from community_works w
    where w.work_id = new.work_id
      and w.work_type = 'gallery'
  ) then
    raise exception 'GalleryWork must reference a Gallery CommunityWork';
  end if;
  return new;
end;
$$;

drop trigger if exists gallery_works_type_guard on gallery_works;
create trigger gallery_works_type_guard
before insert or update of work_id on gallery_works
for each row execute function validate_gallery_work_type();
