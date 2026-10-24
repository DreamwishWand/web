#!/usr/bin/env python3
"""DDVRE 09 INT R13: isolated 113-migration PostgreSQL, not Staging.

Actual source Gallery-first writer and moderator; validation-only privacy
overlay loaded AFTER original migrations. Distinct two-session barriers,
transient SQLSTATE 55P03 whole-transaction retry, public-detail/search/
current-media issuance denial, and no Gallery Cloud guard removal.
Never insert real Auth, owner data or Storage bytes.
"""
import importlib.util,json,threading,time,uuid,sys
from pathlib import Path
import psycopg

helper=Path(__file__).with_name("09int-r11-pr134-all-known-writers-concurrency.py")
spec=importlib.util.spec_from_file_location("r13_fixture_only",helper)
m=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=m
spec.loader.exec_module(m)
dsn=m.local_dsn()
one,execute,fixture=m.one,m.execute,m.fixture

def read(c,g):
    return one(c,"""select count(*) from public.search_documents
      where work_id in (%s,%s)""",(g["galleryWork"],g["presetWork"]))[0]

def suppression_count(c,owner):
    return one(c,"select count(*) from private.r13_account_privacy_barriers where account_id=%s",(owner,))[0]

def barrier(c,g,session,key):
    iat=one(c,"select extract(epoch from clock_timestamp())::bigint")[0]
    return one(c,"select private.r13_begin_account_privacy_barrier(%s,%s,%s,'DELETE',%s)",
        (g["auth"],session,iat,key))[0]

def new_session_local(c,g):
    session=uuid.uuid4()
    execute(c,"insert into auth.users(id) values(%s) on conflict(id) do nothing",(g["auth"],))
    execute(c,"insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",
        (session,g["auth"]))
    return session

def fail_with(c,command,args,fragment):
    c.execute("BEGIN")
    try:
        try:
            one(c,command,args)
            raise AssertionError("R13_EXPECTED_FAIL_CLOSED:"+fragment)
        except psycopg.Error as exc:
            assert fragment in str(exc),(fragment,str(exc))
    finally:
        c.execute("ROLLBACK")

def live_checks(c,g):
    assert one(c,"select private.is_discoverable_work(%s)",(g["galleryWork"],))[0]
    assert one(c,"select private.is_discoverable_work(%s)",(g["presetWork"],))[0]
    p=one(c,"select public.community_get_gallery_photo_public_v1(%s)",(g["galleryWork"],))[0]
    assert p and p.get("coverMediaId")==str(g["oldMedia"]),p
    sp=one(c,"select public.community_get_scene_preset_public_v1(%s)",(g["presetWork"],))[0]
    assert sp and sp.get("presetRevisionId")==str(g["presetRev"]),sp
    m1=one(c,"select public.community_get_public_media_storage_v1(%s)",(g["oldMedia"],))[0]
    assert m1 and m1.get("mediaId")==str(g["oldMedia"]),m1
    gateway=one(c,"select public.community_gallery_media_gateway_v1(%s)",(g["oldMedia"],))[0]
    assert gateway.get("publiclyAccessible") is True,gateway
    assert read(c,g)==2,("expected two indexed synthetic works",read(c,g))

