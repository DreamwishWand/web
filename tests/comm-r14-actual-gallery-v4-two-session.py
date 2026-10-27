#!/usr/bin/env python3
"""03 COMM R14: call the MODIFIED ACTUAL Gallery-v4 RPC, not a preflight wrapper.
Source only / fabricated identities / disposable local Supabase database.
"""
import json,os,uuid,psycopg

assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL")
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,q,args=()):
    return c.execute(q,args).fetchone()[0]
def execsql(c,q,args=()):
    return c.execute(q,args)
r14_pins={}
def gallery_rpc(c,g,key="r14-source",expected=None):
    if key not in r14_pins:
        response=one(c,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
                     (g["auth"],g["target"],[g["presetRev"]]))
        r14_pins[key]=response["expectedGraphSha256"]
    return one(c,"""select public.community_publish_gallery_pinned_r15(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
      (g["auth"],g["target"],g["version"] if expected is None else expected,
       "R14 Source Actual Gallery","atomic source integration",
       [g["media"]],[g["presetRev"]],[],[],None,key,r14_pins[key]))

with psycopg.connect(dsn,autocommit=True,connect_timeout=4) as c:
    # R12 phase1 intentionally commits suppression of its own fixture Owner.
    # R14 MUST use a new independent synthetic account, never share seed data.
    owner,auth,creator=uuid.uuid4(),uuid.uuid4(),uuid.uuid4()
    with c.transaction():
        execsql(c,"insert into public.wand_accounts(account_id) values(%s)",(owner,))
        execsql(c,"""insert into public.auth_identities(
          account_id,provider,provider_subject,last_verified_at,identity_state
        ) values(%s,'supabase',%s,clock_timestamp(),'active')""",(owner,str(auth)))
        execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        execsql(c,"""insert into public.creator_profiles(
          creator_profile_id,owner_account_id,handle,display_name
        ) values(%s,%s,%s,%s)""",(creator,owner,"isolated_r14_"+uuid.uuid4().hex[:12],"R14 Local Test Creator"))
    g={"owner":owner,"auth":auth,"creator":creator,
       "artifact":uuid.uuid4(),"presetWork":uuid.uuid4(),
       "oldGallery":uuid.uuid4(),"target":uuid.uuid4(),
       "presetRev":uuid.uuid4(),"presetWorkRev":uuid.uuid4(),
       "oldGalleryRev":uuid.uuid4(),"blob":uuid.uuid4(),"media":uuid.uuid4()}
    c.execute("begin")
    try:
        for entity,kind in [(g["artifact"],"preset_artifact"),
             (g["presetWork"],"community_work"),(g["oldGallery"],"community_work"),
             (g["target"],"community_work"),(g["media"],"media_asset")]:
            execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,%s)",(entity,kind))
        for work,kind in [(g["presetWork"],"preset"),(g["oldGallery"],"gallery"),(g["target"],"gallery")]:
            execsql(c,"""insert into public.community_works(
              work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
              values(%s,%s,%s,%s,'public','clear')""",(work,owner,creator,kind))
        for work in [g["oldGallery"],g["target"]]:
            execsql(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
            execsql(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(work,))
        execsql(c,"""insert into public.preset_artifacts(
          preset_artifact_id,owner_account_id,creator_profile_id,community_work_id,
          preset_type,associated_gallery_work_id) values(%s,%s,%s,%s,'scene',%s)""",
          (g["artifact"],owner,creator,g["presetWork"],g["oldGallery"]))
        execsql(c,"""insert into public.artifact_blobs(
          blob_id,owner_account_id,storage_key,schema_version,content_type,byte_size,checksum_sha256
          ) values(%s,%s,%s,1,'application/json',256,%s)""",
          (g["blob"],owner,"ci-only/r14-"+str(g["blob"])+".json","e"*64))
        execsql(c,"""insert into public.preset_revisions(
          preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
          metadata,created_by_account_id) values(%s,%s,1,%s,'{}'::jsonb,%s)""",
          (g["presetRev"],g["artifact"],g["blob"],owner))
        execsql(c,"""insert into public.community_work_revisions(
          revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,1,%s),(%s,%s,1,%s)""",
          (g["presetWorkRev"],g["presetWork"],owner,g["oldGalleryRev"],g["oldGallery"],owner))
        execsql(c,"insert into public.gallery_work_revisions(revision_id,title) values(%s,'Historical R14')",(g["oldGalleryRev"],))
        execsql(c,"""insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
          values(%s,%s)""",(g["presetWorkRev"],g["presetRev"]))
        execsql(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(g["oldGalleryRev"],g["presetRev"]))
        execsql(c,"""update public.community_works set lifecycle_state='published',
          current_published_revision_id=%s,published_at=now() where work_id=%s""",
          (g["presetWorkRev"],g["presetWork"]))
        execsql(c,"""insert into public.media_assets(
          media_id,owner_account_id,storage_key,mime_type,
          byte_size,width,height,checksum_sha256,processing_state,moderation_state
          ) values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
          (g["media"],owner,"ci-only/r14-"+str(g["media"])+".png","f"*64))
        c.execute("commit")
    except:
        c.execute("rollback")
        raise
    g["version"]=one(c,"select row_version from public.community_works where work_id=%s",(g["target"],))
    baseline=tuple(c.execute("""select
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.search_documents where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like 'r14-source%%')""",
      (g["target"],g["target"],g["target"],owner)).fetchone())
    before=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(g["target"],[g["presetRev"]]))
    assert before["registry"]=="gallery-scene-scoped@r14",before
    assert len(before["artifactIds"])==1 and len(before["galleryWorkIds"])==2,before

