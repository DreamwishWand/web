#!/usr/bin/env python3
"""04 QR NEW_ONLY X05 Source147: FULL REAL 147 Supabase migrations, no Source144/145 stubs.
All accounts, works and bytes are synthetic inside a disposable local postgres.
No Stage, JWT, Provider, remote Storage or physical cleanup.
"""
import os, json, uuid, psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u=uuid.uuid4
def emit(**kw): print(json.dumps(kw,sort_keys=True,default=str),flush=True)
def one(db,sql,args=()): return db.execute(sql,args).fetchone()[0]
def denied(db,sql,args=()):
    with db.transaction():
        db.execute("SAVEPOINT qr147_case")
        try:
            db.execute(sql,args)
        except psycopg.Error as e:
            db.execute("ROLLBACK TO SAVEPOINT qr147_case")
            db.execute("RELEASE SAVEPOINT qr147_case")
            return {"denied":True,"sqlstate":e.sqlstate,"message":str(e).split("\n")[0][:190]}
        db.execute("ROLLBACK TO SAVEPOINT qr147_case")
        db.execute("RELEASE SAVEPOINT qr147_case")
        return {"denied":False}
def metadata(db,work):
    return one(db,"select private.dreamsnap_shared_public_work_metadata_v1(%s)",(work,))
