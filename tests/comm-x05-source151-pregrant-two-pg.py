#!/usr/bin/env python3
"""Source151 NEW-ONLY disposable full151 local PostgreSQL, two independent DB sessions.
GUC claims + policy text are SYNTHETIC test oracles; never trusted signatures
or real Owner-approved publication policy.
"""
import os,uuid,json,time,hashlib,psycopg
from concurrent.futures import ThreadPoolExecutor
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u=uuid.uuid4
def one(db,q,args=()):return db.execute(q,args).fetchone()[0]
def log(marker,**details): print(json.dumps(dict(marker=marker,**details),sort_keys=True,default=str),flush=True)
def case(db,subject,sql,args=(),role="authenticated",anonymous=False,missing_session=False):
    """Simulates JWT claim GUC; cannot validate a real signed issuer."""
    with db.transaction():
        db.execute("set local role "+role)
        claims={"role":role,"sub":str(subject),"session_id":str(u()) if not missing_session else None,
          "iat":int(time.time()),"is_anonymous":anonymous}
        db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
        db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
        db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
        try:
            with db.transaction():
                value=one(db,sql,args)
            return ("ok",value)
        except psycopg.Error as e:return ("blocked",e.sqlstate,str(e).split("\n")[0][:240])
def deny(x,label):assert x[0]=="blocked",(label,x)
def pre(db,subject,work,**k):
    return case(db,subject,"select public.community_dreamsnap_x05_pregrant_read_v1(%s)",(work,),**k)
def grant(db,subject,work,photo,media,digest,ver=0,epoch=0):
    return case(db,subject,"""select public.community_dreamsnap_x05_owner_action_v1(
      %s,%s,%s,'grant',%s,%s,'v1',%s,true,true,null)""",(work,ver,epoch,photo,media,digest))
def owner(db,subject,work):
    return case(db,subject,"select public.community_dreamsnap_x05_owner_read_v1(%s)",(work,))
