#!/usr/bin/env python3
"""09 INT R12: actual source RPC heterogeneous writer bypass checks, LOCAL ONLY.

Imports R11 fixture functions without running any R3-R11 tests. This tests
NEW writer classes, not the three known reference trigger paths.
No remote DB, object storage, live Staging or user tokens. All mutated
post-fixture data is inside intentionally ROLLBACK-only transactions.
"""
import importlib.util
import json, sys, threading, time, uuid
from pathlib import Path
import psycopg

p=Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py")
spec=importlib.util.spec_from_file_location("r11fixture",p)
base=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=base
spec.loader.exec_module(base)
one,execute,fixture,snapshot,local_dsn,history=(
    base.one,base.execute,base.fixture,base.snapshot,
    base.local_dsn,base.historical_edge_hash)

def isolated_two_sessions(url,g,label,writer,held="artifact",expect="success",timeout=8):
    """Prove a source writer's actual transaction can/cannot bypass the
    caller-held Artifact row. Any writer success happens ONLY inside ROLLBACK.
    """
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        assert apid!=bpid
        before=snapshot(a,g)
        oldsha=history(a,g)
        a.execute("BEGIN")
        results={}
        started=threading.Event()
        done=threading.Event()
        try:
            if held=="artifact":
                assert one(a,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",
                    (g["artifact"],))==(g["artifact"],)
            else:
                assert one(a,"select work_id from public.community_works where work_id=%s for update",
                    (g["galleryWork"],))==(g["galleryWork"],)
            def worker():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='1700ms'")
                    b.execute("set local statement_timeout='6s'")
                    started.set()
                    try:
                        results["response"]=writer(b)
                        results["result"]="success"
                    except psycopg.Error as exc:
                        results["result"]="error"
                        results["state"]=exc.sqlstate
                        results["message"]=str(exc).splitlines()[0]
                except Exception as exc:
                    results["unexpected"]=repr(exc)
                finally:
                    b.execute("ROLLBACK")
                    done.set()
            thread=threading.Thread(target=worker,daemon=True)
            thread.start()
            assert started.wait(5),("R12_WRITER_NEVER_STARTED",label)
            blocked=False
            deadline=time.monotonic()+2.5
            while time.monotonic()<deadline and not done.is_set():
                pids=one(a,"select pg_blocking_pids(%s)",(bpid,))[0]
                if apid in (pids or []):
                    blocked=True
                    break
                time.sleep(.025)
            assert done.wait(timeout),("R12_WRITER_DID_NOT_FINISH",label)
            thread.join(1)
            assert "unexpected" not in results,(label,results)
            if expect=="success":
                assert results.get("result")=="success",(label,results)
                assert not blocked,(label,"SHOULD_NOT_LOCK_ARTIFACT",results)
            elif expect=="denied":
                assert results.get("result")=="error",(label,results)
                assert "PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED" in results.get("message",""),(label,results)
                assert not blocked,(label,"EXPECTED_FAST_DENY",results)
            elif expect=="retirement_denied":
                assert results.get("result")=="error" and not blocked,(label,results)
                assert any(v in results.get("message","") for v in (
                    "GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED",
                    "GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN",
                    "GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED")),(label,results)
            elif expect=="lock":
                assert results.get("state")=="55P03" and blocked,(label,results)
            else:
                raise AssertionError(expect)
            assert snapshot(a,g)==before,(label,"WRITER_SIDE_EFFECTS_SURVIVED_ROLLBACK")
            assert history(a,g)==oldsha,(label,"REVISION_REFERENCES_SURVIVED_ROLLBACK")
            print(json.dumps({"case":label,"actual03COMMSourceRpc":label not in ("R12_ACCOUNT_ERASURE_SOURCE_DERIVED_BULK","R12_CANDIDATE_GALLERY_PREFLIGHT"),
              "twoDistinctBackendSessions":True,"held":held,"writerResult":results.get("result"),
              "sqlstate":results.get("state"),"blockedByHolder":blocked,
              "rollbackPreservedAllTrackedState":True,"safeProductionGraphEnrollment":False}))
        finally:
            a.execute("ROLLBACK")
        assert snapshot(a,g)==before,(label,"HOLDER_FINAL_ROLLBACK_SIDE_EFFECT")
        assert history(a,g)==oldsha

