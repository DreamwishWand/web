-- DreamSnaps query/projection/privacy/moderation layer.

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
  select * into v_result from public.dreamsnap_official_results where entry_id=p_entry_id;
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

revoke execute on function private.dreamsnap_public_official_result(uuid)
from public,anon,authenticated,service_role;

create or replace function public.community_get_current_dreamsnap_challenge_public_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v public.dreamsnap_challenges%rowtype;
begin
  select * into v
  from public.dreamsnap_challenges
  where is_synthetic=false
    and lifecycle_state<>'closed'
  order by submission_opens_at desc,challenge_id desc
  limit 1;

  if v.challenge_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'challengeId',v.challenge_id,
    'challengeKey',v.challenge_key,
    'title',v.title,
    'description',v.description,
    'state',v.lifecycle_state,
    'submissionOpensAt',v.submission_opens_at,
    'submissionClosesAt',v.submission_closes_at,
    'judgingOpensAt',v.judging_opens_at,
    'judgingClosesAt',v.judging_closes_at,
    'resultsAt',v.results_at,
    'closesAt',v.closes_at,
    'formalVoteAllowance',v.formal_vote_allowance,
    'specialPickAllowance',v.special_pick_allowance,
    'allowPostFormalBrowse',v.allow_post_formal_browse,
    'allowSpecialPicks',v.allow_special_picks
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

create or replace function public.community_list_dreamsnap_result_rounds_public_v1(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_limit integer;
begin
  v_limit:=least(greatest(coalesce(p_limit,50),1),100);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'challengeId',x.challenge_id,
      'challengeKey',x.challenge_key,
      'title',x.title,
      'state',x.lifecycle_state,
      'resultsAt',x.results_at,
      'closesAt',x.closes_at
    ) order by x.results_at desc,x.challenge_id)
    from (
      select *
      from public.dreamsnap_challenges
      where is_synthetic=false
        and lifecycle_state in ('results','closed')
      order by results_at desc,challenge_id
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

create or replace function public.community_get_my_dreamsnaps_v1(
  p_auth_subject uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_limit integer;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  v_limit:=least(greatest(coalesce(p_limit,100),1),200);

  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'entryId',x.entry_id,
      'workId',x.work_id,
      'challengeId',x.challenge_id,
      'challengeKey',x.challenge_key,
      'challengeTitle',x.challenge_title,
      'challengeState',x.challenge_state,
      'entryState',x.entry_state,
      'eligibilityState',x.eligibility_state,
      'entryRevisionId',x.entry_revision_id,
      'currentWorkRevisionId',x.current_work_revision_id,
      'entryFrozen',x.entry_revision_id is distinct from x.current_work_revision_id,
      'mediaId',x.media_id,
      'managedUnder13',x.managed_under13,
      'wandResult',x.wand_result,
      'officialResult',x.official_result,
      'officialPublicFields',to_jsonb(x.public_fields),
      'galleryState',x.gallery_state,
      'galleryCommentsEnabled',x.comments_enabled,
      'moderationState',x.moderation_state,
      'joinedAt',x.joined_at
    )) order by x.submission_opens_at desc,x.entry_id)
    from (
      select
        e.entry_id,e.work_id,e.challenge_id,c.challenge_key,c.title challenge_title,
        c.lifecycle_state challenge_state,c.submission_opens_at,
        e.entry_state,e.eligibility_state,e.entry_revision_id,e.managed_under13,e.joined_at,
        w.current_published_revision_id current_work_revision_id,w.moderation_state,
        wrm.media_id,
        case when r.entry_id is null then null else jsonb_build_object(
          'placement',r.placement,'formalScore',r.formal_score,'finalizedAt',r.finalized_at
        ) end wand_result,
        case when o.entry_id is null then null else jsonb_build_object(
          'score',o.score,'rank',o.rank,'moonstones',o.moonstones,
          'pixelDust',o.pixel_dust,'recordedAt',o.recorded_at
        ) end official_result,
        coalesce(op.public_fields,array[]::text[]) public_fields,
        gp.publication_state gallery_state,
        gp.comments_enabled
      from public.dreamsnap_entries e
      join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
      join public.community_works w on w.work_id=e.work_id
      join public.work_revision_media wrm
        on wrm.work_revision_id=e.entry_revision_id
       and wrm.ordinal=0
       and wrm.role='dreamsnap'
      left join public.dreamsnap_wand_results r on r.entry_id=e.entry_id
      left join public.dreamsnap_official_results o on o.entry_id=e.entry_id
      left join public.dreamsnap_official_result_publication op on op.entry_id=e.entry_id
      left join public.dreamsnap_gallery_publications gp on gp.entry_id=e.entry_id
      where e.account_id=v_account_id
      order by c.submission_opens_at desc,e.entry_id
      limit v_limit
    ) x
  ),'[]'::jsonb);
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
    and moderation_state='clear';
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
      )
    );

  if v_result is null then raise exception 'Public media is not accessible'; end if;
  return v_result;
end
$$;