with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==151
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    f="public.community_dreamsnap_x05_pregrant_read_v1(uuid)"
    oid=one(a,"select %s::regprocedure::oid",(f,))
    for role in ("anon","service_role","authenticated"):
        assert bool(one(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid)))==(role=="authenticated")
    for table in ("private.dreamsnap_x05_policy_receipt_v1","private.dreamsnap_x05_owner_policy_v1"):
        oid=one(a,"select %s::regclass::oid",(table,))
        for role in ("anon","authenticated","service_role"):
            assert not one(a,"select has_table_privilege(%s,%s::oid,'SELECT')",(role,oid))
    assert one(a,"select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
    assert one(a,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
    log("COMM151_POLICY_REGISTRY_EMPTY_NO_FAKE_APPROVAL_PASS")
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



    deny(owner(b,auth,post),"OLD_OWNER_READ_NO_CONTROL")
    deny(pre(b,u(),post),"UNKNOWN_OWNER")
    deny(pre(b,auth,post,role="anon"),"ANON")
    deny(pre(b,auth,post,role="service_role"),"SERVICE")
    deny(pre(b,auth,post,missing_session=True),"MISSING_SESSION")
    deny(pre(b,auth,post,anonymous=True),"ANON_SESSION")
    rpost=pre(b,auth,post); rorig=pre(b,auth,original)
    assert rpost[0]=="ok" and rorig[0]=="ok",(rpost,rorig)
    pp,op=rpost[1],rorig[1]
    assert pp["state"]=="NEED_POLICY_ARTIFACT" and pp["grantAvailable"] is False
    assert pp["expectedRowVersion"]==pp["expectedAuthorizationEpoch"]==0
    assert pp["grantRecorded"] is False and pp["publicActivationAllowed"] is False
    assert pp["officialChallengePhaseVerified"] is False
    assert pp["workPhotoBindingVerified"] and pp["mediaOwnershipVerified"]
    assert pp["kind"]=="PostEventCreation" and "entryId" not in pp and "frozenEntryRevisionId" not in pp
    assert pp["photoRevisionId"]==str(photo_post) and pp["photoMediaId"]==str(media_post)
    assert op["kind"]=="OriginalCompetition" and op["entryId"]==str(entry)
    assert op["frozenEntryRevisionId"]==str(photo_original)
    assert "ownerAccountId" not in pp and "storageKey" not in pp and "signedUrl" not in pp
    assert one(a,"select count(*) from private.dreamsnap_x05_work_control_v1")==0
    assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1")==0
    log("COMM151_OWNER_ONLY_PREGRANT_NO_CONTROL_OR_POLICY_PASS")

    # All negative probe mutations are synthetic and rolled back locally.
    with a.transaction():
        a.execute("savepoint identity_negative")
        a.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
        deny(pre(a,auth,post),"RETIRED_IDENTITY")
        a.execute("rollback to savepoint identity_negative")
        a.execute("release savepoint identity_negative")
    with a.transaction():
        a.execute("savepoint media_negative")
        a.execute("update public.media_assets set moderation_state='blocked' where media_id=%s",(media_post,))
        deny(pre(a,auth,post),"BLOCKED_MEDIA")
        a.execute("rollback to savepoint media_negative")
        a.execute("release savepoint media_negative")
    with a.transaction():
        a.execute("savepoint privacy_negative")
        a.execute("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,))
        deny(pre(a,auth,post),"PRIVACY_SUPPRESSED")
        a.execute("rollback to savepoint privacy_negative")
        a.execute("release savepoint privacy_negative")
    log("COMM151_RETIRED_PRIVACY_MEDIA_NEGATIVE_PASS")

    # This is NOT a shipped policy, only a local disposable synthetic artifact.
    policy_text="SYNTHETIC LOCAL TEST ONLY: nonexclusive, purpose-limited, revocable example, no Disney rights claim."
    digest=hashlib.sha256(policy_text.encode("utf-8")).hexdigest()
    a.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,false)",(digest,))
    try:
        a.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
        raise AssertionError("false activation without receipt accepted")
    except psycopg.Error as e:
        assert "X05_POLICY_ARTIFACT_REQUIRED_OR_DIGEST_MISMATCH" in str(e)
    deny(grant(b,auth,post,photo_post,media_post,digest),"GRANT_WITHOUT_APPROVED_POLICY")
    assert one(a,"select count(*) from private.dreamsnap_x05_work_control_v1")==0
    a.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(
                 policy_version,canonical_text,approval_reference,approved_at)
                 values('v1',%s,'SYNTHETIC LOCAL FIXTURE; NO PRODUCTION APPROVAL',now())""",(policy_text,))
    try:
        a.execute("update private.dreamsnap_x05_policy_receipt_v1 set canonical_text='forged' where policy_version='v1'")
        raise AssertionError("immutable receipt altered")
    except psycopg.Error as e:assert "X05_APPROVED_POLICY_RECEIPT_IMMUTABLE" in str(e)
    a.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
    q=pre(b,auth,post)
    assert q[0]=="ok",q
    state=q[1]
    assert state["state"]=="PREGRANT_READY" and state["grantAvailable"] is True
    assert state["policyReceipt"]["canonicalText"]==policy_text
    assert state["policyReceipt"]["policyDigest"]==digest
    assert state["policyReceipt"]["policyVersionText"]=="v1"
    deny(grant(b,auth,post,photo_post,media_original,digest),"MISMATCH_MEDIA")
    assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1")==0
    log("COMM151_SYNTHETIC_POLICY_SHA_APPROVAL_RECEIPT_AND_ROLLBACK_PASS")

    # Initial Work grant 0,0 on TWO real distinct PostgreSQL connections.
    # The existing Source149/150 CAS implementation is used unchanged.
    with psycopg.connect(DSN,autocommit=True) as c:
        with ThreadPoolExecutor(max_workers=2) as pool:
            x=pool.submit(grant,b,auth,post,photo_post,media_post,digest)
            y=pool.submit(grant,c,auth,post,photo_post,media_post,digest)
            results=[x.result(),y.result()]
        assert sum(z[0]=="ok" for z in results)==1,results
        assert sum(z[0]=="blocked" for z in results)==1,results
    assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(post,))==1
    assert one(a,"select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,))==1
    assert one(a,"select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,))==1
    deny(pre(b,auth,post),"PREGRANT_AFTER_GRANT")
    received=owner(b,auth,post)
    assert received[0]=="ok" and received[1]["imageGrant"]["consentRevision"]==1,received
    assert received[1]["kind"]=="PostEventCreation" and received[1]["rowVersion"]==1
    assert received[1]["capabilities"]["publish"] is False
    deny(grant(b,auth,post,photo_post,media_post,digest),"REPLAY_0_0")
    log("COMM151_TWO_PG_INITIAL_GRANT_CAS_AND_OWNER_READ_AFTER_GRANT_PASS")
    log("COMM151_SOURCE_LOCAL_COMPLETE",migrations=151,backends=[one(a,"select pg_backend_pid()"),one(b,"select pg_backend_pid()")])
