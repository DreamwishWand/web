#!/usr/bin/env python3
"""09 INT R17 NEW Writer Gap: actual Gallery Photo update vs direct Scene Artifact.

This deliberately DOES NOT rerun prior Gallery pinned H0/H1/replay tests.
PostgreSQL source calls only, fabricated owner/media/subject in disposable local DB.
A source-accepted update during a held related Artifact proves non-enrollment;
this is a NEGATIVE security counterexample, NOT positive publication approval.
"""
import os,uuid,json
import psycopg

assert os.getenv("DDVRE_R17_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
def execsql(c,q,args=()):return c.execute(q,args)

def main():
  with psycopg.connect(DSN,autocommit=True) as a, psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==124
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    owner,auth,creator,media,subject=(uuid.uuid4() for _ in range(5))
    token=uuid.uuid4().hex
    with a.transaction():
      execsql(a,"insert into public.wand_accounts(account_id) values(%s)",(owner,))
      execsql(a,"""insert into public.auth_identities(
         account_id,provider,provider_subject,last_verified_at,identity_state)
         values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(auth)))
      for eid,etype in ((creator,"creator_profile"),(media,"media_asset")):
        execsql(a,"insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(eid,etype))
      execsql(a,"""insert into public.creator_profiles(
        creator_profile_id,owner_account_id,handle,display_name)
        values(%s,%s,%s,%s)""",(creator,owner,"r17_photo_"+token[:12],"R17 disposable"))
      execsql(a,"""insert into public.media_assets(
         media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
         checksum_sha256,processing_state,moderation_state)
         values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
        (media,owner,"ci-only/r17-"+token+".png","e"*64))
      execsql(a,"""insert into public.gallery_verified_subjects(
         subject_id,gallery_kind,subject_type,canonical_target_id,platform,game_version,
         build_id,profile_schema,evidence_ref,verification_state)
         values(%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',
                624,%s,'verified')""",
         (subject,"r17_"+token,"synthetic-fixture-"+token))
    def photo(c,work,ver,key,title):
      return one(c,"""select public.community_publish_gallery_photo_v1(
        %s,%s,%s,%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s)""",
        (auth,creator,work,ver,"outdoor",subject,title,
         "synthetic no real media bytes",[media],media,True,key))
    first=photo(a,None,None,"r17-photo-create-"+token,"R17 Initial Gallery Photo")
    gallery=uuid.UUID(first["workId"])
    version=one(a,"select row_version from public.community_works where work_id=%s",(gallery,))
    assert one(a,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions cr on cr.revision_id=gp.gallery_revision_id where cr.work_id=%s",(gallery,))==0
    artifact,preset_work,blob,preset_rev=(uuid.uuid4() for _ in range(4))
    with a.transaction():
      for eid,etype in ((artifact,"preset_artifact"),(preset_work,"community_work")):
        execsql(a,"insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(eid,etype))
      execsql(a,"""insert into public.community_works(
         work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
         values(%s,%s,%s,'preset','public','clear')""",
         (preset_work,owner,creator))
      execsql(a,"""insert into public.artifact_blobs(
         blob_id,owner_account_id,storage_key,schema_version,content_type,
         byte_size,checksum_sha256) values(%s,%s,%s,1,'application/json',128,%s)""",
         (blob,owner,"ci-only/r17-blob-"+token+".json","a"*64))
      execsql(a,"""insert into public.preset_artifacts(
        preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,
        preset_type,associated_gallery_work_id) values(%s,%s,%s,%s,'scene',%s)""",
        (artifact,owner,creator,preset_work,gallery))
      execsql(a,"""insert into public.preset_revisions(
        preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
        metadata,created_by_account_id) values(%s,%s,1,%s,'{}'::jsonb,%s)""",
        (preset_rev,artifact,blob,owner))
    assert one(a,"select count(*) from public.preset_artifacts where associated_gallery_work_id=%s",(gallery,))==1
    assert one(b,"select row_version from public.community_works where work_id=%s",(gallery,))==version
    before=tuple(b.execute("""select
       (select count(*) from public.community_work_revisions where work_id=%s),
       (select count(*) from public.search_documents where work_id=%s),
       (select count(*) from public.outbox_events where aggregate_id=%s),
       (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s),
       (select current_published_revision_id from public.community_works where work_id=%s)
    """,(gallery,gallery,gallery,owner,"r17-photo-edit-"+token,gallery)).fetchone())
    # A locks ONLY the direct Scene Artifact. The Photo RPC must participate
    # in this dependency graph or fail closed; no existing GalleryRevisionPreset.
    a.execute("BEGIN")
    try:
      one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(artifact,))
      b.execute("set statement_timeout='4000ms'")
      try:
        output=photo(b,gallery,version,"r17-photo-edit-"+token,"R17 Photo after Scene association")
      except psycopg.Error as e:
        b_error={"sqlstate":e.sqlstate,"message":str(e).splitlines()[0]}
        output=None
    finally:
      a.execute("ROLLBACK")
    after=tuple(a.execute("""select
       (select count(*) from public.community_work_revisions where work_id=%s),
       (select count(*) from public.search_documents where work_id=%s),
       (select count(*) from public.outbox_events where aggregate_id=%s),
       (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s),
       (select current_published_revision_id from public.community_works where work_id=%s)
    """,(gallery,gallery,gallery,owner,"r17-photo-edit-"+token,gallery)).fetchone())
    assert one(a,"select count(*) from public.preset_artifacts where associated_gallery_work_id=%s",(gallery,))==1
    if output is not None:
      # Expected counterexample. A writer touching a linked Gallery commits
      # without locking its Scene Artifact, despite its row being held by A.
      assert output["revisionId"],output
      assert after[0]==before[0]+1,(before,after)
      assert after[2]==before[2]+1,(before,after)
      assert after[3]==before[3]+1,(before,after)
      assert after[4]!=before[4]
      assert one(a,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions cr on cr.revision_id=gp.gallery_revision_id where cr.work_id=%s",(gallery,))==0
      print(json.dumps({
        "result":"R17_ACTUAL_GALLERY_PHOTO_DIRECT_ASSOCIATION_BYPASS_REPRODUCED",
        "ownerSource":"41fbbaf6aba8326fe9935955879218f8b9c35a91",
        "twoIndependentPostgresConnections":True,
        "syntheticValidSceneArtifactWithRevisionDirectlyAssociated":True,
        "historicalPresetRevisionEdgeCount":0,
        "heldDirectSceneArtifactRowDuringPhotoUpdate":True,
        "photoWriterCommittedRevisionOutboxIdempotency":True,
        "sourceAllWriterEnrolled":False,"publicLaunchAuthorized":False,
        "sourceEvidenceClass":"NEGATIVE_COUNTEREXAMPLE_NOT_RELEASE_PASS"
      },sort_keys=True))
    else:
      print(json.dumps({
        "result":"R17_GALLERY_PHOTO_DIRECT_ASSOCIATION_FAIL_CLOSED",
        "ownerSource":"41fbbaf6aba8326fe9935955879218f8b9c35a91",
        "sqlError":b_error,
        "noPartialState":before==after,"sourceAllWriterEnrolled":False,
        "sourceEvidenceClass":"SOURCE_NEGATIVE_LOCAL"
      },sort_keys=True))
      assert before==after,(before,after)

if __name__=="__main__": main()