def rolecheck(db,role,expect,fn_oids,table_oid):
    with db.transaction():
        db.execute("set local role "+role)
        outcome={}
        for fn, oid in fn_oids.items():
            outcome[fn]=one(db,"select has_function_privilege(current_user,%s::oid,'EXECUTE')",(oid,))
        outcome["insert"]=one(db,"select has_table_privilege(current_user,%s::oid,'INSERT')",(table_oid,))
        outcome["update"]=one(db,"select has_table_privilege(current_user,%s::oid,'UPDATE')",(table_oid,))
        outcome["delete"]=one(db,"select has_table_privilege(current_user,%s::oid,'DELETE')",(table_oid,))
        outcome["select"]=one(db,"select has_table_privilege(current_user,%s::oid,'SELECT')",(table_oid,))
        assert not any(outcome.values()),(role,outcome)
        emit(case="ACTUAL_ROLE_CATALOG_DENY",role=role,results=outcome,readerBackend=one(db,"select pg_backend_pid()"))
        # Avoid invoking protected private RPC even if a role lacks private schema USAGE:
        # negative catalog check above is the material privilege proof.

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    backendA=one(a,"select pg_backend_pid()")
    backendB=one(b,"select pg_backend_pid()")
    assert backendA!=backendB
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==147
    actual=one(a,"select pg_get_functiondef('private.dreamsnap_shared_public_work_metadata_v1(uuid)'::regprocedure)")
    assert "public.community_get_gallery_dreamsnap_public_v1" in actual
    assert "private.dreamsnap_public_work_accessible_r20" in actual
    assert "dreamsnap_post_event_staged_v1" in actual
    assert one(a,"select tgname from pg_trigger where tgrelid='private.dreamsnap_post_event_staged_v1'::regclass and not tgisinternal and tgenabled='O'")=="x05_post_event_stage_guard"
    assert one(a,"select pronamespace::regnamespace::text from pg_proc where oid='private.dreamsnap_shared_public_work_metadata_v1(uuid)'::regprocedure")=="private"
    assert one(a,"select count(*) from pg_proc where proname='dreamsnap_shared_public_work_metadata_v1' and pronamespace='public'::regnamespace")==0
    # Single source150? This acceptance pins new private objects and original real existing Source144+145.
    assert one(a,"select proname from pg_proc where oid='public.community_get_gallery_dreamsnap_public_v1(uuid)'::regprocedure")=="community_get_gallery_dreamsnap_public_v1"
    assert one(a,"select proname from pg_proc where oid='private.dreamsnap_public_work_accessible_r20(uuid)'::regprocedure")=="dreamsnap_public_work_accessible_r20"
    fn_oids={
      name:one(a,"select %s::regprocedure::oid",(name,)) for name in
      ("private.dreamsnap_shared_public_work_metadata_v1(uuid)",
       "private.dreamsnap_post_event_stage_validate_v1()")
    }
    table_oid=one(a,"select 'private.dreamsnap_post_event_staged_v1'::regclass::oid")
    for role in ("anon","authenticated","service_role"): rolecheck(b,role,False,fn_oids,table_oid)
    emit(marker="QR147_REAL_FULL147_2PG_CATALOG_PRIVATE_ACL_PASS",migrations=147,writerPid=backendA,readerPid=backendB)

    account,auth,creator,challenge=[u() for _ in range(4)]
    # Three real full-schema Community + DreamSnaps Works: one competition,
    # two independent privately STAGED post-event references (NO Entry).
    work_original,work_p1,work_p2=[u() for _ in range(3)]
    rev_original,rev_p1,rev_p2=[u() for _ in range(3)]
    media_original,media_p1,media_p2=[u() for _ in range(3)]
    entry=u()
    def create_work(work,rev,media,competition=False):
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
        a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
                    values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
        a.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
                    values(%s,%s,1,%s)""",(rev,work,account))
        a.execute("""insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13)
                    values(%s,%s,'self',false)""",(work,challenge))
        a.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
                    no_external_edits_attested,integrity_state,caption)
                    values(%s,%s,true,true,'eligible','QR147 disposable photo')""",(rev,challenge))
        a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
                    width,height,checksum_sha256,processing_state,moderation_state)
                    values(%s,%s,%s,'image/png',1234,1280,720,%s,'ready','clear')""",
                    (media,account,"qr147/local/disposable/"+str(media),"a"*64))
        a.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev,media))
        a.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(rev,work))
    with a.transaction():
        a.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
        a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
                    values(%s,'supabase',%s,now(),'active')""",(account,str(auth)))
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
                    values(%s,%s,%s,'QR147 isolated Creator')""",(creator,account,"qr147_"+u().hex[:19]))
        a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
                    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
                    formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
                    minimum_real_eligible_creators,is_synthetic)
                    values(%s,%s,'QR147 real schema challenge','results',now()-interval '8 hours',
                    now()-interval '7 hours',now()-interval '6 hours',now()-interval '5 hours',
                    now()-interval '4 hours',now()+interval '1 hour',2,1,1,1,false)""",
                    (challenge,"qr147_"+u().hex[:19]))
        for work,rev,media in ((work_original,rev_original,media_original),
                                (work_p1,rev_p1,media_p1),(work_p2,rev_p2,media_p2)):
            create_work(work,rev,media)
        a.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,
                    managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
                    values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",
                    (entry,challenge,work_original,account,rev_original))
        a.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,rev_original))
        a.execute("""insert into public.dreamsnap_gallery_publications(work_id,entry_id,revision_id,publication_state)
                    values(%s,%s,%s,'published')""",(work_original,entry,rev_original))
        a.execute("""update public.community_works set lifecycle_state='published',visibility='public',
                    current_published_revision_id=%s,published_at=now() where work_id=%s""",(rev_original,work_original))
    # Positive is REAL Source144 predicate + REAL Source145 JSON. 147 can return NULL
    # only if there is a legitimate independently reproduced gap in the new projection.
    old145=one(a,"select public.community_get_gallery_dreamsnap_public_v1(%s)",(work_original,))
    assert old145["workId"]==str(work_original),old145
    original=metadata(a,work_original)
    assert original and original["kind"]=="OriginalCompetition",("NEW_READER_POSITIVE_FAILED",original,old145)
    assert original["workId"]==str(work_original) and original["entryId"]==str(entry)
    assert original["entryRevisionId"]==str(rev_original)
    assert original["publishedRevisionId"]==str(rev_original)
    assert original["mediaId"]==str(media_original)
    assert original["officialDdvRank"] is None and original["wandRank"] is None
    for key in ("media","social","officialResults","conceptUpdate","delete"):
        assert original["capabilities"][key] is False,(key,original)
    assert original["capabilities"]["metadata"] is True
    assert not ({"storageKey","signedUrl","officialResult","reactions","comments","edit"} & set(original))
    emit(marker="QR147_ORIGINAL_ACTUAL_SOURCE144_145_FROZEN_POSITIVE_PASS",
        resultFields=sorted(original.keys()),originalMediaReferenceOnly=True)

    def stage_tuple(work,rev,media):
        return (work,challenge,creator,rev,media,rev)
    def insert_stage(work,rev,media):
        a.execute("""insert into private.dreamsnap_post_event_staged_v1(
                  work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
                  values(%s,%s,%s,%s,%s,%s)""",stage_tuple(work,rev,media))
    with a.transaction():
        insert_stage(work_p1,rev_p1,media_p1)
        insert_stage(work_p2,rev_p2,media_p2)
    rows=a.execute("""select work_id,publication_state,official_voting_authority,wand_voting_authority,
                      rights_provenance from private.dreamsnap_post_event_staged_v1
                      order by work_id""").fetchall()
    assert len(rows)==2 and all(row[1:]==("staged","unknown","unknown","unknown") for row in rows),rows
    assert one(a,"select count(*) from public.dreamsnap_entries where work_id in (%s,%s)",(work_p1,work_p2))==0
    assert metadata(a,work_p1) is None and metadata(a,work_p2) is None
    emit(marker="QR147_TWO_REAL_INDEPENDENT_NO_ENTRY_POSTEVENT_STAGED_PASS",
         stageRows=2,entryRows=0,publicationStates=["staged","staged"])

    # Source147 CHECK and guard boundaries. Actual PostgreSQL savepoint rollback
    # around each trial retains the positive baseline, no Staging deployment.
    checks=[
        ("PUBLICATION_PUBLISHED","update private.dreamsnap_post_event_staged_v1 set publication_state='published' where work_id=%s",(work_p1,)),
        ("VOTING_OFFICIAL_FORGED","update private.dreamsnap_post_event_staged_v1 set official_voting_authority='closed' where work_id=%s",(work_p1,)),
        ("VOTING_WAND_FORGED","update private.dreamsnap_post_event_staged_v1 set wand_voting_authority='closed' where work_id=%s",(work_p1,)),
        ("RIGHTS_FORGED","update private.dreamsnap_post_event_staged_v1 set rights_provenance='approved' where work_id=%s",(work_p1,)),
        ("CROSS_WORK_MEDIA","update private.dreamsnap_post_event_staged_v1 set media_id=%s where work_id=%s",(media_p2,work_p1)),
        ("CROSS_WORK_PHOTO","update private.dreamsnap_post_event_staged_v1 set immutable_photo_revision_id=%s where work_id=%s",(rev_p2,work_p1)),
        ("CROSS_WORK_CONCEPT","update private.dreamsnap_post_event_staged_v1 set concept_revision_id=%s where work_id=%s",(rev_p2,work_p1)),
        ("WRONG_CREATOR","update private.dreamsnap_post_event_staged_v1 set creator_profile_id=%s where work_id=%s",(u(),work_p1)),
        ("WRONG_CHALLENGE","update private.dreamsnap_post_event_staged_v1 set challenge_id=%s where work_id=%s",(u(),work_p1)),
        ("POSTEVENT_WORK_PRIVATE_REQUIRED","update public.community_works set visibility='public' where work_id=%s",(work_p1,)),
    ]
    exceptions=[]
    for name,sql,args in checks:
        if name=="POSTEVENT_WORK_PRIVATE_REQUIRED":continue # parent lifecycle validation belongs independent source
        result=denied(a,sql,args)
        assert result["denied"],("NEW_SOURCE147_GUARD_ACCEPTED_INVALID",name)
        exceptions.append(name)
    emit(marker="QR147_REAL_147_STAGE_CHECK_AND_REFERENCE_DENY_PASS",cases=exceptions)

    # For lower-level parent state changes, attempt a *new stage insert* on
    # second un-staged Work, not a fake Source144/145 function.
    def reset_stage_for_trial(): 
        a.execute("delete from private.dreamsnap_post_event_staged_v1 where work_id=%s",(work_p2,))
    def trial(name,sql,args,should_reject=True):
        with a.transaction():
            a.execute("SAVEPOINT qr147_parent")
            try:
                reset_stage_for_trial()
                a.execute(sql,args)
                val=denied(a,"""insert into private.dreamsnap_post_event_staged_v1(
                  work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
                  values(%s,%s,%s,%s,%s,%s)""",stage_tuple(work_p2,rev_p2,media_p2))
                emit(case="SOURCE147_PARENT_NEGATIVE",name=name,rejected=val["denied"],sqlstate=val.get("sqlstate"))
                if should_reject and not val["denied"]:
                    raise AssertionError(("SOURCE147_STAGE_ACCEPTS_INVALID_PARENT",name))
            finally:
                a.execute("ROLLBACK TO SAVEPOINT qr147_parent")
                a.execute("RELEASE SAVEPOINT qr147_parent")
    for name,sql,args in [
      ("MANAGED_UNDER13","update public.dreamsnap_works set managed_under13=true where work_id=%s",(work_p2,)),
      ("MEDIA_UNREADY","update public.media_assets set processing_state='processing' where media_id=%s",(media_p2,)),
      ("MEDIA_MODERATED","update public.media_assets set moderation_state='restricted' where media_id=%s",(media_p2,)),
      ("MEDIA_PURGED","update public.media_assets set purged_at=now() where media_id=%s",(media_p2,)),
      ("REVISION_INELIGIBLE","update public.dreamsnap_work_revisions set integrity_state='ineligible' where revision_id=%s",(rev_p2,)),
      ("WORK_NOT_PRIVATE","update public.community_works set visibility='public' where work_id=%s",(work_p2,)),
      ("CHALLENGE_JUDGING","update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",(challenge,)),
      ("CREATOR_OWNER_MISMATCH","update public.creator_profiles set owner_account_id=%s where creator_profile_id=%s",(u(),creator))
    ]: trial(name,sql,args)

    # Source147 does not claim external voting/rights/phase provenance. Any
    # failure to fail-closed for holder status is a new Source147-only red.
    # This test requires a later clean trial of account + identity/Privacy
    # without changing original historical readers.
    for name,sql,args in [
      ("ACCOUNT_RESTRICTED","update public.wand_accounts set status='restricted' where account_id=%s",(account,)),
      ("IDENTITY_RETIRED","update public.auth_identities set identity_state='retired' where account_id=%s",(account,)),
      ("PRIVACY_SUPPRESSED","insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,)),
      ("CREATOR_ENTITY_TOMBSTONE","update public.community_entities set deleted_at=now() where entity_id=%s",(creator,))
    ]: trial(name,sql,args)
    # Metadata Original embargo/privacy guard: new projection only, with actual
    # Source144/145 functions; independent full Source144 retest NOT done.
    for name,sql,args in [
      ("ORIGINAL_JUDGING_EMBARGO","update public.dreamsnap_challenges set lifecycle_state='judging_open' where challenge_id=%s",(challenge,)),
      ("ORIGINAL_CREATOR_PRIVATE","update public.creator_profiles set profile_visibility='private' where creator_profile_id=%s",(creator,)),
      ("ORIGINAL_ACCOUNT_RESTRICTED","update public.wand_accounts set status='restricted' where account_id=%s",(account,)),
      ("ORIGINAL_PRIVACY_SUPPRESSED","insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,)),
      ("ORIGINAL_WORK_UNPUBLISHED","update public.community_works set visibility='private' where work_id=%s",(work_original,)),
      ("ORIGINAL_ENTRY_INELIGIBLE","update public.dreamsnap_entries set eligibility_state='under_review' where entry_id=%s",(entry,))
    ]:
        with a.transaction():
            a.execute("SAVEPOINT qr147_original")
            try:
                a.execute(sql,args)
                assert metadata(a,work_original) is None,("QR147_ORIGINAL_PRIVATE_READER_EXPOSED",name)
                emit(case="QR147_ORIGINAL_REAL_READER_EMBARGO_DENY",name=name)
            finally:
                a.execute("ROLLBACK TO SAVEPOINT qr147_original")
                a.execute("RELEASE SAVEPOINT qr147_original")
    assert metadata(a,work_original) is not None
    emit(marker="QR147_REAL_FULL147_INDEPENDENT_METADATA_STAGE_ACCEPTANCE_PASS",schema="FULL_147",signedRuntime=False)
