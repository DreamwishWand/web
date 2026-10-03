-- DreamSnaps command layer: private Work registration, explicit competition entry,
-- account-scoped judging rights, separate official results, and post-Results Gallery projection.

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
  v_challenge public.dreamsnap_challenges%rowtype;
  v_checks jsonb;
begin
  if not coalesce(p_game_screenshot_attested,false)
     or not coalesce(p_no_external_edits_attested,false) then
    raise exception 'DreamSnaps competitive screenshot attestations are required';
  end if;
  if p_caption is not null and char_length(p_caption)>2000 then
    raise exception 'DreamSnaps caption exceeds 2000 characters';
  end if;

  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id;
  if v_challenge.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;

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

  insert into public.gallery_work_revisions(
    revision_id,title,description,metadata
  ) values(
    v_revision_id,v_challenge.title,p_caption,
    jsonb_build_object(
      'dreamsnapChallengeId',p_challenge_id,
      'competitionImage',true
    )
  );

  insert into public.dreamsnap_work_revisions(
    revision_id,challenge_id,
    game_screenshot_attested,no_external_edits_attested,
    integrity_state,integrity_checks
  ) values(
    v_revision_id,p_challenge_id,true,true,'eligible',v_checks
  );

  insert into public.work_revision_media(
    work_revision_id,media_id,ordinal,role
  ) values(
    v_revision_id,p_media_id,0,'dreamsnap'
  );

  return v_revision_id;
end
$$;

revoke execute on function private.dreamsnap_create_revision(uuid,uuid,uuid,uuid,text,boolean,boolean)
from public,anon,authenticated,service_role;

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

  insert into public.gallery_works(work_id,gallery_kind)
  values(v_work_id,'dreamsnap');

  insert into public.gallery_work_settings(work_id,comments_enabled)
  values(v_work_id,false);

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

