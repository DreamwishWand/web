-- Anonymous/public read projections intentionally use tightly-scoped SECURITY DEFINER RPCs.
-- Direct SELECT on Community ownership tables remains closed; these functions project only
-- launch-approved public fields and explicitly filter lifecycle/visibility/moderation state.

create or replace function public.community_get_creator_public_v1(p_creator_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
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
        and cp.moderation_state='clear'
    ),'[]'::jsonb)
  ) into v_result
  from public.qa_question_revisions qr
  join public.qa_question_state qs on qs.work_id=v_work.work_id
  where qr.revision_id=v_work.current_published_revision_id;

  return v_result;
end
$$;

create or replace function public.community_get_tip_public_v1(p_tip_id uuid)
returns jsonb
language plpgsql
stable
security definer
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
