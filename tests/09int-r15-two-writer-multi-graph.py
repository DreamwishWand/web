#!/usr/bin/env python3
"""09 INT R15: actual source Gallery v4 across TWO Scene Artifacts and FOUR Galleries.

Independent local 115-source PostgreSQL only. No owner SQL changes or prior
R11-R14 test replay. Every publication is synthetic disposable local DB.
This is a COMPONENT-scoped registry, NOT a global all-kind authority.
"""
import hashlib,importlib.util,json,sys,threading,time,uuid
from pathlib import Path
import psycopg
s=importlib.util.spec_from_file_location("r15_fixture",Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py"))
f=importlib.util.module_from_spec(s);sys.modules[s.name]=f;s.loader.exec_module(f)
URL=f.local_dsn()
def one(c,q,p=()):return f.one(c,q,p)[0]
def execute(c,q,p=()):return f.execute(c,q,p)
def scan(c,groups):
    arts=sorted({g["artifact"] for g in groups},key=str)
    assert len(set(arts))==2
    records=c.execute("""select pa.preset_artifact_id,pa.owner_account_id,pa.creator_profile_id,
       pa.community_work_id,pa.associated_gallery_work_id,pa.preset_type
       from public.preset_artifacts pa where pa.preset_artifact_id=any(%s)
       order by pa.preset_artifact_id""",(arts,)).fetchall()
    assert len(records)==2 and all(str(r[5])=="scene" for r in records),"R15_REGISTRY_UNKNOWN_FACET_FAIL_CLOSED"
    owners={r[1] for r in records};assert len(owners)==1,"R15_CROSS_OWNER_NOT_AUTHORIZED"
    ps=sorted({r[3] for r in records},key=str)
    edges=c.execute("""select wr.work_id,gp.gallery_revision_id,gp.preset_revision_id
        from public.gallery_revision_presets gp
        join public.community_work_revisions wr on wr.revision_id=gp.gallery_revision_id
        join public.preset_revisions pr on pr.preset_revision_id=gp.preset_revision_id
        where pr.preset_artifact_id=any(%s)
        order by wr.work_id,gp.gallery_revision_id,gp.preset_revision_id""",(arts,)).fetchall()
    gs=sorted({r[4] for r in records}|{g["draft"] for g in groups}|{e[0] for e in edges},key=str)
    works=c.execute("""select work_id,owner_account_id,creator_profile_id,work_type,
       lifecycle_state,visibility,moderation_state,row_version,current_published_revision_id
       from public.community_works where work_id=any(%s) order by work_id""",(ps+gs,)).fetchall()
    pubs=c.execute("""select pp.work_revision_id,pp.preset_revision_id
       from public.preset_revision_publications pp
       join public.preset_revisions pr on pr.preset_revision_id=pp.preset_revision_id
       where pr.preset_artifact_id=any(%s)
       order by pp.work_revision_id,pp.preset_revision_id""",(arts,)).fetchall()
    assert len(works)==len(ps)+len(gs),"R15_GRAPH_ROSTER_INCOMPLETE"
    norm=lambda a:[[None if v is None else str(v) for v in r] for r in a]
    snapshot={"scope":"r15-two-scene-known-edges-only",
      "artifacts":norm(records),"works":norm(works),"galleryHistoricalEdges":norm(edges),
      "presetPublications":norm(pubs)}
    digest=hashlib.sha256(json.dumps(snapshot,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {"sha":digest,"account":next(iter(owners)),"artifacts":arts,"presetWorks":ps,"galleries":gs}

def prepare_draft(c,g):
    d=uuid.uuid4();g["draft"]=d
    owner,creator=f.one(c,"select owner_account_id,creator_profile_id from public.community_works where work_id=%s",(g["galleryWork"],))
    c.execute("BEGIN")
    try:
        execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(d,))
        execute(c,"""insert into public.community_works(work_id,owner_account_id,creator_profile_id,
          work_type,visibility,moderation_state) values(%s,%s,%s,'gallery','public','clear')""",
          (d,owner,creator))
        execute(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(d,))
        execute(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(d,))
        c.execute("COMMIT")
    except:
        c.execute("ROLLBACK");raise
    g["expectedVersion"]=one(c,"select row_version from public.community_works where work_id=%s",(d,))

def actor_gate(c,groups,account):
    for g in groups:
        assert one(c,"select private.resolve_active_account(%s)",(g["auth"],))==account
        assert one(c,"""select count(*) from public.auth_identities i
          where i.provider='supabase' and i.provider_subject=%s
          and i.account_id=%s and i.identity_state='active' and i.retired_at is null""",
          (str(g["auth"]),account))==1,"R15_ACTIVE_IDENTITY_REQUIRED"
    assert not one(c,"select private.is_account_privacy_suppressed(%s)",(account,))

def acquire(c,groups,caller_sha):
    v=scan(c,groups)
    actor_gate(c,groups,v["account"])
    one(c,"select account_id from public.wand_accounts where account_id=%s for share",(v["account"],))
    for key,col,table in [
      ("artifacts","preset_artifact_id","public.preset_artifacts"),
      ("presetWorks","work_id","public.community_works"),
      ("galleries","work_id","public.community_works")
    ]:
        assert list(v[key])==sorted(v[key],key=str)
        for identifier in v[key]:
            row=one(c,f"select {col} from {table} where {col}=%s for update",(identifier,))
            assert row==identifier
    actor_gate(c,groups,v["account"])
    refreshed=scan(c,groups)
    if any(v[k]!=refreshed[k] for k in ("artifacts","presetWorks","galleries")):
        raise ValueError("R15_GRAPH_LOCK_ROSTER_CHANGED_RESTART_WHOLE_COMMAND")
    if refreshed["sha"]!=caller_sha:
        raise ValueError("R15_CALLER_GRAPH_FINGERPRINT_STALE")
    return v

def source_publish(c,g):
    result=one(c,"""select public.community_publish_gallery_v4(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],g["draft"],g["expectedVersion"],"R15 concurrent real Source Gallery",
       "synthetic isolated full transaction",[g["oldMedia"]],[g["presetRev"]],[],[],None,
       "r15-"+str(g["draft"])))
    assert result["revisionId"],result
    return result

def counts(c,groups):
    return [(one(c,"select count(*) from public.community_work_revisions where work_id=%s",(g["draft"],)),
            one(c,"select count(*) from public.search_documents where work_id=%s",(g["draft"],)),
            one(c,"select count(*) from public.outbox_events where aggregate_id=%s",(g["draft"],)),
            one(c,"select current_published_revision_id from public.community_works where work_id=%s",(g["draft"],)))
            for g in groups]

def execute_race(groups):
    with psycopg.connect(URL,autocommit=True) as a,psycopg.connect(URL,autocommit=True) as b:
        before=counts(a,groups);assert all(v[0]==v[1]==v[2]==0 for v in before)
        holder_pid=one(a,"select pg_backend_pid()")
        contender_pid=one(b,"select pg_backend_pid()")
        assert holder_pid!=contender_pid
        base_pin=scan(a,groups)["sha"]
        held=threading.Event();release=threading.Event();done=threading.Event();result={}
        def writer_a():
            try:
                a.execute("BEGIN")
                acquire(a,groups,base_pin)
                held.set()
                if not release.wait(10):raise AssertionError("R15_HOLDER_RELEASE_TIMEOUT")
                source_publish(a,groups[0])
                a.execute("COMMIT")
                result["acommitted"]=True
            except Exception as exc:
                result["aerror"]=repr(exc)
                a.execute("ROLLBACK")
            finally:done.set()
        t=threading.Thread(target=writer_a,daemon=True);t.start()
        assert held.wait(10),"R15_HOLDER_DID_NOT_ACQUIRE_BOTH_ARTIFACTS"
        # Observe actual PostgreSQL blocker identity from a third read-only
        # probe; the TWO mutation/contender sessions remain A and B.
        bpid=contender_pid
        probe_stop=threading.Event();observed={}
        def watch_lock():
            with psycopg.connect(URL,autocommit=True) as watch:
                limit=time.monotonic()+3
                while time.monotonic()<limit and not probe_stop.is_set():
                    blockers=one(watch,"select pg_blocking_pids(%s)",(bpid,))
                    if holder_pid in blockers:
                        observed["blocked"]=True
                        observed["blockingPids"]=list(blockers)
                        break
                    time.sleep(.02)
        watcher=threading.Thread(target=watch_lock,daemon=True);watcher.start()
        # B's first attempt locks the same graph and times out in full SQL txn.
        b.execute("BEGIN");b.execute("set local lock_timeout='850ms'")
        try:
            try:
                acquire(b,groups,base_pin)
                raise AssertionError("R15_B_UNEXPECTED_LOCK_SUCCESS")
            except psycopg.Error as err:
                assert err.sqlstate=="55P03",err
                result["timeout"]="55P03"
        finally:b.execute("ROLLBACK")
        probe_stop.set();watcher.join(2)
        assert observed.get("blocked") is True,"R15_PG_BLOCKING_PIDS_NOT_OBSERVED"
        assert counts(b,groups)==before,"R15_B_PARTIAL_STATE_AFTER_TIMEOUT"
        release.set();assert done.wait(12),result;t.join(1)
        assert result.get("acommitted") and "aerror" not in result,result
        after_first=counts(b,groups)
        assert after_first[0][0]==after_first[0][1]==1 and after_first[1]==before[1],after_first
        # Caller that held the old graph digest MUST fail terminally even
        # when target Gallery 2 itself still has the same rowVersion.
        b.execute("BEGIN")
        try:
            try:
                acquire(b,groups,base_pin)
                raise AssertionError("R15_STALE_CALLER_ACCEPTED")
            except ValueError as err:
                assert str(err)=="R15_CALLER_GRAPH_FINGERPRINT_STALE",err
        finally:b.execute("ROLLBACK")
        assert counts(b,groups)==after_first
        # Fresh whole transaction, new full locks, current actor + live graph,
        # then actual source publication commits in disposable local DB.
        b.execute("BEGIN")
        try:
            fresh=scan(b,groups)["sha"]
            assert fresh!=base_pin
            acquire(b,groups,fresh)
            source_publish(b,groups[1])
            b.execute("COMMIT")
        except:
            b.execute("ROLLBACK");raise
        assert all(row[0]==row[1]==1 and row[2]>=1 and row[3] is not None
          for row in counts(b,groups))
        print(json.dumps({"case":"R15_ACTUAL_TWO_GALLERY_WRITERS_MULTI_ARTIFACT_GRAPH",
          "twoIndependentPostgreSQLConnections":True,
          "pgBlockingPidsConfirmed":True,
          "sortedArtifacts":2,"sortedPresetWorks":2,"sortedGalleryWorks":4,
          "firstAttemptSqlstate":"55P03","failedCommandRolledBack":True,
          "firstGallerySourceCommittedLocally":True,
          "oldGraphCallerTerminalRejected":True,
          "freshWholeTransactionSecondGalleryCommittedLocally":True,
          "twoSearchAndOutboxPublicationTransactions":True,
          "signedStagingOrPublicRPCEnrolled":False}))

def bounded_auto_retry_with_source(groups,third):
    """Validation-only automatic WHOLE transaction retries on real SQLSTATE
    55P03. No recovery from stale caller pin or revoked actor. This is not
    deployed Service/Edge retry handling.
    """
    with psycopg.connect(URL,autocommit=True) as a,psycopg.connect(URL,autocommit=True) as b:
        prior=counts(a,groups)
        owner=scan(a,groups)["account"]
        a.execute("BEGIN")
        one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",
            (sorted([groups[0]["artifact"],groups[1]["artifact"]],key=str)[0],))
        attempts=[]
        try:
            for index in range(1,4):
                b.execute("BEGIN")
                b.execute("set local lock_timeout='600ms'")
                try:
                    # Each retry RESOLVES its own current actor, graph roster,
                    # versions and privacy; never reuse a successful precheck.
                    latest=scan(b,groups)["sha"]
                    acquire(b,groups,latest)
                    source_publish(b,third)
                    b.execute("COMMIT")
                    attempts.append("COMMIT")
                    break
                except psycopg.Error as exc:
                    b.execute("ROLLBACK")
                    if exc.sqlstate not in ("55P03","40P01","40001"):
                        raise
                    attempts.append(exc.sqlstate)
                    assert counts(a,groups)==prior,"R15_PARTIAL_STATE_AFTER_TRANSIENT"
                    if index==1:
                        a.execute("ROLLBACK")
                    elif index==3:
                        raise AssertionError("R15_BOUNDED_RETRY_EXHAUSTED")
                except:
                    b.execute("ROLLBACK");raise
        finally:
            if a.info.transaction_status!=psycopg.pq.TransactionStatus.IDLE:
                a.execute("ROLLBACK")
        assert attempts==["55P03","COMMIT"],attempts
        final=counts(b,groups)
        assert final[2][0]==final[2][1]==1 and final[2][2]>=1
        assert final[:2]==prior[:2],(prior,final)
        print(json.dumps({"case":"R15_TEST_DRIVER_BOUNDED_FRESH_WHOLE_TRANSACTION_RETRY",
          "sourceGalleryWriterExecuted":True,"transientSqlstate":"55P03",
          "attempts":2,"maxAttempts":3,"freshActorAndGraphPerAttempt":True,
          "firstFailedTransactionFullyRolledBack":True,
          "secondTransactionCommittedLocally":True,"semanticStaleNotAutomaticallyRefreshed":True,
          "automaticProductionRetryImplemented":False}))

def main():
    with psycopg.connect(URL,autocommit=True) as c:
        groups=[f.fixture(c),f.fixture(c)]
        for g in groups:prepare_draft(c,g)
        registry=scan(c,groups)
        assert len(registry["artifacts"])==2 and len(registry["galleries"])==4
    execute_race(groups)
    # A third draft reuses Scene 1: distinct Work, shared Artifact graph.
    # It is published via the unchanged actual v4 RPC only after a bounded
    # transient-only retry runner succeeds in a freshly authorized txn.
    third=dict(groups[0])
    with psycopg.connect(URL,autocommit=True) as c:
        prepare_draft(c,third)
    expanded=[*groups,third]
    bounded_auto_retry_with_source(expanded,third)
    print(json.dumps({"result":"R15_TWO_ACTUAL_SOURCE_GALLERY_WRITERS_SCOPED_MULTI_GRAPH_PASS",
      "ownerSourceCommit":"1d98e4234f6b6762c46c6a26e59a00640f18053b",
      "sourceMigrationCount":115,"fullAllFacetGraphComplete":False,
      "productionAllWriterEnrollment":False,"automaticRetryDeployed":False,"testDriverBoundedTransientRetryPassed":True,
      "retirementAuthorized":False}))

if __name__=="__main__":main()