def main():
    url=local_dsn()
    with psycopg.connect(url,autocommit=True) as c:
        g=fixture(c)
        owner=one(c,"select owner_account_id from public.community_works where work_id=%s",
                  (g["presetWork"],))[0]
        # Explicit synthetic-only moderator role and pre-created case.
        # This setup does not modify any real user or operator privilege.
        case=uuid.uuid4()
        c.execute("BEGIN")
        try:
            execute(c,"insert into public.account_roles(account_id,role) values(%s,'moderator') on conflict do nothing",(owner,))
            execute(c,"insert into public.moderation_cases(case_id,target_entity_id) values(%s,%s)",
                (case,g["galleryWork"]))
            # A separate draft Gallery is required for v4; do not force a
            # PUBLIC Gallery to unpublished (Cloud safety guard correctly denies).
            g["publishingGalleryWork"]=uuid.uuid4()
            execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",
                (g["publishingGalleryWork"],))
            execute(c,"""insert into public.community_works(
                work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
                select %s,owner_account_id,creator_profile_id,'gallery','public','clear'
                from public.community_works where work_id=%s""",
                (g["publishingGalleryWork"],g["galleryWork"]))
            execute(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",
                (g["publishingGalleryWork"],))
            execute(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",
                (g["publishingGalleryWork"],))
            c.execute("COMMIT")
        except:
            c.execute("ROLLBACK")
            raise
        g["publishingGalleryVersion"]=one(c,"select row_version from public.community_works where work_id=%s",(g["publishingGalleryWork"],))[0]

    # HARD DENY is the CURRENT source state; this is NOT positive enrollment.
    for name in ("community_change_work_visibility","community_unpublish_work","community_delete_work"):
        def owner_action(b,name=name):
            if name=="community_change_work_visibility":
                return one(b,"select public.community_change_work_visibility(%s,%s,%s,'unlisted',%s)",
                    (g["auth"],g["presetWork"],g["presetVersion"],"r12-"+name+"-"+str(uuid.uuid4())))[0]
            return one(b,f"select public.{name}(%s,%s,%s,%s)",
                (g["auth"],g["presetWork"],g["presetVersion"],"r12-"+name+"-"+str(uuid.uuid4())))[0]
        isolated_two_sessions(url,g,"R12_GENERIC_PRESET_OWNER_LIFECYCLE_DENY_"+name,owner_action,
                              held="gallery",expect="denied")

    # ACTUAL current PR134-source Gallery-first RPC updates Gallery current
    # published revision and inserts GalleryRevisionPreset while another
    # session holds its linked PresetArtifact. Rejection/serialization through
    # Artifact would be required for the universal R12 protocol.
    def gallery_first(b):
        resp=one(b,"""select public.community_publish_gallery_v4(
          %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
          (g["auth"],g["publishingGalleryWork"],g["publishingGalleryVersion"],"R12 isolated gallery current",
           "rollback-only Source RPC",[g["oldMedia"]],[g["presetRev"]],[],[],None,
           "r12-gallery-"+str(uuid.uuid4())))[0]
        assert resp.get("revisionId"),resp
        assert one(b,"select current_published_revision_id from public.community_works where work_id=%s",
                   (g["publishingGalleryWork"],))[0]==uuid.UUID(resp["revisionId"])
        return resp
    isolated_two_sessions(url,g,"R12_GALLERY_FIRST_CURRENT_REVISION_BYPASS_ARTIFACT_LOCK",
                          gallery_first,expect="success")

    # An example of the required pre-lock order, only in this isolated
    # harness, not part of any activated source RPC or consumer permission.
    def candidate_wrapper(b):
        execute(b,"select preset_artifact_id from public.preset_artifacts where preset_artifact_id=%s for update",
                (g["artifact"],))
        return gallery_first(b)
    isolated_two_sessions(url,g,"R12_CANDIDATE_GALLERY_PREFLIGHT",candidate_wrapper,expect="lock")

    # Old moderation entry point is still deployed in Staging and local Source;
    # it MUST remain operational for safety. Demonstrate that its direct
    # GalleryWork state-write does not participate in linked Artifact locks.
    def moderation(b):
        response=one(b,"select public.community_moderate_work(%s,%s,'restrict',%s)",
                     (g["auth"],case,"R12 synthetic concurrent safety takedown"))[0]
        assert response.get("moderationState")=="restricted",response
        return response
    isolated_two_sessions(url,g,"R12_LEGACY_MODERATION_RPC_BYPASS_ARTIFACT_LOCK",
                          moderation,expect="success")

    # Source-derived bulk stage of ACCOUNT ERASURE, not the sensitive
    # community_tombstone_account session/recent-auth RPC itself. Its exact
    # update target/predicate exists in the current live function definition.
    # This negative must NOT be used to delay actual privacy hiding; the
    # contract needs immediate read suppression independent of graph cleanup.
    def erasure_bulk(b):
        return execute(b,"""update public.community_works
           set lifecycle_state='deleted',visibility='private'
           where owner_account_id=%s and lifecycle_state<>'deleted'""",(owner,))
    isolated_two_sessions(url,g,"R12_ACCOUNT_ERASURE_SOURCE_DERIVED_BULK",
                          erasure_bulk,expect="retirement_denied")
    print(json.dumps({"result":"R12_HETEROGENEOUS_WRITER_SOURCE_GAP_EVIDENCE_PASS",
      "actualGalleryFirstBypassConfirmed":True,
      "actualModerationBypassConfirmed":True,
      "accountErasureRpcNotInvoked":True,
      "sourceDerivedAccountErasureBulkBlockedByGalleryCloudGuard":True,
      "accountErasureUserJobPotentiallyBlocked":True,
      "genericPresetLifecyclePositivePermissionEnabled":False,
      "globalAllWriterLockOrderAccepted":False,
      "moderationAndErasureOperationsDisabled":False,
      "graphComplete":False,"retirementAuthorized":False}))

if __name__=="__main__":
    main()
