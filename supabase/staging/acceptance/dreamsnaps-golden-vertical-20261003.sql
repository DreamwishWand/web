-- DreamSnaps Golden Vertical rollback acceptance.
-- Uses existing staging identities/Creator Profiles, creates only transaction-local content,
-- and ROLLBACKs every fixture. Requires three non-staff submitter accounts plus one distinct judge.

begin;

do $$
declare
  v_subjects uuid[];
  v_accounts uuid[];
  v_creators uuid[];
  v_judge_subject uuid;
  v_judge_account uuid;
  v_judge_creator uuid;
  v_challenge uuid;
  v_workspace_b uuid;
  v_media_a uuid:=gen_random_uuid();
  v_media_b uuid:=gen_random_uuid();
  v_media_c uuid:=gen_random_uuid();
  v_media_bad uuid:=gen_random_uuid();
  v_work_a uuid;
  v_work_b uuid;
  v_work_c uuid;
  v_work_a2 uuid;
  v_rev_a1 uuid;
  v_rev_a2 uuid;
  v_rev_b uuid;
  v_rev_c uuid;
  v_entry_a uuid;
  v_entry_b uuid;
  v_entry_c uuid;
  v_row_a bigint;
  v_cv bigint;
  v_json jsonb;
  v_public jsonb;
  v_gallery jsonb;
  v_dup_blocked boolean:=false;
  v_frozen_blocked boolean:=false;
  v_early_gallery_blocked boolean:=false;
  v_early_browse_blocked boolean:=false;
  v_self_vote_blocked boolean:=false;
  v_vote_cap_blocked boolean:=false;
  v_special_cap_blocked boolean:=false;
  v_minor_comment_blocked boolean:=false;
  v_invalid_media_blocked boolean:=false;
  v_integrity_blocked boolean:=false;
  v_changed integer;