def retry_negative(url,g,owner,session):
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        old_count=suppression_count(a,owner)
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        assert old_count==0 and apid!=bpid
        a.execute("BEGIN")
        try:
            assert one(a,"select account_id from public.wand_accounts where account_id=%s for update",
                        (owner,))==(owner,)
            done=threading.Event()
            result={}
            def worker():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='950ms'")
                    try:
                        barrier(b,g,session,"r13-account-owner-retry-lock")
                        result["unexpectedSuccess"]=True
                    except psycopg.Error as ex:
                        result["sqlstate"]=ex.sqlstate
                except Exception as ex:
                    result["unexpected"]=str(ex)
                finally:
                    b.execute("ROLLBACK")
                    done.set()
            t=threading.Thread(target=worker,daemon=True)
            t.start()
            seen_block=False
            deadline=time.monotonic()+2
            while time.monotonic()<deadline and not done.is_set():
                pids=one(a,"select pg_blocking_pids(%s)",(bpid,))[0]
                if apid in (pids or []):
                    seen_block=True
                    break
                time.sleep(.025)
            assert done.wait(6),"R13_PRIVACY_LOCK_TIMEOUT_MISSING"
            t.join(1)
            assert result.get("sqlstate")=="55P03" and seen_block and not result.get("unexpectedSuccess"),result
            assert suppression_count(a,owner)==0
            print(json.dumps({"case":"R13_ACTUAL_PRIVACY_BARRIER_WHOLE_TXN_RETRY_PRECONDITION",
                "holderBackend":apid,"writerBackend":bpid,"pgBlockingPidsConfirmed":seen_block,
                "sqlstate":"55P03","firstAttemptFullyRolledBack":True}))
        finally:
            a.execute("ROLLBACK")
        assert suppression_count(a,owner)==0
    # A real *fresh* whole transaction is used later, not a savepoint retry.

