-- 03 COMM / Issue #139: source-only account privacy suppression, NOT physical erasure.
-- No Gallery lifecycle, Cloud, media object or native DDV mutation in this migration.
-- Requires Privacy/Legal/Ops approval + signed Staging acceptance before deployment.

create table if not exists private.account_privacy_suppressions (
  account_id uuid primary key references public.wand_accounts(account_id),
  suppressed_at timestamptz not null default clock_timestamp(),
  cleanup_state text not null default 'suppressed_cleanup_pending'
    check (cleanup_state in ('suppressed_cleanup_pending','cleanup_review_required')),
  cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  next_cleanup_at timestamptz null,
  last_error_code text null,
  updated_at timestamptz not null default clock_timestamp()
);
alter table private.account_privacy_suppressions enable row level security;
revoke all on private.account_privacy_suppressions from public,anon,authenticated,service_role;
create index if not exists account_privacy_suppressions_due_idx
  on private.account_privacy_suppressions(next_cleanup_at)
  where cleanup_state='suppressed_cleanup_pending';

create or replace function private.is_account_privacy_suppressed(p_account_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $privacy_lookup$
  select exists (
    select 1 from private.account_privacy_suppressions s
    where s.account_id=p_account_id
  )
$privacy_lookup$;
revoke all on function private.is_account_privacy_suppressed(uuid) from public;
grant execute on function private.is_account_privacy_suppressed(uuid) to anon,authenticated,service_role;

-- The common account resolution gates most owner commands. Account status and
-- auth mapping stay intact while deletion is deferred; retries use the special
-- recent-session Privacy RPC below, not this regular new-write authorization.
create or replace function private.resolve_active_account(p_auth_subject uuid)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $resolve_private$
declare
  v_account_id uuid;
  v_status public.account_status;
begin
  select a.account_id,a.status into v_account_id,v_status
  from public.auth_identities i
  join public.wand_accounts a on a.account_id=i.account_id
  where i.provider='supabase'
    and i.provider_subject=p_auth_subject::text
  limit 1;
  if v_account_id is null then
    raise exception 'WandAccount mapping not found for Supabase subject';
  end if;
  if v_status <> 'active' then
    raise exception 'WandAccount is not active';
  end if;
  if private.is_account_privacy_suppressed(v_account_id) then
    raise exception 'ACCOUNT_PRIVACY_SUPPRESSED';
  end if;
  return v_account_id;
end
$resolve_private$;

-- Durable read-time denial remains effective even when delayed publishers
-- have already written stale Work/Search state or Outbox events.
create or replace function private.is_discoverable_work(p_work_id uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,auth,public,private
as $privacy_discover$
  select exists (
    select 1
    from public.community_works w
    join public.community_entities e on e.entity_id=w.work_id
    where w.work_id=p_work_id and e.deleted_at is null
      and w.lifecycle_state='published'
      and w.visibility='public'
      and w.moderation_state='clear'
      and w.current_published_revision_id is not null
      and not private.is_account_privacy_suppressed(w.owner_account_id)
  )
$privacy_discover$;

create or replace function private.can_access_work(
  p_work_id uuid, p_account_id uuid default private.current_wand_account_id()
)
returns boolean
language sql stable security definer
set search_path=pg_catalog,auth,public,private
as $privacy_work_access$
  select exists (
    select 1 from public.community_works w
    join public.community_entities e on e.entity_id=w.work_id
    where w.work_id=p_work_id and e.deleted_at is null
      and (
        private.is_staff(p_account_id)
        or (
          not private.is_account_privacy_suppressed(w.owner_account_id)
          and (
            w.owner_account_id=p_account_id
            or (
              w.lifecycle_state='published'
              and w.current_published_revision_id is not null
              and w.visibility in ('public','unlisted')
              and w.moderation_state='clear'
            )
          )
        )
      )
  )
$privacy_work_access$;

-- Direct Creator SQL/RLS and SECURITY DEFINER public projection must both
-- refuse suppressed owner identities. Staff may investigate held data.
drop policy if exists creator_profiles_accessible_read on public.creator_profiles;
create policy creator_profiles_accessible_read on public.creator_profiles
for select to anon,authenticated
using (
  private.is_staff()
  or (
    not private.is_account_privacy_suppressed(owner_account_id)
    and (
      owner_account_id=private.current_wand_account_id()
      or (profile_visibility in ('public','unlisted') and moderation_state='clear')
    )
  )
);

create or replace function public.community_get_creator_public_v1(p_creator_profile_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $privacy_creator_public$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'creatorProfileId',c.creator_profile_id,
    'handle',c.handle,
    'displayName',c.display_name,
    'avatarMediaId',c.avatar_media_id,
    'bio',c.bio
  ) into v_result
  from public.creator_profiles c
  where c.creator_profile_id=p_creator_profile_id
    and c.profile_visibility='public' and c.moderation_state='clear'
    and not private.is_account_privacy_suppressed(c.owner_account_id);
  if v_result is null then
    raise exception 'Creator Profile is not publicly accessible';
  end if;
  return v_result;
end
$privacy_creator_public$;

-- Defense in depth for delayed positive current-pointer republish. Existing
-- negative moderator restriction is intentionally NOT blocked.
create or replace function private.reject_suppressed_owner_publication_v1()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,private
as $privacy_work_write$
begin
  if private.is_account_privacy_suppressed(new.owner_account_id) then
    if TG_OP='INSERT' or (
      new.lifecycle_state='published'
      and new.visibility in ('public','unlisted')
      and new.moderation_state='clear'
      and (
        new.current_published_revision_id is distinct from old.current_published_revision_id
        or new.lifecycle_state is distinct from old.lifecycle_state
        or new.visibility is distinct from old.visibility
        or new.moderation_state is distinct from old.moderation_state
      )
    ) then
      raise exception 'ACCOUNT_PRIVACY_SUPPRESSED';
    end if;
  end if;
  return new;
end
$privacy_work_write$;
revoke all on function private.reject_suppressed_owner_publication_v1()
from public,anon,authenticated,service_role;
drop trigger if exists community_works_privacy_positive_guard_v1 on public.community_works;
create trigger community_works_privacy_positive_guard_v1
before insert or update on public.community_works
for each row execute function private.reject_suppressed_owner_publication_v1();

-- Separate authenticated, session-bound, idempotent *suppression*, not erasure.
-- Signatures preserve existing Edge actor and confirmation; the verified JWT
-- subject and session are supplied only by the authenticated Edge handler.
create or replace function public.community_request_privacy_suppression_v1(
  p_auth_subject uuid,p_session_id uuid,p_issued_at_epoch bigint,p_confirmation text
)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $privacy_request$
declare
  v_account_id uuid;
  v_cutoff timestamptz;
  v_created_at timestamptz;
  v_not_after timestamptz;
  v_window integer;
  v_suppressed_at timestamptz;
  v_first boolean := false;
begin
  if p_confirmation <> 'DELETE' then
    raise exception 'Explicit account deletion confirmation is required';
  end if;
  select integer_value into v_window from private.community_security_config
  where policy_key='account_delete_recent_auth_seconds';
  if v_window is null or v_window<=0 then
    raise exception 'Account deletion recent-auth policy is not configured';
  end if;
  if p_auth_subject is null or p_session_id is null
     or p_issued_at_epoch is null or p_issued_at_epoch<=0
     or to_timestamp(p_issued_at_epoch)>clock_timestamp()+interval '60 seconds' then
    raise exception 'Valid signed identity and session required';
  end if;

  -- Unlike resolve_active_account, a suppressed account must be able to
  -- repeat this exact DELETE request without restoring regular write access.
  select i.account_id,i.sessions_valid_after into v_account_id,v_cutoff
  from public.auth_identities i
  join public.wand_accounts a on a.account_id=i.account_id
  where i.provider='supabase'
    and i.provider_subject=p_auth_subject::text
    and i.identity_state='active'
    and a.status='active' and a.deleted_at is null
  limit 1;
  if v_account_id is null then raise exception 'Active AuthIdentity not found'; end if;
  if to_timestamp(p_issued_at_epoch)<v_cutoff then
    raise exception 'Wand session has been revoked';
  end if;
  select s.created_at,s.not_after into v_created_at,v_not_after
  from auth.sessions s where s.id=p_session_id and s.user_id=p_auth_subject;
  if v_created_at is null then raise exception 'Authenticated session not found'; end if;
  if v_not_after is not null and v_not_after<=clock_timestamp() then
    raise exception 'Authenticated session has expired';
  end if;
  if v_created_at<clock_timestamp()-make_interval(secs=>v_window) then
    raise exception 'Recent authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('account-delete:'||v_account_id::text,0));
  perform 1 from public.wand_accounts
  where account_id=v_account_id and status='active' and deleted_at is null for update;
  if not found then raise exception 'WandAccount is not active'; end if;

  insert into private.account_privacy_suppressions(account_id,next_cleanup_at)
  values(v_account_id,clock_timestamp())
  on conflict(account_id) do nothing;
  v_first := found;
  select suppressed_at into v_suppressed_at
  from private.account_privacy_suppressions where account_id=v_account_id;

  if v_first then
    -- Search materialization is disposable. Do NOT update community_works,
    -- Gallery lifecycle, blob/cover history, Cloud or Storage; guards stay ON.
    delete from public.search_documents d
    using public.community_works w
    where d.work_id=w.work_id and w.owner_account_id=v_account_id;
    insert into public.outbox_events(
      aggregate_type,aggregate_id,event_type,payload,dedupe_key
    ) values(
      'wand_account',v_account_id,'account.privacy_suppressed',
      jsonb_build_object('accountId',v_account_id,'deferredCleanup',true),
      'account.privacy_suppressed:'||v_account_id::text
    );
    insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
    values(v_account_id,'account.privacy_suppressed',null,
      jsonb_build_object('deferredCleanup',true,'physicalDeletionComplete',false));
  end if;
  return jsonb_build_object(
    'accountId',v_account_id,
    'privacyState','suppressed_cleanup_pending',
    'suppressedAt',v_suppressed_at,
    'alreadySuppressed',not v_first,
    'publicReadsSuppressed',true,
    'fullDeletionComplete',false,
    'previousBearerUrlsRevoked',false,
    'retentionPolicyApproved',false
  );
end
$privacy_request$;

-- Compatibility entry point: pre-existing account Edge uses this name, but
-- success now means SUPPRESSION ONLY. External response must reflect that.
create or replace function public.community_tombstone_account(
  p_auth_subject uuid,p_session_id uuid,p_issued_at_epoch bigint,p_confirmation text
)
returns jsonb
language sql volatile security definer
set search_path=pg_catalog,public,private
as $privacy_compat$
  select public.community_request_privacy_suppression_v1(
    p_auth_subject,p_session_id,p_issued_at_epoch,p_confirmation
  )
$privacy_compat$;

revoke all on function public.community_request_privacy_suppression_v1(uuid,uuid,bigint,text)
from public,anon,authenticated,service_role;
grant execute on function public.community_request_privacy_suppression_v1(uuid,uuid,bigint,text)
to service_role;
revoke all on function public.community_tombstone_account(uuid,uuid,bigint,text)
from public,anon,authenticated;
grant execute on function public.community_tombstone_account(uuid,uuid,bigint,text)
to service_role;

-- An explicit search read-time fence even for SECURITY INVOKER callers
-- that bypass RLS (e.g. internal service_role projection).
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
    and private.is_discoverable_work(d.work_id)
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

