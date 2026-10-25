#!/usr/bin/env python3
"""03 COMM R15: shared-Scene caller Graph pin in actual SQL writer.
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


def preflight(c,work):
    return one(c,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
               (g["auth"],work,[g["presetRev"]]))
def pinned_publish(c,work,expected,sha,key):
    return one(c,"""select public.community_publish_gallery_pinned_r15(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
      (g["auth"],work,expected,"Shared Scene R15","Caller graph pin",
       [g["media"]],[g["presetRev"]],[],[],None,key,sha))
def b_state(c):
    return tuple(c.execute("""select
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.search_documents where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s
          and idempotency_key like 'r15-b%%')""",
      (g["target"],g["target"],g["target"],owner)).fetchone())
with psycopg.connect(dsn,autocommit=True) as c:
    # Legacy direct v4 must reject linked Scene, no unpinned bypass.
    try:
        gallery_rpc_legacy=one(c,"""select public.community_publish_gallery_v4(
          %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
          (auth,g["target"],g["version"],"legacy","fail closed",[g["media"]],
           [g["presetRev"]],[],[],None,"r15-legacy"))
        raise AssertionError("R15_LEGACY_SCENE_BYPASS")
    except psycopg.Error as e:
        assert "R15_PINNED_GRAPH_REQUIRED" in str(e),str(e)
    pinned_b=preflight(c,g["target"])
    pinned_a=preflight(c,g["oldGallery"])
    assert pinned_b["registryVersion"]=="gallery-scene-scoped@r15"
    assert pinned_b["schemaVersion"]==1
    assert len(pinned_b["expectedGalleryWorkIds"])==2
    b_version=g["version"]
    a_version=one(c,"select row_version from public.community_works where work_id=%s",(g["oldGallery"],))
    b_before=b_state(c)
    assert b_before==(0,0,0,0),b_before
    # Gallery A publishes the shared Scene, adding an immutable historical edge.
    a_response=pinned_publish(c,g["oldGallery"],a_version,pinned_a["expectedGraphSha256"],"r15-a-commit")
    assert a_response["revisionId"]
    fresh_b=preflight(c,g["target"])
    assert fresh_b["expectedGraphSha256"] != pinned_b["expectedGraphSha256"]
    assert one(c,"select row_version from public.community_works where work_id=%s",
               (g["target"],))==b_version
    try:
        pinned_publish(c,g["target"],b_version,pinned_b["expectedGraphSha256"],"r15-b-stale")
        raise AssertionError("R15_STALE_CALLER_GRAPH_ACCEPTED")
    except psycopg.Error as e:
        assert "R15_STALE_GRAPH_TERMINAL" in str(e),str(e)
    assert b_state(c)==b_before,b_state(c)
    print(json.dumps({"case":"R15_STALE_SHARED_SCENE_HISTORY_REJECTED",
       "targetRowVersionUnchanged":True,"noPartialState":True}))

# Historical linked GalleryWork is in the writer's deterministic lock roster.
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    a.execute("begin")
    one(a,"select work_id from public.community_works where work_id=%s for update",
        (g["oldGallery"],))
    b.execute("begin")
    b.execute("set local lock_timeout='320ms'")
    try:
        pinned_publish(b,g["target"],b_version,fresh_b["expectedGraphSha256"],"r15-b-lock")
        raise AssertionError("R15_HISTORICAL_GALLERY_WORK_LOCK_BYPASSED")
    except psycopg.Error as e:
        assert e.sqlstate=="55P03",(e.sqlstate,str(e))
    b.execute("rollback")
    a.execute("rollback")
    assert b_state(b)==b_before
    print(json.dumps({"case":"R15_HELD_HISTORICAL_GALLERYWORK_55P03",
                      "rollbackAtomic":True}))

with psycopg.connect(dsn,autocommit=True) as c:
    successful=pinned_publish(c,g["target"],b_version,fresh_b["expectedGraphSha256"],"r15-b-commit")
    assert successful["revisionId"]
    assert b_state(c)==(1,1,1,1),b_state(c)
    # Old already committed request must replay without refreshing its original pin.
    replay=pinned_publish(c,g["target"],b_version,fresh_b["expectedGraphSha256"],"r15-b-commit")
    assert replay==successful
    assert b_state(c)==(1,1,1,1)
    changed=preflight(c,g["target"])
    assert changed["expectedGraphSha256"] != fresh_b["expectedGraphSha256"]
    try:
        pinned_publish(c,g["target"],b_version,changed["expectedGraphSha256"],"r15-b-commit")
        raise AssertionError("R15_IDEMPOTENCY_MIXED_PIN_ACCEPTED")
    except psycopg.Error as e:
        assert "R15_IDEMPOTENCY_REQUEST_CONFLICT" in str(e),str(e)
    assert b_state(c)==(1,1,1,1)
    print(json.dumps({"case":"R15_FRESH_ONLY_AND_IDEMPOTENT_REPLAY",
      "freshCommit":True,"replaySamePin":True,"sameKeyChangedPinDenied":True,
      "revisionSearchOutboxExactlyOnce":True}))
print(json.dumps({"result":"03COMM_R15_PINNED_GALLERY_TWO_BACKEND_SOURCE_PASS",
  "realSourceWriter":True,"signedJWTTested":False,"allFacetsCovered":False,
  "storageBytesTested":False}))
