
-- Harden public Gallery/Q&A reads to run as caller and rely on RLS.
-- Interaction aggregates that require private rows stay on authenticated service-role queries.

drop policy if exists work_revision_media_accessible_read on public.work_revision_media;
create policy work_revision_media_accessible_read
on public.work_revision_media for select to anon,authenticated
using (
  exists (
    select 1 from public.community_work_revisions r
    where r.revision_id=work_revision_id
      and private.can_access_work(r.work_id)
  )
);
grant select on public.work_revision_media to anon,authenticated,service_role;

drop policy if exists gallery_revision_presets_accessible_read on public.gallery_revision_presets;
create policy gallery_revision_presets_accessible_read
on public.gallery_revision_presets for select to anon,authenticated
using (
  exists (
    select 1 from public.community_work_revisions r
    where r.revision_id=gallery_revision_id
      and private.can_access_work(r.work_id)
  )
);
grant select on public.gallery_revision_presets to anon,authenticated,service_role;

drop policy if exists qa_question_redirects_public_read on public.qa_question_redirects;
create policy qa_question_redirects_public_read
on public.qa_question_redirects for select to anon,authenticated
using (private.is_discoverable_work(target_question_id));
grant select on public.qa_question_redirects to anon,authenticated,service_role;

create index if not exists qa_question_redirects_target_idx
  on public.qa_question_redirects(target_question_id);
create index if not exists qa_question_state_accepted_answer_idx
  on public.qa_question_state(accepted_answer_id)
  where accepted_answer_id is not null;
create index if not exists qa_tip_revisions_source_question_idx
  on public.qa_tip_revisions(source_question_id)
  where source_question_id is not null;
create index if not exists qa_tip_revisions_source_answer_idx
  on public.qa_tip_revisions(source_answer_id)
  where source_answer_id is not null;

create or replace function public.community_get_creator_public_v1(p_creator_profile_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,private
as $$
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
    and c.profile_visibility='public'
    and c.moderation_state='clear';

  if v_result is null then raise exception 'Creator Profile is not publicly accessible'; end if;
  return v_result;
end
$$;

create or replace function public.community_get_gallery_public_v1(p_work_id uuid)
returns jsonb
language plpgsql
stable
security invoker
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

create or replace function public.community_get_gallery_v1(
  p_auth_subject uuid,
  p_work_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_public jsonb;
  v_reaction_counts jsonb;
  v_reaction_kinds jsonb;
  v_own_reactions jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_work(p_work_id,v_account_id) then
    raise exception 'Work is not accessible';
  end if;
  select * into v_work from public.community_works
  where work_id=p_work_id and work_type='gallery';
  if v_work.work_id is null then raise exception 'Gallery Work not found'; end if;

  if v_work.lifecycle_state='published'
     and v_work.visibility='public'
     and v_work.moderation_state='clear' then
    v_public:=public.community_get_gallery_public_v1(p_work_id);
  else
    select jsonb_build_object(
      'workId',v_work.work_id,
      'workType','gallery',
      'creatorProfileId',v_work.creator_profile_id,
      'lifecycleState',v_work.lifecycle_state,
      'visibility',v_work.visibility,
      'moderationState',v_work.moderation_state,
      'rowVersion',v_work.row_version,
      'commentsEnabled',coalesce(s.comments_enabled,true),
      'title',r.title,
      'description',r.description,
      'metadata',r.metadata
    ) into v_public
    from public.gallery_work_settings s
    left join public.gallery_work_revisions r
      on r.revision_id=v_work.current_published_revision_id
    where s.work_id=v_work.work_id;
  end if;

  select coalesce(jsonb_agg(x.reaction_kind order by x.reaction_kind),'[]'::jsonb)
  into v_reaction_kinds
  from (
    select distinct reaction_kind
    from public.reactions
    where target_entity_id=p_work_id
  ) x;

  select coalesce(jsonb_agg(
    jsonb_build_object('kind',x.reaction_kind,'count',x.n)
    order by x.reaction_kind
  ),'[]'::jsonb)
  into v_reaction_counts
  from (
    select reaction_kind,count(*)::integer n
    from public.reactions
    where target_entity_id=p_work_id
    group by reaction_kind
  ) x;

  select coalesce(jsonb_agg(reaction_kind order by reaction_kind),'[]'::jsonb)
  into v_own_reactions
  from public.reactions
  where target_entity_id=p_work_id and account_id=v_account_id;

  return v_public || jsonb_build_object(
    'isOwner',v_work.owner_account_id=v_account_id,
    'reactionKinds',v_reaction_kinds,
    'viewerReactionKinds',v_own_reactions,
    'reactionCounts',case when v_work.owner_account_id=v_account_id or private.is_staff(v_account_id)
      then v_reaction_counts else null end
  );
end
$$;

create or replace function public.community_get_question_redirect_public_v1(p_question_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog,public,private
as $$
  select jsonb_build_object(
    'questionId',r.question_id,
    'redirectKind',r.redirect_kind,
    'targetQuestionId',r.target_question_id
  )
  from public.qa_question_redirects r
  where r.question_id=p_question_id
$$;

create or replace function public.community_get_question_public_v1(p_question_id uuid)
returns jsonb
language plpgsql
stable
security invoker
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
        and cp.moderation_state='clear'
    ),'[]'::jsonb)
  ) into v_result
  from public.qa_question_revisions qr
  join public.qa_question_state qs on qs.work_id=v_work.work_id
  where qr.revision_id=v_work.current_published_revision_id;

  return v_result;
