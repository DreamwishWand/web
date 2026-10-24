#!/usr/bin/env python3
"""09 INT R13 independent test of ACTUAL 03 COMM PR134 privacy Source.

Two ephemeral local PostgreSQL sessions use real
public.community_request_privacy_suppression_v1 + real
public.community_publish_gallery_v4. Modes:
  source-gap: demonstrates precommit privacy/publication cross-writer race.
  fenced: validation-only AAA account root lock prevents that race.
No mock RPC, no live Auth/Storage/CDN, NO Staging remote DSN, no production
privilege/migration change. R11 fixture imported only; no R11 tests run.
"""
import importlib.util,json,os,sys,threading,time,uuid
from pathlib import Path
import psycopg

f=Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py")
spec=importlib.util.spec_from_file_location("r13_source_fixture_only",f)
m=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=m
spec.loader.exec_module(m)
dsn=m.local_dsn()
one,execute,fixture=m.one,m.execute,m.fixture
mode=os.environ.get("DDVRE_R13_SOURCE_MODE")
assert mode in ("source-gap","fenced"),"REQUIRED_KNOWN_ISOLATED_MODE"

def fail_with(c,sql,args,parts):
    c.execute("BEGIN")
    try:
        try:
            one(c,sql,args)
            raise AssertionError("EXPECTED_PUBLIC_DENIAL_NOT_OBSERVED:"+repr(parts))
        except psycopg.Error as exc:
            assert any(p in str(exc) for p in parts),(str(exc),parts)
    finally:
        c.execute("ROLLBACK")

def prep_fixture(c):
    g=fixture(c)
    owner=one(c,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))[0]
    staff=one(c,"""select provider_subject::uuid,account_id from public.auth_identities
        where provider='supabase' and account_id<>%s limit 1""",(owner,))
    assert staff
    g["owner"]=owner
    g["staffAuth"],g["staffAccount"]=staff
    g["session"]=uuid.uuid4()
    g["newGallery"]=uuid.uuid4()
    g["modCase"]=uuid.uuid4()
    c.execute("BEGIN")
    try:
        execute(c,"insert into auth.users(id) values(%s) on conflict(id) do nothing",(g["auth"],))
        execute(c,"insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",
                (g["session"],g["auth"]))
        execute(c,"insert into public.account_roles(account_id,role) values(%s,'moderator') on conflict do nothing",
                (g["staffAccount"],))
        execute(c,"insert into public.moderation_cases(case_id,target_entity_id) values(%s,%s)",
                (g["modCase"],g["galleryWork"]))
        execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",
                (g["newGallery"],))
        execute(c,"""insert into public.community_works(
          work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
          select %s,owner_account_id,creator_profile_id,'gallery','public','clear'
          from public.community_works where work_id=%s""",(g["newGallery"],g["galleryWork"]))
        execute(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(g["newGallery"],))
        execute(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",
                (g["newGallery"],))
        for work in (g["galleryWork"],g["presetWork"]):
            execute(c,"""insert into public.search_documents(
              entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at)
              select work_id,work_id,work_type,creator_profile_id,'R13 old public fixture',
               'synthetic only',now(),now() from public.community_works where work_id=%s""",(work,))
        c.execute("COMMIT")
    except:
        c.execute("ROLLBACK")
        raise
    assert one(c,"select private.is_discoverable_work(%s)",(g["galleryWork"],))[0]
    assert one(c,"select count(*) from public.search_documents where work_id in (%s,%s)",
               (g["galleryWork"],g["presetWork"]))[0]==2
    assert one(c,"select public.community_gallery_media_gateway_v1(%s)",(g["oldMedia"],))[0]["publiclyAccessible"] is True
    assert one(c,"select count(*) from private.account_privacy_suppressions where account_id=%s",(owner,))[0]==0
    # Current 03 COMM Source resolve_active_account no longer explicitly
    # checks identity_state=active. Exercise this exact actor predicate in a
    # rolled-back local transaction; it must be returned as a separate
    # authorization gap, not equated with a signed identity attack.
    c.execute("BEGIN")
    try:
        execute(c,"update public.auth_identities set identity_state='retired' where account_id=%s",(g["staffAccount"],))
        accepted=one(c,"select private.resolve_active_account(%s)",(g["staffAuth"],))[0]
        assert accepted==g["staffAccount"],("SOURCE_AUTH_IDENTITY_BEHAVIOR_CHANGED",accepted)
        print(json.dumps({"case":"R13_SOURCE_ACTIVE_ACCOUNT_RESOLVER_RETIRED_AUTH_IDENTITY_NEGATIVE",
          "retiredSyntheticIdentityStillResolvesOwner":True,
          "actualSignedTokenAccepted":False,"rolledBack":True}))
    finally:
        c.execute("ROLLBACK")
    return g

