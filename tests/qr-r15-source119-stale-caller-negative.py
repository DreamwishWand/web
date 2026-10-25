#!/usr/bin/env python3
"""04 QR R15 independent optimistic caller-graph NEGATIVE baseline.
Reuse *only* proven Source119 SQL fixture creation; own assertions and actual v4 calls.
Uses real SQL on disposable local Supabase; NOT signed JWT or Release PASS.
"""
import json,os,uuid,hashlib,psycopg

assert os.getenv("DDVRE_QR_R15_ISOLATED_LOCAL")=="CONFIRMED"
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
        ) values(%s,%s,%s,%s)""",(creator,owner,"isolated_qr15_"+uuid.uuid4().hex[:12],"R14 Local Test Creator"))
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

def graph(c,work):
    v=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(work,[g["presetRev"]]))
    assert v["registry"]=="gallery-scene-scoped@r14"
    assert str(g["artifact"]) in v["artifactIds"]
    digest=hashlib.sha256(json.dumps(v,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    return v,digest

def actual_publish(c,target,version,key):
    return one(c,"""select public.community_publish_gallery_v4(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],target,version,"QR R15 real actual Gallery v4",
       "independent Source119 caller optimistic graph check",
       [g["media"]],[g["presetRev"]],[],[],None,key))

# Establish second, different Gallery A target. The existing seeded Gallery target
# is B. A's publication, not a direct SQL history-row insert, changes B's graph.
with psycopg.connect(dsn,autocommit=True,connect_timeout=4) as c:
    gallery_a=uuid.uuid4()
    c.execute("begin")
    try:
        execsql(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(gallery_a,))
        execsql(c,"""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'gallery','public','clear')""",(gallery_a,g["owner"],g["creator"]))
        execsql(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(gallery_a,))
        execsql(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(gallery_a,))
        c.execute("commit")
    except:
        c.execute("rollback")
        raise
    gallery_a_version=one(c,"select row_version from public.community_works where work_id=%s",(gallery_a,))
    prior_b=state(c,g["target"],"qr15-B")
    assert prior_b[:4]==(0,0,0,0),prior_b

with psycopg.connect(dsn,autocommit=True,connect_timeout=4) as session_a,psycopg.connect(dsn,autocommit=True,connect_timeout=4) as session_b:
    assert one(session_a,"select pg_backend_pid()")!=one(session_b,"select pg_backend_pid()")
    pre_graph,pre_sha=graph(session_b,g["target"])
    b_row_before=state(session_b,g["target"],"qr15-B")[4]
    assert b_row_before==g["version"]

    # Gallery A genuine Source119 writer commits a history edge for shared Scene.
    session_a.execute("begin")
    result_a=actual_publish(session_a,gallery_a,gallery_a_version,"qr15-A")
    assert result_a.get("revisionId"),result_a
    session_a.execute("commit")
    assert state(session_a,gallery_a,"qr15-A")[:4]==(1,1,1,1)

    post_graph,post_sha=graph(session_b,g["target"])
    assert pre_sha!=post_sha,"GRAPH_BEFORE_AFTER_NOT_CHANGED"
    assert state(session_b,g["target"],"qr15-B")[:4]==(0,0,0,0)
    assert state(session_b,g["target"],"qr15-B")[4]==b_row_before
    historical_a=one(session_b,"""select count(*) from public.gallery_revision_presets p
      join public.community_work_revisions r on r.revision_id=p.gallery_revision_id
      where r.work_id=%s and p.preset_revision_id=%s""",(gallery_a,g["presetRev"]))
    assert historical_a>=1
    # There is deliberately no expectedGraphSha256 arg to the real Source119 v4:
    # B carries original unchanged rowVersion but historical caller graph is OLD.
    session_b.execute("begin")
    result_b=actual_publish(session_b,g["target"],b_row_before,"qr15-B")
    assert result_b.get("revisionId"),result_b
    session_b.execute("commit")
    assert state(session_b,g["target"],"qr15-B")[:4]==(1,1,1,1)
    assert actual_publish(session_b,g["target"],b_row_before,"qr15-B")==result_b
    assert state(session_b,g["target"],"qr15-B")[:4]==(1,1,1,1)

print(json.dumps({
  "case":"QR_R15_ACTUAL_SOURCE119_STALE_CALLER_ACCEPTED_SECURITY_FAIL_REPRODUCED",
  "classification":"SOURCE_SECURITY_NEGATIVE_FAIL_NOT_RELEASE_PASS",
  "ownerSource":"7414e0666a2afa55709b874d3e2dee5fbd970df9",
  "migrations":119,
  "actualRpc":"public.community_publish_gallery_v4",
  "twoDistinctPostgresSessions":True,
  "differentGalleryWorksShareOneScene":True,
  "historicalGraphShaBefore":pre_sha,
  "historicalGraphShaAfter":post_sha,
  "bTargetRowVersionUnchangedBeforeCommit":True,
  "oldCallerGraphAccepted":True,
  "aAndBRevisionsSearchOutboxIdempotency":(1,1,1,1),
  "bReplayStable":True,
  "signedJwtStaging":False,"globalGraphComplete":False,
  "ownerSourceModified":False
},sort_keys=True))
