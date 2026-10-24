#!/usr/bin/env python3
"""09 INT R15 independent owner119 REAL SQL Gallery v4 cross-Gallery contention.

Strictly disposable local PostgreSQL after all 119 actual source migrations.
No Python pre-lock wrapper. No R11/R12/R13/R14 replay. Synthetic identity only.
Tests two actual Gallery RPC publications sharing a SINGLE known Scene Artifact
but DIFFERENT target Gallery Work, and stale preflight graph across commits.
"""
import importlib.util,json,sys,uuid
from pathlib import Path
import psycopg
p=Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py")
sp=importlib.util.spec_from_file_location("r15_fixture_cross",p)
f=importlib.util.module_from_spec(sp);sys.modules[sp.name]=f;sp.loader.exec_module(f)
url=f.local_dsn()
def one(c,sql,args=()):return f.one(c,sql,args)[0]
def ex(c,sql,args=()):return f.execute(c,sql,args)

def draft(c,g):
    wid=uuid.uuid4()
    owner,creator=f.one(c,"select owner_account_id,creator_profile_id from public.community_works where work_id=%s",(g["galleryWork"],))
    c.execute("BEGIN")
    try:
        ex(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(wid,))
        ex(c,"""insert into public.community_works(work_id,owner_account_id,creator_profile_id,
             work_type,visibility,moderation_state) values(%s,%s,%s,'gallery','public','clear')""",
           (wid,owner,creator))
        ex(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(wid,))
        ex(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(wid,))
        c.execute("COMMIT")
    except:
        c.execute("ROLLBACK")
        raise
    return {"work":wid,"version":one(c,"select row_version from public.community_works where work_id=%s",(wid,))}

