#!/usr/bin/env python3
"""True PostgreSQL concurrency tests in a disposable GitHub Actions PG17 service.

Run ONLY on a fresh localhost PostgreSQL DB named ddvre_09int_isolated.
Uses the UNCHANGED source migration from PR #123 (verified Git blob).
This is NOT Staging acceptance, all-writer closure, or retirement authorization.
"""
import hashlib, json, os, threading, time, uuid
from pathlib import Path
from urllib.parse import urlsplit
import psycopg

SOURCE=Path("supabase/migrations/20261025002400_gallery_known_reference_writer_fence_v1.sql")
EXPECTED_BLOB="e9c102916e2159223c1651d418a1ec9953d6fa78"
G=uuid.uuid4(); PW=uuid.uuid4(); P=uuid.uuid4(); PR=uuid.uuid4()
GR=uuid.uuid4(); PWR=uuid.uuid4()
DDL="""
CREATE SCHEMA private;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.community_works (
 work_id uuid PRIMARY KEY, work_type text NOT NULL,
 row_version bigint NOT NULL DEFAULT 0,
 current_published_revision_id uuid, lifecycle_state text NOT NULL DEFAULT 'published');
CREATE TABLE public.community_work_revisions (
 revision_id uuid PRIMARY KEY, work_id uuid NOT NULL REFERENCES public.community_works(work_id));
CREATE TABLE public.preset_artifacts (
 preset_artifact_id uuid PRIMARY KEY,
 associated_gallery_work_id uuid REFERENCES public.community_works(work_id),
 untouched_note text DEFAULT '');
CREATE TABLE public.preset_revisions (
 preset_revision_id uuid PRIMARY KEY,
 preset_artifact_id uuid NOT NULL REFERENCES public.preset_artifacts(preset_artifact_id));
CREATE TABLE public.gallery_revision_presets (
 gallery_revision_id uuid NOT NULL REFERENCES public.community_work_revisions(revision_id),
 preset_revision_id uuid NOT NULL REFERENCES public.preset_revisions(preset_revision_id),
 PRIMARY KEY(gallery_revision_id,preset_revision_id));
CREATE TABLE public.preset_revision_publications (
 work_revision_id uuid PRIMARY KEY REFERENCES public.community_work_revisions(revision_id),
 preset_revision_id uuid NOT NULL REFERENCES public.preset_revisions(preset_revision_id));
"""
def one(c,sql,params=()):
    with c.cursor() as cur:
        cur.execute(sql,params)
        return cur.fetchone()

def digest(c):
    return one(c,"""SELECT md5(w.row_version::text || ':' || w.lifecycle_state::text || ':' ||
       coalesce((SELECT string_agg(gp.gallery_revision_id::text || '/' || gp.preset_revision_id::text, ',' ORDER BY gp.gallery_revision_id,gp.preset_revision_id)
          FROM public.gallery_revision_presets gp JOIN public.community_work_revisions gr ON gr.revision_id=gp.gallery_revision_id
          WHERE gr.work_id=w.work_id),'') || ':' ||
       coalesce((SELECT string_agg(pa.preset_artifact_id::text,',' ORDER BY pa.preset_artifact_id)
          FROM public.preset_artifacts pa WHERE pa.associated_gallery_work_id=w.work_id),''))
          FROM public.community_works w WHERE w.work_id=%s""",(G,))[0]

