#!/usr/bin/env python3
"""09 INT R17 independent NEW Owner132 Photo/Media/Cover read-only Preflight.
No Owner acceptance tests imported. Original 132 SQL migrations in isolated DB.
Synthetic data; no signed HTTP, binary Storage, or external CDN.
"""
import os,uuid,json
import psycopg
assert os.getenv("DDVRE_09INT_LOCAL_ISOLATED")=="YES" and not os.getenv("DATABASE_URL")
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
U=uuid.uuid4
def one(c,sql,args=()):return c.execute(sql,args).fetchone()[0]
def query(c,actor,work):
 return one(c,"select public.community_gallery_photo_media_preflight_r17(%s,%s)",(actor,work))
def state(c,work,account):
 return tuple(c.execute("""select
 (select row_version from public.community_works where work_id=%s),
 (select current_published_revision_id from public.community_works where work_id=%s),
 (select count(*) from public.community_work_revisions where work_id=%s),
 (select count(*) from public.outbox_events where aggregate_id=%s),
 (select count(*) from public.idempotency_keys where account_id=%s),
 (select count(*) from public.audit_events where target_entity_id=%s),
 (select count(*) from public.work_revision_media rm join public.community_work_revisions r on r.revision_id=rm.work_revision_id where r.work_id=%s),
 (select count(*) from public.gallery_photo_revision_fields f join public.community_work_revisions r on r.revision_id=f.revision_id where r.work_id=%s)
 """,(work,work,work,work,account,work,work,work)).fetchone())
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert one(a,"select count(*) from supabase_migrations.schema_migrations")==133
 assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
 owner,auth,other,otherauth,creator,gallery,rev1,rev2,sub,m1,m2,preset_work,artifact=(U() for _ in range(13))
 with a.transaction():
  for acc,subject in ((owner,auth),(other,otherauth)):
   a.execute("insert into public.wand_accounts(account_id) values(%s)",(acc,))
   a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
       values(%s,'supabase',%s,clock_timestamp(),'active')""",(acc,str(subject)))
  for eid,typ in ((creator,"creator_profile"),(gallery,"community_work"),
                  (m1,"media_asset"),(m2,"media_asset"),(preset_work,"community_work"),
                  (artifact,"preset_artifact")):
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(eid,typ))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'R17 independent preflight')",
    (creator,owner,"r17_pf_"+U().hex[:16]))
  a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
        values(%s,%s,%s,'gallery','public','clear')""",(gallery,owner,creator))
  a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(gallery,))
  a.execute("""insert into public.gallery_verified_subjects(
        subject_id,gallery_kind,subject_type,canonical_target_id,
        platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
        values(%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',
               624,'r17-isolated-controlled-metadata','verified')""",(sub,"synthetic-"+U().hex))
  a.execute("insert into public.gallery_photo_subjects(work_id,subject_id,owner_account_id,creator_profile_id) values(%s,%s,%s,%s)",(gallery,sub,owner,creator))
  for media,key,sha in ((m1,"current-and-history","a"*64),(m2,"current-only","b"*64)):
   a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
      byte_size,width,height,checksum_sha256,processing_state,moderation_state)
      values(%s,%s,%s,'image/png',1024,16,16,%s,'ready','clear')""",
      (media,owner,"ci-only/r17-pref-"+key+"-"+U().hex+".png",sha))
  for rev,num,medias,cover in ((rev1,1,[(m1,0)],m1),
                              (rev2,2,[(m1,0),(m2,1)],m2)):
   a.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
        values(%s,%s,%s,%s)""",(rev,gallery,num,owner))
   a.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,%s)",(rev,"R17 historical" if num==1 else "R17 current"))
   for media,ordinal in medias:
    a.execute("""insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
                 values(%s,%s,%s,'gallery')""",(rev,media,ordinal))
   a.execute("""insert into public.gallery_photo_revision_fields(revision_id,subject_id,cover_media_id,originality_attested)
               values(%s,%s,%s,true)""",(rev,sub,cover))
  a.execute("""update public.community_works set lifecycle_state='published',
     current_published_revision_id=%s,published_at=now() where work_id=%s""",(rev2,gallery))
  a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
        values(%s,%s,%s,'preset','private','clear')""",(preset_work,owner,creator))
  a.execute("""insert into public.preset_artifacts(
     preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,
     preset_type,associated_gallery_work_id) values(%s,%s,%s,%s,'scene',%s)""",
     (artifact,owner,creator,preset_work,gallery))
 snap0=state(a,gallery,owner)
 # No new positive authorization: this SQL is service-only and always returns
 # explicit blocked flags. The unsupported direct Scene edge must be counted.
 v=query(a,auth,gallery)
 assert v["schemaVersion"]==1 and v["contract"]=="ddv.gallery-photo-media-readonly@r17"
 assert v["workId"]==str(gallery)
 assert v["rowVersion"]==snap0[0] and v["currentPublishedRevisionId"]==str(rev2)
 assert len(v["workRevisions"])==2
 assert len(v["mediaReferences"])==3 and len(v["coverReferences"])==2
 assert v["knownDependencyCounts"]["directPresetArtifacts"]==1
 assert v["knownDependencyCounts"]["historicalGalleryRevisionPresets"]==0
 assert v["knownDependencyCounts"]["mediaReferences"]==3
 assert v["knownDependencyCounts"]["unreadyOrForeignMediaReferences"]==0
 for key in ("actualStorageBytesVerified","metadataSha256IsStorageProof",
             "priorSignedUrlsRevoked","cdnBrowserPurgeProven",
             "storageIssuerGraphComplete","graphComplete","mutationAuthorized",
             "saveRevisionAuthorized","pairedGalleryPublishAuthorized",
             "retirementAuthorized","physicalCleanupAuthorized"):
  assert v[key] is False,(key,v.get(key))
 assert v["snapshotNotAtomicMutationFence"] is True
 assert "PHOTO_SCENE_DEPENDENCY_NOT_ENROLLED" in v["blockedReasons"]
 assert not any(x in str(v) for x in ("ci-only/","storageKey","signedUrl","uploadToken"))
 assert state(a,gallery,owner)==snap0
 print(json.dumps({"case":"R17_ACTUAL_OWNER133_PREFLIGHT_HISTORY_MEDIA_COVER_AND_SCENE",
   "revisions":2,"mediaReferences":3,"coverReferences":2,
   "directSceneDetected":True,"noStoragePathOrToken":True,
   "allWriteAuthorizationFalse":True,"sideEffectsNone":True}))
 try:query(b,otherauth,gallery)
 except psycopg.Error as e:assert "R17_PHOTO_PREFLIGHT_FORBIDDEN" in str(e),str(e)
 else:raise AssertionError("NON_OWNER_READ_ALLOWED")
 assert one(a,"select has_function_privilege('authenticated','public.community_gallery_photo_media_preflight_r17(uuid,uuid)','EXECUTE')") is False
 assert state(a,gallery,owner)==snap0
 print(json.dumps({"case":"R17_ACTUAL_OWNER133_PREFLIGHT_NONOWNER_DIRECT_ACL",
   "nonOwnerDenied":True,"authenticatedDirectRpcDenied":True,"noSideEffects":True}))
 # MVCC under a second session's held target Gallery Work: read-only preflight
 # must not claim this was an atomic whole-graph mutation fence.
 a.execute("BEGIN")
 one(a,"select work_id from public.community_works where work_id=%s for update",(gallery,))
 b.execute("SET statement_timeout='2500ms'")
 read_locked=query(b,auth,gallery)
 assert read_locked["snapshotNotAtomicMutationFence"] is True
 a.execute("ROLLBACK")
 assert state(a,gallery,owner)==snap0
 print(json.dumps({"case":"R17_ACTUAL_OWNER133_PREFLIGHT_NOT_LOCKED_WRITER_FENCE",
    "twoSessions":True,"readDuringHeldWorkLock":True,"notAtomicFence":True,"noSideEffects":True}))
 # Observation gap: current cover remains attached, but is not first in media
 # order; the SQL returns coverFirst:false yet its inconsistency counter does
 # not include ordinal != 0. This may be a useful Owner P1 correction.
 current=next(x for x in v["coverReferences"] if x["isCurrent"])
 assert current["coverInRevisionMedia"] is True
 assert current["coverFirst"] is False
 assert v["knownDependencyCounts"]["coverSubjectOrReferenceMismatch"]==1
 assert "MEDIA_COVER_METADATA_INCONSISTENT" in v["blockedReasons"]
 print(json.dumps({"case":"R17_OWNER133_COVER_ORDINAL_INCONSISTENCY_FIXED",
    "currentCoverFirst":False,"currentCoverPresentInRevision":True,
    "coverMismatchCount":1,"mediaCoverInconsistencyReasonPresent":True,
    "classification":"CONFIRMED_SOURCE_READONLY_OBSERVER_FIX_NOT_WRITER_PERMISSION"}))
 print(json.dumps({"result":"09INT_R17_OWNER133_COVER_ORDINAL_REAL_SQL_FIX_ACCEPTED",
    "ownerPin":"f3918b18c546087202d5118e741547b42fa55b28",
    "signedJWT":False,"realStorageBytes":False,"allWriterEnrolled":False}))
