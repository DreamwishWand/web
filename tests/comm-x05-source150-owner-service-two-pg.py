#!/usr/bin/env python3
"""Source150 NEW-ONLY verified JWT-actor wrapper tests with disposable full150 PG.
All JWT claims and accounts here are synthetic in a self-contained local DB,
not proof of a signed real issuer, account session or deployed Edge function.
"""
import os,uuid,json,time,psycopg
from concurrent.futures import ThreadPoolExecutor
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u=uuid.uuid4
def one(db,q,args=()): return db.execute(q,args).fetchone()[0]
def log(marker,**details): print(json.dumps(dict(marker=marker,**details),sort_keys=True,default=str),flush=True)
def case(db,subject,sql,args=(),role="authenticated",expired=False,epoch=None,missing_session=False,anonymous=False):
    """DB claim context mocked; production PostgREST verifies signed JWT upstream."""
    with db.transaction():
        db.execute("set local role "+role)
        claims={"role":role,"sub":str(subject),"session_id":str(u()) if not missing_session else None,
                "iat":int(time.time())-80000 if expired else int(time.time()),
                "is_anonymous":anonymous}
        db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
        db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
        db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
        if epoch is not None:
            db.execute("select set_config('request.jwt.claim.iat',%s,true)",(str(epoch),))
        try:
            # An expected PostgreSQL RAISE must abort only an inner SAVEPOINT,
            # never poison the outer synthetic transaction or role setup.
            with db.transaction():
                value=one(db,sql,args)
            return ("ok",value)
        except psycopg.Error as e:
            return ("blocked",e.sqlstate,str(e).split("\n")[0][:200])
def assert_denied(result,name):
    assert result[0]=="blocked",(name,result)
def read(db,subject,work,**opts):
    return case(db,subject,"select public.community_dreamsnap_x05_owner_read_v1(%s)",(work,),**opts)
