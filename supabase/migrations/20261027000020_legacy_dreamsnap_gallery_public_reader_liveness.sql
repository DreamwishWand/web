-- 03 COMM / Issue224 — real local PostgreSQL CEX for legacy Search.
-- Original 44500 Search and effective FINAL 44600 native-revision Detail read.
-- Forward-only Source145; no historical Source134–144 edits or public Publisher.
-- One accepted shared predicate: Source144 private.dreamsnap_public_work_accessible_r20.
-- Own-account OFF on official DDV NUMERIC fields is independent of public Wand Work.
-- Original authorizations/JSON signatures preserved; no CDN/media bearer revocation.

-- Confirmed 144-schema two-connection RED:
-- Account restricted, identity retired, Creator entity deleted -> old Search
-- returns WorkId/MediaId while Source144 V2 signer & WAND Result deny.
-- Privacy Suppression old Search already denied (NOT a reproduced leak).
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
      join public.community_work_revisions cr
        on cr.revision_id=gp.revision_id and cr.work_id=w.work_id
      join public.dreamsnap_work_revisions dr
        on dr.revision_id=gp.revision_id and dr.integrity_state='eligible'
      join public.media_assets m
        on m.media_id=wrm.media_id
       and m.owner_account_id=w.owner_account_id
       and m.processing_state='ready'
       and m.moderation_state='clear'
       and m.purged_at is null
      where gp.publication_state='published'
        and gp.work_id=e.work_id
        and e.account_id=w.owner_account_id
        and e.managed_under13=false
        and private.dreamsnap_public_work_accessible_r20(w.work_id)
        and cp.owner_account_id=w.owner_account_id
        and c.is_synthetic=false
        and c.lifecycle_state in ('results','closed')
        and e.entry_state='entered'
        and e.eligibility_state='eligible'
        and w.lifecycle_state='published'
        and w.visibility='public'
        and w.moderation_state='clear'
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

-- Legacy Detail did not return positive data from the first 144 synthetic
-- fixture (NOT_REPRODUCED as an actual disclosure); still align its first
-- SECURITY DEFINER work lookup and final relation read with same accepted
-- Account/Identity/Creator/Privacy effective public criteria. The detail body
-- is based on FINAL Source44600, not superseded Source44500 (dr.caption).
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
    and private.dreamsnap_public_work_accessible_r20(work_id);
  if v_work.work_id is null then raise exception 'Gallery DreamSnaps Work is not publicly accessible'; end if;

  select jsonb_build_object(
    'workId',v_work.work_id,
    'workType','dreamsnap',
    'creatorProfileId',v_work.creator_profile_id,
    'creator',public.community_get_creator_public_v1(v_work.creator_profile_id),
    'challengeId',c.challenge_id,
    'challengeTitle',c.title,
    'caption',dr.caption,
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
    ),'[]'::jsonb) else '[]'::jsonb end
  )
  into v_result
  from public.dreamsnap_gallery_publications gp
  join public.dreamsnap_entries e on e.entry_id=gp.entry_id
  join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
  join public.dreamsnap_work_revisions dr on dr.revision_id=gp.revision_id
  join public.work_revision_media wrm
    on wrm.work_revision_id=gp.revision_id
   and wrm.ordinal=0
   and wrm.role='dreamsnap'
  join public.community_work_revisions cr
    on cr.revision_id=gp.revision_id
   and cr.work_id=v_work.work_id
  join public.media_assets m
    on m.media_id=wrm.media_id
   and m.owner_account_id=v_work.owner_account_id
   and m.processing_state='ready'
   and m.moderation_state='clear'
   and m.purged_at is null
  where gp.work_id=v_work.work_id
    and gp.work_id=e.work_id
    and e.account_id=v_work.owner_account_id
    and e.managed_under13=false
    and private.dreamsnap_public_work_accessible_r20(v_work.work_id)
    and gp.publication_state='published'
    and c.lifecycle_state in ('results','closed')
    and c.is_synthetic=false
    and e.entry_state='entered'
    and e.eligibility_state='eligible'
    and dr.integrity_state='eligible';

  if v_result is null then raise exception 'Gallery DreamSnaps Work is not publicly accessible'; end if;
  return v_result;
end
$$;
