-- 03 COMM #139: isolated synthetic full-schema local PG fixture; rollback only.
-- Never execute against Staging/Production or use genuine user auth/media.
begin;
do $privacy_test$
declare
  v_account uuid;
  v_auth uuid;
  v_creator uuid;
  v_other_auth uuid;
  v_session uuid:=gen_random_uuid();
  v_stale_session uuid:=gen_random_uuid();
  v_work uuid;
  v_revision uuid:=gen_random_uuid();
  v_media uuid:=gen_random_uuid();
  v_subject uuid;
  v_result jsonb;
  v_retry jsonb;
  v_error text;
  v_event_count integer;
  v_before bigint;
begin
  select a.account_id,a.provider_subject::uuid,c.creator_profile_id
    into v_account,v_auth,v_creator
  from public.auth_identities a
  join public.creator_profiles c on c.owner_account_id=a.account_id
  where c.handle='isolated_bootstrap_creator' and a.provider='supabase' limit 1;
  select a.provider_subject::uuid into v_other_auth
  from public.auth_identities a
  where a.provider='supabase' and a.account_id<>v_account limit 1;
  select w.work_id into v_work from public.community_works w
  where w.owner_account_id=v_account and w.work_type='gallery' limit 1;
  select subject_id into v_subject from public.gallery_verified_subjects
  where subject_type='floating_island' and verification_state='verified' limit 1;
  if v_auth is null or v_other_auth is null or v_work is null or v_subject is null then
    raise exception 'PRIVACY_LOCAL_SYNTHETIC_SEED_MISSING';
  end if;
  -- Real DB schema with a locally fabricated PUBLIC Gallery Photo/Media.
  insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
  insert into public.media_assets(
    media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
    checksum_sha256,processing_state,moderation_state
  ) values(v_media,v_account,'ci-only/privacy-'||v_media||'.png',
    'image/png',128,10,10,repeat('a',64),'ready','clear');
  insert into public.gallery_work_settings(work_id,comments_enabled)
  values(v_work,true);
  insert into public.gallery_photo_subjects(
    work_id,subject_id,owner_account_id,creator_profile_id
  ) values(v_work,v_subject,v_account,v_creator);
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id
  ) values(v_revision,v_work,1,v_account);
  insert into public.gallery_work_revisions(revision_id,title,description)
  values(v_revision,'CI Privacy Test',null);
  insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
  values(v_revision,v_media,0,'gallery');
  insert into public.gallery_photo_revision_fields(
    revision_id,subject_id,cover_media_id,originality_attested
  ) values(v_revision,v_subject,v_media,true);
  update public.community_works
  set lifecycle_state='published',visibility='public',
      current_published_revision_id=v_revision,published_at=now()
  where work_id=v_work;
  insert into public.search_documents(
    entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at
  ) values(v_work,v_work,'gallery',v_creator,'CI Privacy Test','synthetic',now());
  select row_version into v_before from public.community_works where work_id=v_work;
  if not private.is_discoverable_work(v_work) then
    raise exception 'PRIVACY_PRE_SUPPRESSION_PUBLIC_MISSING';
  end if;
  if (public.community_get_public_media_storage_v1(v_media)->>'mediaId')::uuid<>v_media then
    raise exception 'PRIVACY_PRE_SUPPRESSION_MEDIA_MISSING';
  end if;
  insert into auth.users(id) values(v_auth) on conflict(id) do nothing;
  insert into auth.users(id) values(v_other_auth) on conflict(id) do nothing;
  insert into auth.sessions(id,user_id,created_at)
  values(v_session,v_auth,clock_timestamp()),
        (v_stale_session,v_auth,clock_timestamp()-interval '3 days');

  -- A wrong actor cannot present the real owner's session ID.
  begin
    perform public.community_tombstone_account(
      v_other_auth,v_session,extract(epoch from now())::bigint,'DELETE'
    );
    raise exception 'PRIVACY_CROSS_OWNER_ACCEPTED';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_CROSS_OWNER_ACCEPTED' then raise; end if;
  end;
  begin
    perform public.community_tombstone_account(
      v_auth,v_stale_session,extract(epoch from now())::bigint,'DELETE'
    );
    raise exception 'PRIVACY_STALE_SESSION_ACCEPTED';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_STALE_SESSION_ACCEPTED' then raise; end if;
  end;
  begin
    perform public.community_tombstone_account(
      v_auth,v_session,extract(epoch from now())::bigint,'NOT_DELETE'
    );
    raise exception 'PRIVACY_CONFIRMATION_BYPASS';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_CONFIRMATION_BYPASS' then raise; end if;
  end;

  -- Actual compatibility RPC, not a mock. The Cloud preservation guard
  -- remains installed; only independent privacy suppression is committed.
  v_result:=public.community_tombstone_account(
    v_auth,v_session,extract(epoch from now())::bigint,'DELETE'
  );
  if v_result->>'privacyState'<>'suppressed_cleanup_pending'
     or v_result->>'fullDeletionComplete'<>'false'
     or v_result->>'alreadySuppressed'<>'false' then
    raise exception 'PRIVACY_STAGE_FIRST_RESPONSE_INVALID: %',v_result;
  end if;
  if not private.is_account_privacy_suppressed(v_account)
     or private.is_discoverable_work(v_work)
     or exists(select 1 from public.search_documents where work_id=v_work)
     or not exists(select 1 from public.community_works
                   where work_id=v_work and lifecycle_state='published'
                     and visibility='public' and row_version=v_before) then
    raise exception 'PRIVACY_BARRIER_NOT_INDEPENDENT_OF_GALLERY';
  end if;
  begin
    perform public.community_get_public_media_storage_v1(v_media);
    raise exception 'PRIVACY_MEDIA_READ_BYPASS';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_MEDIA_READ_BYPASS' then raise; end if;
  end;
  begin
    perform public.community_get_creator_public_v1(v_creator);
    raise exception 'PRIVACY_CREATOR_PUBLIC_BYPASS';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_CREATOR_PUBLIC_BYPASS' then raise; end if;
  end;
  begin
    perform private.resolve_active_account(v_auth);
    raise exception 'PRIVACY_NEW_WRITE_AUTH_BYPASS';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_NEW_WRITE_AUTH_BYPASS' then raise; end if;
  end;
  begin
    update public.community_works set current_published_revision_id=gen_random_uuid()
    where work_id=v_work;
    raise exception 'PRIVACY_REPUBLISH_BYPASS';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='PRIVACY_REPUBLISH_BYPASS' then raise; end if;
  end;

  v_retry:=public.community_tombstone_account(
    v_auth,v_session,extract(epoch from now())::bigint,'DELETE'
  );
  if v_retry->>'alreadySuppressed'<>'true'
     or v_retry->>'suppressedAt' is distinct from v_result->>'suppressedAt' then
    raise exception 'PRIVACY_RETRY_NOT_IDEMPOTENT';
  end if;
  select count(*) into v_event_count from public.outbox_events
  where aggregate_id=v_account and event_type='account.privacy_suppressed';
  if v_event_count<>1 then raise exception 'PRIVACY_DUPLICATE_OUTBOX_EVENT';end if;
  -- Emergency negative moderation remains legal while public positives deny.
  update public.community_works set moderation_state='restricted' where work_id=v_work;
  if not exists(select 1 from public.community_works
    where work_id=v_work and moderation_state='restricted') then
    raise exception 'PRIVACY_MODERATOR_RESTRICT_DENIED';
  end if;
  if has_function_privilege('anon',
      'public.community_request_privacy_suppression_v1(uuid,uuid,bigint,text)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.community_request_privacy_suppression_v1(uuid,uuid,bigint,text)','EXECUTE')
    or has_table_privilege('service_role',
      'private.account_privacy_suppressions','UPDATE') then
    raise exception 'PRIVACY_ACL_EXPOSED';
  end if;
  raise notice 'PRIVACY_SOURCE_BARRIER_PASS: actual RPC, linked photo/media, read/write, stale/cross-owner, idempotence, moderation negative';
end
$privacy_test$;
rollback;