def invoke_suppression(a,g):
    iat=one(a,"select extract(epoch from clock_timestamp())::bigint")[0]
    response=one(a,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",
                 (g["auth"],g["session"],iat))[0]
    assert response["privacyState"]=="suppressed_cleanup_pending",response
    assert response["fullDeletionComplete"] is False,response
    assert response["previousBearerUrlsRevoked"] is False,response
    return response

def invoke_gallery(b,g):
    return one(b,"""select public.community_publish_gallery_v4(
      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
      (g["auth"],g["newGallery"],1,
       "R13 actual source Gallery FIRST","cross-product privacy race",
       [g["oldMedia"]],[g["presetRev"]],[],[],None,
       "r13-source-gallery-"+str(uuid.uuid4())))[0]

def transient_retry_preflight(url,g):
    """Actual owner Privacy RPC fails 55P03 while Account lock is held.
    Entire failed DB transaction rolls back. A subsequent separate fresh
    transaction reauthorizes and attempts the same privacy operation in
    privacy_race() -- NOT a statement/savepoint continuation.
    """
    with psycopg.connect(url,autocommit=True) as a,psycopg.connect(url,autocommit=True) as b:
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        assert apid!=bpid
        a.execute("BEGIN")
        finished=threading.Event()
        result={}
        try:
            assert one(a,"select account_id from public.wand_accounts where account_id=%s for update",
                       (g["owner"],))==(g["owner"],)
            def worker():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='950ms'")
                    try:
                        invoke_suppression(b,g)
                        result["unexpectedSuccess"]=True
                    except psycopg.Error as ex:
                        result["sqlstate"]=ex.sqlstate
                except Exception as ex:
                    result["unexpected"]=repr(ex)
                finally:
                    b.execute("ROLLBACK")
                    finished.set()
            t=threading.Thread(target=worker,daemon=True)
            t.start()
            blocked=False
            deadline=time.monotonic()+2
            while time.monotonic()<deadline and not finished.is_set():
                pids=one(a,"select pg_blocking_pids(%s)",(bpid,))[0]
                if apid in (pids or []):
                    blocked=True
                    break
                time.sleep(.025)
            assert finished.wait(6),"R13_PRIVACY_LOCK_TIMEOUT_MISSING"
            t.join(1)
            assert blocked and result.get("sqlstate")=="55P03" and not result.get("unexpectedSuccess"),result
            assert one(a,"select count(*) from private.account_privacy_suppressions where account_id=%s",(g["owner"],))[0]==0
            print(json.dumps({"case":"R13_ACTUAL_OWNER_PRIVACY_RPC_TRANSIENT_LOCK_RETRY_BOUNDARY",
              "distinctBackends":True,"blockedByAccountRoot":True,
              "sqlstate":"55P03","failedWholeTransactionRolledBack":True,
              "subsequentExecutionRequiresFreshTransactionAndReauthorization":True,
              "automaticProductionRetryImplemented":False}))
        finally:
            a.execute("ROLLBACK")

def privacy_race(a,b,g):
    holder=one(a,"select pg_backend_pid()")[0]
    publisher=one(b,"select pg_backend_pid()")[0]
    assert holder!=publisher
    a.execute("BEGIN")
    first=invoke_suppression(a,g)
    assert one(a,"select count(*) from private.account_privacy_suppressions where account_id=%s",(g["owner"],))[0]==1
    # The barrier must remain UNCOMMITTED until B's source Writer has either
    # completed (unsafe source) or been physically blocked (candidate).
    finished=threading.Event()
    resume=threading.Event()
    result={}
    def writer():
        try:
            b.execute("BEGIN")
            b.execute("set local lock_timeout='5s'")
            try:
                response=invoke_gallery(b,g)
                result["response"]=response
                result["state"]="success"
            except psycopg.Error as exc:
                result["state"]="error"
                result["sqlstate"]=exc.sqlstate
                result["error"]=str(exc).splitlines()[0]
            finished.set()
            assert resume.wait(12),"R13_PUBLISH_COMMIT_RELEASE_MISSING"
            if result["state"]=="success":
                b.execute("COMMIT")
            else:
                b.execute("ROLLBACK")
        except Exception as exc:
            result["unexpected"]=repr(exc)
            try:b.execute("ROLLBACK")
            except:pass
            finished.set()
    t=threading.Thread(target=writer,daemon=True)
    t.start()
    blocked=False
    deadline=time.monotonic()+2.6
    while time.monotonic()<deadline and not finished.is_set():
        pids=one(a,"select pg_blocking_pids(%s)",(publisher,))[0]
        if holder in (pids or []):
            blocked=True
            break
        time.sleep(.02)
    if mode=="source-gap":
        assert finished.wait(3),("R13_UNEXPECTED_SOURCE_ACCOUNT_LOCK",result)
        assert result.get("state")=="success" and not blocked,result
        assert result["response"].get("revisionId"),result
        a.execute("COMMIT")
        resume.set()
        t.join(12)
        assert not t.is_alive() and "unexpected" not in result,result
        assert one(a,"select lifecycle_state from public.community_works where work_id=%s",(g["newGallery"],))[0]=="published"
        assert one(a,"select count(*) from public.search_documents where work_id=%s",(g["newGallery"],))[0]==1
        print(json.dumps({"case":"R13_SOURCE_REAL_BARRIER_VS_GALLERY_FIRST_WRITER_RACE",
          "holderPid":holder,"publisherPid":publisher,
          "sourceGalleryRpcSucceededBeforePrivacyCommit":True,
          "galleryCommitAfterPrivacyCommit":True,
          "newOwnerPublishedWorkAfterSuppression":True,
          "sourceAccountRootLockMissing":True,"positivePermissionAccepted":False}))
    else:
        assert blocked,("R13_FENCE_DID_NOT_BLOCK_ON_ACCOUNT_ROW",result)
        a.execute("COMMIT")
        assert finished.wait(6),("R13_FENCE_ERROR_MISSING",result)
        resume.set()
        t.join(12)
        assert not t.is_alive() and "unexpected" not in result,result
        assert result.get("state")=="error" and result.get("sqlstate")=="P0001",result
        assert "ACCOUNT_PRIVACY_SUPPRESSED" in result.get("error",""),result
        assert one(a,"select lifecycle_state from public.community_works where work_id=%s",(g["newGallery"],))[0]=="draft"
        assert one(a,"select count(*) from public.search_documents where work_id=%s",(g["newGallery"],))[0]==0
        print(json.dumps({"case":"R13_CANDIDATE_ACCOUNT_ROOT_BEFORE_PRIVACY_GUARD",
          "holderPid":holder,"publisherPid":publisher,
          "realTwoConnectionPgBlockingPids":True,
          "privacyBarrierCommitted":True,"gallerySourceSqlstate":"P0001",
          "newOwnerPublicationRejected":True,"newRevisionRolledBack":True,
          "fenceSourceMergedOrDeployed":False}))
    assert first["alreadySuppressed"] is False

def verify_public_and_moderation(c,g):
    owner=g["owner"]
    assert one(c,"select count(*) from private.account_privacy_suppressions where account_id=%s",(owner,))[0]==1
    assert not one(c,"select private.is_discoverable_work(%s)",(g["galleryWork"],))[0]
    assert not one(c,"select private.is_discoverable_work(%s)",(g["presetWork"],))[0]
    assert one(c,"select count(*) from public.search_documents where work_id in (%s,%s)",
      (g["galleryWork"],g["presetWork"]))[0]==0
    assert one(c,"select count(*) from public.community_search_public()")[0]==0,"read-time search must hide even stale newly committed projection"
    assert one(c,"select public.community_gallery_media_gateway_v1(%s)",(g["oldMedia"],))[0]["publiclyAccessible"] is False
    fail_with(c,"select public.community_get_public_media_storage_v1(%s)",(g["oldMedia"],),["Public media is not accessible"])
    fail_with(c,"select public.community_get_gallery_photo_public_v1(%s)",(g["galleryWork"],),
        ["Gallery Work is not publicly accessible","Creator Profile is not publicly accessible"])
    fail_with(c,"select public.community_get_scene_preset_public_v1(%s)",(g["presetWork"],),
        ["Scene Preset is not publicly accessible"])
    fail_with(c,"select private.resolve_active_account(%s)",(g["auth"],),["ACCOUNT_PRIVACY_SUPPRESSED"])
    # Owner's valid recent session may retry suppression idempotently without
    # reauthorizing general write/publish access.
    re=invoke_suppression(c,g)
    assert re["alreadySuppressed"] is True
    assert one(c,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='account.privacy_suppressed'",
       (owner,))[0]==1
    # Emergency moderator restrict still succeeds inside rollback-only test.
    c.execute("BEGIN")
    try:
        result=one(c,"select public.community_moderate_work(%s,%s,'restrict',%s)",
          (g["staffAuth"],g["modCase"],"R13 moderator emergency safety restriction"))[0]
        assert result["moderationState"]=="restricted",result
    finally:
        c.execute("ROLLBACK")
    # Gallery Cloud guard has NOT been changed to allow forbidden retirements.
    fail_with(c,"update public.community_works set visibility='private' where work_id=%s",
       (g["galleryWork"],),["GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED"])
    print(json.dumps({"case":"R13_OWNER_SOURCE_PRIVACY_BARRIER_PUBLIC_PROJECTIONS",
        "searchPublicRows":0,
        "creatorAndGalleryAndScenePublicReadsDenied":True,
        "newMediaGatewayDenied":True,
        "existingWorkStillPublicInRawDB":True,
        "moderatorRestrictStillWorks":True,
        "repeatedSuppressionIdempotent":True,
        "alreadyIssuedBearerStillPossiblyValid":True,
        "fullAccountErasureComplete":False}))

def main():
    with psycopg.connect(dsn,autocommit=True) as setup:
        g=prep_fixture(setup)
    transient_retry_preflight(dsn,g)
    with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
        privacy_race(a,b,g)
    with psycopg.connect(dsn,autocommit=True) as c:
        verify_public_and_moderation(c,g)
    print(json.dumps({"result":"R13_COMM_OWNER_SOURCE_PRIVACY_CROSS_WRITER_INDEPENDENT_ACCEPTANCE",
        "mode":mode,"sourcePR134PinnedSha":"18730fd7b5fe1f554f4d8d4b9d83a0109484479f",
        "actualOwnerSourceRPCs":True,
        "authorizedSignedStagingActors":False,
        "fullCurrentHistoricalGraphEnrolled":False,
        "graphComplete":False,"retirementAuthorized":False}))

if __name__=="__main__":
    main()
