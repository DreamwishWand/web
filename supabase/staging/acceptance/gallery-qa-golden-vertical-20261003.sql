
-- Gallery + Q&A Golden Vertical staging acceptance.
-- Uses existing staging acceptance identities only inside one transaction.
-- All generated Community/Media/interaction rows and the temporary recent-auth
-- session timestamp change are rolled back. No fixture can enter seed metrics.

begin;

create temporary table gv_fixture_ids(
  key text primary key,
  id uuid not null
) on commit drop;
grant select,insert,update,delete on table gv_fixture_ids to anon;

do $$
declare
  v_sub_a uuid;
  v_acc_a uuid;
  v_creator_a uuid;
  v_sub_b uuid;
  v_acc_b uuid;
  v_creator_b uuid;
  v_mod_sub uuid;
  v_mod_session uuid;

  v_media uuid := gen_random_uuid();
  v_gallery uuid;
  v_gallery_row bigint;
  v_comment uuid;
  v_reply uuid;
  v_report jsonb;
  v_case uuid;
  v_question uuid;
  v_question2 uuid;
  v_answer uuid;
  v_tip uuid;
  v_q_report jsonb;
  v_q_case uuid;
  v_j jsonb;
  v_now_epoch bigint := floor(extract(epoch from clock_timestamp()))::bigint;