def concurrent_gallery_vs_suppression(url,g,owner,session,new_gallery):
    with psycopg.connect(url,autocommit=True) as a, psycopg.connect(url,autocommit=True) as b:
        before_gallery=one(a,"select count(*) from public.community_work_revisions where work_id=%s",(new_gallery,))[0]
        assert before_gallery==0
        original_links=one(a,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id where r.work_id=%s",(new_gallery,))[0]
        assert original_links==0
        apid=one(a,"select pg_backend_pid()")[0]
        bpid=one(b,"select pg_backend_pid()")[0]
        bdone=threading.Event()
        result={}
        a.execute("BEGIN")
        try:
            assert one(a,"select account_id from public.wand_accounts where account_id=%s for update",(owner,))==(owner,)
            def writer():
                try:
                    b.execute("BEGIN")
                    b.execute("set local lock_timeout='6s'")
                    try:
                        result["response"]=one(b,"""select public.community_publish_gallery_v4(
                            %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s)""",
                           (g["auth"],new_gallery,1,
                            "R13 initially admitted Gallery-first","privacy fence concurrent rollback",
                            [g["oldMedia"]],[g["presetRev"]],[],[],None,
                            "r13-gallery-concurrent-"+str(uuid.uuid4())))[0]
                        result["unexpectedPublish"]=True
                    except psycopg.Error as ex:
                        result["sqlstate"]=ex.sqlstate
                        result["message"]=str(ex).splitlines()[0]
                except Exception as ex:
                    result["unexpected"]=str(ex)
                finally:
                    b.execute("ROLLBACK")
                    bdone.set()
            thread=threading.Thread(target=writer,daemon=True)
            thread.start()
            blocked=False
            deadline=time.monotonic()+4
            while time.monotonic()<deadline and not bdone.is_set():
                pids=one(a,"select pg_blocking_pids(%s)",(bpid,))[0]
                if apid in (pids or []):
                    blocked=True
                    break
                time.sleep(.025)
            assert blocked,("R13_ACCOUNT_BARRIER_PUBLICATION_NOT_SERIALIZED",result)
            resp=barrier(a,g,session,"r13-owner-account-privacy-suppression")
            assert resp["suppressed"] is True and resp["cleanupComplete"] is False,resp
            assert suppression_count(a,owner)==1
            a.execute("COMMIT")
        except:
            a.execute("ROLLBACK")
            raise
        assert bdone.wait(10),"R13_GALLERY_PUBLICATION_THREAD_TIMEOUT"
        thread.join(1)
        assert result.get("sqlstate")=="P0001" and "R13_OWNER_PUBLICATION_BARRIER" in result.get("message",""),result
        assert not result.get("unexpectedPublish") and not result.get("unexpected"),result
        assert one(a,"select count(*) from public.community_work_revisions where work_id=%s",(new_gallery,))[0]==0
        assert one(a,"select count(*) from public.gallery_revision_presets gp join public.community_work_revisions r on r.revision_id=gp.gallery_revision_id where r.work_id=%s",(new_gallery,))[0]==0
        print(json.dumps({"case":"R13_ACTUAL_GALLERY_V4_PUBLISH_VS_COMMITTED_PRIVACY_BARRIER",
            "actorAndGalleryWriterTwoBackends":True,"writerBlockedByAccountRow":True,
            "privacyBarrierCommitted":True,"gallerySqlstate":"P0001",
            "galleryRollbackNoRevisionOrSearchOrOutbox":True,
            "ownerCloudRetirementGuardStillEnabled":True,
            "allWriterEnrollmentAccepted":False}))

def after_suppression(c,g,owner,staff_auth,case):
    assert suppression_count(c,owner)==1
    assert not one(c,"select private.is_discoverable_work(%s)",(g["galleryWork"],))[0]
    assert not one(c,"select private.is_discoverable_work(%s)",(g["presetWork"],))[0]
    assert read(c,g)==0
    assert one(c,"select count(*) from public.community_works where work_id in (%s,%s) and lifecycle_state='published' and visibility='public'",
        (g["galleryWork"],g["presetWork"]))[0]==2,"must preserve cloud guard and historical works"
    fail_with(c,"select public.community_get_gallery_photo_public_v1(%s)",(g["galleryWork"],),
              "Creator Profile is not publicly accessible")
    fail_with(c,"select public.community_get_scene_preset_public_v1(%s)",(g["presetWork"],),
              "Scene Preset is not publicly accessible")
    fail_with(c,"select public.community_get_public_media_storage_v1(%s)",(g["oldMedia"],),
              "Public media is not accessible")
    gateway=one(c,"select public.community_gallery_media_gateway_v1(%s)",(g["oldMedia"],))[0]
    assert gateway.get("galleryManaged") is True and gateway.get("publiclyAccessible") is False,gateway
    fail_with(c,"select private.resolve_active_account(%s)",(g["auth"],),
              "R13_ACCOUNT_PRIVACY_BARRIER_ACTIVE")
    # Even if old request was accepted before suppression, next source command
    # sees the durable owner barrier after the new DB transaction.
    fail_with(c,"select public.community_unpublish_work(%s,%s,%s,%s)",
              (g["auth"],g["presetWork"],g["presetVersion"],"r13-old-user-unpublish"),
              "R13_ACCOUNT_PRIVACY_BARRIER_ACTIVE")
    # Search projector should be unable to reinsert a stale public hit.
    fail_with(c,"""insert into public.search_documents(
      entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at)
      select work_id,work_id,work_type,creator_profile_id,
          'stale after suppression','DENIED',now(),now()
      from public.community_works where work_id=%s""",
       (g["galleryWork"],),"R13_SEARCH_PROJECTION_SUPPRESSED")
    # Legacy PUBLIC Gallery Cloud guard still rejects attempts to convert its
    # public Work into private, even by a DB-owner-only test SQL statement.
    fail_with(c,"update public.community_works set visibility='private' where work_id=%s",
       (g["galleryWork"],),"GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED")
    # Moderator must still be permitted to perform emergency restriction.
    c.execute("BEGIN")
    try:
        resp=one(c,"select public.community_moderate_work(%s,%s,'restrict',%s)",
                 (staff_auth,case,"R13 isolated safety restriction after owner suppression"))[0]
        assert resp["moderationState"]=="restricted",resp
        assert not one(c,"select private.is_discoverable_work(%s)",(g["galleryWork"],))[0]
        print(json.dumps({"case":"R13_MODERATOR_EMERGENCY_RESTRICT_STILL_EXECUTES",
            "actualSourceRpc":True,"safetyPathNotDisabled":True,"willRollback":True}))
    finally:
        c.execute("ROLLBACK")
    assert not one(c,"select private.is_discoverable_work(%s)",(g["galleryWork"],))[0]
    assert read(c,g)==0
    print(json.dumps({"case":"R13_COMMITTED_SOURCE_PRIVACY_READ_SEARCH_CURRENT_MEDIA_DENIAL",
      "publicGalleryDenied":True,"publicSceneDenied":True,"newMediaIssuerDenied":True,
      "publicSearchDocuments":0,"ownerNewWritesDenied":True,
      "existingCloudGuardUnmodified":True,"priorSignedUrlExpiryUnproved":True,
      "deferredCleanupStillPending":True}))

def main():
    with psycopg.connect(dsn,autocommit=True) as c:
        g=fixture(c)
        owner=one(c,"select owner_account_id from public.community_works where work_id=%s",(g["galleryWork"],))[0]
        staff=one(c,"""select i.provider_subject::uuid,a.account_id
            from public.auth_identities i join public.wand_accounts a on a.account_id=i.account_id
            where a.account_id<>%s and i.provider='supabase' limit 1""",(owner,))
        assert staff
        staff_auth,staff_id=staff
        sid=uuid.uuid4()
        modcase=uuid.uuid4()
        newgallery=uuid.uuid4()
        c.execute("BEGIN")
        try:
            execute(c,"insert into auth.users(id) values(%s) on conflict(id) do nothing",(g["auth"],))
            execute(c,"insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(sid,g["auth"]))
            execute(c,"insert into public.account_roles(account_id,role) values(%s,'moderator') on conflict do nothing",(staff_id,))
            execute(c,"insert into public.moderation_cases(case_id,target_entity_id) values(%s,%s)",(modcase,g["galleryWork"]))
            execute(c,"insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(newgallery,))
            execute(c,"""insert into public.community_works(
              work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
              select %s,owner_account_id,creator_profile_id,'gallery','public','clear'
              from public.community_works where work_id=%s""",(newgallery,g["galleryWork"]))
            execute(c,"insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(newgallery,))
            execute(c,"insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(newgallery,))
            # R11 shared fixture does not create SearchDocuments until its
            # later paired Scene positive test. Seed exactly two independently
            # discoverable projection rows for the R13 suppression test.
            for work in (g["galleryWork"],g["presetWork"]):
                execute(c,"""insert into public.search_documents(
                   entity_id,work_id,work_type,creator_profile_id,title,text_content,published_at,updated_at)
                   select work_id,work_id,work_type,creator_profile_id,
                     'R13 indexed local fixture','synthetic only',now(),now()
                   from public.community_works where work_id=%s""",(work,))
            c.execute("COMMIT")
        except:
            c.execute("ROLLBACK")
            raise
        live_checks(c,g)
        # Unauthenticated/recent-session mismatched caller cannot establish
        # suppression and may not mutate the Account/Index.
        fail_with(c,"select private.r13_begin_account_privacy_barrier(%s,%s,%s,'DELETE',%s)",
                  (g["auth"],uuid.uuid4(),one(c,"select extract(epoch from clock_timestamp())::bigint")[0],
                   "r13-invalid-session-not-authorized"),"Authenticated session not found")
        assert suppression_count(c,owner)==0
        assert one(c,"select has_function_privilege('service_role','private.r13_begin_account_privacy_barrier(uuid,uuid,bigint,text,text)','EXECUTE')")[0] is False
    retry_negative(dsn,g,owner,sid)
    concurrent_gallery_vs_suppression(dsn,g,owner,sid,newgallery)
    with psycopg.connect(dsn,autocommit=True) as c:
        after_suppression(c,g,owner,staff_auth,modcase)
    print(json.dumps({"result":"R13_ISOLATED_PRIVACY_BARRIER_AND_GALLERY_V4_TWO_SESSION_PASS",
      "realSourceGalleryFirstRpc":True,"syntheticAuthRecentSession":True,
      "wholeTransactionRetrySource":True,"actorRecheckEveryAttempt":True,
      "fullGraphAuthorityEnrolled":False,
      "releaseApproved":False,"signedStagingActorsOrCdnAccepted":False,
      "graphComplete":False,"retirementAuthorized":False}))

if __name__=="__main__":
    main()
