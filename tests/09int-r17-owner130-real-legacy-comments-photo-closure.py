#!/usr/bin/env python3
"""03 COMM R17 Source-only two independent real PostgreSQL sessions."""
import json,os,uuid,psycopg
assert os.getenv('DDVRE_R17_INDEPENDENT_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
owner,auth,creator,subject=u(),u(),u(),u()
g_direct,g_history,g_both=(u() for _ in range(3))
preset_work,artifact_direct,artifact_history,artifact_both=u(),u(),u(),u()
preset_rev,preset_work_rev,blob=(u() for _ in range(3))
revs={g_direct:u(),g_history:u(),g_both:u()}
dreamsnap_work,challenge,ds_rev,entry=(u() for _ in range(4))
with psycopg.connect(dsn,autocommit=True) as c:
  with c.transaction():
    c.execute("insert into public.wand_accounts(account_id) values(%s)",(owner,))
    c.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
      values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(auth)))
    entities=[(creator,'creator_profile')]+[(w,'community_work') for w in (g_direct,g_history,g_both,preset_work,dreamsnap_work)]+[(a,'preset_artifact') for a in (artifact_direct,artifact_history,artifact_both)]
    for key,typ in entities:c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(key,typ))
    c.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
      values(%s,%s,%s,'R17 owner')""",(creator,owner,'isolated_r17_'+u().hex[:12]))
    for w,kind in [(g_direct,'gallery'),(g_history,'gallery'),(g_both,'gallery'),(preset_work,'preset'),(dreamsnap_work,'dreamsnap')]:
      c.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
        values(%s,%s,%s,%s,'public','clear')""",(w,owner,creator,kind))
    for w in revs:
      c.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(w,))
      c.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(w,))
      c.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(revs[w],w,owner))
      c.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'R17 photo previous')",(revs[w],))
      c.execute("""update public.community_works set lifecycle_state='published',
        current_published_revision_id=%s,published_at=now() where work_id=%s""",(revs[w],w))
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
    c.execute("""insert into public.artifact_blobs(
      blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256)
      values(%s,%s,%s,1,'application/json',100,%s)""",(blob,owner,'local/r17/'+str(blob),'a'*64))
    c.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(preset_work_rev,preset_work,owner))
    for ar,related in [(artifact_direct,g_direct),(artifact_history,None),(artifact_both,g_both)]:
      c.execute("""insert into public.preset_artifacts(
        preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,preset_type,associated_gallery_work_id)
        values(%s,%s,%s,%s,'scene',%s)""",(ar,owner,creator,preset_work,related))
    c.execute("""insert into public.preset_revisions(
      preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,metadata,created_by_account_id)
      values(%s,%s,1,%s,'{}'::jsonb,%s)""",(preset_rev,artifact_history,blob,owner))
    c.execute("insert into public.preset_revision_publications(work_revision_id,preset_revision_id) values(%s,%s)",(preset_work_rev,preset_rev))
    for w in [g_history,g_both]:
      c.execute("insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(revs[w],preset_rev))
    c.execute("""update public.community_works set lifecycle_state='published',current_published_revision_id=%s,
      published_at=now() where work_id=%s""",(preset_work_rev,preset_work))
    # DreamSnaps under13: test actual v2 branch rather than replacing or disabling it.
    c.execute("""insert into public.dreamsnap_challenges(
      challenge_id,challenge_key,title,lifecycle_state,
      submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
      formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,is_synthetic)
      values(%s,%s,'R17 under13','results',now()-interval '6 days',now()-interval '5 days',
      now()-interval '4 days',now()-interval '3 days',now()-interval '2 days',now()+interval '1 day',5,0,1,true)""",
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
      current_published_revision_id=%s,published_at=now() where work_id=%s""",(ds_rev,dreamsnap_work))
  versions={w:one(c,"select row_version from public.community_works where work_id=%s",(w,)) for w in revs}
  assert one(c,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id where r.work_id=%s",(g_direct,))==0
  assert one(c,"select count(*) from public.preset_artifacts where associated_gallery_work_id=%s",(g_history,))==0

# Independent assertions, NEW source-only post-repair verification.
# Reuse Owner synthetic fixture construction only, not Owner acceptance checks.
def state(c,w):
 return tuple(c.execute("""select
 (select comments_enabled from public.gallery_work_settings where work_id=%s),
 (select facets->>'commentsEnabled' from public.search_documents where work_id=%s),
 (select count(*) from public.audit_events where target_entity_id=%s),
 (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like '09int-postfix-%%'),
 (select count(*) from public.community_work_revisions where work_id=%s),
 (select count(*) from public.outbox_events where aggregate_id=%s),
 (select row_version from public.community_works where work_id=%s),
 (select current_published_revision_id from public.community_works where work_id=%s)
 """,(w,w,w,owner,w,w,w,w)).fetchone())
def expect_error(call,phrase=None,code=None):
 try:call()
 except psycopg.Error as e:
  if phrase is not None:assert phrase in str(e),(phrase,e.sqlstate,str(e))
  if code is not None:assert e.sqlstate==code,(code,e.sqlstate,str(e))
  return e.sqlstate
 raise AssertionError("POSITIVE_LEGACY_WRITER_REMAINED_REACHABLE")
def photo(c,w,media,key):
 return one(c,"""select public.community_publish_gallery_photo_v1(
 %s,%s,%s,%s,'outdoor',%s,'09 INT R17 post-fix','',%s::uuid[],%s,true,%s)""",
 (auth,creator,w,versions[w],subject,[media],media,key))
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert one(a,"select count(*) from supabase_migrations.schema_migrations")==130
 assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
 # NO original unfixed code replay: this is real repaired v1/v2 function
 # acceptance under a held direct Scene Artifact, including zero side-effects.
 start=state(a,g_direct)
 a.execute("BEGIN")
 one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(artifact_direct,))
 for old in ("v1","v2"):
  expect_error(lambda:one(b,"select public.community_set_gallery_comments_enabled_"+old+"(%s,%s,false)",(auth,g_direct)),
    "R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED")
  assert state(b,g_direct)==start,(old,start,state(b,g_direct))
 a.execute("ROLLBACK")
 assert state(b,g_direct)==start
 print(json.dumps({"case":"09INT_R17_ACTUAL_LEGACY_GALLERY_V1_V2_FIX",
  "twoSessionHeldArtifact":True,"oldDirectV1Denied":True,"oldV2GalleryDenied":True,
  "settingsSearchAuditIdempotencyUnchanged":True}))
 # Photo Direct/History/Both: verify actual repaired writer terminal, not owner wrapper.
 # Existing owner data explicitly includes reference combinations.
 for w,art,kind in ((g_direct,artifact_direct,"DIRECT"),(g_history,None,"HISTORY"),
                     (g_both,artifact_both,"BOTH")):
  before=state(a,w)
  a.execute("BEGIN")
  if art:
   one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(art,))
  else:
   one(a,"select work_id from public.community_works where work_id=%s for update",(w,))
  media=u()
  if art:
   expect_error(lambda:photo(b,w,media,"09int-postfix-photo-"+kind),"R17_PHOTO_DEPENDENCY_NOT_ENROLLED")
  else:
   b.execute("BEGIN")
   b.execute("set local lock_timeout='200ms'")
   expect_error(lambda:photo(b,w,media,"09int-postfix-photo-"+kind),code="55P03")
   b.execute("ROLLBACK")
  a.execute("ROLLBACK")
  expect_error(lambda:photo(b,w,media,"09int-postfix-photo-unheld-"+kind),
               "R17_PHOTO_DEPENDENCY_NOT_ENROLLED")
  assert state(a,w)==before,(kind,before,state(a,w))
  print(json.dumps({"case":"09INT_R17_REPAIRED_PHOTO_"+kind,
   "terminalReject":True,"noRevisionOutboxIdempotencyOrCurrentPointerChanges":True,
   "twoBackendLockProof":True}))
 # New R16 owner writer remains one safe metadata-only option for an
 # unsupported directly linked Gallery.
 expect_error(lambda:one(b,"""select public.community_set_gallery_comments_enabled_atomic_r16(
 %s,%s,%s,%s,false,%s)""",(auth,g_direct,versions[g_direct],revs[g_direct],"09int-postfix-atomic")),
 "R16_DEPENDENT_GALLERY_METADATA_NOT_ENROLLED")
 assert state(b,g_direct)==start
 # DreamSnaps under13 v2 must remain functional without routing to Gallery v1.
 expect_error(lambda:one(b,"select public.community_set_gallery_comments_enabled_v2(%s,%s,true)",
                           (auth,dreamsnap_work)),"Comments are disabled for this Work")
 assert one(b,"select public.community_set_gallery_comments_enabled_v2(%s,%s,false)",
            (auth,dreamsnap_work))["commentsEnabled"] is False
 assert one(b,"select comments_enabled from public.dreamsnap_gallery_publications where work_id=%s",
            (dreamsnap_work,)) is False
 print(json.dumps({"case":"09INT_R17_DREAMSNAPS_UNDER13_V2_PRESERVED",
  "enableRejected":True,"disableAllowed":True}))
 # Positive CONTROL: an unlinked, verified Photo-only Gallery remains editable
 # with synthetic READY/CLEAR metadata. Does NOT certify real Storage bytes.
 clean_work,clean_rev,media=(u() for _ in range(3))
 with a.transaction():
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",
            (clean_work,media))
  a.execute("""insert into public.community_works(
     work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
     values(%s,%s,%s,'gallery','public','clear')""",(clean_work,owner,creator))
  a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(clean_work,))
  a.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(clean_work,))
  a.execute("""insert into public.community_work_revisions(
     revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)""",
    (clean_rev,clean_work,owner))
  a.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'09INT clean Gallery')",(clean_rev,))
  a.execute("""update public.community_works set lifecycle_state='published',
    current_published_revision_id=%s,published_at=now() where work_id=%s""",(clean_rev,clean_work))
  a.execute("insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id) values(%s,%s,%s,%s)",
    (clean_work,subject,owner,creator))
  a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
      byte_size,width,height,checksum_sha256,processing_state,moderation_state)
      values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
    (media,owner,"ci-only/09int-postfix-"+u().hex+".png","f"*64))
 original=one(a,"select row_version from public.community_works where work_id=%s",(clean_work,))
 result=one(b,"""select public.community_publish_gallery_photo_v1(
  %s,%s,%s,%s,'outdoor',%s,'09INT clean control','no actual bytes',
  %s::uuid[],%s,true,%s)""",
  (auth,creator,clean_work,original,subject,[media],media,"09int-postfix-unlinked-control"))
 assert result["revisionId"] and one(a,"select count(*) from public.community_work_revisions where work_id=%s",(clean_work,))==2
 assert one(a,"select count(*) from public.outbox_events where aggregate_id=%s",(clean_work,))==1
 print(json.dumps({"case":"09INT_R17_UNLINKED_PHOTO_SOURCE_CONTROL","actualPhotoWriterCommitted":True,
 "syntheticStorageMetadataOnly":True}))
 print(json.dumps({"result":"09INT_R17_POST_OWNER130_ACTUAL_TWO_BACKEND_LEGACY_AND_PHOTO_CLOSURE_PASS",
 "ownerPin":"5edcf47e605d6d43b8c15f8102dd27e21a7582ef",
 "sourceFullyEnrolled":False,"signedStaging":False,"physicalCleanup":False}))