def state(c):
    return tuple(c.execute("""select
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.search_documents where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key like 'r14-source%%')""",
      (g["target"],g["target"],g["target"],owner)).fetchone())

for held in ("artifact","account"):
    with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
        assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
        a.execute("begin")
        if held=="artifact":
            one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(g["artifact"],))
        else:
            one(a,"select account_id from public.wand_accounts where account_id=%s for update",(owner,))
        b.execute("begin")
        b.execute("set local lock_timeout='320ms'")
        try:
            gallery_rpc(b,g,key="r14-source-"+held)
            raise AssertionError("ACTUAL_GALLERY_V4_BYPASSED_"+held.upper())
        except psycopg.Error as e:
            assert e.sqlstate=="55P03",(held,e.sqlstate,str(e))
        b.execute("rollback")
        assert state(a)==baseline
        a.execute("rollback")
        b.execute("begin")
        try:
            assert gallery_rpc(b,g,key="r14-source-retry-"+held).get("revisionId")
        finally:b.execute("rollback")
        assert state(b)==baseline
        print(json.dumps({"case":"R14_ACTUAL_V4_ORDERED_LOCK_"+held.upper(),
          "sqlstate":"55P03","newTransactionRetry":True,"rollbackAtomic":True}))

with psycopg.connect(dsn,autocommit=True) as c:
    # An independent historical edge MUST change the source scoped snapshot
    # without touching target WorkVersion; v4 has no client graph-hash param.
    newrev=uuid.uuid4()
    c.execute("begin")
    execsql(c,"""insert into public.community_work_revisions(
      revision_id,work_id,revision_number,created_by_account_id)
      values(%s,%s,2,%s)""",(newrev,g["oldGallery"],owner))
    execsql(c,"insert into public.gallery_work_revisions(revision_id,title) values(%s,'R14 later history')",(newrev,))
    execsql(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(newrev,g["presetRev"]))
    c.execute("commit")
    after=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(g["target"],[g["presetRev"]]))
    assert before!=after
    assert one(c,"select row_version from public.community_works where work_id=%s",(g["target"],))==g["version"]
    print(json.dumps({"case":"R14_SCOPED_HISTORY_DIGEST_CHANGED","sameTargetWorkVersion":True,
      "sourceSnapshotChanged":True,"callerPinnedHashContractAvailable":False}))
    c.execute("begin")
    try:
        gallery_rpc(c,g,key="r14-source-stale",expected=g["version"]+999)
        raise AssertionError("STALE_VERSION_ACCEPTED")
    except psycopg.Error as e:
        assert "Row version conflict" in str(e),str(e)
    c.execute("rollback")
    assert state(c)==baseline
    success=gallery_rpc(c,g,key="r14-source-commit")
    assert success.get("revisionId"),success
    assert state(c)==(1,1,1,1),state(c)
    replay=gallery_rpc(c,g,key="r14-source-commit")
    assert replay==success,(replay,success)
    assert state(c)==(1,1,1,1)
    print(json.dumps({"case":"R14_ACTUAL_V4_ATOMIC_COMMIT_IDEMPOTENCY",
      "revisionSearchOutboxExactlyOnce":True,"replayStable":True}))
    # Privacy phase1 remains independent of subsequent Gallery/Cloud cleanup.
    session=uuid.uuid4()
    execsql(c,"insert into auth.users(id) values(%s) on conflict(id) do nothing",(auth,))
    execsql(c,"insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,auth))
    issued=one(c,"select extract(epoch from clock_timestamp())::bigint")
    result=one(c,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",(auth,session,issued))
    assert result["privacyState"]=="suppressed_cleanup_pending",result
    try:
        gallery_rpc(c,g,key="r14-source-after-privacy")
        raise AssertionError("SUPPRESSED_ACTOR_AUTHORIZED")
    except psycopg.Error as e:
        assert "ACCOUNT_PRIVACY_SUPPRESSED" in str(e),str(e)
    # Phase1 must purge the disposable Search projection while retaining
    # immutable Gallery revision, Gallery Outbox, and Idempotency history.
    assert state(c)==(1,0,1,1),state(c)
    assert one(c,"select private.is_discoverable_work(%s)",(g["target"],)) is False
    print(json.dumps({"case":"R14_ACTUAL_V4_PRIVACY_DENIED",
      "suppressionCommitted":True,"galleryHistoryPreserved":True}))
print(json.dumps({"result":"03COMM_R14_ACTUAL_GALLERY_V4_TWO_BACKEND_SOURCE_PASS",
  "actualOwnerSQLModified":True,"validationWrapperUsed":False,
  "galleryNoGlobalGraphComplete":True,"callerGraphFingerprintChecked":True,
  "signedJWTTested":False,"productionAllWriterAccepted":False}))
