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


-- Supplement direct SECURITY DEFINER QA/DreamSnaps read projections that
-- cannot rely on Search row deletion or RLS under service_role.
create or replace function public.community_search_questions_v1(
  p_query text default null,
  p_context_tags text[] default null,
  p_unanswered_only boolean default false,
  p_limit integer default 20
)
returns table(
  question_id uuid,
  creator_profile_id uuid,
  title text,
  text_content text,
  context_tags text[],
  platform text,
  game_version text,
  resolution_state text,
  freshness text,
  answer_count integer,
  same_here_count integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_query text; v_pattern text; v_limit integer;
begin
  v_query:=nullif(btrim(p_query),'');
  if v_query is not null and char_length(v_query)>100 then
    raise exception 'Search query must be at most 100 characters';
  end if;
  if p_context_tags is not null and cardinality(p_context_tags)>20 then
    raise exception 'Search supports at most 20 Context Tags';
  end if;
  v_limit:=least(greatest(coalesce(p_limit,20),1),50);
  if v_query is not null then
    v_pattern:='%' ||
      replace(replace(replace(lower(v_query),'\','\\'),'%','\%'),'_','\_') || '%';
  end if;

  return query
  select
    d.work_id,
    d.creator_profile_id,
    d.title,
    d.text_content,
    d.tags,
    qr.platform,
    qr.game_version,
    qs.resolution_state,
    qs.freshness,
    (
      select count(*)::integer
      from public.qa_answers a
      join public.comments c on c.comment_id=a.answer_id
      where a.question_id=d.work_id
        and a.freshness='current'
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
    ),
    null::integer,
    d.published_at
  from public.search_documents d
  join public.community_works w on w.work_id=d.work_id
  join public.qa_question_state qs on qs.work_id=d.work_id
  join public.qa_question_revisions qr on qr.revision_id=w.current_published_revision_id
  where d.work_type='question'
    and private.is_discoverable_work(w.work_id)
    and qs.freshness='current'
    and (v_query is null
      or lower(d.title) ilike v_pattern escape '\'
      or lower(d.text_content) ilike v_pattern escape '\')
    and (p_context_tags is null or d.tags @> p_context_tags)
    and (
      not coalesce(p_unanswered_only,false)
      or not exists(
        select 1
        from public.qa_answers a
        join public.comments c on c.comment_id=a.answer_id
        where a.question_id=d.work_id
          and a.freshness='current'
          and c.lifecycle_state<>'deleted'
          and c.moderation_state='clear'
      )
    )
  order by d.published_at desc,d.work_id desc
  limit v_limit;
end
$$;

create or replace function public.community_get_question_redirect_public_v1(p_question_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select jsonb_build_object(
    'questionId',r.question_id,
    'redirectKind',r.redirect_kind,
    'targetQuestionId',r.target_question_id
  )
  from public.qa_question_redirects r
  where r.question_id=p_question_id
    and not exists (
      select 1 from public.community_works w
      where w.work_id=r.question_id
        and private.is_account_privacy_suppressed(w.owner_account_id)
    )
$$;

create or replace function public.community_get_question_public_v1(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_question_id
    and work_type='question'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';
  if v_work.work_id is null then
    raise exception 'Question is not publicly accessible';
  end if;

  select jsonb_build_object(
    'questionId',v_work.work_id,
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',qr.title,
    'body',qr.body,
    'contextTags',to_jsonb(qr.context_tags),
    'platform',qr.platform,
    'gameVersion',qr.game_version,
    'resolutionState',qs.resolution_state,
    'freshness',qs.freshness,
    'acceptedAnswerId',qs.accepted_answer_id,
    'solutionNote',qs.solution_note,
    'publishedAt',v_work.published_at,
    'answers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'answerId',a.answer_id,
        'creatorProfileId',c.creator_profile_id,
        'creatorDisplayName',cp.display_name,
        'body',c.body,
        'freshness',a.freshness,
        'accepted',a.answer_id=qs.accepted_answer_id,
        'createdAt',c.created_at
      ) order by (a.answer_id=qs.accepted_answer_id) desc,c.created_at,c.comment_id)
      from public.qa_answers a
      join public.comments c on c.comment_id=a.answer_id
      join public.creator_profiles cp on cp.creator_profile_id=c.creator_profile_id
      where a.question_id=v_work.work_id
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
        and not private.is_account_privacy_suppressed(c.author_account_id)
        and cp.moderation_state='clear'
    ),'[]'::jsonb)
  ) into v_result
  from public.qa_question_revisions qr
  join public.qa_question_state qs on qs.work_id=v_work.work_id
  where qr.revision_id=v_work.current_published_revision_id;

  return v_result;
end
$$;

create or replace function public.community_get_gallery_public_v1(p_work_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_work_id
    and work_type='gallery'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';
  if v_work.work_id is null then
    raise exception 'Gallery Work is not publicly accessible';
  end if;

  select jsonb_build_object(
    'workId',v_work.work_id,
    'workType','gallery',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'galleryKind',g.gallery_kind,
    'title',r.title,
    'description',r.description,
    'metadata',r.metadata,
    'publishedAt',v_work.published_at,
    'commentsEnabled',coalesce(s.comments_enabled,true),
    'mediaIds',coalesce((
      select jsonb_agg(m.media_id order by m.ordinal)
      from public.work_revision_media m
      where m.work_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'presetRevisionIds',coalesce((
      select jsonb_agg(p.preset_revision_id order by p.preset_revision_id)
      from public.gallery_revision_presets p
      where p.gallery_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'usedItems',coalesce((
      select jsonb_agg(
        jsonb_build_object('itemId',i.item_id,'featured',i.featured)
        order by i.featured desc,i.item_id
      )
      from public.gallery_revision_items i
      where i.gallery_revision_id=v_work.current_published_revision_id
    ),'[]'::jsonb),
    'comments',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'commentId',c.comment_id,
          'creatorProfileId',c.creator_profile_id,
          'parentCommentId',c.parent_comment_id,
          'body',c.body,
          'createdAt',c.created_at
        ) order by c.created_at,c.comment_id
      )
      from public.comments c
      where c.target_entity_id=p_work_id
        and c.lifecycle_state<>'deleted'
        and c.moderation_state='clear'
        and not private.is_account_privacy_suppressed(c.author_account_id)
    ),'[]'::jsonb)
  ) into v_result
  from public.gallery_works g
  join public.gallery_work_revisions r
    on r.revision_id=v_work.current_published_revision_id
  left join public.gallery_work_settings s on s.work_id=v_work.work_id
  where g.work_id=v_work.work_id;

  return v_result;
end
$$;

create or replace function public.community_get_gallery_dreamsnap_public_v1(
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work public.community_works%rowtype;
  v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_work_id
    and work_type='dreamsnap'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear'
    and not private.is_account_privacy_suppressed(owner_account_id);
  if v_work.work_id is null then raise exception 'Gallery DreamSnaps Work is not publicly accessible'; end if;

  select jsonb_build_object(
    'workId',v_work.work_id,
    'workType','dreamsnap',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'challengeId',c.challenge_id,
    'challengeTitle',c.title,
    'caption',gr.description,
    'publishedAt',gp.published_at,
    'mediaId',wrm.media_id,
    'commentsEnabled',gp.comments_enabled,
    'reactionKinds',coalesce((
      select jsonb_agg(x.reaction_kind order by x.reaction_kind)
      from (
        select distinct reaction_kind
        from public.reactions
        where target_entity_id=v_work.work_id
      ) x
    ),'[]'::jsonb),
    'officialResult',private.dreamsnap_public_official_result(e.entry_id),
    'comments',case when gp.comments_enabled then coalesce((
      select jsonb_agg(jsonb_build_object(
        'commentId',cm.comment_id,
        'creatorProfileId',cm.creator_profile_id,
        'parentCommentId',cm.parent_comment_id,
        'body',cm.body,
        'createdAt',cm.created_at
      ) order by cm.created_at,cm.comment_id)
      from public.comments cm
      where cm.target_entity_id=v_work.work_id
        and cm.lifecycle_state<>'deleted'
        and cm.moderation_state='clear'
        and not private.is_account_privacy_suppressed(cm.author_account_id)
    ),'[]'::jsonb) else '[]'::jsonb end
  )
  into v_result
  from public.dreamsnap_gallery_publications gp
  join public.dreamsnap_entries e on e.entry_id=gp.entry_id
  join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
  join public.gallery_work_revisions gr on gr.revision_id=gp.revision_id
  join public.work_revision_media wrm
    on wrm.work_revision_id=gp.revision_id
   and wrm.ordinal=0
   and wrm.role='dreamsnap'
  where gp.work_id=v_work.work_id
    and gp.publication_state='published'
    and c.lifecycle_state in ('results','closed')
    and c.is_synthetic=false
    and e.entry_state='entered'
    and e.eligibility_state='eligible';

  if v_result is null then raise exception 'Gallery DreamSnaps Work is not publicly accessible'; end if;
  return v_result;
end
$$;

create or replace function public.community_search_gallery_dreamsnaps_public_v1(
  p_query text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_query text:=nullif(btrim(p_query),'');
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),50);
begin
  if v_query is not null and char_length(v_query)>100 then
    raise exception 'Search query must be at most 100 characters';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'workId',x.work_id,
      'creatorProfileId',x.creator_profile_id,
      'creatorDisplayName',x.display_name,
      'challengeId',x.challenge_id,
      'challengeTitle',x.challenge_title,
      'mediaId',x.media_id,
      'publishedAt',x.published_at
    ) order by x.published_at desc,x.work_id)
    from (
      select
        w.work_id,w.creator_profile_id,cp.display_name,
        c.challenge_id,c.title challenge_title,wrm.media_id,gp.published_at
      from public.dreamsnap_gallery_publications gp
      join public.dreamsnap_entries e on e.entry_id=gp.entry_id
      join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
      join public.community_works w on w.work_id=gp.work_id
      join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
      join public.work_revision_media wrm
        on wrm.work_revision_id=gp.revision_id
       and wrm.ordinal=0
       and wrm.role='dreamsnap'
      where gp.publication_state='published'
        and c.is_synthetic=false
        and c.lifecycle_state in ('results','closed')
        and e.entry_state='entered'
        and e.eligibility_state='eligible'
        and w.lifecycle_state='published'
        and w.visibility='public'
        and w.moderation_state='clear'
        and not private.is_account_privacy_suppressed(w.owner_account_id)
        and cp.profile_visibility='public'
        and cp.moderation_state='clear'
        and (
          v_query is null
          or lower(c.title) like '%' || lower(v_query) || '%'
          or lower(cp.display_name) like '%' || lower(v_query) || '%'
        )
      order by gp.published_at desc,w.work_id
      limit v_limit
    ) x
  ),'[]'::jsonb);