begin
  select a.account_id,i.provider_subject::uuid,c.creator_profile_id
    into v_acc_a,v_sub_a,v_creator_a
  from public.wand_accounts a
  join public.auth_identities i
    on i.account_id=a.account_id
   and i.provider='supabase'
   and i.identity_state='active'
  join public.creator_profiles c on c.owner_account_id=a.account_id
  where a.status='active'
    and not exists (
      select 1 from public.account_roles r
      where r.account_id=a.account_id and r.role in ('moderator','admin')
    )
  order by a.created_at,a.account_id
  limit 1;

  select a.account_id,i.provider_subject::uuid,c.creator_profile_id
    into v_acc_b,v_sub_b,v_creator_b
  from public.wand_accounts a
  join public.auth_identities i
    on i.account_id=a.account_id
   and i.provider='supabase'
   and i.identity_state='active'
  join public.creator_profiles c on c.owner_account_id=a.account_id
  where a.status='active'
    and a.account_id<>v_acc_a
    and not exists (
      select 1 from public.account_roles r
      where r.account_id=a.account_id and r.role in ('moderator','admin')
    )
  order by a.created_at,a.account_id
  limit 1;

  select i.provider_subject::uuid,s.id
    into v_mod_sub,v_mod_session
  from public.wand_accounts a
  join public.account_roles r
    on r.account_id=a.account_id
   and r.role in ('moderator','admin')
  join public.auth_identities i
    on i.account_id=a.account_id
   and i.provider='supabase'
   and i.identity_state='active'
  join auth.sessions s on s.user_id=i.provider_subject::uuid
  where a.status='active'
  order by s.created_at desc nulls last
  limit 1;

  if v_sub_a is null or v_sub_b is null or v_mod_sub is null then
    raise exception 'GV_FIXTURE requires two non-staff Creator accounts and one staff session';
  end if;

  insert into public.community_entities(entity_id,entity_type)
  values(v_media,'media_asset');
  insert into public.media_assets(
    media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,
    processing_state,moderation_state
  ) values(
    v_media,v_acc_a,'engineering-fixture/gallery-qa/' || v_media::text,
    'image/png',1024,1920,1080,repeat('a',64),'ready','clear'
  );
  insert into public.community_entity_origins(entity_id,origin_kind)
  values(v_media,'engineering_fixture');

  -- Gallery create / PUBLIC-only publication.
  v_j := public.community_create_gallery_work_v1(
    v_sub_a,v_creator_a,'outdoor','gv-gallery-create-20261003'
  );
  v_gallery := (v_j->>'workId')::uuid;
  update public.community_entity_origins
  set origin_kind='engineering_fixture' where entity_id=v_gallery;

  if (select visibility from public.community_works where work_id=v_gallery) <> 'public' then
    raise exception 'GV_ASSERT gallery create was not forced PUBLIC';
  end if;
  if not (select comments_enabled from public.gallery_work_settings where work_id=v_gallery) then
    raise exception 'GV_ASSERT Gallery comments not enabled by default';
  end if;

  update public.community_works set visibility='unlisted' where work_id=v_gallery;
  begin
    perform public.community_publish_gallery_v4(
      v_sub_a,v_gallery,
      (select row_version from public.community_works where work_id=v_gallery),
      'GV Fixture Gallery 20261003','fixture',array[v_media],
      array[]::uuid[],array[40000001::bigint],array[40000001::bigint],
      'fixture:moodboard:1','gv-gallery-publish-invalid-20261003'
    );
    raise exception 'GV_EXPECTED_FAILURE_NOT_RAISED gallery UNLISTED publish';
  exception when others then
    if sqlerrm='GV_EXPECTED_FAILURE_NOT_RAISED gallery UNLISTED publish'
       or position('Gallery launch publication must be PUBLIC' in sqlerrm)=0 then
      raise;
    end if;
  end;

  update public.community_works set visibility='public' where work_id=v_gallery;
  select row_version into v_gallery_row
  from public.community_works where work_id=v_gallery;

  v_j := public.community_publish_gallery_v4(
    v_sub_a,v_gallery,v_gallery_row,
    'GV Fixture Gallery 20261003','Golden Vertical rollback fixture',
    array[v_media],array[]::uuid[],
    array[40000001::bigint,40000002::bigint],array[40000001::bigint],
    'fixture:moodboard:1','gv-gallery-publish-20261003'
  );

  if (v_j->>'visibility') <> 'public'
     or not exists(
       select 1 from public.search_documents
       where work_id=v_gallery and work_type='gallery'
         and facets->>'galleryKind'='outdoor'
         and (facets->>'commentsEnabled')::boolean
     ) then
    raise exception 'GV_ASSERT Gallery publication/discovery projection failed';
  end if;

  if (select count(*) from public.work_revision_media m
      join public.community_works w on w.current_published_revision_id=m.work_revision_id
      where w.work_id=v_gallery) <> 1
     or (select count(*) from public.gallery_revision_items i
         join public.community_works w on w.current_published_revision_id=i.gallery_revision_id
         where w.work_id=v_gallery and i.featured) <> 1 then
    raise exception 'GV_ASSERT Gallery immutable publication composition failed';
  end if;

  -- Save / reaction / comment / reply.
  perform public.community_save_entity(v_sub_b,v_gallery);
  perform public.community_add_reaction(v_sub_b,v_gallery,'engineering_fixture_reaction');

  v_j := public.community_add_comment_v2(
    v_sub_b,v_creator_b,v_gallery,null,
    'Fixture viewer comment','gv-gallery-comment-20261003'
  );
  v_comment := (v_j->>'commentId')::uuid;
  update public.community_entity_origins set origin_kind='engineering_fixture'
  where entity_id=v_comment;

  v_j := public.community_add_comment_v2(
    v_sub_a,v_creator_a,v_gallery,v_comment,
    'Fixture author reply','gv-gallery-reply-20261003'
  );
  v_reply := (v_j->>'commentId')::uuid;
  update public.community_entity_origins set origin_kind='engineering_fixture'
  where entity_id=v_reply;

  begin
    perform public.community_set_gallery_comments_enabled_v1(v_sub_b,v_gallery,false);
    raise exception 'GV_EXPECTED_FAILURE_NOT_RAISED unauthorized Gallery control';
  exception when others then
    if sqlerrm='GV_EXPECTED_FAILURE_NOT_RAISED unauthorized Gallery control'
       or position('does not own Gallery Work' in sqlerrm)=0 then raise; end if;
  end;

  perform public.community_set_gallery_comments_enabled_v1(v_sub_a,v_gallery,false);
  if not exists(
    select 1 from public.comments where comment_id=v_comment and lifecycle_state<>'deleted'
  ) then
    raise exception 'GV_ASSERT disabling comments deleted existing comment';
  end if;

  begin
    perform public.community_add_comment_v2(
      v_sub_b,v_creator_b,v_gallery,null,
      'Must be rejected','gv-gallery-comment-disabled-20261003'
    );
    raise exception 'GV_EXPECTED_FAILURE_NOT_RAISED disabled Gallery comment';
  exception when others then
    if sqlerrm='GV_EXPECTED_FAILURE_NOT_RAISED disabled Gallery comment'
       or position('Comments are disabled' in sqlerrm)=0 then raise; end if;
  end;

  perform public.community_set_gallery_comments_enabled_v1(v_sub_a,v_gallery,true);
  perform public.community_gallery_author_remove_comment_v1(
    v_sub_a,v_gallery,v_comment,'Creator removed fixture comment'
  );
  if (select lifecycle_state from public.comments where comment_id=v_comment) <> 'deleted' then
    raise exception 'GV_ASSERT author comment removal failed';
  end if;

  -- Reaction presentation.
  v_j := public.community_get_gallery_v1(v_sub_a,v_gallery);
  if jsonb_array_length(coalesce(v_j->'reactionCounts','[]'::jsonb)) <> 1 then
    raise exception 'GV_ASSERT Gallery author reaction aggregate missing';
  end if;

  v_j := public.community_get_gallery_v1(v_sub_b,v_gallery);
  if v_j->'reactionCounts' <> 'null'::jsonb
     or not (v_j->'reactionKinds') ? 'engineering_fixture_reaction' then
    raise exception 'GV_ASSERT Gallery viewer reaction presentation invalid';
  end if;

  -- My Gallery.
  v_j := public.community_get_my_gallery_v1(v_sub_a,50);
  if not exists(
    select 1 from jsonb_array_elements(v_j->'myWorks') x
    where (x->>'workId')::uuid=v_gallery
  ) then raise exception 'GV_ASSERT My Gallery > My Works missing'; end if;

  v_j := public.community_get_my_gallery_v1(v_sub_b,50);
  if not exists(
    select 1 from jsonb_array_elements(v_j->'saved') x
    where (x->>'targetEntityId')::uuid=v_gallery
      and coalesce((x->>'accessible')::boolean,false)
  ) then raise exception 'GV_ASSERT My Gallery > Saved missing'; end if;

  -- Report / recent-auth moderation / degraded Saved reference / restore.
  v_report := public.community_report_entity(
    v_sub_b,v_gallery,'other','Gallery Golden Vertical fixture report',
    'gv-gallery-report-20261003'
  );
  v_case := (v_report->>'caseId')::uuid;

  update auth.sessions
  set created_at=clock_timestamp(),updated_at=clock_timestamp()
  where id=v_mod_session and user_id=v_mod_sub;

  perform public.community_moderate_work_v3(
    v_mod_sub,v_mod_session,v_now_epoch,v_case,'remove',
    'Fixture moderation remove acceptance'
  );

  if exists(select 1 from public.search_documents where work_id=v_gallery) then
    raise exception 'GV_ASSERT moderated Gallery remained discoverable';
  end if;

  v_j := public.community_get_my_gallery_v1(v_sub_b,50);
  if not exists(
    select 1 from jsonb_array_elements(v_j->'saved') x
    where (x->>'targetEntityId')::uuid=v_gallery
      and not coalesce((x->>'accessible')::boolean,true)
      and x->'work'='null'::jsonb
  ) then raise exception 'GV_ASSERT Saved unavailable-source state missing'; end if;

  perform public.community_moderate_work_v3(
    v_mod_sub,v_mod_session,v_now_epoch,v_case,'restore',
    'Fixture moderation restore acceptance'
  );
  if not exists(
    select 1 from public.search_documents
    where work_id=v_gallery
      and facets->>'galleryKind'='outdoor'
      and (facets->>'commentsEnabled')::boolean
  ) then raise exception 'GV_ASSERT restored Gallery projection/facets missing'; end if;

  -- Q&A ask / discovery / Unanswered / Same Here / Answer.
  v_j := public.community_ask_question_v1(
    v_sub_a,v_creator_a,
    'GV Fixture Question 20261003',
    'How does the rollback Golden Vertical fixture behave?',
    array['engineering-fixture:system'],
    'Switch','1.25.0','gv-question-ask-20261003'
  );
  v_question := (v_j->>'questionId')::uuid;
  update public.community_entity_origins set origin_kind='engineering_fixture'
  where entity_id=v_question;

  if not exists(
    select 1 from public.qa_question_state
    where work_id=v_question and resolution_state='unresolved' and freshness='current'
  ) then raise exception 'GV_ASSERT Question initial state invalid'; end if;

  if (select count(*) from public.community_search_questions_v1(
      'GV Fixture Question',array['engineering-fixture:system'],true,20
    ) where question_id=v_question) <> 1 then
    raise exception 'GV_ASSERT Unanswered filter did not find new Question';
  end if;

  perform public.community_set_same_here_v1(v_sub_b,v_question,true);

  v_j := public.community_add_answer_v1(
    v_sub_b,v_creator_b,v_question,
    'Fixture answer with reusable resolution information.',
    'gv-answer-add-20261003'
  );
  v_answer := (v_j->>'answerId')::uuid;
  update public.community_entity_origins set origin_kind='engineering_fixture'
  where entity_id=v_answer;

  if (select count(*) from public.community_search_questions_v1(
      'GV Fixture Question',array['engineering-fixture:system'],true,20
    ) where question_id=v_question) <> 0 then
    raise exception 'GV_ASSERT Unanswered filter retained answered Question';
  end if;

  begin
    perform public.community_resolve_question_v1(v_sub_a,v_question,null,null);
    raise exception 'GV_EXPECTED_FAILURE_NOT_RAISED empty Question resolution';
  exception when others then
    if sqlerrm='GV_EXPECTED_FAILURE_NOT_RAISED empty Question resolution'
       or position('requires Accepted Answer or Solution Note' in sqlerrm)=0 then raise; end if;
  end;

  perform public.community_set_answer_utility_v1(v_sub_a,v_answer,'helpful');
  perform public.community_set_answer_utility_v1(v_sub_b,v_answer,'worked_for_me');
  perform public.community_resolve_question_v1(v_sub_a,v_question,v_answer,null);

  begin
    perform public.community_set_same_here_v1(v_sub_a,v_question,true);
    raise exception 'GV_EXPECTED_FAILURE_NOT_RAISED Same Here on solved Question';
  exception when others then
    if sqlerrm='GV_EXPECTED_FAILURE_NOT_RAISED Same Here on solved Question'
       or position('CURRENT + UNRESOLVED' in sqlerrm)=0 then raise; end if;
  end;
  perform public.community_set_same_here_v1(v_sub_b,v_question,false);

  -- Create Tip from own Answer with inherited provenance/context.
  v_j := public.community_create_tip_v1(
    v_sub_b,v_creator_b,
    'GV Fixture Tip 20261003',
    'Reusable fixture Tip derived from my Answer.',
    null,null,null,v_question,v_answer,
    'gv-tip-create-20261003'
  );
  v_tip := (v_j->>'tipId')::uuid;
  update public.community_entity_origins set origin_kind='engineering_fixture'
  where entity_id=v_tip;

  if not exists(
    select 1
    from public.community_works w
    join public.qa_tip_revisions tr on tr.revision_id=w.current_published_revision_id
    where w.work_id=v_tip
      and tr.source_question_id=v_question
      and tr.source_answer_id=v_answer
      and tr.context_tags=array['engineering-fixture:system']
  ) then raise exception 'GV_ASSERT Tip provenance/context inheritance failed'; end if;

  v_j := public.community_get_my_qa_activity_v1(v_sub_b,100);
  if not exists(
    select 1 from jsonb_array_elements(v_j->'contributions') x
    where x->>'kind'='answer' and (x->>'entityId')::uuid=v_answer
  ) or not exists(
    select 1 from jsonb_array_elements(v_j->'contributions') x
    where x->>'kind'='tip' and (x->>'entityId')::uuid=v_tip
  ) then raise exception 'GV_ASSERT Q&A My Activity missing contributions'; end if;

  -- Freshness/outdated semantics.
  perform public.community_set_qa_freshness_v1(v_sub_b,v_tip,'needs_recheck');
  if exists(select 1 from public.search_documents where work_id=v_tip) then
    raise exception 'GV_ASSERT NEEDS_RECHECK Tip remained in ordinary search';
  end if;
  perform public.community_remove_outdated_qa_v1(v_sub_b,v_tip);
  if (select lifecycle_state from public.community_works where work_id=v_tip) <> 'deleted' then
    raise exception 'GV_ASSERT outdated Tip was not deleted';
  end if;

  perform public.community_set_qa_freshness_v1(v_sub_b,v_answer,'needs_recheck');
  perform public.community_remove_outdated_qa_v1(v_sub_b,v_answer);
  if (select resolution_state from public.qa_question_state where work_id=v_question) <> 'unresolved' then
    raise exception 'GV_ASSERT Question did not reopen after accepted Answer deletion';
  end if;
  perform public.community_set_same_here_v1(v_sub_b,v_question,true);

  -- Duplicate withdraw/redirect.
  v_j := public.community_ask_question_v1(
    v_sub_a,v_creator_a,
    'GV Fixture Duplicate Question 20261003',
    'Duplicate fixture content.',
    array['engineering-fixture:system'],
    'Switch','1.25.0','gv-question-duplicate-20261003'
  );
  v_question2 := (v_j->>'questionId')::uuid;
  update public.community_entity_origins set origin_kind='engineering_fixture'
  where entity_id=v_question2;

  perform public.community_withdraw_duplicate_question_v1(
    v_sub_a,v_question2,v_question
  );
  if (select lifecycle_state from public.community_works where work_id=v_question2) <> 'deleted'
     or not exists(
       select 1 from public.qa_question_redirects
       where question_id=v_question2 and target_question_id=v_question
     ) then raise exception 'GV_ASSERT duplicate withdraw/redirect failed'; end if;

  -- Q&A report/moderation/restore.
  v_q_report := public.community_report_entity(
    v_sub_b,v_question,'other','Q&A Golden Vertical fixture report',
    'gv-question-report-20261003'
  );
  v_q_case := (v_q_report->>'caseId')::uuid;

  perform public.community_moderate_work_v3(
    v_mod_sub,v_mod_session,v_now_epoch,v_q_case,'remove',
    'Fixture Q&A moderation remove acceptance'
  );
  if exists(select 1 from public.search_documents where work_id=v_question) then
    raise exception 'GV_ASSERT moderated Question remained discoverable';
  end if;

  perform public.community_moderate_work_v3(
    v_mod_sub,v_mod_session,v_now_epoch,v_q_case,'restore',
    'Fixture Q&A moderation restore acceptance'
  );
  if not exists(
    select 1 from public.search_documents
    where work_id=v_question
      and title='GV Fixture Question 20261003'
      and tags @> array['engineering-fixture:system']
      and facets->>'freshness'='current'
      and facets->>'resolutionState'='unresolved'
  ) then raise exception 'GV_ASSERT restored Question projection missing'; end if;

  insert into gv_fixture_ids(key,id) values
    ('gallery',v_gallery),
    ('question',v_question),
    ('duplicate',v_question2);

  update public.community_entity_origins
  set origin_kind='engineering_fixture'
  where entity_id in (
    v_gallery,v_comment,v_reply,v_question,v_answer,v_tip,v_question2,v_media
  );

  if exists(
    select 1 from public.community_entity_origins
    where entity_id in (
      v_gallery,v_comment,v_reply,v_question,v_answer,v_tip,v_question2,v_media
    )
      and origin_kind<>'engineering_fixture'
  ) then raise exception 'GV_ASSERT fixture origin boundary failed'; end if;