def test_block(a,b,label,stmt,expect_block=True):
    apid=one(a,"SELECT pg_backend_pid()")[0]
    bpid=one(b,"SELECT pg_backend_pid()")[0]
    assert apid!=bpid, "not two real backends"
    before=digest(a)
    start=threading.Event(); finish=threading.Event(); output={}
    a.execute("BEGIN")
    try:
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
        acquired=time.monotonic()
        def contender():
            try:
                b.execute("BEGIN")
                b.execute("SET LOCAL lock_timeout='1800ms'")
                assert one(b,"SELECT pg_backend_pid()")[0]==bpid
                output["attempt"]=time.monotonic()
                start.set()
                try:
                    with b.cursor() as cur:
                        cur.execute(stmt[0],stmt[1])
                        output["rowCount"]=cur.rowcount
                    output["sqlstate"]=None
                except psycopg.Error as e:
                    output["sqlstate"]=e.sqlstate
                output["end"]=time.monotonic()
            except Exception as e:
                output["unexpected"]=type(e).__name__+":"+str(e)
            finally:
                b.execute("ROLLBACK")
                finish.set()
        t=threading.Thread(target=contender,daemon=True)
        t.start()
        assert start.wait(4),label+": worker did not start"
        observed=False; wait_type=None
        deadline=time.monotonic()+2.5
        while time.monotonic()<deadline and not finish.is_set():
            blockers,wait=one(a,'''SELECT pg_blocking_pids(%s),
                       (SELECT wait_event_type FROM pg_stat_activity WHERE pid=%s)''',(bpid,bpid))
            if apid in (blockers or []):
                observed=True; wait_type=wait; break
            time.sleep(.025)
        assert finish.wait(5),label+": contender did not complete"
        t.join(1)
        assert "unexpected" not in output,(label,output)
        assert observed and output["sqlstate"]=="55P03",(label,output,observed)
        assert output["attempt"]>=acquired,(label,"attempt did not overlap holder")
        assert output["end"]<time.monotonic()
        print(json.dumps({"case":label,"holderPid":apid,"contenderPid":bpid,
          "pgBlockingPidsIncludesHolder":observed,"waitEventType":wait_type,
          "sqlstate":output["sqlstate"],"contenderTimedOutBeforeHolderRelease":True}))
    finally:
        a.execute("ROLLBACK")
    assert digest(a)==before,label+": unexpected persistent mutation"
    b.execute("BEGIN")
    try:
        b.execute("SET LOCAL lock_timeout='3s'")
        with b.cursor() as cur:
            cur.execute(stmt[0],stmt[1])
            assert cur.rowcount==1,(label,cur.rowcount)
    finally:
        b.execute("ROLLBACK")
    assert digest(a)==before,label+": retry rollback failed"



def test_consistent_artifact_preset_gallery_order(a,b):
    """Positive *lock-order control only*: A and B acquire Artifact -> PresetWork -> GalleryWork.

    This is an isolated, read-only row-lock contract demonstration.
    It does NOT prove any existing deployed RPC participates in this order.
    """
    before=digest(a)
    apid=one(a,"SELECT pg_backend_pid()")[0]
    bpid=one(b,"SELECT pg_backend_pid()")[0]
    assert apid!=bpid
    start=threading.Event()
    done=threading.Event()
    result={}
    a.execute("BEGIN")
    a.execute("SET LOCAL statement_timeout='7s'")
    try:
        assert one(a,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))==(P,)
        def same_order_writer():
            try:
                b.execute("BEGIN")
                b.execute("SET LOCAL statement_timeout='7s'")
                start.set()
                assert one(b,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))==(P,)
                assert one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(PW,))==(PW,)
                assert one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
                result["acquiredAll"]=True
            except psycopg.Error as err:
                result["sqlstate"]=err.sqlstate
            except Exception as exc:
                result["unexpected"]=type(exc).__name__+":"+str(exc)
            finally:
                b.execute("ROLLBACK")
                done.set()
        t=threading.Thread(target=same_order_writer,daemon=True)
        t.start()
        assert start.wait(3),"ORDERED_WRITER_NOT_STARTED"
        observed=False
        deadline=time.monotonic()+3
        while time.monotonic()<deadline:
            holders=one(a,"SELECT pg_blocking_pids(%s)",(bpid,))[0]
            if apid in (holders or []):
                observed=True
                break
            time.sleep(.025)
        assert observed,"ORDERED_WRITER_BLOCKING_NOT_OBSERVED"
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(PW,))==(PW,)
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
    finally:
        a.execute("ROLLBACK")
    assert done.wait(5),"ORDERED_WRITER_DID_NOT_RESUME"
    t.join(1)
    assert result=={"acquiredAll":True},result
    assert digest(a)==before,"ORDERED_LOCK_CONTROL_MUTATED_GRAPH"
    print(json.dumps({"case":"candidate-consistent-artifact-preset-gallery-order",
        "holderPid":apid,"waitingPid":bpid,
        "pgBlockingPidsIncludesHolder":observed,
        "secondWriterAcquiredAllAfterRollback":True,
        "deadlockObserved":False,"allTransactionsRolledBack":True,
        "allDeployedWritersEnrolled":False}))