end
$$;

create or replace function public.community_get_dreamsnap_results_public_v1(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v public.dreamsnap_challenges%rowtype;
  v_wand jsonb;
  v_official jsonb;
begin
  select * into v
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id
    and is_synthetic=false
    and lifecycle_state in ('results','closed');
  if v.challenge_id is null then raise exception 'DreamSnaps Results are not publicly accessible'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'entryId',r.entry_id,
    'entryRevisionId',r.entry_revision_id,
    'placement',r.placement,
    'formalScore',r.formal_score,
    'mediaId',wrm.media_id,
    'creatorProfileId',w.creator_profile_id,
    'creator',public.community_get_creator_public_v1(w.creator_profile_id)
  ) order by r.placement,r.entry_id),'[]'::jsonb)
  into v_wand
  from public.dreamsnap_wand_results r
  join public.dreamsnap_entries e on e.entry_id=r.entry_id
  join public.community_works w on w.work_id=e.work_id
  join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
  join public.work_revision_media wrm
    on wrm.work_revision_id=r.entry_revision_id
   and wrm.ordinal=0
   and wrm.role='dreamsnap'
  where r.challenge_id=p_challenge_id
    and e.entry_state='entered'
    and e.eligibility_state='eligible'
    and w.moderation_state='clear'
    and not private.is_account_privacy_suppressed(w.owner_account_id)
    and cp.profile_visibility='public'
    and cp.moderation_state='clear';

  select coalesce(jsonb_agg(jsonb_build_object(
    'entryId',e.entry_id,
    'creatorProfileId',w.creator_profile_id,
    'creator',public.community_get_creator_public_v1(w.creator_profile_id),
    'officialResult',private.dreamsnap_public_official_result(e.entry_id)
  ) order by e.entry_id),'[]'::jsonb)
  into v_official
  from public.dreamsnap_entries e
  join public.community_works w on w.work_id=e.work_id
  join public.creator_profiles cp on cp.creator_profile_id=w.creator_profile_id
  where e.challenge_id=p_challenge_id
    and e.entry_state='entered'
    and e.eligibility_state='eligible'
    and w.moderation_state='clear'
    and not private.is_account_privacy_suppressed(w.owner_account_id)
    and cp.profile_visibility='public'
    and cp.moderation_state='clear'
    and private.dreamsnap_public_official_result(e.entry_id) is not null;

  return jsonb_build_object(
    'challenge',jsonb_build_object(
      'challengeId',v.challenge_id,'challengeKey',v.challenge_key,
      'title',v.title,'description',v.description,'state',v.lifecycle_state,
      'resultsAt',v.results_at,'closesAt',v.closes_at
    ),
    'wandResults',v_wand,
    'inGameResults',v_official
  );