end
$$;

-- Public/anonymous projection checks.
create temporary table gv_anon_checks(
  key text primary key,
  ok boolean not null
) on commit drop;
grant select,insert on table gv_anon_checks to anon;

set local role anon;

insert into gv_anon_checks(key,ok)
select 'gallery_detail',
  (public.community_get_gallery_public_v1(
    (select id from gv_fixture_ids where key='gallery')
  )->>'title')='GV Fixture Gallery 20261003';

insert into gv_anon_checks(key,ok)
select 'gallery_discovery',
  exists(
    select 1 from public.community_search_public(
      'GV Fixture Gallery','gallery'::public.work_type,null,null,20,null,null
    )
    where work_id=(select id from gv_fixture_ids where key='gallery')
  );

insert into gv_anon_checks(key,ok)
select 'question_discovery',
  exists(
    select 1 from public.community_search_questions_v1(
      'GV Fixture Question',array['engineering-fixture:system'],false,20
    )
    where question_id=(select id from gv_fixture_ids where key='question')
  );

insert into gv_anon_checks(key,ok)
select 'question_detail',
  (public.community_get_question_public_v1(
    (select id from gv_fixture_ids where key='question')
  )->>'resolutionState')='unresolved';

insert into gv_anon_checks(key,ok)
select 'duplicate_redirect',
  (public.community_get_question_redirect_public_v1(
    (select id from gv_fixture_ids where key='duplicate')
  )->>'targetQuestionId')=(select id::text from gv_fixture_ids where key='question');

reset role;

do $$
begin
  if exists(select 1 from gv_anon_checks where not ok) then
    raise exception 'GV_ASSERT anonymous/public acceptance failed: %',
      (select jsonb_agg(jsonb_build_object('key',key,'ok',ok)) from gv_anon_checks);
  end if;
end
$$;

rollback;

select jsonb_build_object(
  'status','PASS',
  'scope','GALLERY_AND_QA_BACKEND_ROLLBACK_FIXTURE',
  'persistentFixtureRows',0,
  'publicChecks',array[
    'gallery_detail','gallery_discovery',
    'question_discovery','question_detail','duplicate_redirect'
  ],
  'moderationPath','RECENT_AUTH_V3'
) as golden_vertical_backend_acceptance;