def test_bounded_clean_transaction_replay(a):
    """A clean full-transaction retry *shape* after synthetic 40P01, not live RPC retry."""
    before=digest(a)
    for attempt in range(1,3):
        a.execute("BEGIN")
        try:
            a.execute("SET LOCAL lock_timeout='1800ms'")
            a.execute("SET LOCAL statement_timeout='5s'")
            assert one(a,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))==(P,)
            assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(PW,))==(PW,)
            assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
            assert digest(a)==before,"REPLAY_CHANGED_GRAPH"
        finally:
            a.execute("ROLLBACK")
    assert digest(a)==before,"REPLAY_ROLLBACK_CHANGED_GRAPH"
    print(json.dumps({"case":"bounded-clean-transaction-replay-shape",
        "attempts":2,"transactionLevelRollback":True,"immutableBaselinePreserved":True,
        "realRPCIdempotentRetryAccepted":False}))

def test_synthetic_lock_order_inversion(a,b):
    """Negative demonstration, NOT an implemented Gallery retirement RPC.

    Existing Scene writes acquire PresetArtifact -> GalleryWork.
    A hypothetical Gallery-first retirement taking GalleryWork -> PresetArtifact
    can create a deadlock. No UPDATE/DELETE occurs in this test.
    """
    before=digest(a)
    apid=one(a,"SELECT pg_backend_pid()")[0]
    bpid=one(b,"SELECT pg_backend_pid()")[0]
    assert apid!=bpid
    started=threading.Event(); done=threading.Event()
    result={}
    a.execute("BEGIN")
    a.execute("SET LOCAL statement_timeout='7s'")
    try:
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
        def artifact_first_writer():
            try:
                b.execute("BEGIN")
                b.execute("SET LOCAL statement_timeout='7s'")
                assert one(b,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))==(P,)
                started.set()
                try:
                    one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))
                    result["bState"]="completed"
                except psycopg.Error as err:
                    result["bState"]=err.sqlstate
            except Exception as exc:
                result["error"]=str(exc)
            finally:
                b.execute("ROLLBACK")
                done.set()
        worker=threading.Thread(target=artifact_first_writer,daemon=True)
        worker.start()
        assert started.wait(4),"SCENE_ORDER_WRITER_NOT_STARTED"
        observed=False; deadline=time.monotonic()+4
        while time.monotonic()<deadline:
            blockers=one(a,"SELECT pg_blocking_pids(%s)",(bpid,))[0]
            if apid in (blockers or []):
                observed=True; break
            time.sleep(.03)
        assert observed,"SCENE_WRITER_WAITING_ON_GALLERY_NOT_OBSERVED"
        try:
            one(a,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))
            result["aState"]="completed"
        except psycopg.Error as err:
            result["aState"]=err.sqlstate
    finally:
        a.execute("ROLLBACK")
    assert done.wait(5),"INVERTED_WORKER_STUCK"
    worker.join(1)
    assert "error" not in result,result
    assert "40P01" in (result.get("aState"),result.get("bState")),("EXPECTED_DEADLOCK_NOT_OBSERVED",result)
    assert digest(a)==before,"SYNTHETIC_DEADLOCK_CHANGED_GRAPH"
    print(json.dumps({"case":"synthetic-reverse-lock-order-deadlock",
          "holderPid":apid,"sceneWriterPid":bpid,
          "sceneWriterBlockedByGallery":observed,
          "observedSqlstate40P01":True,"allTransactionsRolledBack":True,
          "actualRetirementRPCExecuted":False,
          "lockOrderContractAccepted":False}))