def execute_actual(c,g,draft,key):
    return one(c,"""select public.community_publish_gallery_v4(
        %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],draft["work"],draft["version"],"R15 actual two Gallery writers",
       "one shared Scene Artifact; synthetic evidence only",
       [g["oldMedia"]],[g["presetRev"]],[],[],None,key))

def state(c,draft,key):
    return f.one(c,"""select
       (select count(*) from public.community_work_revisions where work_id=%s),
       (select count(*) from public.search_documents where work_id=%s),
       (select count(*) from public.outbox_events where aggregate_id=%s),
       (select count(*) from public.idempotency_keys where idempotency_key=%s),
       (select current_published_revision_id from public.community_works where work_id=%s),
       (select row_version from public.community_works where work_id=%s)""",
       (draft["work"],draft["work"],draft["work"],key,draft["work"],draft["work"]))

def same_scope(c,g,work):
    snap=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(work,[g["presetRev"]]))
    assert snap["registry"]=="gallery-scene-scoped@r14"
    assert len(snap["artifactIds"])==1 and snap["artifactIds"][0]==str(g["artifact"]),snap["artifactIds"]
    return snap

def main():
    with psycopg.connect(url,autocommit=True) as seed:
        g=f.fixture(seed)
        a=draft(seed,g)
        b=draft(seed,g)
        owner=one(seed,"select owner_account_id from public.community_works where work_id=%s",(g["presetWork"],))
        original_b_snapshot=same_scope(seed,g,b["work"])
        original_b_state=state(seed,b,"r15-shared-scene-B")
        assert original_b_state[0]==original_b_state[1]==original_b_state[2]==original_b_state[3]==0
        assert one(seed,"select private.resolve_active_account(%s)",(g["auth"],))==owner
    with psycopg.connect(url,autocommit=True) as x,psycopg.connect(url,autocommit=True) as y:
        assert one(x,"select pg_backend_pid()")!=one(y,"select pg_backend_pid()")
        xa=state(x,a,"r15-shared-scene-A")
        x.execute("BEGIN")
        try:
            positive_a=execute_actual(x,g,a,"r15-shared-scene-A")
            assert positive_a.get("revisionId"),positive_a
            assert one(x,"select current_published_revision_id from public.community_works where work_id=%s",(a["work"],))==uuid.UUID(positive_a["revisionId"])
            assert state(y,a,"r15-shared-scene-A")==xa,"R15_A_UNCOMMITTED_STATE_VISIBLE"
            y.execute("BEGIN")
            y.execute("SET LOCAL lock_timeout='800ms'")
            try:
                try:
                    execute_actual(y,g,b,"r15-shared-scene-B")
                    raise AssertionError("R15_OWNER119_CROSS_GALLERY_SHARED_ARTIFACT_BYPASS")
                except psycopg.Error as err:
                    assert err.sqlstate=="55P03",("R15_SOURCE_LOCK_MISSING",err.sqlstate,str(err))
            finally:
                y.execute("ROLLBACK")
            assert state(y,b,"r15-shared-scene-B")==original_b_state
            x.execute("COMMIT")
        except:
            x.execute("ROLLBACK")
            raise
        after_a=same_scope(y,g,b["work"])
        assert original_b_snapshot!=after_a,"R15_SHARED_ARTIFACT_HISTORY_NOT_DETECTED"
        assert one(y,"select row_version from public.community_works where work_id=%s",(b["work"],))==b["version"]
        assert state(y,b,"r15-shared-scene-B")==original_b_state
        # The caller's original Graph snapshot has become stale even though
        # Gallery B's version is unchanged. Current source has no caller
        # expectedGraphSha256 argument and therefore admits B's stale request.
        y.execute("BEGIN")
        try:
            positive_b=execute_actual(y,g,b,"r15-shared-scene-B")
            assert positive_b.get("revisionId"),positive_b
            y.execute("COMMIT")
        except:
            y.execute("ROLLBACK")
            raise
        for draft_item,key in ((a,"r15-shared-scene-A"),(b,"r15-shared-scene-B")):
            counts=state(y,draft_item,key)
            assert counts[:4]==(1,1,1,1),("R15_PARTIAL_IDEMPOTENCY_OR_SEARCH",counts)
            assert counts[4] is not None and counts[5]>draft_item["version"]
        replay=execute_actual(y,g,b,"r15-shared-scene-B")
        assert replay==positive_b,"R15_IDEMPOTENCY_RESPONSE_CHANGED"
        assert state(y,b,"r15-shared-scene-B")[:4]==(1,1,1,1)
        print(json.dumps({
           "case":"R15_ACTUAL_OWNER119_CROSS_GALLERY_SHARED_SCENE_SERIALIZATION",
           "sourceRpc":"public.community_publish_gallery_v4",
           "twoSeparatePostgresBackends":True,
           "sharedActualPresetArtifact":True,
           "differentTargetGalleryWorks":True,
           "secondContenderSqlstate":"55P03",
           "secondFailedTransactionNoResidualChanges":True,
           "firstSourcePublishCommittedLocally":True,
           "secondSourcePublishCommittedInNewTransactionLocally":True,
           "sourceIdempotencyAndSearchAndOutboxExactlyOnceEach":True,
           "secondGalleryWorkRowVersionUnchangedBeforeSecondCommit":True,
           "historicalGraphChangedBeforeSecondCommit":True,
           "sourceCallerExpectedGraphPinAbsent":True,
           "sourceAcceptedStaleCaller":True,
           "fullGraphComplete":False,"retirementAuthorized":False
        }))
    print(json.dumps({
      "result":"R15_SOURCE119_REAL_CROSS_GALLERY_SHARED_ARTIFACT_PASS_WITH_CALLER_STALE_NEGATIVE",
      "ownerSourcePinned":"7414e0666a2afa55709b874d3e2dee5fbd970df9",
      "migrations":119,
      "realSignedStaging":False,"fullAllWriterEnrollment":False,
      "productionRetryTested":False,"originalOwnerDraftModified":False
    }))

if __name__=="__main__":main()
