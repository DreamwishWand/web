#!/usr/bin/env python3
"""03 COMM R17 Source-only two independent real PostgreSQL sessions."""
import json,os,uuid,psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
owner,auth,creator,subject=u(),u(),u(),u()
g_direct,g_history,g_both=(u() for _ in range(3))
preset_work,preset_work_direct,preset_work_both,artifact_direct,artifact_history,artifact_both=(u() for _ in range(6))
preset_rev,preset_work_rev,blob=(u() for _ in range(3))
revs={g_direct:u(),g_history:u(),g_both:u()}
gallery_media=u()
dreamsnap_work,challenge,ds_rev,entry=(u() for _ in range(4))
with psycopg.connect(dsn,autocommit=True) as c:
  with c.transaction():
    c.execute("insert into public.wand_accounts(account_id) values(%s)",(owner,))
    c.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
      values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(auth)))
    entities=[(creator,'creator_profile'),(gallery_media,'media_asset')]+[(w,'community_work') for w in (g_direct,g_history,g_both,preset_work,preset_work_direct,preset_work_both,dreamsnap_work)]+[(a,'preset_artifact') for a in (artifact_direct,artifact_history,artifact_both)]
    for key,typ in entities:c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(key,typ))
    c.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
      values(%s,%s,%s,'R17 owner')""",(creator,owner,'isolated_r17_'+u().hex[:12]))
    for w,kind in [(g_direct,'gallery'),(g_history,'gallery'),(g_both,'gallery'),(preset_work,'preset'),(preset_work_direct,'preset'),(preset_work_both,'preset'),(dreamsnap_work,'dreamsnap')]:
      c.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
        values(%s,%s,%s,%s,%s,'clear')""",(w,owner,creator,kind,'private' if kind=='dreamsnap' else 'public'))
    for w in revs:
      c.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(w,))
      c.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(w,))
      c.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(revs[w],w,owner))
      c.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'R17 photo previous')",(revs[w],))
      c.execute("""insert into public.search_documents(
        entity_id,work_id,work_type,creator_profile_id,title,text_content,tags,facets,published_at,updated_at)
        values(%s,%s,'gallery',%s,'R17 photo previous','',array[]::text[],
        '{"galleryKind":"outdoor","commentsEnabled":true}'::jsonb,now(),now())""",(w,w,creator))
    c.execute("""insert into public.gallery_verified_subjects(
      subject_id,gallery_kind,subject_type,canonical_target_id,platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
      values(%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',624,'r17-synthetic-local-test','verified')""",
      (subject,'r17-synthetic-'+u().hex[:14]))
    for w in revs:
      c.execute("""insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id)
        values(%s,%s,%s,%s)""",(w,subject,owner,creator))
    c.execute("""insert into public.media_assets(
      media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
      checksum_sha256,processing_state,moderation_state)
      values(%s,%s,%s,'image/png',100,10,10,%s,'ready','clear')""",
      (gallery_media,owner,'local/r17/photo-media/'+gallery_media.hex,'a'*64))
    c.execute("""insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
      values(%s,%s,0,'gallery')""",(revs[g_direct],gallery_media))
    c.execute("""insert into public.gallery_photo_revision_fields(
      revision_id,subject_id,cover_media_id,originality_attested)
      values(%s,%s,%s,true)""",(revs[g_direct],subject,gallery_media))
    c.execute("""insert into public.artifact_blobs(
      blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
      values(%s,%s,%s,1,'application/json',100,%s)""",(blob,owner,'local/r17/'+str(blob),'a'*64))
    c.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(preset_work_rev,preset_work,owner))
    for ar,related,pw in [(artifact_direct,g_direct,preset_work_direct),(artifact_history,None,preset_work),(artifact_both,g_both,preset_work_both)]:
      c.execute("""insert into public.preset_artifacts(
        preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type,associated_gallery_work_id)
        values(%s,%s,%s,%s,'scene',%s)""",(ar,owner,creator,pw,related))
    c.execute("""insert into public.preset_revisions(
      preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
      values(%s,%s,1,%s,'{}'::jsonb,%s)""",(preset_rev,artifact_history,blob,owner))
    c.execute("insert into public.preset_revision_publications(work_revision_id,preset_revision_id) values(%s,%s)",(preset_work_rev,preset_rev))
    for w in [g_history,g_both]:
      c.execute("insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(revs[w],preset_rev))
    # Seal current gallery compositions only AFTER historical edge insertion.
    for w in revs:
      c.execute("""update public.community_works set lifecycle_state='published',
        current_published_revision_id=%s,published_at=now() where work_id=%s""",(revs[w],w))
    c.execute("""update public.community_works set lifecycle_state='published',current_published_revision_id=%s,
      published_at=now() where work_id=%s""",(preset_work_rev,preset_work))
    # DreamSnaps under13: test actual v2 branch rather than replacing or disabling it.
    c.execute("""insert into public.dreamsnap_challenges(
      challenge_id,challenge_key,title,lifecycle_state,
      submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
      formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
      values(%s,%s,'R17 under13','results',now()-interval '6 days',now()-interval '5 days',
      now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',5,0,1,1,true)""",
      (challenge,'r17-'+u().hex[:14]))
    c.execute("""insert into public.dreamsnap_works(
      work_id,challenge_id,workspace_relationship_kind,managed_under13)
      values(%s,%s,'parent_guardian_managed',true)""",(dreamsnap_work,challenge))
    c.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(ds_rev,dreamsnap_work,owner))
    c.execute("""insert into public.dreamsnap_work_revisions(
      revision_id,challenge_id,game_screenshot_attested,no_external_edits_attested,integrity_state)
      values(%s,%s,true,true,'eligible')""",(ds_rev,challenge))
    c.execute("""insert into public.dreamsnap_entries(
      entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,origin_kind)
      values(%s,%s,%s,%s,true,%s,'synthetic')""",(entry,challenge,dreamsnap_work,owner,ds_rev))
    c.execute("""insert into public.dreamsnap_gallery_publications(
      work_id,entry_id,revision_id,publication_state,comments_enabled)
      values(%s,%s,%s,'published',false)""",(dreamsnap_work,entry,ds_rev))
    c.execute("""update public.community_works set lifecycle_state='published',
      current_published_revision_id=%s,published_at=now(),visibility='public' where work_id=%s""",(ds_rev,dreamsnap_work))
  versions={w:one(c,"select row_version from public.community_works where work_id=%s",(w,)) for w in revs}
  assert one(c,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id where r.work_id=%s",(g_direct,))==0
  assert one(c,"select count(*) from public.preset_artifacts where associated_gallery_work_id=%s",(g_history,))==0

def state(c,w):
 return tuple(c.execute("""select
   (select comments_enabled from public.gallery_work_settings where work_id=%s),
   (select facets->>'commentsEnabled' from public.search_documents where work_id=%s),
   (select count(*) from public.audit_events where target_entity_id=%s),
   (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like 'r17%%'),
   (select count(*) from public.community_work_revisions where work_id=%s),
   (select count(*) from public.outbox_events where aggregate_id=%s),
   (select row_version from public.community_works where work_id=%s),
   (select current_published_revision_id from public.community_works where work_id=%s)
 """,(w,w,w,owner,w,w,w,w)).fetchone())
def photo(c,w,key):
  media=u()
  return one(c,"""select public.community_publish_gallery_photo_v1(
    %s,%s,%s,%s,'outdoor',%s,'R17 blocked','',%s::uuid[],%s,true,%s)""",
    (auth,creator,w,versions[w],subject,[media],media,key))
def expect(c,call,marker):
  try: call()
  except psycopg.Error as e:
    assert marker in str(e),(marker,e.sqlstate,str(e))
    return e.sqlstate
  raise AssertionError('UNSAFE_WRITER_ACCEPTED '+marker)
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
  assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
  for w,artifact,which in [(g_direct,artifact_direct,'DIRECT'),(g_history,None,'HISTORICAL'),(g_both,artifact_both,'DIRECT_AND_HISTORICAL')]:
    baseline=state(b,w)
    a.execute('begin')
    if artifact:
      one(a,'select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update',(artifact,))
    else:
      one(a,'select work_id from public.community_works where work_id=%s for update',(w,))
    b.execute('begin')
    b.execute("set local lock_timeout='250ms'")
    if which=='HISTORICAL':
      try:
        photo(b,w,'r17-photo-historical')
        raise AssertionError('PHOTO_HISTORICAL_HELD_WORK_BYPASS')
      except psycopg.Error as e: assert e.sqlstate=='55P03',(e.sqlstate,str(e))
    else:
      expect(b,lambda:photo(b,w,'r17-photo-'+which),'R17_PHOTO_DEPENDENCY_NOT_ENROLLED')
    b.execute('rollback')
    a.execute('rollback')
    assert state(b,w)==baseline,(which,baseline,state(b,w))
    expect(b,lambda:photo(b,w,'r17-photo-after-'+which),'R17_PHOTO_DEPENDENCY_NOT_ENROLLED')
    assert state(b,w)==baseline
    print(json.dumps({'case':'R17_PHOTO_'+which+'_FAIL_CLOSED','twoBackend':True,'noPartial':True}))
  for version in ('v1','v2'):
    old=state(b,g_direct)
    a.execute('begin')
    one(a,'select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update',(artifact_direct,))
    expect(b,lambda:one(b,"select public.community_set_gallery_comments_enabled_"+version+"(%s,%s,false)",(auth,g_direct)),
           'R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED')
    a.execute('rollback')
    assert state(b,g_direct)==old
    print(json.dumps({'case':'R17_LEGACY_GALLERY_COMMENTS_'+version.upper()+'_DENIED','noSettingsSearchAuditIdempotency':True}))
  # New R16 route remains the only owner-scoped Gallery metadata mutation.
  expect(b,lambda:one(b,"select public.community_set_gallery_comments_enabled_atomic_r16(%s,%s,%s,%s,false,%s)",
       (auth,g_direct,versions[g_direct],revs[g_direct],'r17-atomic')),'R16_DEPENDENT_GALLERY_METADATA_NOT_ENROLLED')
  assert state(b,g_direct)[3]==0
  # DreamSnaps v2 / parent-guardian under13 must not be disabled.
  expect(b,lambda:one(b,"select public.community_set_gallery_comments_enabled_v2(%s,%s,true)",(auth,dreamsnap_work)),
          'Comments are disabled for this Work')
  result=one(b,"select public.community_set_gallery_comments_enabled_v2(%s,%s,false)",(auth,dreamsnap_work))
  assert result['commentsEnabled'] is False and one(b,"select comments_enabled from public.dreamsnap_gallery_publications where work_id=%s",(dreamsnap_work,)) is False
  print(json.dumps({'case':'R17_DREAMSNAPS_UNDER13_V2_UNCHANGED','enabledTrueDenied':True,'enabledFalseSucceeds':True}))
with psycopg.connect(dsn,autocommit=True) as probe:
  for w,direct_count,historical_count in [
    (g_direct,1,0),(g_history,0,1),(g_both,1,1)
  ]:
    before=state(probe,w)
    observed=one(probe,"select public.community_gallery_photo_media_preflight_r17(%s,%s)",(auth,w))
    assert observed['contract']=='ddv.gallery-photo-media-readonly@r17'
    assert observed['workId']==str(w)
    assert observed['knownDependencyCounts']['directPresetArtifacts']==direct_count
    assert observed['knownDependencyCounts']['historicalGalleryRevisionPresets']==historical_count
    assert observed['workRevisions'] and isinstance(observed['mediaReferences'],list)
    if w==g_direct:
      assert observed['knownDependencyCounts']['mediaReferences']==1
      assert len(observed['mediaReferences'])==1
      media=observed['mediaReferences'][0]
      assert media['mediaId']==str(gallery_media)
      assert media['metadataReady'] is True
      assert media['declaredSha256']=='a'*64
      assert media['declaredByteSize']==100
      assert len(observed['coverReferences'])==1
      cover=observed['coverReferences'][0]
      assert cover['coverMediaId']==str(gallery_media)
      assert cover['coverInRevisionMedia'] is True
      assert cover['coverFirst'] is True
      assert cover['subjectMatches'] is True

    assert observed['graphComplete'] is False
    assert observed['mutationAuthorized'] is False
    assert observed['actualStorageBytesVerified'] is False
    assert observed['metadataSha256IsStorageProof'] is False
    assert observed['retirementAuthorized'] is False
    assert observed['snapshotNotAtomicMutationFence'] is True
    assert 'PHOTO_SCENE_DEPENDENCY_NOT_ENROLLED' in observed['blockedReasons']
    assert 'storageKey' not in json.dumps(observed)
    assert state(probe,w)==before
    print(json.dumps({'case':'R17_PHOTO_MEDIA_READONLY_'+str(direct_count)+'_'+str(historical_count),
      'direct':direct_count,'historical':historical_count,'noMutation':True}))
  expect(probe,lambda:one(probe,"select public.community_gallery_photo_media_preflight_r17(%s,%s)",(auth,preset_work)),
    'R17_PHOTO_PREFLIGHT_FORBIDDEN')
  print(json.dumps({'case':'R17_PHOTO_MEDIA_NONPHOTO_DENIED'}))
print(json.dumps({'result':'03COMM_R17_ACTUAL_SOURCE_LEGACY_COMMENTS_AND_PHOTO_TWO_BACKEND_PASS',
  'signedStagingJWT':False,'storageBytes':False,'nativeWriter':False}))