def test_missing_preset_work_lifecycle_writer_fence(a,b):
    """Negative minimal-schema test: Gallery row lock alone does not fence Preset Work state.

    Models a deployed table mutation class, NOT the actual RPC with auth/RLS/triggers.
    """
    original=one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))
    before_gallery=one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))
    apid=one(a,"SELECT pg_backend_pid()")[0]
    bpid=one(b,"SELECT pg_backend_pid()")[0]
    assert apid!=bpid
    committed=threading.Event()
    began=threading.Event()
    result={}
    a.execute("BEGIN")
    try:
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
        def preset_lifecycle_mutation():
            try:
                b.execute("BEGIN")
                b.execute("SET LOCAL lock_timeout='1300ms'")
                began.set()
                with b.cursor() as cur:
                    cur.execute("UPDATE public.community_works SET lifecycle_state='unpublished' WHERE work_id=%s",(PW,))
                    result["updateCount"]=cur.rowcount
                b.execute("COMMIT")
                result["committed"]=True
            except psycopg.Error as exc:
                result["sqlstate"]=exc.sqlstate
                b.execute("ROLLBACK")
            except Exception as exc:
                result["error"]=repr(exc)
                b.execute("ROLLBACK")
            finally:
                committed.set()
        t=threading.Thread(target=preset_lifecycle_mutation,daemon=True)
        t.start()
        assert began.wait(4),"PRESET_LIFECYCLE_WORKER_NOT_STARTED"
        assert committed.wait(4),"PRESET_WORK_UPDATE_INCORRECTLY_WAITED_FOR_GALLERY_LOCK"
        t.join(1)
        assert result=={"updateCount":1,"committed":True},result
        blockers=one(a,"SELECT pg_blocking_pids(%s)",(bpid,))[0]
        assert apid not in (blockers or []),"UNEXPECTED_GALLERY_WORK_FENCE"
        after_lifecycle=one(a,"SELECT lifecycle_state FROM public.community_works WHERE work_id=%s",(PW,))[0]
        assert after_lifecycle=="unpublished",after_lifecycle
        assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))==before_gallery
        print(json.dumps({"case":"preset-work-lifecycle-bypasses-gallery-lock-negative",
          "galleryHolderPid":apid,"presetStatusWriterPid":bpid,
          "presetUnpublishCommittedWhileGalleryHeld":True,
          "galleryWorkRowVersionUnchanged":True,
          "requiresNewSharedWriterFence":True,
          "deployedRPCInvoked":False,
          "fullSupabaseSchemaUsed":False,
          "positiveRetirementAuthorized":False}))
    finally:
        a.execute("ROLLBACK")
    b.execute("BEGIN")
    try:
        with b.cursor() as cur:
            cur.execute("UPDATE public.community_works SET lifecycle_state=%s,row_version=%s WHERE work_id=%s",(original[0],original[1],PW))
            assert cur.rowcount==1
        b.execute("COMMIT")
    except:
        b.execute("ROLLBACK")
        raise
    assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))==original
    assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))==before_gallery


def test_candidate_lifecycle_shared_lock_guard(a,b):
    """Candidate explicit envelope: PresetArtifact -> PresetWork -> GalleryWork.

    This is NOT a deployed RPC or generic trigger. Stage A holds the Gallery
    lock while B attempts an artifact-first lifecycle writer: no mutation may
    commit before release. Then B retries the ENTIRE transaction after release.
    """
    before=one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))
    gallery_before=one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))
    apid=one(a,"SELECT pg_backend_pid()")[0]
    bpid=one(b,"SELECT pg_backend_pid()")[0]
    entered=threading.Event(); finished=threading.Event(); observed={}
    assert apid!=bpid
    a.execute("BEGIN")
    try:
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
        def contender():
            try:
                b.execute("BEGIN")
                b.execute("SET LOCAL lock_timeout='1600ms'")
                # Discover the relationship without taking target row locks.
                assert one(b,"SELECT associated_gallery_work_id FROM public.preset_artifacts WHERE preset_artifact_id=%s",(P,))==(G,)
                assert one(b,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))==(P,)
                assert one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(PW,))==(PW,)
                entered.set()
                try:
                    assert one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
                    b.execute("UPDATE public.community_works SET lifecycle_state='unpublished' WHERE work_id=%s",(PW,))
                    observed["prematureCommit"]=True
                except psycopg.Error as e:
                    observed["sqlstate"]=e.sqlstate
            except Exception as e:
                observed["unexpected"]=repr(e)
            finally:
                b.execute("ROLLBACK")
                finished.set()
        t=threading.Thread(target=contender,daemon=True)
        t.start()
        assert entered.wait(4),"CANDIDATE_WRITER_NOT_ENTERED"
        was_blocked=False
        deadline=time.monotonic()+2.5
        while time.monotonic()<deadline and not finished.is_set():
            pids=one(a,"SELECT pg_blocking_pids(%s)",(bpid,))[0]
            if apid in (pids or []):
                was_blocked=True
                break
            time.sleep(.02)
        assert finished.wait(5),"CANDIDATE_WRITER_DID_NOT_TIMEOUT"
        t.join(1)
        assert observed=={"sqlstate":"55P03"},observed
        assert was_blocked,"CANDIDATE_WRITER_NO_ACTUAL_GALLERY_WAIT"
        assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))==before
        print(json.dumps({"case":"candidate-lifecycle-enrolled-while-gallery-locked",
            "holderPid":apid,"writerPid":bpid,"actualGalleryBlockingObserved":was_blocked,
            "sqlstate":"55P03","presetStatusUnaffected":True,
            "candidateDeployed":False,"positiveRetirementAuthorized":False}))
    finally:
        a.execute("ROLLBACK")
    # New transaction. The old locked graph and any previous auth must not be reused.
    b.execute("BEGIN")
    try:
        b.execute("SET LOCAL lock_timeout='3s'")
        assert one(b,"SELECT associated_gallery_work_id FROM public.preset_artifacts WHERE preset_artifact_id=%s",(P,))==(G,)
        assert one(b,"SELECT preset_artifact_id FROM public.preset_artifacts WHERE preset_artifact_id=%s FOR UPDATE",(P,))==(P,)
        assert one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(PW,))==(PW,)
        assert one(b,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
        assert one(b,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))==before
        assert one(b,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))==gallery_before
        with b.cursor() as cur:
            cur.execute("UPDATE public.community_works SET lifecycle_state='unpublished' WHERE work_id=%s",(PW,))
            assert cur.rowcount==1
        b.execute("COMMIT")
    except:
        b.execute("ROLLBACK")
        raise
    assert one(a,"SELECT lifecycle_state FROM public.community_works WHERE work_id=%s",(PW,))==("unpublished",)
    assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))==gallery_before
    # Isolated-only fixture restoration, never remote user Work.
    b.execute("BEGIN")
    try:
        b.execute("UPDATE public.community_works SET lifecycle_state=%s,row_version=%s WHERE work_id=%s",(before[0],before[1],PW))
        b.execute("COMMIT")
    except:
        b.execute("ROLLBACK")
        raise
    assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))==before
    print(json.dumps({"case":"candidate-lifecycle-whole-transaction-retry",
        "retryAfterHolderReleaseCommittedInDisposableFixture":True,
        "fixtureRestored":True,"deployedRpcRetryProven":False,
        "allWriterEnrollmentProven":False,"graphComplete":False,
        "retirementAuthorized":False}))