def action(db,subject,work,ver,auth_epoch,act,photo=None,media=None,policy=None,digest=None,
           capture=None,accepted=None,concept=None,**opts):
    return case(db,subject,"""select public.community_dreamsnap_x05_owner_action_v1(
      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
      (work,ver,auth_epoch,act,photo,media,policy,digest,capture,accepted,concept),**opts)

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==150
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    private_fns=[
      "private.dreamsnap_x05_record_creator_grant_v1(uuid,uuid,uuid,uuid,text,text,bigint,boolean,boolean)",
      "private.dreamsnap_x05_owner_transition_v1(uuid,uuid,bigint,text,uuid)",
      "private.dreamsnap_x05_verified_db_subject_v1()"
    ]
    pub_fns=[
      "public.community_dreamsnap_x05_owner_read_v1(uuid)",
      "public.community_dreamsnap_x05_owner_action_v1(uuid,bigint,bigint,text,uuid,uuid,text,text,boolean,boolean,uuid)"
    ]
    for role in ("anon","authenticated","service_role"):
        for sign in private_fns:
            oid=one(a,"select %s::regprocedure::oid",(sign,))
            assert not one(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid)),(role,sign)
        for sign in pub_fns:
            oid=one(a,"select %s::regprocedure::oid",(sign,))
            value=one(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid))
            assert value==(role=="authenticated"),(role,sign,value)
    assert one(a,"select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
    log("COMM150_LEAST_PRIVILEGE_NO_PRIVATE_SOURCE149_GRANTS_PASS")
    account,auth,creator,challenge=[u() for _ in range(4)]
    original,post=[u(),u()]
    photo_original,photo_post=[u(),u()]
    media_original,media_post=[u(),u()]
    entry=u()
    def make_work(work,rev,media):
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
        a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
                     values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
        a.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                     values(%s,%s,1,%s)""",(rev,work,account))
        a.execute("""insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13)
                     values(%s,%s,'self',false)""",(work,challenge))
        a.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
                     no_external_edits_attested,integrity_state,caption)
                     values(%s,%s,true,true,'eligible','disposable image')""",(rev,challenge))
        a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
                     width,height,checksum_sha256,processing_state,moderation_state)
                     values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
                    (media,account,"comm149/local/disposable/"+str(media),"a"*64))
        a.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev,media))
        a.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(rev,work))
    with a.transaction():
        a.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
        a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(auth)))
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'Source149 Creator')",(creator,account,"comm149_"+u().hex[:19]))
        a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
                     submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
                     formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
                     minimum_real_eligible_creators,is_synthetic)
                     values(%s,%s,'Synthetic PostgreSQL Fixture','results',now()-interval '8 hours',
                     now()-interval '7 hours',now()-interval '6 hours',now()-interval '5 hours',
                     now()-interval '4 hours',now()+interval '1 hour',2,1,1,1,false)""",
                  (challenge,"comm149_"+u().hex[:19]))
        make_work(original,photo_original,media_original)
        make_work(post,photo_post,media_post)
        a.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,
                     managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
                     values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",
                  (entry,challenge,original,account,photo_original))
        a.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,photo_original))
        a.execute("insert into public.dreamsnap_gallery_publications(work_id,entry_id,revision_id,publication_state) values(%s,%s,%s,'published')",(original,entry,photo_original))
        a.execute("""update public.community_works set lifecycle_state='published',visibility='public',
                     current_published_revision_id=%s,published_at=now() where work_id=%s""",(photo_original,original))
        a.execute("""insert into private.dreamsnap_post_event_staged_v1(
                     work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
                     values(%s,%s,%s,%s,%s,%s)""",(post,challenge,creator,photo_post,media_post,photo_post))


    # No stored owner grant exists yet; never infer grants from a READY media or
    # the fixed weekly schedule. Register only synthetic policy into LOCAL PG.
    assert_denied(read(b,auth,post),"UNREGISTERED_WORK_READ")
    assert_denied(action(b,auth,post,0,0,"grant",photo_post,media_post,"v1","b"*64,True,True),"POLICY_UNSEEDED")
    a.execute("""insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active)
                 values('v1',%s,true)""",("b"*64,))
    assert_denied(action(b,u(),post,0,0,"grant",photo_post,media_post,"v1","b"*64,True,True),"WRONG_SUBJECT")
    assert_denied(action(b,auth,post,0,0,"grant",photo_post,media_post,"v1","c"*64,True,True),"FORGED_DIGEST")
    assert_denied(action(b,auth,post,0,0,"grant",photo_post,media_post,"v2","b"*64,True,True),"WRONG_POLICY")
    assert_denied(action(b,auth,post,0,0,"grant",photo_post,media_post,"v1","b"*64,False,True),"NO_SELF_CAPTURE")
    assert_denied(action(b,auth,post,0,0,"grant",photo_post,media_post,"v1","b"*64,True,False),"NO_AFFIRMATIVE_GRANT")
    assert_denied(action(b,auth,post,0,0,"grant",photo_original,media_post,"v1","b"*64,True,True),"WRONG_FROZEN")
    assert_denied(action(b,auth,post,0,0,"grant",photo_post,media_original,"v1","b"*64,True,True),"CROSS_WORK_MEDIA")
    assert_denied(read(b,auth,post,role="anon"),"ANON")
    assert_denied(read(b,auth,post,role="service_role"),"SERVICE_ROLE")
    assert_denied(read(b,auth,post,missing_session=True),"SESSION_MISSING")
    assert_denied(read(b,auth,post,anonymous=True),"ANONYMOUS_SIGN_IN")
    log("COMM150_CALLER_JWT_POLICY_OWNER_MEDIA_NEGATIVE_PASS")

    # Register an existing ORIGINAL and a private STAGED PostEvent without
    # creating public Works, Entry IDs or new source model.
    original_grant=action(b,auth,original,0,0,"grant",photo_original,media_original,"v1","b"*64,True,True)
    post_grant=action(b,auth,post,0,0,"grant",photo_post,media_post,"v1","b"*64,True,True)
    assert original_grant[0]=="ok",original_grant
    assert post_grant[0]=="ok",post_grant
    roriginal=read(b,auth,original); rpost=read(b,auth,post)
    assert roriginal[0]=="ok",roriginal
    assert rpost[0]=="ok",rpost
    q=roriginal[1];p=rpost[1]
    assert q["kind"]=="OriginalCompetition" and q["entryId"]==str(entry)
    assert q["frozenEntryRevisionId"]==str(photo_original)
    assert p["kind"]=="PostEventCreation" and "entryId" not in p
    assert "frozenEntryRevisionId" not in p
    assert q["imageGrant"]["policyVersionText"]=="v1"
    assert q["imageGrant"]["policyVersionOrdinal"]==1
    assert q["imageGrant"]["consentRevision"]==1
    assert q["imageGrant"]["policyDigest"]=="b"*64
    assert q["authorizationEpoch"]==1 and q["rowVersion"]==1
    assert "ownerAccountId" not in q and "storageKey" not in q and "signedUrl" not in q
    assert not q["capabilities"]["publicMedia"] and not p["capabilities"]["publish"]
    assert roriginal[1]["photoMediaId"]==str(media_original)
    log("COMM150_PRIVATE_TYPED_READ_ORIGINAL_POSTEVENT_POLICY_PROJECTION_PASS")

    # Already-accepted Source149 concurrency is NOT retested here. Test newly
    # introduced public narrow wrapper's epoch C.A.S. on two DB connections.
    assert_denied(action(b,auth,post,1,999,"preflight"),"MISMATCH_AUTH_EPOCH")
    assert_denied(action(b,auth,post,0,1,"preflight"),"STALE_ROW")
    assert_denied(action(b,auth,post,1,1,"withdraw",concept=photo_post),"EXTRA_ACTION_FIELD")
    with a.transaction():
        a.execute("savepoint retired")
        try:
            a.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
            assert_denied(read(a,auth,post),"RETIRED_IDENTITY")
        finally:
            a.execute("rollback to savepoint retired")
            a.execute("release savepoint retired")
    with a.transaction():
        a.execute("savepoint privacy")
        try:
            a.execute("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,))
            assert_denied(read(a,auth,post),"PRIVACY_SUPPRESSION")
        finally:
            a.execute("rollback to savepoint privacy")
            a.execute("release savepoint privacy")
    log("COMM150_IDENTITY_PRIVACY_STALE_EPOCH_NEGATIVE_PASS")

    # Per-source new wrapper CAS across distinct backends. Original public
    # visibility must flip when withdraw; cached Reader is not its own authority.
    with psycopg.connect(DSN,autocommit=True) as c:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=2) as pool:
            fa=pool.submit(action,b,auth,original,1,1,"withdraw")
            fc=pool.submit(action,c,auth,original,1,1,"withdraw")
            choices=[fa.result(),fc.result()]
        assert sum(x[0]=="ok" for x in choices)==1,choices
        assert sum(x[0]=="blocked" for x in choices)==1,choices
    assert one(a,"select visibility::text from public.community_works where work_id=%s",(original,))=="private"
    assert one(a,"select publication_state from public.dreamsnap_gallery_publications where work_id=%s",(original,))=="unpublished"
    after=read(b,auth,original)
    assert after[0]=="ok" and after[1]["erasure"]["state"]=="PUBLIC_DISABLED",after
    assert after[1]["rowVersion"]==2 and after[1]["authorizationEpoch"]==2
    assert after[1]["imageGrant"]["consentRevision"]==1  # revoke changes CAS, not grant receipt
    assert_denied(action(b,auth,original,1,1,"withdraw"),"REPLAY")
    assert_denied(action(b,auth,original,2,2,"grant",photo_original,media_original,"v1","b"*64,True,True),"REGRANT_TERMINAL")
    log("COMM150_WRAPPED_CAS_TWO_PG_REVOKE_REPLAY_PRIVATE_READ_PASS")

    deleted=action(b,auth,post,1,1,"delete")
    assert deleted[0]=="ok",deleted
    assert deleted[1]["owner"]["erasure"]["state"]=="MEDIA_PURGE_PENDING"
    assert deleted[1]["owner"]["erasure"]["physicalPurgeVerified"] is False
    assert deleted[1]["owner"]["erasure"]["providerStatus"]=="requested"
    assert deleted[1]["owner"]["rowVersion"]==2
    assert deleted[1]["owner"]["imageGrant"]["consentRevision"]==1
    assert one(a,"select verified_at from private.dreamsnap_x05_purge_tracking_v1 where work_id=%s",(post,)) is None
    # A genuine preexisting legal hold, not a fabricated media-purged status.
    with a.transaction():
        a.execute("savepoint hold")
        try:
            a.execute("""insert into private.account_retention_holds(account_id,hold_type,reason,created_by_account_id)
                         values(%s,'legal','synthetic test only',%s)""",(account,account))
            hold=read(a,auth,post)
            assert hold[0]=="ok" and hold[1]["erasure"]["state"]=="LEGAL_HOLD",hold
            assert not hold[1]["erasure"]["physicalPurgeVerified"]
        finally:
            a.execute("rollback to savepoint hold")
            a.execute("release savepoint hold")
    assert_denied(action(b,auth,post,2,2,"delete"),"DELETE_REPLAY")
    assert one(a,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='dreamsnap.x05_nonpublic_delete'",(post,))==1
    assert one(a,"select private.dreamsnap_x05_public_activation_v1(%s)",(post,)) is False
    log("COMM150_DELETE_REQUEST_LEGAL_HOLD_NOT_PROVIDER_PURGED_PASS")
    log("COMM150_SOURCE_LOCAL_COMPLETE",migrations=150,backends=[
      one(a,"select pg_backend_pid()"),one(b,"select pg_backend_pid()")])