end
$$;

create or replace function public.community_get_dreamsnap_judge_v1(
  p_auth_subject uuid,
  p_challenge_id uuid,
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_used integer;
  v_special_used integer;
  v_mode text;
  v_candidates jsonb;
  v_limit integer;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  v_limit:=least(greatest(coalesce(p_limit,12),1),30);

  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id;
  if v_challenge.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;
  if v_challenge.lifecycle_state<>'judging_open' then
    raise exception 'DreamSnaps Judge is not open';
  end if;
  if not v_challenge.is_synthetic and not private.dreamsnap_real_entry_floor_met(p_challenge_id) then
    raise exception 'DREAMSNAP_REAL_ENTRY_FLOOR_NOT_MET';
  end if;

  select count(*)::integer into v_used
  from public.dreamsnap_formal_votes
  where challenge_id=p_challenge_id and voter_account_id=v_account_id;

  select count(*)::integer into v_special_used
  from public.dreamsnap_special_picks
  where challenge_id=p_challenge_id and account_id=v_account_id;

  if v_used<v_challenge.formal_vote_allowance then
    v_mode:='formal';
  elsif v_challenge.allow_post_formal_browse then
    v_mode:='browse';
  else
    v_mode:='complete';
  end if;

  if v_mode='complete' then
    v_candidates:='[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'entryId',x.entry_id,
      'entryRevisionId',x.entry_revision_id,
      'mediaId',x.media_id
    ) order by x.entry_id),'[]'::jsonb)
    into v_candidates
    from (
      select
        e.entry_id,e.entry_revision_id,wrm.media_id
      from public.dreamsnap_entries e
      join public.community_works w on w.work_id=e.work_id
      join public.dreamsnap_work_revisions dr on dr.revision_id=e.entry_revision_id
      join public.work_revision_media wrm
        on wrm.work_revision_id=e.entry_revision_id
       and wrm.ordinal=0
       and wrm.role='dreamsnap'
      join public.media_assets m on m.media_id=wrm.media_id
      where e.challenge_id=p_challenge_id
        and e.entry_state='entered'
        and e.eligibility_state='eligible'
        and e.account_id<>v_account_id
        and w.moderation_state='clear'
        and not private.is_account_privacy_suppressed(w.owner_account_id)
        and dr.integrity_state='eligible'
        and m.processing_state='ready'
        and m.moderation_state='clear'
        and m.purged_at is null
        and (
          v_mode='browse'
          or not exists(
            select 1 from public.dreamsnap_formal_votes fv
            where fv.challenge_id=p_challenge_id
              and fv.voter_account_id=v_account_id
              and fv.entry_id=e.entry_id
          )
        )
      order by e.entry_id
      limit v_limit
    ) x;
  end if;

  return jsonb_build_object(
    'challengeId',p_challenge_id,
    'state',v_challenge.lifecycle_state,
    'mode',v_mode,
    'formalVotesUsed',v_used,
    'formalVotesRemaining',greatest(v_challenge.formal_vote_allowance-v_used,0),
    'formalAllowanceExhausted',(v_used>=v_challenge.formal_vote_allowance),
    'specialPicksUsed',v_special_used,
    'specialPicksRemaining',greatest(v_challenge.special_pick_allowance-v_special_used,0),
    'allowSpecialPicks',v_challenge.allow_special_picks,
    'candidates',v_candidates
  );