R7_FILE=Path("tests/09int-r7-source-derived-linked-unpublish-candidate.sql")
R7_OWNER=uuid.uuid4()
R7_NONOWNER=uuid.uuid4()

def setup_r7_source_derived(c):
    """Only local disposable PG schema stubs for actual source-derived RPC execution.

    Functions in the Staging RPC resolve real auth and use other production tables;
    the fixture mocks only their transaction-related dependencies, not roles/RLS.
    """
    c.execute("CREATE SCHEMA IF NOT EXISTS extensions")
    c.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    c.execute("ALTER TABLE public.community_works ADD COLUMN owner_account_id uuid")
    c.execute("ALTER TABLE public.preset_artifacts ADD COLUMN community_work_id uuid")
    c.execute("UPDATE public.community_works SET owner_account_id=%s",(R7_OWNER,))
    c.execute("UPDATE public.preset_artifacts SET community_work_id=%s WHERE preset_artifact_id=%s",(PW,P))
    c.execute("""
       CREATE TABLE public.idempotency_keys (
         account_id uuid NOT NULL,
         idempotency_key text NOT NULL,
         command_name text NOT NULL,
         request_hash text NOT NULL,
         response jsonb, completed_at timestamptz,
         PRIMARY KEY(account_id,idempotency_key));
       CREATE TABLE public.search_documents (
         entity_id uuid PRIMARY KEY, work_id uuid NOT NULL);
       CREATE TABLE public.outbox_events (
         aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
         event_type text NOT NULL,payload jsonb NOT NULL,
         dedupe_key text UNIQUE);
       CREATE OR REPLACE FUNCTION private.resolve_active_account(p_auth_subject uuid)
       RETURNS uuid LANGUAGE plpgsql AS $mock$
       BEGIN
         IF p_auth_subject IS NULL THEN RAISE EXCEPTION 'MOCK_AUTH_SUBJECT_NULL'; END IF;
         RETURN p_auth_subject;
       END $mock$;
       CREATE OR REPLACE FUNCTION private.r7_fixture_increment_row_version()
       RETURNS trigger LANGUAGE plpgsql AS $version$
       BEGIN
         NEW.row_version := OLD.row_version+1;
         RETURN NEW;
       END $version$;
       CREATE TRIGGER r7_fixture_work_row_version
         BEFORE UPDATE ON public.community_works FOR EACH ROW
         EXECUTE FUNCTION private.r7_fixture_increment_row_version();
    """)
    c.execute("INSERT INTO public.search_documents(entity_id,work_id) VALUES(%s,%s)",(PW,PW))
    sql=R7_FILE.read_text()
    assert "perform private.cross_product_lock_linked_preset_work_r7(p_work_id,v_account_id);" in sql
    assert "SECURITY DEFINER" in sql
    c.execute(sql)
    assert one(c,"SELECT has_function_privilege('anon','private.cross_product_lock_linked_preset_work_r7(uuid,uuid)','EXECUTE')")[0] is False
    assert one(c,"SELECT has_function_privilege('authenticated','private.cross_product_lock_linked_preset_work_r7(uuid,uuid)','EXECUTE')")[0] is False
    assert one(c,"SELECT has_function_privilege('service_role','private.cross_product_lock_linked_preset_work_r7(uuid,uuid)','EXECUTE')")[0] is False