begin
  select
    array_agg(q.subject order by q.rn),
    array_agg(q.account_id order by q.rn),
    array_agg(q.creator_profile_id order by q.rn)
  into v_subjects,v_accounts,v_creators
  from (
    select row_number() over(order by wa.account_id)::int rn,
           ai.provider_subject::uuid subject,
           wa.account_id,
           cp.creator_profile_id
    from public.wand_accounts wa
    join public.auth_identities ai
      on ai.account_id=wa.account_id
     and ai.provider='supabase'
     and ai.identity_state='active'
    join public.creator_profiles cp
      on cp.owner_account_id=wa.account_id
     and cp.profile_visibility='public'
     and cp.moderation_state='clear'
    where wa.status='active'
      and not exists (
        select 1 from public.account_roles ar
        where ar.account_id=wa.account_id
      )
      and (
        select count(*) from public.ddv_profile_workspaces dw
        where dw.account_id=wa.account_id
      ) < 5
    order by wa.account_id
    limit 3
  ) q;

  if coalesce(cardinality(v_accounts),0) < 3 then
    raise exception 'ACCEPTANCE_NEEDS_THREE_NONSTAFF_SUBMITTERS';
  end if;

  select ai.provider_subject::uuid,wa.account_id,cp.creator_profile_id
  into v_judge_subject,v_judge_account,v_judge_creator
  from public.wand_accounts wa
  join public.auth_identities ai
    on ai.account_id=wa.account_id
   and ai.provider='supabase'
   and ai.identity_state='active'
  join public.creator_profiles cp
    on cp.owner_account_id=wa.account_id
   and cp.profile_visibility='public'
   and cp.moderation_state='clear'
  where wa.status='active'
    and not (wa.account_id=any(v_accounts))
  order by wa.account_id
  limit 1;

  if v_judge_account is null then
    raise exception 'ACCEPTANCE_NEEDS_DISTINCT_JUDGE_ACCOUNT';
  end if;

  v_subjects:=v_subjects||v_judge_subject;
  v_accounts:=v_accounts||v_judge_account;
  v_creators:=v_creators||v_judge_creator;

  insert into public.community_entities(entity_id,entity_type)
  values
    (v_media_a,'media_asset'),
    (v_media_b,'media_asset'),
    (v_media_c,'media_asset'),
    (v_media_bad,'media_asset');

  insert into public.media_assets(
    media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
    checksum_sha256,processing_state,moderation_state
  ) values
    (v_media_a,v_accounts[1],'acceptance/'||v_media_a::text||'.png','image/png',1000,1920,1080,repeat('a',64),'ready','clear'),
    (v_media_b,v_accounts[2],'acceptance/'||v_media_b::text||'.png','image/png',1000,1920,1080,repeat('b',64),'ready','clear'),
    (v_media_c,v_accounts[3],'acceptance/'||v_media_c::text||'.png','image/png',1000,1920,1080,repeat('c',64),'ready','clear'),
    (v_media_bad,v_accounts[1],'acceptance/'||v_media_bad::text||'.png','image/png',1000,1600,1000,repeat('d',64),'ready','clear');

  insert into public.dreamsnap_challenges(
    challenge_key,title,description,lifecycle_state,
    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,
    results_at,closes_at,
    formal_vote_allowance,special_pick_allowance,
    minimum_real_eligible_entries,minimum_real_eligible_creators,
    allow_post_formal_browse,allow_special_picks,result_algorithm,
    required_aspect_numerator,required_aspect_denominator,minimum_width,minimum_height,
    is_synthetic
  ) values(
    'acceptance-'||replace(gen_random_uuid()::text,'-',''),
    'DreamSnaps Golden Vertical Acceptance',
    'Rollback-only acceptance round',
    'submission_open',
    now()-interval '7 hours',
    now()-interval '6 hours',
    now()-interval '5 hours',
    now()-interval '4 hours',
    now()-interval '3 hours',
    now()+interval '1 hour',
    2,1,3,3,true,true,'formal_vote_count_v1',
    16,9,1280,720,false
  )
  returning challenge_id into v_challenge;

  v_json:=public.community_create_ddv_profile_workspace_v1(
    v_subjects[2],'parent_guardian_managed'
  );
  v_workspace_b:=(v_json->>'workspaceId')::uuid;

  begin
    perform public.community_register_dreamsnap_work_v1(
      v_subjects[1],v_creators[1],v_challenge,null,v_media_bad,
      'Invalid aspect',true,true,'accept-register-invalid-'||gen_random_uuid()::text
    );
  exception when others then
    if position('aspect ratio does not match round policy' in sqlerrm)>0 then
      v_invalid_media_blocked:=true;
    else
      raise;
    end if;
  end;
  if not v_invalid_media_blocked then
    raise exception 'ACCEPTANCE_INVALID_MEDIA_NOT_BLOCKED';
  end if;

  v_json:=public.community_register_dreamsnap_work_v1(
    v_subjects[1],v_creators[1],v_challenge,null,v_media_a,
    'Entry A',true,true,'accept-register-a-'||gen_random_uuid()::text
  );
  v_work_a:=(v_json->>'workId')::uuid;
  v_rev_a1:=(v_json->>'revisionId')::uuid;
  v_row_a:=(v_json->>'rowVersion')::bigint;

  v_json:=public.community_dreamsnap_join_event_v1(
    v_subjects[1],v_work_a,'accept-join-a-'||gen_random_uuid()::text
  );
  v_entry_a:=(v_json->>'entryId')::uuid;

  v_json:=public.community_register_dreamsnap_work_v1(
    v_subjects[2],v_creators[2],v_challenge,v_workspace_b,v_media_b,
    'Entry B managed',true,true,'accept-register-b-'||gen_random_uuid()::text
  );
  v_work_b:=(v_json->>'workId')::uuid;
  v_rev_b:=(v_json->>'revisionId')::uuid;
  v_json:=public.community_dreamsnap_join_event_v1(
    v_subjects[2],v_work_b,'accept-join-b-'||gen_random_uuid()::text
  );
  v_entry_b:=(v_json->>'entryId')::uuid;

  if not exists(
    select 1 from public.dreamsnap_entries
    where entry_id=v_entry_b and managed_under13=true
  ) then
    raise exception 'ACCEPTANCE_MANAGED_UNDER13_NOT_DERIVED';
  end if;

  if private.dreamsnap_real_entry_floor_met(v_challenge) then
    raise exception 'ACCEPTANCE_REAL_POOL_FLOOR_MET_TOO_EARLY';
  end if;

  v_json:=public.community_register_dreamsnap_work_v1(
    v_subjects[3],v_creators[3],v_challenge,null,v_media_c,
    'Entry C',true,true,'accept-register-c-'||gen_random_uuid()::text
  );
  v_work_c:=(v_json->>'workId')::uuid;
  v_rev_c:=(v_json->>'revisionId')::uuid;

  perform public.community_dreamsnap_apply_integrity_assessment_v1(
    v_rev_c,'under_review',array['acceptance_suspicious']::text[],
    'Rollback acceptance suspicious-content gate'
  );

  begin
    perform public.community_dreamsnap_join_event_v1(
      v_subjects[3],v_work_c,'accept-join-c-blocked-'||gen_random_uuid()::text
    );
  exception when others then
    if position('not competition-eligible' in sqlerrm)>0 then
      v_integrity_blocked:=true;
    else
      raise;
    end if;
  end;
  if not v_integrity_blocked then
    raise exception 'ACCEPTANCE_INTEGRITY_REVIEW_DID_NOT_BLOCK_ENTRY';
  end if;

  perform public.community_dreamsnap_apply_integrity_assessment_v1(
    v_rev_c,'eligible',array[]::text[],
    'Rollback acceptance cleared'
  );

  v_json:=public.community_dreamsnap_join_event_v1(
    v_subjects[3],v_work_c,'accept-join-c-'||gen_random_uuid()::text
  );
  v_entry_c:=(v_json->>'entryId')::uuid;

  if not private.dreamsnap_real_entry_floor_met(v_challenge) then
    raise exception 'ACCEPTANCE_REAL_POOL_ENTRY_CREATOR_FLOOR_NOT_MET';
  end if;

  v_json:=public.community_register_dreamsnap_work_v1(
    v_subjects[1],v_creators[1],v_challenge,null,v_media_a,
    'Second Work A',true,true,'accept-register-a2-'||gen_random_uuid()::text
  );
  v_work_a2:=(v_json->>'workId')::uuid;
  begin
    perform public.community_dreamsnap_join_event_v1(
      v_subjects[1],v_work_a2,'accept-join-a2-'||gen_random_uuid()::text
    );
  exception when others then
    if position('already used its DreamSnaps entry right' in sqlerrm)>0 then
      v_dup_blocked:=true;
    else
      raise;
    end if;
  end;
  if not v_dup_blocked then raise exception 'ACCEPTANCE_SECOND_ENTRY_NOT_BLOCKED'; end if;

  v_json:=public.community_dreamsnap_update_work_revision_v1(
    v_subjects[1],v_work_a,v_row_a,v_media_a,'Entry A edited',true,true,
    'accept-update-a-'||gen_random_uuid()::text
  );
  v_rev_a2:=(v_json->>'revisionId')::uuid;

  if (select entry_revision_id from public.dreamsnap_entries where entry_id=v_entry_a)<>v_rev_a1 then
    raise exception 'ACCEPTANCE_ENTRY_REVISION_CHANGED_WITH_WORK_EDIT';
  end if;
  if (select current_published_revision_id from public.community_works where work_id=v_work_a)<>v_rev_a2 then
    raise exception 'ACCEPTANCE_WORK_REVISION_DID_NOT_ADVANCE';
  end if;

  begin
    perform public.community_dreamsnap_publish_gallery_v1(v_subjects[1],v_entry_a,true);
  exception when others then
    if position('only after Results' in sqlerrm)>0 then v_early_gallery_blocked:=true; else raise; end if;
  end;
  if not v_early_gallery_blocked then raise exception 'ACCEPTANCE_EARLY_GALLERY_NOT_BLOCKED'; end if;

  select row_version into v_cv from public.dreamsnap_challenges where challenge_id=v_challenge;
  perform public.community_dreamsnap_transition_challenge_v1(v_challenge,v_cv,'submission_closed',clock_timestamp());
  select row_version into v_cv from public.dreamsnap_challenges where challenge_id=v_challenge;
  perform public.community_dreamsnap_transition_challenge_v1(v_challenge,v_cv,'judging_open',clock_timestamp());

  begin
    perform public.community_dreamsnap_replace_entry_revision_v1(v_subjects[1],v_entry_a,v_rev_a2);
  exception when others then
    if position('revision is frozen' in sqlerrm)>0 then v_frozen_blocked:=true; else raise; end if;
  end;
  if not v_frozen_blocked then raise exception 'ACCEPTANCE_ENTRY_REVISION_NOT_FROZEN'; end if;

  v_json:=public.community_get_dreamsnap_judge_v1(v_subjects[4],v_challenge,12);
  if v_json->>'mode'<>'formal' then raise exception 'ACCEPTANCE_JUDGE_NOT_FORMAL'; end if;
  if jsonb_array_length(v_json->'candidates')<>3 then raise exception 'ACCEPTANCE_JUDGE_POOL_WRONG_SIZE'; end if;
  if lower(v_json::text) ~ '(creator|owner|officialresult|accountid)' then
    raise exception 'ACCEPTANCE_BLIND_JUDGE_LEAK';
  end if;

  begin
    perform public.community_dreamsnap_add_browse_reaction_v1(
      v_subjects[4],v_challenge,v_entry_c,'like'
    );
  exception when others then
    if position('must be exhausted' in sqlerrm)>0 then v_early_browse_blocked:=true; else raise; end if;
  end;
  if not v_early_browse_blocked then raise exception 'ACCEPTANCE_EARLY_BROWSE_NOT_BLOCKED'; end if;

  begin
    perform public.community_dreamsnap_cast_formal_vote_v1(v_subjects[1],v_challenge,v_entry_a);
  exception when others then
    if position('Self-judging' in sqlerrm)>0 then v_self_vote_blocked:=true; else raise; end if;
  end;
  if not v_self_vote_blocked then raise exception 'ACCEPTANCE_SELF_VOTE_NOT_BLOCKED'; end if;

  perform public.community_dreamsnap_cast_formal_vote_v1(v_subjects[4],v_challenge,v_entry_a);
  perform public.community_dreamsnap_cast_formal_vote_v1(v_subjects[4],v_challenge,v_entry_b);

  begin
    perform public.community_dreamsnap_cast_formal_vote_v1(v_subjects[4],v_challenge,v_entry_c);
  exception when others then
    if position('allowance is exhausted' in sqlerrm)>0 then v_vote_cap_blocked:=true; else raise; end if;
  end;
  if not v_vote_cap_blocked then raise exception 'ACCEPTANCE_FORMAL_VOTE_CAP_NOT_ENFORCED'; end if;

  v_json:=public.community_get_dreamsnap_judge_v1(v_subjects[4],v_challenge,12);
  if v_json->>'mode'<>'browse' or (v_json->>'formalAllowanceExhausted')::boolean<>true then
    raise exception 'ACCEPTANCE_POST_FORMAL_MODE_NOT_REACHED';
  end if;

  perform public.community_dreamsnap_add_browse_reaction_v1(
    v_subjects[4],v_challenge,v_entry_c,'like'
  );
  perform public.community_dreamsnap_special_pick_v1(
    v_subjects[4],v_challenge,v_entry_c
  );

  begin
    perform public.community_dreamsnap_special_pick_v1(
      v_subjects[4],v_challenge,v_entry_a
    );
  exception when others then
    if position('allowance is exhausted' in sqlerrm)>0 then v_special_cap_blocked:=true; else raise; end if;
  end;
  if not v_special_cap_blocked then raise exception 'ACCEPTANCE_SPECIAL_PICK_CAP_NOT_ENFORCED'; end if;

  select row_version into v_cv from public.dreamsnap_challenges where challenge_id=v_challenge;
  perform public.community_dreamsnap_transition_challenge_v1(v_challenge,v_cv,'judging_closed',clock_timestamp());
  select row_version into v_cv from public.dreamsnap_challenges where challenge_id=v_challenge;
  v_json:=public.community_dreamsnap_finalize_results_v1(v_challenge,v_cv,clock_timestamp());
  if (v_json->>'resultCount')::int<>3 then raise exception 'ACCEPTANCE_RESULTS_COUNT_WRONG'; end if;

  perform public.community_dreamsnap_record_official_result_v1(
    v_subjects[1],v_entry_a,1234.5,7,4000,250,
    jsonb_build_object('source','acceptance')
  );

  v_public:=public.community_get_dreamsnap_results_public_v1(v_challenge);
  if jsonb_array_length(v_public->'inGameResults')<>0 then
    raise exception 'ACCEPTANCE_OFFICIAL_RESULT_NOT_PRIVATE_BY_DEFAULT';
  end if;

  perform public.community_dreamsnap_set_official_result_publication_v1(
    v_subjects[1],v_entry_a,array['rank','moonstones']::text[]
  );

  v_public:=public.community_get_dreamsnap_results_public_v1(v_challenge);
  if jsonb_array_length(v_public->'wandResults')<>3 then raise exception 'ACCEPTANCE_WAND_RESULTS_WRONG_SIZE'; end if;
  if jsonb_array_length(v_public->'inGameResults')<>1 then raise exception 'ACCEPTANCE_OFFICIAL_OPTIN_MISSING'; end if;
  if not ((v_public->'inGameResults'->0->'officialResult') ? 'rank')
     or not ((v_public->'inGameResults'->0->'officialResult') ? 'moonstones')
     or ((v_public->'inGameResults'->0->'officialResult') ? 'score')
     or ((v_public->'inGameResults'->0->'officialResult') ? 'pixelDust') then
    raise exception 'ACCEPTANCE_OFFICIAL_FIELD_PRIVACY_BROKEN';
  end if;

  perform public.community_dreamsnap_publish_gallery_v1(v_subjects[1],v_entry_a,true);
  v_json:=public.community_dreamsnap_publish_gallery_v1(v_subjects[2],v_entry_b,true);
  if (v_json->>'commentsEnabled')::boolean<>false then
    raise exception 'ACCEPTANCE_MANAGED_UNDER13_COMMENTS_NOT_FORCED_OFF';
  end if;

  v_gallery:=public.community_get_gallery_dreamsnap_public_v1(v_work_a);
  if (v_gallery->>'mediaId')::uuid<>v_media_a then raise exception 'ACCEPTANCE_GALLERY_MEDIA_WRONG'; end if;
  if not ((v_gallery->'officialResult') ? 'rank')
     or ((v_gallery->'officialResult') ? 'score') then
    raise exception 'ACCEPTANCE_GALLERY_OFFICIAL_PRIVACY_BROKEN';
  end if;

  perform public.community_add_reaction(v_subjects[4],v_work_a,'like');
  perform public.community_save_entity(v_subjects[4],v_work_a);
  perform public.community_add_comment_v3(
    v_subjects[4],v_creators[4],v_work_a,null,
    'Acceptance comment','accept-comment-a-'||gen_random_uuid()::text
  );

  begin
    perform public.community_add_comment_v3(
      v_subjects[4],v_creators[4],v_work_b,null,
      'Should be blocked','accept-comment-b-'||gen_random_uuid()::text
    );
  exception when others then
    if position('Comments are disabled' in sqlerrm)>0 then v_minor_comment_blocked:=true; else raise; end if;
  end;
  if not v_minor_comment_blocked then raise exception 'ACCEPTANCE_MANAGED_UNDER13_COMMENT_NOT_BLOCKED'; end if;

  v_json:=public.community_report_entity(
    v_subjects[4],v_work_a,'dreamsnap_content',null,
    'accept-report-a-'||gen_random_uuid()::text
  );
  if not exists(
    select 1 from public.moderation_cases
    where case_id=(v_json->>'caseId')::uuid and target_entity_id=v_work_a
  ) then raise exception 'ACCEPTANCE_REPORT_CASE_NOT_CREATED'; end if;

  v_changed:=private.dreamsnap_apply_work_moderation_effect_v1(v_work_a,'restrict');
  if v_changed<>1 or (select eligibility_state from public.dreamsnap_entries where entry_id=v_entry_a)<>'ineligible' then
    raise exception 'ACCEPTANCE_MODERATION_RESTRICT_NOT_PROJECTED';
  end if;

  begin
    perform public.community_get_gallery_dreamsnap_public_v1(v_work_a);
    raise exception 'ACCEPTANCE_RESTRICTED_GALLERY_STILL_VISIBLE';
  exception when others then
    if position('ACCEPTANCE_RESTRICTED_GALLERY_STILL_VISIBLE' in sqlerrm)>0 then raise; end if;
  end;

  v_changed:=private.dreamsnap_apply_work_moderation_effect_v1(v_work_a,'restore');
  if v_changed<>1 or (select eligibility_state from public.dreamsnap_entries where entry_id=v_entry_a)<>'eligible' then
    raise exception 'ACCEPTANCE_MODERATION_RESTORE_NOT_PROJECTED';
  end if;

  perform public.community_get_gallery_dreamsnap_public_v1(v_work_a);

  raise notice 'DREAMSNAPS_GOLDEN_VERTICAL_ROLLBACK_ACCEPTANCE_PASS';
end
$$;

rollback;