create or replace function public.community_dreamsnap_update_work_revision_v1(
  p_auth_subject uuid,
  p_work_id uuid,
  p_expected_version bigint,
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
  v_work public.community_works%rowtype;
  v_dw public.dreamsnap_works%rowtype;
  v_revision_id uuid;
  v_entry_revision_id uuid;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then raise exception 'Idempotency key required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(concat_ws('|',
    'dreamsnap_update_work_revision_v1',p_work_id::text,p_expected_version::text,
    p_media_id::text,coalesce(p_caption,''),
    p_game_screenshot_attested::text,p_no_external_edits_attested::text
  ),'sha256'),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;
  if v_work.work_id is null or v_work.work_type<>'dreamsnap' then raise exception 'DreamSnaps Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps Work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state='deleted' or v_work.moderation_state<>'clear' then
    raise exception 'DreamSnaps Work cannot be updated';
  end if;

  select * into v_dw from public.dreamsnap_works where work_id=p_work_id;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'dreamsnap_update_work_revision_v1',v_request_hash);

  v_revision_id:=private.dreamsnap_create_revision(
    v_account_id,p_work_id,v_dw.challenge_id,p_media_id,p_caption,
    p_game_screenshot_attested,p_no_external_edits_attested
  );

  update public.community_works
  set current_published_revision_id=v_revision_id,updated_at=now()
  where work_id=p_work_id
  returning * into v_work;

  select e.entry_revision_id into v_entry_revision_id
  from public.dreamsnap_entries e
  where e.work_id=p_work_id and e.entry_state='entered'
  limit 1;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.work_revision_updated',p_work_id,
    jsonb_build_object(
      'revisionId',v_revision_id,
      'competitionEntryRevisionId',v_entry_revision_id,
      'competitionEntryChanged',false
    )
  );

  v_response:=jsonb_build_object(
    'workId',p_work_id,'revisionId',v_revision_id,'rowVersion',v_work.row_version,
    'competitionEntryRevisionId',v_entry_revision_id,'competitionEntryChanged',false
  );
  update public.idempotency_keys
  set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_dreamsnap_join_event_v1(
  p_auth_subject uuid,
  p_work_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,extensions,public,private
as $$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_dw public.dreamsnap_works%rowtype;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_revision public.dreamsnap_work_revisions%rowtype;
  v_entry public.dreamsnap_entries%rowtype;
  v_origin text;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_idempotency_key)),0)=0 then raise exception 'Idempotency key required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash:=encode(digest(concat_ws('|','dreamsnap_join_event_v1',p_work_id::text),'sha256'),'hex');
  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  if v_existing_hash is not null then
    if v_existing_hash<>v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  select * into v_work from public.community_works where work_id=p_work_id for update;
  if v_work.work_id is null or v_work.work_type<>'dreamsnap' then raise exception 'DreamSnaps Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps Work'; end if;
  if v_work.moderation_state<>'clear' or v_work.lifecycle_state='deleted' then raise exception 'DreamSnaps Work is unavailable'; end if;

  select * into v_dw from public.dreamsnap_works where work_id=p_work_id;
  select * into v_challenge from public.dreamsnap_challenges where challenge_id=v_dw.challenge_id for share;
  if v_challenge.lifecycle_state<>'submission_open' then raise exception 'DreamSnaps competition entry is closed'; end if;

  select * into v_revision
  from public.dreamsnap_work_revisions
  where revision_id=v_work.current_published_revision_id
    and challenge_id=v_dw.challenge_id;
  if v_revision.revision_id is null or v_revision.integrity_state<>'eligible' then
    raise exception 'DreamSnaps Work revision is not competition-eligible';
  end if;

  if exists(
    select 1 from public.dreamsnap_entries
    where challenge_id=v_dw.challenge_id and account_id=v_account_id
  ) then
    raise exception 'Wand Account already used its DreamSnaps entry right for this challenge';
  end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values(v_account_id,p_idempotency_key,'dreamsnap_join_event_v1',v_request_hash);

  v_origin:=case
    when v_challenge.is_synthetic then 'synthetic'
    else private.community_origin_kind_for_account(v_account_id)
  end;

  insert into public.dreamsnap_entries(
    challenge_id,work_id,account_id,workspace_id,managed_under13,
    entry_revision_id,origin_kind
  ) values(
    v_dw.challenge_id,p_work_id,v_account_id,v_dw.source_workspace_id,v_dw.managed_under13,
    v_revision.revision_id,v_origin
  )
  returning * into v_entry;

  insert into public.dreamsnap_entry_revision_history(entry_id,revision_id)
  values(v_entry.entry_id,v_entry.entry_revision_id);

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.competition_joined',p_work_id,
    jsonb_build_object(
      'entryId',v_entry.entry_id,'challengeId',v_entry.challenge_id,
      'revisionId',v_entry.entry_revision_id,'managedUnder13',v_entry.managed_under13,
      'originKind',v_origin
    )
  );

  v_response:=jsonb_build_object(
    'entryId',v_entry.entry_id,'workId',p_work_id,'challengeId',v_entry.challenge_id,
    'revisionId',v_entry.entry_revision_id,'entryState',v_entry.entry_state,
    'eligibilityState',v_entry.eligibility_state,'frozenAt',v_entry.frozen_at
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end
$$;

create or replace function public.community_dreamsnap_replace_entry_revision_v1(
  p_auth_subject uuid,
  p_entry_id uuid,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_challenge public.dreamsnap_challenges%rowtype;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select * into v_entry
  from public.dreamsnap_entries
  where entry_id=p_entry_id
  for update;
  if v_entry.entry_id is null then raise exception 'DreamSnaps entry not found'; end if;
  if v_entry.account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps entry'; end if;
  if v_entry.entry_state<>'entered' then raise exception 'DreamSnaps entry is not active'; end if;

  select * into v_challenge from public.dreamsnap_challenges
  where challenge_id=v_entry.challenge_id for share;
  if v_challenge.lifecycle_state<>'submission_open' then
    raise exception 'DreamSnaps entry revision is frozen';
  end if;

  if v_entry.entry_revision_id=p_revision_id then
    return jsonb_build_object(
      'entryId',v_entry.entry_id,'revisionId',v_entry.entry_revision_id,
      'frozenAt',v_entry.frozen_at,'replayed',true
    );
  end if;

  if not exists(
    select 1
    from public.dreamsnap_work_revisions dr
    join public.community_work_revisions r on r.revision_id=dr.revision_id
    where dr.revision_id=p_revision_id
      and dr.challenge_id=v_entry.challenge_id
      and dr.integrity_state='eligible'
      and r.work_id=v_entry.work_id
  ) then
    raise exception 'Replacement revision is not eligible for this DreamSnaps entry';
  end if;

  update public.dreamsnap_entry_revision_history
  set unbound_at=now()
  where entry_id=v_entry.entry_id and unbound_at is null;

  update public.dreamsnap_entries
  set entry_revision_id=p_revision_id,frozen_at=now(),updated_at=now()
  where entry_id=v_entry.entry_id
  returning * into v_entry;

  insert into public.dreamsnap_entry_revision_history(entry_id,revision_id)
  values(v_entry.entry_id,p_revision_id);

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.entry_revision_replaced',v_entry.work_id,
    jsonb_build_object(
      'entryId',v_entry.entry_id,'revisionId',p_revision_id,'challengeId',v_entry.challenge_id
    )
  );

  return jsonb_build_object(
    'entryId',v_entry.entry_id,'revisionId',v_entry.entry_revision_id,
    'frozenAt',v_entry.frozen_at,'replayed',false
  );
end
$$;

create or replace function public.community_dreamsnap_cast_formal_vote_v1(
  p_auth_subject uuid,
  p_challenge_id uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_entry public.dreamsnap_entries%rowtype;
  v_used integer;
  v_origin text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(
    'dreamsnap-judge:' || p_challenge_id::text || ':' || v_account_id::text,0
  ));

  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id
  for share;
  if v_challenge.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;
  if v_challenge.lifecycle_state<>'judging_open' then raise exception 'DreamSnaps formal judging is not open'; end if;
  if not v_challenge.is_synthetic and not private.dreamsnap_real_entry_floor_met(p_challenge_id) then
    raise exception 'DREAMSNAP_REAL_ENTRY_FLOOR_NOT_MET';
  end if;

  select count(*)::integer into v_used
  from public.dreamsnap_formal_votes
  where challenge_id=p_challenge_id and voter_account_id=v_account_id;
  if v_used>=v_challenge.formal_vote_allowance then
    raise exception 'DreamSnaps formal judging allowance is exhausted';
  end if;

  select * into v_entry
  from public.dreamsnap_entries
  where entry_id=p_entry_id and challenge_id=p_challenge_id
  for share;
  if v_entry.entry_id is null
     or v_entry.entry_state<>'entered'
     or v_entry.eligibility_state<>'eligible' then
    raise exception 'DreamSnaps entry is not judge-eligible';
  end if;
  if v_entry.account_id=v_account_id then raise exception 'Self-judging is not allowed'; end if;
  if not exists(
    select 1 from public.community_works w
    join public.dreamsnap_work_revisions dr on dr.revision_id=v_entry.entry_revision_id
    where w.work_id=v_entry.work_id
      and w.moderation_state='clear'
      and dr.integrity_state='eligible'
  ) then
    raise exception 'DreamSnaps entry is not judge-eligible';
  end if;

  v_origin:=case
    when v_challenge.is_synthetic then 'synthetic'
    else private.community_origin_kind_for_account(v_account_id)
  end;

  insert into public.dreamsnap_formal_votes(
    challenge_id,voter_account_id,entry_id,entry_revision_id,voter_origin_kind
  ) values(
    p_challenge_id,v_account_id,p_entry_id,v_entry.entry_revision_id,v_origin
  );

  v_used:=v_used+1;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.formal_vote_cast',v_entry.work_id,
    jsonb_build_object(
      'challengeId',p_challenge_id,'entryId',p_entry_id,
      'entryRevisionId',v_entry.entry_revision_id,'voteOrdinal',v_used
    )
  );

  return jsonb_build_object(
    'challengeId',p_challenge_id,'votesUsed',v_used,
    'votesRemaining',greatest(v_challenge.formal_vote_allowance-v_used,0),
    'formalAllowanceExhausted',(v_used>=v_challenge.formal_vote_allowance)
  );