def test_r7_source_derived_writer_rpc(a,b):
    """Invoke the ACTUAL STAGING-SOURCE-DERIVED community_unpublish_work with
    one candidate helper insertion. Unlike R6 this does NOT update Work directly.
    """
    row=lambda conn: one(conn,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(PW,))
    before=row(a)
    assert before==("published",0),before
    initial_gallery=one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))
    assert one(a,"SELECT count(*) FROM public.search_documents WHERE work_id=%s",(PW,))[0]==1
    apid=one(a,"SELECT pg_backend_pid()")[0]
    bpid=one(b,"SELECT pg_backend_pid()")[0]
    assert apid!=bpid
    begin=threading.Event();end=threading.Event();result={}
    a.execute("BEGIN")
    try:
        assert one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))==(G,)
        def writer():
            try:
                b.execute("BEGIN")
                b.execute("SET LOCAL lock_timeout='1700ms'")
                assert one(b,"SELECT pg_backend_pid()")[0]==bpid
                result["attemptedAt"]=time.monotonic()
                begin.set()
                try:
                    one(b,"SELECT public.community_unpublish_work(%s,%s,%s,%s)",
                        (R7_OWNER,PW,0,"r7-source-generic-unpublish"))
                    result["completedWhileGalleryLocked"]=True
                except psycopg.Error as ex:
                    result["sqlstate"]=ex.sqlstate
                    result["failedAt"]=time.monotonic()
            except Exception as ex:
                result["unexpected"]=str(ex)
            finally:
                b.execute("ROLLBACK")
                end.set()
        thread=threading.Thread(target=writer,daemon=True)
        thread.start()
        assert begin.wait(4),"R7_SOURCE_RPC_WRITER_NOT_STARTED"
        blocked=False;deadline=time.monotonic()+3
        while time.monotonic()<deadline and not end.is_set():
            pids=one(a,"SELECT pg_blocking_pids(%s)",(bpid,))[0]
            if apid in (pids or []):
                blocked=True;break
            time.sleep(.02)
        assert end.wait(5),"R7_SOURCE_RPC_WRITER_DID_NOT_FINISH"
        thread.join(1)
        assert result.get("sqlstate")=="55P03" and "unexpected" not in result,result
        assert not result.get("completedWhileGalleryLocked",False)
        assert blocked,"R7_NO_REAL_GALLERY_ROW_WAIT_OBSERVED"
        assert row(a)==before
        assert one(a,"SELECT count(*) FROM public.idempotency_keys")[0]==0
        assert one(a,"SELECT count(*) FROM public.outbox_events")[0]==0
        assert one(a,"SELECT count(*) FROM public.search_documents WHERE work_id=%s",(PW,))[0]==1
        print(json.dumps({"case":"source-derived-unpublish-rpc-shared-lock-timeout",
            "holderPid":apid,"writerPid":bpid,"pgBlockingPidsVerified":True,
            "sqlstate":"55P03","idempotencyRowsAfterRollback":0,
            "outboxRowsAfterRollback":0,"searchRowsAfterRollback":1,
            "actualStagingSourceBodyWithOneInsertion":True,
            "productionAuthAndRlsUsed":False,
            "deployedBackendWriterUpdated":False}))
    finally:
        a.execute("ROLLBACK")
    assert row(a)==before
    # Simulate source-RPC retries: entirely new transaction & actor/graph re-read.
    b.execute("BEGIN")
    try:
        res=one(b,"SELECT public.community_unpublish_work(%s,%s,%s,%s)",
              (R7_OWNER,PW,0,"r7-source-generic-unpublish"))[0]
        assert row(b)==("unpublished",1)
        assert one(b,"SELECT count(*) FROM public.idempotency_keys")[0]==1
        assert one(b,"SELECT count(*) FROM public.outbox_events")[0]==1
        assert one(b,"SELECT count(*) FROM public.search_documents WHERE work_id=%s",(PW,))[0]==0
    finally:
        b.execute("ROLLBACK")
    assert row(a)==before
    assert one(a,"SELECT count(*) FROM public.idempotency_keys")[0]==0
    assert one(a,"SELECT count(*) FROM public.outbox_events")[0]==0
    assert one(a,"SELECT count(*) FROM public.search_documents WHERE work_id=%s",(PW,))[0]==1
    print(json.dumps({"case":"source-derived-unpublish-rpc-retry-and-full-rollback",
        "retryUsesNewTransaction":True,"workRowVersionInTx":1,
        "idempotencyAndOutboxRolledBack":True,
        "searchProjectionRolledBack":True,"staleGraphReauthorizationProven":False}))
    # Authorized local-only COMMIT and duplicate idempotent replay prove actual
    # candidate RPC participates in one transaction. Fixture is ephemeral.
    b.execute("BEGIN")
    try:
        first=one(b,"SELECT public.community_unpublish_work(%s,%s,%s,%s)",
                  (R7_OWNER,PW,0,"r7-source-generic-unpublish"))[0]
        b.execute("COMMIT")
    except:
        b.execute("ROLLBACK"); raise
    assert row(a)==("unpublished",1)
    assert one(a,"SELECT count(*) FROM public.outbox_events")[0]==1
    assert one(a,"SELECT count(*) FROM public.idempotency_keys")[0]==1
    assert one(a,"SELECT count(*) FROM public.search_documents WHERE work_id=%s",(PW,))[0]==0
    replay=one(a,"SELECT public.community_unpublish_work(%s,%s,%s,%s)",
              (R7_OWNER,PW,0,"r7-source-generic-unpublish"))[0]
    assert replay==first
    assert row(a)==("unpublished",1)
    assert one(a,"SELECT count(*) FROM public.outbox_events")[0]==1
    # Different actor must be denied by the candidate helper before Graph lock.
    b.execute("BEGIN")
    try:
        try:
            one(b,"SELECT public.community_unpublish_work(%s,%s,%s,%s)",
                (R7_NONOWNER,PW,1,"r7-unauthorized"))
            raise AssertionError("NONOWNER_CANDIDATE_WRITER_WAS_AUTHORIZED")
        except psycopg.Error as e:
            assert e.sqlstate=="P0001",e.sqlstate
            assert "OWNER_MISMATCH" in str(e)
    finally:
        b.execute("ROLLBACK")
    assert row(a)==("unpublished",1)
    assert one(a,"SELECT lifecycle_state,row_version FROM public.community_works WHERE work_id=%s",(G,))==initial_gallery
    print(json.dumps({"case":"source-derived-unpublish-rpc-commit-idempotency-owner",
        "idempotentReplayWithoutDuplicateOutbox":True,"nonownerRejected":True,
        "galleryWorkRowVersionUnchanged":True,
        "isolatedFixtureOnly":True,
        "productionRpcIdempotentRetryApproved":False,
        "graphComplete":False,"retirementAuthorized":False}))

