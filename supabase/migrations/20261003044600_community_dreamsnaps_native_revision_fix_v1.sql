-- Correct DreamSnaps to remain a first-class CommunityWork domain instead of
-- masquerading as GalleryWork. Existing Gallery invariants stay untouched.

alter table public.dreamsnap_work_revisions
  add column if not exists caption text;

alter table public.dreamsnap_work_revisions
  drop constraint if exists dreamsnap_work_revisions_caption_check;
alter table public.dreamsnap_work_revisions
  add constraint dreamsnap_work_revisions_caption_check
  check (caption is null or char_length(caption)<=2000);

create or replace function private.dreamsnap_create_revision(
  p_account_id uuid,
  p_work_id uuid,
  p_challenge_id uuid,
  p_media_id uuid,
  p_caption text,
  p_game_screenshot_attested boolean,
  p_no_external_edits_attested boolean
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_revision_id uuid:=gen_random_uuid();
  v_revision_number integer;
  v_checks jsonb;
begin
  if not coalesce(p_game_screenshot_attested,false)
     or not coalesce(p_no_external_edits_attested,false) then
    raise exception 'DreamSnaps competitive screenshot attestations are required';
  end if;
  if p_caption is not null and char_length(p_caption)>2000 then
    raise exception 'DreamSnaps caption exceeds 2000 characters';
  end if;
  if not exists(
    select 1 from public.dreamsnap_challenges where challenge_id=p_challenge_id
  ) then raise exception 'DreamSnaps challenge not found'; end if;

  v_checks:=private.dreamsnap_validate_media(p_account_id,p_media_id,p_challenge_id);

  select coalesce(max(revision_number),0)+1
  into v_revision_number
  from public.community_work_revisions
  where work_id=p_work_id;

  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_revision_id,p_work_id,v_revision_number,p_account_id,
    jsonb_build_object(
      'dreamsnapChallengeId',p_challenge_id,
      'competitionImage',true
    )
  );

  insert into public.dreamsnap_work_revisions(
    revision_id,challenge_id,caption,
    game_screenshot_attested,no_external_edits_attested,
    integrity_state,integrity_checks
  ) values(
    v_revision_id,p_challenge_id,p_caption,
    true,true,'eligible',v_checks
  );

  insert into public.work_revision_media(
    work_revision_id,media_id,ordinal,role
  ) values(
    v_revision_id,p_media_id,0,'dreamsnap'
  );

  return v_revision_id;
end
$$;

