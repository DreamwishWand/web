#!/usr/bin/env python3
"""04 QR R15 independent optimistic caller-graph NEGATIVE baseline.
Reuse *only* proven Source124 SQL fixture creation; own assertions and actual v4 calls.
Uses real SQL on disposable local Supabase; NOT signed JWT or Release PASS.
"""
import json,os,uuid,hashlib,psycopg

assert os.getenv("DDVRE_QR_R15_FIXED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL")
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def one(c,q,args=()):
    return c.execute(q,args).fetchone()[0]
def execsql(c,q,args=()):
    return c.execute(q,args)
def gallery_rpc(c,g,key="r14-source",expected=None):
    return one(c,"""select public.community_publish_gallery_v4(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],g["target"],g["version"] if expected is None else expected,
       "R14 Source Actual Gallery","atomic source integration",
       [g["media"]],[g["presetRev"]],[],[],None,key))

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
        ) values(%s,%s,%s,%s)""",(creator,owner,"isolated_qr15fixed_"+uuid.uuid4().hex[:12],"R14 Local Test Creator"))
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


def state(c,w,key):
    return tuple(c.execute("""select
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.search_documents where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where idempotency_key=%s),
      (select row_version from public.community_works where work_id=%s)""",
      (w,w,w,key,w)).fetchone())

def preflight(c,w):
    pin=one(c,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
            (g["auth"],w,[g["presetRev"]]))
    assert pin["registryVersion"]=="gallery-scene-scoped@r15",pin
    assert pin["schemaVersion"]==1,pin
    assert len(pin["expectedGraphSha256"])==64,pin
    return pin