def main():
    assert os.getenv("DDVRE_EPHEMERAL_GITHUB_PG")=="CONFIRMED"
    url=os.environ["DDVRE_EPHEMERAL_POSTGRES_DSN"]
    parsed=urlsplit(url)
    assert parsed.hostname in ("127.0.0.1","localhost") and parsed.path=="/ddvre_09int_isolated", "NONISOLATED_DSN_REJECTED"
    data=SOURCE.read_bytes()
    gitblob=hashlib.sha1(f"blob {len(data)}\0".encode()+data).hexdigest()
    assert gitblob==EXPECTED_BLOB,("MIGRATION_NOT_PINNED",gitblob)
    with psycopg.connect(url,autocommit=True) as c:
        c.execute(DDL)
        c.execute(data.decode())
        assert one(c,"""SELECT count(*) FROM pg_trigger
            WHERE tgname IN ('gallery_revision_presets_known_reference_fence',
            'preset_artifacts_known_gallery_reference_fence',
            'preset_revision_publications_known_gallery_reference_fence') AND tgenabled='O'""")[0]==3
        for role in ("anon","authenticated","service_role"):
            assert one(c,"SELECT has_function_privilege(%s,'private.gallery_known_reference_writer_fence_v1()','EXECUTE')",(role,))[0] is False
        c.execute("INSERT INTO public.community_works(work_id,work_type) VALUES(%s,%s),(%s,%s)",(G,"gallery",PW,"preset"))
        c.execute("INSERT INTO public.community_work_revisions(revision_id,work_id) VALUES(%s,%s),(%s,%s)",(GR,G,PWR,PW))
        c.execute("INSERT INTO public.preset_artifacts(preset_artifact_id,associated_gallery_work_id) VALUES(%s,%s)",(P,G))
        c.execute("INSERT INTO public.preset_revisions(preset_revision_id,preset_artifact_id) VALUES(%s,%s)",(PR,P))
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        # Control: an unrelated column update MUST NOT wait on GalleryWork.
        a.execute("BEGIN")
        one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))
        b.execute("BEGIN")
        try:
            b.execute("SET LOCAL lock_timeout='500ms'")
            with b.cursor() as cur:
                cur.execute("UPDATE public.preset_artifacts SET untouched_note=untouched_note WHERE preset_artifact_id=%s",(P,))
                assert cur.rowcount==1
        finally:
            b.execute("ROLLBACK"); a.execute("ROLLBACK")
        print(json.dumps({"case":"no-gallery-reference-column-control","noSharedLockRequired":True}))

        update=("UPDATE public.preset_artifacts SET associated_gallery_work_id=associated_gallery_work_id WHERE preset_artifact_id=%s AND associated_gallery_work_id=%s",(P,G))
        test_block(a,b,"associated-gallery-artifact-update",update)
        edge=("INSERT INTO public.gallery_revision_presets(gallery_revision_id,preset_revision_id) VALUES(%s,%s)",(GR,PR))
        test_block(a,b,"gallery-revision-preset-insert",edge)
        pinned=digest(a)
        b.execute(*edge) # isolated DB only: simulate a concurrent committed new dependent edge
        assert digest(a)!=pinned,"GRAPH_FINGERPRINT_FAILED_TO_CHANGE"
        a.execute("BEGIN")
        try:
            one(a,"SELECT work_id FROM public.community_works WHERE work_id=%s FOR UPDATE",(G,))
            assert digest(a)!=pinned,"STALE_GRAPH_PIN_ACCEPTED"
            print(json.dumps({"case":"under-lock-stale-fingerprint","staleSnapshotRejected":True,
                  "positiveRetirementAuthorized":False}))
        finally:
            a.execute("ROLLBACK")
        publication=("INSERT INTO public.preset_revision_publications(work_revision_id,preset_revision_id) VALUES(%s,%s)",(PWR,PR))
        test_block(a,b,"preset-revision-publication-insert",publication)
        assert one(a,"SELECT row_version FROM public.community_works WHERE work_id=%s",(G,))[0]==0
        test_synthetic_lock_order_inversion(a,b)
        test_consistent_artifact_preset_gallery_order(a,b)
        test_bounded_clean_transaction_replay(a)
        test_missing_preset_work_lifecycle_writer_fence(a,b)
        test_candidate_lifecycle_shared_lock_guard(a,b)
    with psycopg.connect(url,autocommit=True) as setup:
        setup_r7_source_derived(setup)
    with psycopg.connect(url,autocommit=True) as r7a, psycopg.connect(url,autocommit=True) as r7b:
        test_r7_source_derived_writer_rpc(r7a,r7b)
    print(json.dumps({"result":"ISOLATED_KNOWN_WRITER_FENCE_CONCURRENCY_PASS",
        "realPostgreSQLSessions":True,"verifiedTriggerPaths":3,"stagingAcceptance":False,
        "allWriterCoverage":False,"graphComplete":False,"retirementAuthorized":False}))

if __name__=="__main__":
    main()