create or replace function public.community_register_dreamsnap_work_v1(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_challenge_id uuid,
  p_workspace_id uuid,
  p_media_id uuid,
  p_caption text,
  p_game_screenshot_attested boolean,
  p_no_external_edits_attested boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_workspace public.ddv_profile_workspaces%rowtype;
  v_relationship text:='self';
  v_managed boolean:=false;
  v_work_id uuid;
  v_revision_id uuid;
  v_origin text;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
  v_work public.community_works%rowtype;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then
    raise exception 'Idempotency key required';
  end if;

  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id
  for share;
  if v_challenge.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;
  if v_challenge.lifecycle_state<>'submission_open' then
    raise exception 'DreamSnaps submission is not open';
  end if;

  if not exists(
    select 1 from public.creator_profiles c
    where c.creator_profile_id=p_creator_profile_id
      and c.owner_account_id=v_account_id
      and c.moderation_state='clear'
  ) then
    raise exception 'CreatorProfile is not owned by actor or is unavailable';
  end if;

  if p_workspace_id is not null then
    select * into v_workspace
    from public.ddv_profile_workspaces
    where workspace_id=p_workspace_id
      and account_id=v_account_id
      and lifecycle_state='active';
    if v_workspace.workspace_id is null then
      raise exception 'DDV Profile Workspace not found or not active';
    end if;
    v_relationship:=v_workspace.relationship_kind;
    v_managed:=v_relationship='parent_guardian_managed';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_account_id::text || ':' || p_idempotency_key,0)
  );
  v_request_hash:=encode(digest(
    concat_ws('|',
      'register_dreamsnap_work_v1',p_creator_profile_id::text,p_challenge_id::text,
      coalesce(p_workspace_id::text,''),p_media_id::text,coalesce(p_caption,''),
      p_game_screenshot_attested::text,p_no_external_edits_attested::text
    ),'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then
      raise exception 'Idempotency key reused with a different request';
    end if;
    return v_response;
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'register_dreamsnap_work_v1',v_request_hash);

  v_work_id:=gen_random_uuid();
  insert into public.community_entities(entity_id,entity_type)
  values(v_work_id,'community_work');

  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility
  ) values(
    v_work_id,v_account_id,p_creator_profile_id,'dreamsnap','draft','private'
  );

  insert into public.dreamsnap_works(
    work_id,challenge_id,source_workspace_id,workspace_relationship_kind,managed_under13
  ) values(
    v_work_id,p_challenge_id,p_workspace_id,v_relationship,v_managed
  );

  v_revision_id:=private.dreamsnap_create_revision(
    v_account_id,v_work_id,p_challenge_id,p_media_id,p_caption,
    p_game_screenshot_attested,p_no_external_edits_attested
  );

  update public.community_works
  set lifecycle_state='published',
      visibility='private',
      current_published_revision_id=v_revision_id,
      published_at=now(),
      updated_at=now()
  where work_id=v_work_id
  returning * into v_work;

  v_origin:=case
    when v_challenge.is_synthetic then 'synthetic'
    else private.community_origin_kind_for_account(v_account_id)
  end;

  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_work_id,v_origin);

  insert into public.outbox_events(
    aggregate_type,aggregate_id,event_type,payload,dedupe_key
  ) values(
    'community_work',v_work_id,'dreamsnap.work_registered',
    jsonb_build_object(
      'workId',v_work_id,'challengeId',p_challenge_id,'revisionId',v_revision_id,
      'managedUnder13',v_managed,'originKind',v_origin
    ),
    'dreamsnap.work_registered:' || v_work_id::text
  );

  v_response:=jsonb_build_object(
    'workId',v_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version,
    'challengeId',p_challenge_id,'competitionEntered',false,'managedUnder13',v_managed
  );

  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  return v_response;
end
$$;

create or replace function public.community_dreamsnap_publish_gallery_v1(
  p_auth_subject uuid,
  p_entry_id uuid,
  p_comments_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_work public.community_works%rowtype;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_comments boolean;
  v_caption text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);

  select * into v_entry
  from public.dreamsnap_entries
  where entry_id=p_entry_id
  for update;
  if v_entry.entry_id is null then raise exception 'DreamSnaps entry not found'; end if;
  if v_entry.account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps entry'; end if;
  if v_entry.entry_state<>'entered' or v_entry.eligibility_state<>'eligible' then
    raise exception 'DreamSnaps entry is not eligible for Gallery publication';
  end if;

  select * into v_challenge from public.dreamsnap_challenges
  where challenge_id=v_entry.challenge_id for share;
  if v_challenge.lifecycle_state not in ('results','closed') then
    raise exception 'DreamSnaps Gallery publication is available only after Results';
  end if;

  select * into v_work from public.community_works
  where work_id=v_entry.work_id for update;
  if v_work.moderation_state<>'clear' or v_work.lifecycle_state='deleted' then
    raise exception 'DreamSnaps Work is moderation-blocked';
  end if;

  v_comments:=case when v_entry.managed_under13 then false else coalesce(p_comments_enabled,true) end;

  insert into public.dreamsnap_gallery_publications(
    work_id,entry_id,revision_id,publication_state,comments_enabled,published_at,updated_at
  ) values(
    v_entry.work_id,v_entry.entry_id,v_entry.entry_revision_id,'published',v_comments,now(),now()
  )
  on conflict(work_id) do update set
    entry_id=excluded.entry_id,
    revision_id=excluded.revision_id,
    publication_state='published',
    comments_enabled=excluded.comments_enabled,
    published_at=now(),
    updated_at=now();

  update public.community_works
  set lifecycle_state='published',
      visibility='public',
      published_at=now(),
      updated_at=now()
  where work_id=v_entry.work_id
  returning * into v_work;

  select caption into v_caption
  from public.dreamsnap_work_revisions
  where revision_id=v_entry.entry_revision_id;

  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at
  ) values(
    v_entry.work_id,v_entry.work_id,'dreamsnap',v_work.creator_profile_id,
    v_challenge.title,coalesce(v_caption,''),array[]::text[],
    jsonb_build_object(
      'challengeId',v_entry.challenge_id,
      'commentsEnabled',v_comments,
      'competitionArchive',true
    ),
    v_work.published_at,now()
  )
  on conflict(entity_id) do update set
    creator_profile_id=excluded.creator_profile_id,
    title=excluded.title,text_content=excluded.text_content,
    tags=excluded.tags,facets=excluded.facets,
    published_at=excluded.published_at,updated_at=now();

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.gallery_published',v_entry.work_id,
    jsonb_build_object(
      'entryId',v_entry.entry_id,'revisionId',v_entry.entry_revision_id,
      'commentsEnabled',v_comments
    )
  );

  return jsonb_build_object(
    'workId',v_entry.work_id,'entryId',v_entry.entry_id,
    'revisionId',v_entry.entry_revision_id,'visibility','public',
    'commentsEnabled',v_comments
  );