exception
  when unique_violation then
    raise exception 'DreamSnaps entry was already judged by this Wand Account';
end
$$;

create or replace function public.community_dreamsnap_add_browse_reaction_v1(
  p_auth_subject uuid,
  p_challenge_id uuid,
  p_entry_id uuid,
  p_reaction_kind text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_entry public.dreamsnap_entries%rowtype;
  v_used integer;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if coalesce(char_length(btrim(p_reaction_kind)),0) not between 1 and 64 then
    raise exception 'Reaction kind must be 1-64 characters';
  end if;

  select * into v_challenge from public.dreamsnap_challenges
  where challenge_id=p_challenge_id for share;
  if v_challenge.lifecycle_state<>'judging_open' or not v_challenge.allow_post_formal_browse then
    raise exception 'DreamSnaps post-formal browse is not available';
  end if;

  select count(*)::integer into v_used
  from public.dreamsnap_formal_votes
  where challenge_id=p_challenge_id and voter_account_id=v_account_id;
  if v_used<v_challenge.formal_vote_allowance then
    raise exception 'Formal judging allowance must be exhausted before browse reactions';
  end if;

  select * into v_entry from public.dreamsnap_entries
  where entry_id=p_entry_id and challenge_id=p_challenge_id;
  if v_entry.entry_id is null or v_entry.entry_state<>'entered' or v_entry.eligibility_state<>'eligible' then
    raise exception 'DreamSnaps entry is not browse-eligible';
  end if;
  if not exists(
    select 1 from public.community_works w
    where w.work_id=v_entry.work_id and w.moderation_state='clear'
  ) then raise exception 'DreamSnaps entry is not browse-eligible'; end if;

  insert into public.reactions(account_id,target_entity_id,reaction_kind)
  values(v_account_id,v_entry.work_id,btrim(p_reaction_kind))
  on conflict do nothing;

  return jsonb_build_object(
    'challengeId',p_challenge_id,'entryId',p_entry_id,'reactionKind',btrim(p_reaction_kind)
  );
end
$$;

create or replace function public.community_dreamsnap_special_pick_v1(
  p_auth_subject uuid,
  p_challenge_id uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_challenge public.dreamsnap_challenges%rowtype;
  v_entry public.dreamsnap_entries%rowtype;
  v_formal_used integer;
  v_special_used integer;
  v_origin text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(
    'dreamsnap-special:' || p_challenge_id::text || ':' || v_account_id::text,0
  ));

  select * into v_challenge from public.dreamsnap_challenges
  where challenge_id=p_challenge_id for share;
  if v_challenge.lifecycle_state<>'judging_open'
     or not v_challenge.allow_post_formal_browse
     or not v_challenge.allow_special_picks
     or v_challenge.special_pick_allowance<=0 then
    raise exception 'DreamSnaps Special Pick is not available';
  end if;

  select count(*)::integer into v_formal_used
  from public.dreamsnap_formal_votes
  where challenge_id=p_challenge_id and voter_account_id=v_account_id;
  if v_formal_used<v_challenge.formal_vote_allowance then
    raise exception 'Formal judging allowance must be exhausted before Special Pick';
  end if;

  select count(*)::integer into v_special_used
  from public.dreamsnap_special_picks
  where challenge_id=p_challenge_id and account_id=v_account_id;
  if v_special_used>=v_challenge.special_pick_allowance then
    raise exception 'DreamSnaps Special Pick allowance is exhausted';
  end if;

  select * into v_entry from public.dreamsnap_entries
  where entry_id=p_entry_id and challenge_id=p_challenge_id;
  if v_entry.entry_id is null or v_entry.entry_state<>'entered' or v_entry.eligibility_state<>'eligible' then
    raise exception 'DreamSnaps entry is not Special-Pick eligible';
  end if;
  if v_entry.account_id=v_account_id then raise exception 'Self Special Pick is not allowed'; end if;
  if not exists(
    select 1 from public.community_works w
    where w.work_id=v_entry.work_id and w.moderation_state='clear'
  ) then raise exception 'DreamSnaps entry is not Special-Pick eligible'; end if;

  v_origin:=case
    when v_challenge.is_synthetic then 'synthetic'
    else private.community_origin_kind_for_account(v_account_id)
  end;

  insert into public.dreamsnap_special_picks(
    challenge_id,account_id,entry_id,entry_revision_id,actor_origin_kind
  ) values(
    p_challenge_id,v_account_id,p_entry_id,v_entry.entry_revision_id,v_origin
  );

  v_special_used:=v_special_used+1;
  return jsonb_build_object(
    'challengeId',p_challenge_id,'specialPicksUsed',v_special_used,
    'specialPicksRemaining',greatest(v_challenge.special_pick_allowance-v_special_used,0)
  );
exception
  when unique_violation then
    raise exception 'DreamSnaps entry already has this Wand Account Special Pick';
end
$$;

create or replace function public.community_dreamsnap_finalize_results_v1(
  p_challenge_id uuid,
  p_expected_version bigint,
  p_effective_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_challenge public.dreamsnap_challenges%rowtype;
  v_count integer;
begin
  select * into v_challenge
  from public.dreamsnap_challenges
  where challenge_id=p_challenge_id
  for update;
  if v_challenge.challenge_id is null then raise exception 'DreamSnaps challenge not found'; end if;
  if v_challenge.lifecycle_state='results' then
    select count(*)::integer into v_count from public.dreamsnap_wand_results where challenge_id=p_challenge_id;
    return jsonb_build_object('challengeId',p_challenge_id,'state','results','resultCount',v_count,'replayed',true);
  end if;
  if v_challenge.lifecycle_state<>'judging_closed' then raise exception 'DreamSnaps results cannot be finalized from current state'; end if;
  if v_challenge.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_challenge.result_algorithm is null then raise exception 'DreamSnaps result algorithm is not configured'; end if;
  if v_challenge.result_algorithm<>'formal_vote_count_v1' then
    raise exception 'Unsupported DreamSnaps result algorithm';
  end if;

  delete from public.dreamsnap_wand_results where challenge_id=p_challenge_id;

  with scores as (
    select
      e.entry_id,e.challenge_id,e.entry_revision_id,
      count(v.entry_id)::numeric as score
    from public.dreamsnap_entries e
    join public.community_works w on w.work_id=e.work_id
    join public.dreamsnap_work_revisions dr on dr.revision_id=e.entry_revision_id
    left join public.dreamsnap_formal_votes v
      on v.challenge_id=e.challenge_id and v.entry_id=e.entry_id
    where e.challenge_id=p_challenge_id
      and e.entry_state='entered'
      and e.eligibility_state='eligible'
      and w.moderation_state='clear'
      and dr.integrity_state='eligible'
    group by e.entry_id,e.challenge_id,e.entry_revision_id
  ), ranked as (
    select *,
      rank() over(order by score desc,entry_id) as placement
    from scores
  )
  insert into public.dreamsnap_wand_results(
    entry_id,challenge_id,entry_revision_id,placement,formal_score,result_payload
  )
  select
    entry_id,challenge_id,entry_revision_id,placement::integer,score,
    jsonb_build_object('algorithm','formal_vote_count_v1')
  from ranked;

  select count(*)::integer into v_count
  from public.dreamsnap_wand_results where challenge_id=p_challenge_id;

  perform public.community_dreamsnap_transition_challenge_v1(
    p_challenge_id,p_expected_version,'results',p_effective_at
  );

  return jsonb_build_object(
    'challengeId',p_challenge_id,'state','results','resultCount',v_count,'replayed',false
  );
end
$$;

create or replace function public.community_dreamsnap_record_official_result_v1(
  p_auth_subject uuid,
  p_entry_id uuid,
  p_score numeric,
  p_rank integer,
  p_moonstones bigint,
  p_pixel_dust bigint,
  p_official_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_state text;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select e.*,c.lifecycle_state into v_entry,v_state
  from public.dreamsnap_entries e
  join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
  where e.entry_id=p_entry_id
  for update of e;
  if v_entry.entry_id is null then raise exception 'DreamSnaps entry not found'; end if;
  if v_entry.account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps entry'; end if;
  if v_state not in ('results','closed') then raise exception 'Official DreamSnaps result is not available before Results'; end if;
  if p_rank is not null and p_rank<=0 then raise exception 'Official rank must be positive'; end if;
  if p_moonstones is not null and p_moonstones<0 then raise exception 'Moonstones cannot be negative'; end if;
  if p_pixel_dust is not null and p_pixel_dust<0 then raise exception 'Pixel Dust cannot be negative'; end if;

  insert into public.dreamsnap_official_results(
    entry_id,account_id,score,rank,moonstones,pixel_dust,official_payload,updated_at
  ) values(
    p_entry_id,v_account_id,p_score,p_rank,p_moonstones,p_pixel_dust,
    coalesce(p_official_payload,'{}'::jsonb),now()
  )
  on conflict(entry_id) do update set
    score=excluded.score,rank=excluded.rank,moonstones=excluded.moonstones,
    pixel_dust=excluded.pixel_dust,official_payload=excluded.official_payload,updated_at=now();

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.official_result_recorded',v_entry.work_id,
    jsonb_build_object('entryId',p_entry_id,'challengeId',v_entry.challenge_id)
  );

  return jsonb_build_object('entryId',p_entry_id,'recorded',true);
end
$$;

create or replace function public.community_dreamsnap_set_official_result_publication_v1(
  p_auth_subject uuid,
  p_entry_id uuid,
  p_public_fields text[]
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_entry public.dreamsnap_entries%rowtype;
  v_state text;
  v_fields text[];
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  select e.*,c.lifecycle_state into v_entry,v_state
  from public.dreamsnap_entries e
  join public.dreamsnap_challenges c on c.challenge_id=e.challenge_id
  where e.entry_id=p_entry_id;
  if v_entry.entry_id is null then raise exception 'DreamSnaps entry not found'; end if;
  if v_entry.account_id<>v_account_id then raise exception 'Actor does not own DreamSnaps entry'; end if;
  if v_state not in ('results','closed') then raise exception 'Official DreamSnaps result cannot be published before Results'; end if;
  if not exists(select 1 from public.dreamsnap_official_results where entry_id=p_entry_id) then
    raise exception 'Official DreamSnaps result is not recorded';
  end if;

  select coalesce(array_agg(distinct x order by x),array[]::text[])
  into v_fields
  from unnest(coalesce(p_public_fields,array[]::text[])) x
  where x in ('score','rank','moonstones','pixel_dust');

  if cardinality(v_fields)<>cardinality(coalesce(p_public_fields,array[]::text[])) then
    raise exception 'Unsupported official DreamSnaps public field';
  end if;

  insert into public.dreamsnap_official_result_publication(
    entry_id,public_fields,published_at,updated_at
  ) values(
    p_entry_id,v_fields,case when cardinality(v_fields)>0 then now() else null end,now()
  )
  on conflict(entry_id) do update set
    public_fields=excluded.public_fields,
    published_at=case
      when cardinality(excluded.public_fields)>0
        then coalesce(dreamsnap_official_result_publication.published_at,now())
      else null
    end,
    updated_at=now();

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'dreamsnap.official_result_publication_changed',v_entry.work_id,
    jsonb_build_object('entryId',p_entry_id,'publicFields',to_jsonb(v_fields))
  );

  return jsonb_build_object('entryId',p_entry_id,'publicFields',to_jsonb(v_fields));
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

  insert into public.gallery_work_settings(work_id,comments_enabled,updated_at)
  values(v_entry.work_id,v_comments,now())
  on conflict(work_id) do update set
    comments_enabled=excluded.comments_enabled,updated_at=now();

  update public.community_works
  set lifecycle_state='published',
      visibility='public',
      published_at=now(),
      updated_at=now()
  where work_id=v_entry.work_id
  returning * into v_work;

  select description into v_caption
  from public.gallery_work_revisions
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

create or replace function public.community_add_comment_v3(
  p_auth_subject uuid,
  p_creator_profile_id uuid,
  p_target_entity_id uuid,
  p_parent_comment_id uuid,
  p_body text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_work_type public.work_type;
begin
  select work_type into v_work_type
  from public.community_works
  where work_id=p_target_entity_id;

  if v_work_type='dreamsnap' then
    if not exists(
      select 1
      from public.dreamsnap_gallery_publications gp
      join public.dreamsnap_entries e on e.entry_id=gp.entry_id
      join public.dreamsnap_challenges ch on ch.challenge_id=e.challenge_id
      join public.community_works w on w.work_id=gp.work_id
      where gp.work_id=p_target_entity_id
        and gp.publication_state='published'
        and gp.comments_enabled=true
        and e.managed_under13=false
        and ch.lifecycle_state in ('results','closed')
        and w.lifecycle_state='published'
        and w.visibility='public'
        and w.moderation_state='clear'
    ) then
      raise exception 'Comments are disabled for this Work';
    end if;
  end if;

  return public.community_add_comment_v2(
    p_auth_subject,p_creator_profile_id,p_target_entity_id,
    p_parent_comment_id,p_body,p_idempotency_key
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

  if v_type='dreamsnap' then
    select e.managed_under13 into v_managed
    from public.dreamsnap_gallery_publications gp
    join public.dreamsnap_entries e on e.entry_id=gp.entry_id
    where gp.work_id=p_work_id and gp.publication_state='published';
    if v_managed and p_enabled then
      raise exception 'Comments are disabled for this Work';
    end if;
    update public.dreamsnap_gallery_publications
    set comments_enabled=case when v_managed then false else p_enabled end,updated_at=now()
    where work_id=p_work_id;
    p_enabled:=case when v_managed then false else p_enabled end;
  end if;

  insert into public.gallery_work_settings(work_id,comments_enabled,updated_at)
  values(p_work_id,p_enabled,now())
  on conflict(work_id) do update
  set comments_enabled=excluded.comments_enabled,updated_at=now();

  update public.search_documents
  set facets=facets || jsonb_build_object('commentsEnabled',p_enabled),updated_at=now()
  where work_id=p_work_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(v_account_id,'gallery.comments_enabled',p_work_id,jsonb_build_object('enabled',p_enabled));

  return jsonb_build_object('workId',p_work_id,'commentsEnabled',p_enabled);
end
$$;

create or replace function public.community_gallery_author_remove_comment_v2(
  p_auth_subject uuid,
  p_work_id uuid,
  p_comment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_changed boolean:=false;
begin
  v_account_id:=private.resolve_active_account(p_auth_subject);
  if not exists(
    select 1 from public.community_works
    where work_id=p_work_id
      and work_type in ('gallery','dreamsnap')
      and owner_account_id=v_account_id
  ) then raise exception 'Actor does not own Gallery-compatible Work'; end if;
  if coalesce(char_length(btrim(p_reason)),0) not between 3 and 500 then
    raise exception 'Removal reason must be 3-500 characters';
  end if;

  update public.comments
  set lifecycle_state='deleted',updated_at=now()
  where comment_id=p_comment_id
    and target_entity_id=p_work_id
    and lifecycle_state<>'deleted'
  returning true into v_changed;

  if not coalesce(v_changed,false) then raise exception 'Comment not found or already removed'; end if;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'gallery.comment_author_removed',p_comment_id,
    jsonb_build_object('workId',p_work_id,'reason',btrim(p_reason))
  );

  return jsonb_build_object('commentId',p_comment_id,'removed',true);
end
$$;

revoke execute on function public.community_register_dreamsnap_work_v1(uuid,uuid,uuid,uuid,uuid,text,boolean,boolean,text)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_update_work_revision_v1(uuid,uuid,bigint,uuid,text,boolean,boolean,text)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_join_event_v1(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_replace_entry_revision_v1(uuid,uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_cast_formal_vote_v1(uuid,uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_add_browse_reaction_v1(uuid,uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_special_pick_v1(uuid,uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_finalize_results_v1(uuid,bigint,timestamptz)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_record_official_result_v1(uuid,uuid,numeric,integer,bigint,bigint,jsonb)
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])
from public,anon,authenticated;
revoke execute on function public.community_dreamsnap_publish_gallery_v1(uuid,uuid,boolean)
from public,anon,authenticated;
revoke execute on function public.community_add_comment_v3(uuid,uuid,uuid,uuid,text,text)
from public,anon,authenticated;
revoke execute on function public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)
from public,anon,authenticated;
revoke execute on function public.community_gallery_author_remove_comment_v2(uuid,uuid,uuid,text)
from public,anon,authenticated;

grant execute on function public.community_register_dreamsnap_work_v1(uuid,uuid,uuid,uuid,uuid,text,boolean,boolean,text)
to service_role;
grant execute on function public.community_dreamsnap_update_work_revision_v1(uuid,uuid,bigint,uuid,text,boolean,boolean,text)
to service_role;
grant execute on function public.community_dreamsnap_join_event_v1(uuid,uuid,text)
to service_role;
grant execute on function public.community_dreamsnap_replace_entry_revision_v1(uuid,uuid,uuid)
to service_role;
grant execute on function public.community_dreamsnap_cast_formal_vote_v1(uuid,uuid,uuid)
to service_role;
grant execute on function public.community_dreamsnap_add_browse_reaction_v1(uuid,uuid,uuid,text)
to service_role;
grant execute on function public.community_dreamsnap_special_pick_v1(uuid,uuid,uuid)
to service_role;
grant execute on function public.community_dreamsnap_finalize_results_v1(uuid,bigint,timestamptz)
to service_role;
grant execute on function public.community_dreamsnap_record_official_result_v1(uuid,uuid,numeric,integer,bigint,bigint,jsonb)
to service_role;
grant execute on function public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])
to service_role;
grant execute on function public.community_dreamsnap_publish_gallery_v1(uuid,uuid,boolean)
to service_role;
grant execute on function public.community_add_comment_v3(uuid,uuid,uuid,uuid,text,text)
to service_role;
grant execute on function public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)
to service_role;
grant execute on function public.community_gallery_author_remove_comment_v2(uuid,uuid,uuid,text)
to service_role;