create or replace function private.dreamsnap_apply_work_moderation_effect_v1(
  p_work_id uuid,
  p_action text
)
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_affected integer:=0;
begin
  if p_action in ('restrict','remove') then
    update public.dreamsnap_entries
    set eligibility_state='ineligible',updated_at=now()
    where work_id=p_work_id
      and entry_state='entered'
      and eligibility_state<>'ineligible';
    get diagnostics v_affected=row_count;
    delete from public.search_documents where work_id=p_work_id;
  elsif p_action='restore' then
    update public.dreamsnap_entries e
    set eligibility_state='eligible',updated_at=now()
    where e.work_id=p_work_id
      and e.entry_state='entered'
      and exists(
        select 1 from public.dreamsnap_work_revisions dr
        where dr.revision_id=e.entry_revision_id and dr.integrity_state='eligible'
      );
    get diagnostics v_affected=row_count;

    insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
    )
    select
      w.work_id,w.work_id,'dreamsnap',w.creator_profile_id,c.title,coalesce(gr.description,''),
      array[]::text[],
      jsonb_build_object(
        'challengeId',c.challenge_id,'commentsEnabled',gp.comments_enabled,'competitionArchive',true
      ),
      gp.published_at,now()
    from public.community_works w
    join public.dreamsnap_gallery_publications gp on gp.work_id=w.work_id
    join public.dreamsnap_entries e on e.entry_id=gp.entry_id
    join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
    join public.gallery_work_revisions gr on gr.revision_id=gp.revision_id
    where w.work_id=p_work_id
      and w.lifecycle_state='published'
      and w.visibility='public'
      and w.moderation_state='clear'
      and gp.publication_state='published'
      and c.lifecycle_state in ('results','closed')
      and e.entry_state='entered'
      and e.eligibility_state='eligible'
    on conflict(entity_id) do update set
      creator_profile_id=excluded.creator_profile_id,
      title=excluded.title,text_content=excluded.text_content,
      tags=excluded.tags,facets=excluded.facets,
      published_at=excluded.published_at,updated_at=now();
  else
    raise exception 'Unsupported DreamSnaps moderation projection action';
  end if;

  return v_affected;
end
$$;

revoke execute on function private.dreamsnap_apply_work_moderation_effect_v1(uuid,text)
from public,anon,authenticated,service_role;

create or replace function public.community_moderate_entity_v5(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_case_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_target uuid;
  v_work_type public.work_type;
  v_result jsonb;
  v_affected integer:=0;
begin
  select mc.target_entity_id,w.work_type
  into v_target,v_work_type
  from public.moderation_cases mc
  left join public.community_works w on w.work_id=mc.target_entity_id
  where mc.case_id=p_case_id;

  v_result:=public.community_moderate_entity_v4(
    p_auth_subject,p_session_id,p_issued_at_epoch,p_case_id,p_action,p_reason
  );

  if v_work_type='dreamsnap' then
    v_affected:=private.dreamsnap_apply_work_moderation_effect_v1(v_target,p_action);
    v_result:=v_result || jsonb_build_object(
      'dreamsnapEligibilityRowsChanged',v_affected
    );
  end if;

  return v_result;
end
$$;

revoke execute on function public.community_get_current_dreamsnap_challenge_public_v1()
from public,anon,authenticated;
revoke execute on function public.community_get_dreamsnap_judge_v1(uuid,uuid,integer)
from public,anon,authenticated;
revoke execute on function public.community_get_dreamsnap_judge_media_storage_v1(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_list_dreamsnap_result_rounds_public_v1(integer)
from public,anon,authenticated;
revoke execute on function public.community_get_dreamsnap_results_public_v1(uuid)
from public,anon,authenticated;
revoke execute on function public.community_get_my_dreamsnaps_v1(uuid,integer)
from public,anon,authenticated;
revoke execute on function public.community_get_gallery_dreamsnap_public_v1(uuid)
from public,anon,authenticated;
revoke execute on function public.community_search_gallery_dreamsnaps_public_v1(text,integer)
from public,anon,authenticated;
revoke execute on function public.community_get_public_media_storage_v2(uuid)
from public,anon,authenticated;
revoke execute on function public.community_moderate_entity_v5(uuid,uuid,bigint,uuid,text,text)
from public,anon,authenticated;

grant execute on function public.community_get_current_dreamsnap_challenge_public_v1()
to service_role;
grant execute on function public.community_get_dreamsnap_judge_v1(uuid,uuid,integer)
to service_role;
grant execute on function public.community_get_dreamsnap_judge_media_storage_v1(uuid,uuid)
to service_role;
grant execute on function public.community_list_dreamsnap_result_rounds_public_v1(integer)
to service_role;
grant execute on function public.community_get_dreamsnap_results_public_v1(uuid)
to service_role;
grant execute on function public.community_get_my_dreamsnaps_v1(uuid,integer)
to service_role;
grant execute on function public.community_get_gallery_dreamsnap_public_v1(uuid)
to service_role;
grant execute on function public.community_search_gallery_dreamsnaps_public_v1(text,integer)
to service_role;
grant execute on function public.community_get_public_media_storage_v2(uuid)
to service_role;
grant execute on function public.community_moderate_entity_v5(uuid,uuid,bigint,uuid,text,text)
to service_role;