end
$$;

create or replace function public.community_set_gallery_comments_enabled_v2(
  p_auth_subject uuid,
  p_work_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_type public.work_type;
  v_managed boolean:=false;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select work_type into v_type
  from public.community_works
  where work_id=p_work_id and owner_account_id=v_account_id;
  if v_type is null or v_type not in ('gallery','dreamsnap') then
    raise exception 'Actor does not own a Gallery-compatible Work';
  end if;

  if v_type='gallery' then
    return public.community_set_gallery_comments_enabled_v1(
      p_auth_subject,p_work_id,p_enabled
    );
  end if;

  select e.managed_under13 into v_managed
  from public.dreamsnap_gallery_publications gp
  join public.dreamsnap_entries e on e.entry_id=gp.entry_id
  where gp.work_id=p_work_id and gp.publication_state='published';

  if v_managed and p_enabled then
    raise exception 'Comments are disabled for this Work';
  end if;

  p_enabled:=case when v_managed then false else p_enabled end;

  update public.dreamsnap_gallery_publications
  set comments_enabled=p_enabled,updated_at=now()
  where work_id=p_work_id and publication_state='published';

  if not found then raise exception 'DreamSnaps Gallery publication not found'; end if;

  update public.search_documents
  set facets=facets || jsonb_build_object('commentsEnabled',p_enabled),updated_at=now()
  where work_id=p_work_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(v_account_id,'gallery.comments_enabled',p_work_id,jsonb_build_object('enabled',p_enabled));

  return jsonb_build_object('workId',p_work_id,'commentsEnabled',p_enabled);
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
      w.work_id,w.work_id,'dreamsnap',w.creator_profile_id,c.title,coalesce(dr.caption,''),
      array[]::text[],
      jsonb_build_object(
        'challengeId',c.challenge_id,'commentsEnabled',gp.comments_enabled,'competitionArchive',true
      ),
      gp.published_at,now()
    from public.community_works w
    join public.dreamsnap_gallery_publications gp on gp.work_id=w.work_id
    join public.dreamsnap_entries e on e.entry_id=gp.entry_id
    join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
    join public.dreamsnap_work_revisions dr on dr.revision_id=gp.revision_id
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

revoke execute on function private.dreamsnap_create_revision(uuid,uuid,uuid,uuid,text,boolean,boolean)
from public,anon,authenticated,service_role;
revoke execute on function private.dreamsnap_apply_work_moderation_effect_v1(uuid,text)
from public,anon,authenticated,service_role;

revoke execute on function public.community_register_dreamsnap_work_v1(uuid,uuid,uuid,uuid,uuid,text,boolean,boolean,text)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_publish_gallery_v1(uuid,uuid,boolean)
from public,anon,authenticated;
revoke execute on function public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)
from public,anon,authenticated;
revoke execute on function public.community_get_gallery_dreamsnap_public_v1(uuid)
from public,anon,authenticated;

grant execute on function public.community_register_dreamsnap_work_v1(uuid,uuid,uuid,uuid,uuid,text,boolean,boolean,text)
to service_role;
grant execute on function public.community_dreamsnap_publish_gallery_v1(uuid,uuid,boolean)
to service_role;
grant execute on function public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)
to service_role;
grant execute on function public.community_get_gallery_dreamsnap_public_v1(uuid)
to service_role;