end
$$;

create or replace function public.community_get_question_v1(
  p_auth_subject uuid,
  p_question_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_result jsonb;
  v_same_here boolean;
  v_same_here_count integer;
  v_utility jsonb;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not private.can_access_work(p_question_id,v_account_id) then
    raise exception 'Question is not accessible';
  end if;
  v_result:=public.community_get_question_public_v1(p_question_id);

  select exists(
    select 1 from public.qa_same_here
    where account_id=v_account_id and question_id=p_question_id
  ) into v_same_here;

  select count(*)::integer into v_same_here_count
  from public.qa_same_here where question_id=p_question_id;

  select coalesce(jsonb_object_agg(u.answer_id::text,u.utility_kind),'{}'::jsonb)
  into v_utility
  from public.qa_answer_utility u
  join public.qa_answers a on a.answer_id=u.answer_id
  where u.account_id=v_account_id and a.question_id=p_question_id;

  return v_result || jsonb_build_object(
    'sameHereCount',v_same_here_count,
    'viewerSameHere',v_same_here,
    'viewerAnswerUtility',v_utility
  );
end
$$;

create or replace function public.community_get_tip_public_v1(p_tip_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,private
as $$
declare v_work public.community_works%rowtype; v_result jsonb;
begin
  select * into v_work
  from public.community_works
  where work_id=p_tip_id
    and work_type='tip'
    and lifecycle_state='published'
    and visibility='public'
    and moderation_state='clear';
  if v_work.work_id is null then
    raise exception 'Tip is not publicly accessible';
  end if;

  select jsonb_build_object(
    'tipId',v_work.work_id,
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'title',tr.title,'body',tr.body,'contextTags',to_jsonb(tr.context_tags),
    'platform',tr.platform,'gameVersion',tr.game_version,
    'freshness',ts.freshness,
    'sourceQuestionId',tr.source_question_id,'sourceAnswerId',tr.source_answer_id,
    'publishedAt',v_work.published_at
  ) into v_result
  from public.qa_tip_revisions tr
  join public.qa_tip_state ts on ts.work_id=v_work.work_id
  where tr.revision_id=v_work.current_published_revision_id;

  return v_result;
end
$$;

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
security invoker
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