def pinned(c,w,ver,pin,key):
    return one(c,"""select public.community_publish_gallery_pinned_r15(
       %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
      (g["auth"],w,ver,"QR R15 independent pinned test",
       "Local QA only; no media bytes",
       [g["media"]],[g["presetRev"]],[],[],None,key,pin))

def denied(c,fragment,call):
    try:
        call()
    except psycopg.Error as e:
        assert fragment in str(e),(fragment,e.sqlstate,str(e))
        return e.sqlstate
    raise AssertionError("SECURITY_NEGATIVE_ACCEPTED_"+fragment)

with psycopg.connect(dsn,autocommit=True,connect_timeout=4) as seed:
    gallery_a=uuid.uuid4()
    seed.execute("begin")
    try:
        execsql(seed,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(gallery_a,))
        execsql(seed,"""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'gallery','public','clear')""",(gallery_a,g["owner"],g["creator"]))
        execsql(seed,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(gallery_a,))
        execsql(seed,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(gallery_a,))
        seed.execute("commit")
    except:
        seed.execute("rollback")
        raise
    a_version=one(seed,"select row_version from public.community_works where work_id=%s",(gallery_a,))
    b_version=g["version"]
    old_b_state=state(seed,g["target"],"qr15fixed-b")
    assert old_b_state[:4]==(0,0,0,0)
    # Legacy 11-arg Scene graph route MUST fail closed.
    denied(seed,"R15_PINNED_GRAPH_REQUIRED",lambda:gallery_rpc(seed,g,key="qr15fixed-legacy"))
    assert state(seed,g["target"],"qr15fixed-b")==old_b_state

with psycopg.connect(dsn,autocommit=True,connect_timeout=4) as session_a,psycopg.connect(dsn,autocommit=True,connect_timeout=4) as session_b:
    assert one(session_a,"select pg_backend_pid()")!=one(session_b,"select pg_backend_pid()")
    pin_b_old=preflight(session_b,g["target"])
    pin_a=preflight(session_a,gallery_a)
    result_a=pinned(session_a,gallery_a,a_version,pin_a["expectedGraphSha256"],"qr15fixed-a")
    assert result_a["revisionId"]
    assert state(session_a,gallery_a,"qr15fixed-a")[:4]==(1,1,1,1)
    pin_b_new=preflight(session_b,g["target"])
    assert pin_b_old["expectedGraphSha256"]!=pin_b_new["expectedGraphSha256"],"NO_SHARED_HISTORY_DELTA"
    assert state(session_b,g["target"],"qr15fixed-b")[4]==b_version
    before=state(session_b,g["target"],"qr15fixed-b")
    denied(session_b,"R15_STALE_GRAPH_TERMINAL",
           lambda:pinned(session_b,g["target"],b_version,pin_b_old["expectedGraphSha256"],"qr15fixed-stale"))
    assert state(session_b,g["target"],"qr15fixed-stale")==before

    # Force contention on a historically linked OTHER gallery work (not target B).
    session_a.execute("begin")
    one(session_a,"select work_id from public.community_works where work_id=%s for update",(gallery_a,))
    session_b.execute("begin")
    session_b.execute("set local lock_timeout='320ms'")
    try:
        denied(session_b,"could not obtain lock",
            lambda:pinned(session_b,g["target"],b_version,pin_b_new["expectedGraphSha256"],"qr15fixed-held"))
        session_b.execute("rollback")
    finally:
        session_a.execute("rollback")
    assert state(session_b,g["target"],"qr15fixed-held")==before
    # Fresh entire independent transaction with ORIGINAL client new pin may succeed.
    success=pinned(session_b,g["target"],b_version,pin_b_new["expectedGraphSha256"],"qr15fixed-b")
    assert success.get("revisionId")
    assert state(session_b,g["target"],"qr15fixed-b")[:4]==(1,1,1,1)
    assert pinned(session_b,g["target"],b_version,pin_b_new["expectedGraphSha256"],"qr15fixed-b")==success
    assert state(session_b,g["target"],"qr15fixed-b")[:4]==(1,1,1,1)
    replay_other_pin=preflight(session_b,g["target"])
    assert replay_other_pin["expectedGraphSha256"]!=pin_b_new["expectedGraphSha256"]
    denied(session_b,"R15_IDEMPOTENCY_REQUEST_CONFLICT",
           lambda:pinned(session_b,g["target"],b_version,replay_other_pin["expectedGraphSha256"],"qr15fixed-b"))
    assert state(session_b,g["target"],"qr15fixed-b")[:4]==(1,1,1,1)

    # Retire actor inside only a transaction, no permanent fixture role mutation.
    session_b.execute("begin")
    execsql(session_b,"update public.auth_identities set identity_state='retired' where provider='supabase' and provider_subject=%s",(str(g["auth"]),))
    denied(session_b,"Active AuthIdentity not found",
        lambda:pinned(session_b,g["target"],b_version,pin_b_new["expectedGraphSha256"],"qr15fixed-retired"))
    session_b.execute("rollback")

    # Actual Phase1 suppresses positive work independent of old media/Graph cleanup.
    session_b.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(g["auth"],))
    sid=uuid.uuid4()
    session_b.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(sid,g["auth"]))
    epoch=one(session_b,"select extract(epoch from clock_timestamp())::bigint")
    privacy=one(session_b,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",
                (g["auth"],sid,epoch))
    assert privacy["privacyState"]=="suppressed_cleanup_pending"
    denied(session_b,"ACCOUNT_PRIVACY_SUPPRESSED",
        lambda:pinned(session_b,g["target"],b_version,pin_b_new["expectedGraphSha256"],"qr15fixed-suppressed"))
    assert state(session_b,g["target"],"qr15fixed-b")[0]==1
    assert state(session_b,g["target"],"qr15fixed-suppressed")[3]==0
    # Staff restrict is safety independent, below is direct SQL only, not real role test.
    session_b.execute("begin")
    execsql(session_b,"update public.community_works set moderation_state='restricted' where work_id=%s",(g["target"],))
    assert one(session_b,"select moderation_state from public.community_works where work_id=%s",(g["target"],))=="restricted"
    session_b.execute("rollback")

print(json.dumps({"marker":"QR_R15_OWNER124_INDEPENDENT_PINNED_ACTUAL_SOURCE_PASS",
  "sourceHead":"59270c14c5615e706c6b2d08207df96b3d937f9d",
  "migrations":124,"twoDistinctPgBackends":True,"sameSceneDifferentGalleries":True,
  "staleExpectedGraphRejectedWithoutSideEffects":True,
  "freshPreflightAccepted":True,"idempotentReplay":True,
  "replayChangedPinDenied":True,"legacyUnpinnedSceneDenied":True,
  "historicalGalleryHeld55P03":True,
  "retiredActorDenied":True,"suppressedActorDenied":True,
  "emergencyRestrictDirectSqlOnly":True,"multiArtifactAndUnknownFacets":"NOT_EXECUTED",
  "edgeRetry40P01_40001":"NOT_EXECUTED",
  "realSignedJwtAndStorage":False,"globalGraphComplete":False},sort_keys=True))
