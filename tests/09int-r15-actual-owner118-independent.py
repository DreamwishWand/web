#!/usr/bin/env python3
"""09 INT R15 independent negative evidence: ACTUAL owner Source118 Gallery v4.

No wrapper, no altered Source SQL, no public roles, no JWT, no Staging.
Tests real owner SQL, held locks, historical caller-hash gap and multi-
Artifact Source hard denial in ephemeral local Supabase with 118 migrations.
"""
import importlib.util,json,sys,threading,time,uuid
from pathlib import Path
import psycopg
mod=importlib.util.spec_from_file_location("r15fixture118",Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py"))
f=importlib.util.module_from_spec(mod);sys.modules[mod.name]=f;mod.loader.exec_module(f)
url=f.local_dsn()
def one(c,q,p=()):return f.one(c,q,p)[0]
def ex(c,q,p=()):return f.execute(c,q,p)

def make_draft(c,g):
    d=uuid.uuid4();g["target"]=d
    owner,creator=f.one(c,"select owner_account_id,creator_profile_id from public.community_works where work_id=%s",(g["galleryWork"],))
    c.execute("BEGIN")
    try:
        ex(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(d,))
        ex(c,"""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          values(%s,%s,%s,'gallery','public','clear')""",(d,owner,creator))
        ex(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(d,))
        ex(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(d,))
        c.execute("COMMIT")
    except:c.execute("ROLLBACK");raise
    g["targetVersion"]=one(c,"select row_version from public.community_works where work_id=%s",(d,))

def invoke(c,g,name):
    return one(c,"""select public.community_publish_gallery_v4(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],g["target"],g["targetVersion"],"R15 actual owner Source118",
       "strictly synthetic local Source DB",[g["oldMedia"]],[g["presetRev"]],[],[],None,
       "r15-source118-"+name))

def state(c,g):
    return f.one(c,"""select
     (select count(*) from public.community_work_revisions where work_id=%s),
     (select count(*) from public.search_documents where work_id=%s),
     (select count(*) from public.outbox_events where aggregate_id=%s),
     (select current_published_revision_id from public.community_works where work_id=%s),
     (select row_version from public.community_works where work_id=%s)""",
     (g["target"],g["target"],g["target"],g["target"],g["target"]))

def lock_real_rpc(g,kind):
    with psycopg.connect(url,autocommit=True) as a,psycopg.connect(url,autocommit=True) as b:
        before=state(a,g)
        owner=one(a,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))
        apid=one(a,"select pg_backend_pid()");bpid=one(b,"select pg_backend_pid()")
        assert apid!=bpid
        a.execute("BEGIN")
        if kind=="artifact":
            one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",(g["artifact"],))
        elif kind=="account":
            one(a,"select account_id from public.wand_accounts where account_id=%s for update",(owner,))
        else:raise AssertionError(kind)
        result={}
        b.execute("BEGIN")
        b.execute("set local lock_timeout='750ms'")
        try:
            try:
                invoke(b,g,"lock-"+kind)
                raise AssertionError("R15_SOURCE118_LOCK_BYPASSED")
            except psycopg.Error as err:
                result["sqlstate"]=err.sqlstate
                assert err.sqlstate=="55P03",err
        finally:b.execute("ROLLBACK")
        assert state(a,g)==before
        a.execute("ROLLBACK")
        b.execute("BEGIN")
        try:
            assert invoke(b,g,"fresh-"+kind)["revisionId"]
        finally:b.execute("ROLLBACK")
        assert state(b,g)==before
        print(json.dumps({"case":"R15_ACTUAL_OWNER_SOURCE118_ORDERED_LOCK",
           "held":kind,"twoRealPGWriterSessions":True,"sqlstate":"55P03",
           "sourceMigrationInProductionWriter":True,
           "failedWholeTransactionRolledBack":True,
           "freshSourceCommandSucceededRollbackOnly":True}))

def historical_caller_gap(g):
    with psycopg.connect(url,autocommit=True) as c:
        before=state(c,g)
        current=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(g["target"],[g["presetRev"]]))
        assert current["registry"]=="gallery-scene-scoped@r14"
        assert len(current["artifactIds"])==1
        owner=one(c,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))
        newrev=uuid.uuid4()
        c.execute("BEGIN")
        try:
            n=one(c,"select coalesce(max(revision_number),0)+1 from public.community_work_revisions where work_id=%s",(g["galleryWork"],))
            ex(c,"""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                      values(%s,%s,%s,%s)""",(newrev,g["galleryWork"],n,owner))
            ex(c,"insert into public.gallery_work_revisions(revision_id,title) values(%s,'R15 independently added history')",(newrev,))
            ex(c,"insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",
               (newrev,g["presetRev"]))
            c.execute("COMMIT")
        except:c.execute("ROLLBACK");raise
        after=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(g["target"],[g["presetRev"]]))
        assert after!=current and state(c,g)==before
        # The same original Gallery v4 request carries ONLY target row_version
        # and NO expected graph digest. This must remain a NEGATIVE outcome:
        # source can execute after external historical graph changed.
        c.execute("BEGIN")
        try:
            result=invoke(c,g,"pre-history-stale-caller")
            assert result["revisionId"],result
            assert one(c,"select count(*) from public.community_work_revisions where work_id=%s",(g["target"],))==1
            print(json.dumps({"case":"R15_SOURCE118_STALE_HISTORICAL_CALLER_PIN_ABSENT",
               "ownerScopedGraphChanged":True,
               "targetWorkVersionUnchanged":True,
               "callerGraphFingerprintParamExists":False,
               "actualSourceGalleryV4AcceptedStaleClientRequest":True,
               "publicationCommitted":False,
               "allWriterGraphClosureAccepted":False}))
        finally:c.execute("ROLLBACK")
        assert state(c,g)==before

def multi_artifact_fail_closed(g):
    with psycopg.connect(url,autocommit=True) as c:
        g2=f.fixture(c)
        before=state(c,g)
        c.execute("BEGIN")
        try:
            ex(c,"update public.preset_artifacts set associated_gallery_work_id=%s where preset_artifact_id=%s",
               (g["target"],g2["artifact"]))
            c.execute("COMMIT")
        except:c.execute("ROLLBACK");raise
        snap=one(c,"select private.gallery_v4_scoped_graph_r14(%s,%s::uuid[])",(g["target"],[g["presetRev"]]))
        assert len(snap["artifactIds"])==2,(snap["artifactIds"],)
        c.execute("BEGIN")
        try:
            try:
                invoke(c,g,"multiple-artifacts")
                raise AssertionError("R15_MULTI_ARTIFACT_WRITER_UNEXPECTED_SUCCESS")
            except psycopg.Error as error:
                assert "R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED" in str(error),str(error)
        finally:c.execute("ROLLBACK")
        assert state(c,g)==before
        print(json.dumps({"case":"R15_ACTUAL_SOURCE118_MULTI_ARTIFACT_GRAPH_FAIL_CLOSED",
          "sourceGraphDetectedArtifacts":2,"sourceRpcDenied":True,
          "ownerSourceWriterPositiveEnrollment":False,
          "unchangedSourceCloudGuard":True}))

def main():
    with psycopg.connect(url,autocommit=True) as c:
        g=f.fixture(c);make_draft(c,g)
        assert one(c,"select private.resolve_active_account(%s)",(g["auth"],))
    for held in ("artifact","account"):lock_real_rpc(g,held)
    historical_caller_gap(g)
    multi_artifact_fail_closed(g)
    print(json.dumps({"result":"R15_ACTUAL_OWNER_SOURCE118_ATOMIC_COVERAGE_INDEPENDENT",
      "sourcePin":"f682fc17fa11b96f024f8fd3457bcfd99ce5eac1",
      "migrations":118,"realOwnerRpcSource":True,
      "knownSceneSourceScopedEnrolled":True,
      "callerGraphPinMissing":True,
      "multiArtifactFailClosed":True,
      "allWriterGraphComplete":False,
      "retirementAuthorized":False,"realSignedStaging":False}))

if __name__=="__main__":main()