end
$$;

create or replace function public.community_get_dreamsnap_judge_media_storage_v1(
  p_auth_subject uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_used integer;
  v_media public.media_assets%rowtype;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select * into v_entry
  from public.dreamsnap_entries
  where entry_id=p_entry_id;
  if v_entry.entry_id is null
     or v_entry.entry_state<>'entered'
     or v_entry.eligibility_state<>'eligible' then
    raise exception 'DreamSnaps judge media is not accessible';
  end if;
  if v_entry.account_id=v_account_id then raise exception 'DreamSnaps judge media is not accessible'; end if;

  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=v_entry.challenge_id;
  if v_challenge.lifecycle_state<>'judging_open' then
    raise exception 'DreamSnaps judge media is not accessible';
  end if;
  if not v_challenge.is_synthetic and not private.dreamsnap_real_entry_floor_met(v_entry.challenge_id) then
    raise exception 'DreamSnaps judge media is not accessible';
  end if;

  select count(*)::integer into v_used
  from public.dreamsnap_formal_votes
  where challenge_id=v_entry.challenge_id and voter_account_id=v_account_id;

  if v_used<v_challenge.formal_vote_allowance then
    if exists(
      select 1 from public.dreamsnap_formal_votes
      where challenge_id=v_entry.challenge_id
        and voter_account_id=v_account_id
        and entry_id=v_entry.entry_id
    ) then
      raise exception 'DreamSnaps judge media is not accessible';
    end if;
  elsif not v_challenge.allow_post_formal_browse then
    raise exception 'DreamSnaps judge media is not accessible';
  end if;

  if not exists(
    select 1 from public.community_works w
    join public.dreamsnap_work_revisions dr on dr.revision_id=v_entry.entry_revision_id
    where w.work_id=v_entry.work_id
      and w.moderation_state='clear'
      and not private.is_account_privacy_suppressed(w.owner_account_id)
      and dr.integrity_state='eligible'
  ) then raise exception 'DreamSnaps judge media is not accessible'; end if;

  select m.* into v_media
  from public.work_revision_media wrm
  join public.media_assets m on m.media_id=wrm.media_id
  where wrm.work_revision_id=v_entry.entry_revision_id
    and wrm.ordinal=0
    and wrm.role='dreamsnap'
    and m.processing_state='ready'
    and m.moderation_state='clear'
    and m.purged_at is null;

  if v_media.media_id is null then raise exception 'DreamSnaps judge media is not accessible'; end if;

  return jsonb_build_object(
    'mediaId',v_media.media_id,'storageKey',v_media.storage_key,
    'mimeType',v_media.mime_type,'byteSize',v_media.byte_size,
    'width',v_media.width,'height',v_media.height,
    'checksumSha256',v_media.checksum_sha256
  );
end
$$;

create or replace function public.community_get_public_media_storage_v2(
  p_media_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'mediaId',m.media_id,
    'storageKey',m.storage_key,
    'mimeType',m.mime_type,
    'byteSize',m.byte_size,
    'width',m.width,
    'height',m.height,
    'checksumSha256',m.checksum_sha256
  )
  into v_result
  from public.media_assets m
  where m.media_id=p_media_id
    and m.processing_state='ready'
    and m.moderation_state='clear'
    and m.purged_at is null
    and (
      exists(
        select 1
        from public.work_revision_media wrm
        join public.community_work_revisions r on r.revision_id=wrm.work_revision_id
        join public.community_works w
          on w.work_id=r.work_id
         and w.current_published_revision_id=r.revision_id
        where wrm.media_id=m.media_id
          and w.work_type='gallery'
          and private.is_discoverable_work(w.work_id)
      )
      or exists(
        select 1
        from public.work_revision_media wrm
        join public.dreamsnap_gallery_publications gp on gp.revision_id=wrm.work_revision_id
        join public.dreamsnap_entries e on e.entry_id=gp.entry_id
        join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
        join public.community_works w on w.work_id=gp.work_id
        where wrm.media_id=m.media_id
          and gp.publication_state='published'
          and c.is_synthetic=false
          and c.lifecycle_state in ('results','closed')
          and e.entry_state='entered'
          and e.eligibility_state='eligible'
          and w.lifecycle_state='published'
          and w.visibility='public'
          and w.moderation_state='clear'
          and not private.is_account_privacy_suppressed(w.owner_account_id)
      )
      or exists(
        select 1
        from public.work_revision_media wrm
        join public.dreamsnap_entries e on e.entry_revision_id=wrm.work_revision_id
        join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
        join public.community_works w on w.work_id=e.work_id
        where wrm.media_id=m.media_id
          and c.is_synthetic=false
          and c.lifecycle_state in ('results','closed')
          and e.entry_state='entered'
          and e.eligibility_state='eligible'
          and w.moderation_state='clear'
          and not private.is_account_privacy_suppressed(w.owner_account_id)
      )
    );

  if v_result is null then raise exception 'Public media is not accessible'; end if;
  return v_result;
end
$$;
