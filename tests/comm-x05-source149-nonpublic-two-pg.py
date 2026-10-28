#!/usr/bin/env python3
"""Source149 NEW-ONLY isolated 149-schema real PostgreSQL test; no source148 acceptance rerun."""
import os, json, uuid, psycopg
from concurrent.futures import ThreadPoolExecutor
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("SUPABASE_ACCESS_TOKEN") and not os.getenv("DATABASE_URL")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u=uuid.uuid4
def one(db,sql,args=()): return db.execute(sql,args).fetchone()[0]
def fail(db,sql,args=()):
    with db.transaction():
        db.execute("SAVEPOINT x05negative")
        try: db.execute(sql,args)
        except psycopg.Error as e:
            db.execute("ROLLBACK TO SAVEPOINT x05negative")
            db.execute("RELEASE SAVEPOINT x05negative")
            return e.sqlstate
        db.execute("ROLLBACK TO SAVEPOINT x05negative")
        db.execute("RELEASE SAVEPOINT x05negative")
    return None
def log(marker,**d): print(json.dumps(dict(marker=marker,**d),sort_keys=True,default=str),flush=True)

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select count(*) from supabase_migrations.schema_migrations")==149
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    fn_signatures=("private.dreamsnap_x05_record_creator_grant_v1(uuid,uuid,uuid,uuid,text,text,bigint,boolean,boolean)",
                   "private.dreamsnap_x05_owner_transition_v1(uuid,uuid,bigint,text,uuid)",
                   "private.dreamsnap_x05_schedule_preflight_v1(timestamptz,timestamptz)",
                   "private.dreamsnap_x05_control_live_v1(uuid)",
                   "private.dreamsnap_x05_public_activation_v1(uuid)")
    fn_oids={reg:one(a,"select %s::regprocedure::oid",(reg,)) for reg in fn_signatures}
    table_names=("private.dreamsnap_x05_work_control_v1","private.dreamsnap_x05_consent_events_v1","private.dreamsnap_x05_purge_tracking_v1")
    table_oids={tb:one(a,"select %s::regclass::oid",(tb,)) for tb in table_names}
    for role in ("anon","authenticated","service_role"):
        with b.transaction():
            b.execute("set local role "+role)
            for reg,oid in fn_oids.items():
                assert not one(b,"select has_function_privilege(current_user,%s::oid,'EXECUTE')",(oid,)),reg
            for tb,oid in table_oids.items():
                for action in ("SELECT","INSERT","UPDATE","DELETE"):
                    assert not one(b,"select has_table_privilege(current_user,%s::oid,%s)",(oid,action)),(tb,action)
    assert one(a,"select count(*) from pg_proc where proname ~ '^dreamsnap_x05_' and pronamespace='public'::regnamespace")==0
    log("COMM149_NONPUBLIC_ROLE_ACL_SOURCE_PASS")

    cases=[
      ("2026-10-14 12:59:59+00","upcoming"),
      ("2026-10-14 13:00:00+00","submission"),
      ("2026-10-21 12:59:59+00","submission"),
      ("2026-10-21 13:00:00+00","voting"),
      ("2026-10-28 12:59:59+00","voting"),
      ("2026-10-28 13:00:00+00","scheduled_post_voting"),
    ]
    for current,expect in cases:
        p=one(a,"select private.dreamsnap_x05_schedule_preflight_v1(%s::timestamptz,%s::timestamptz)",
              ("2026-10-14 13:00+00",current))
        assert p["scheduleState"]==expect and p["positivePublicAllowed"] is False
        assert p["officialServerPhaseVerified"] is False and p["verifiedChallengeId"] is False
    for anchor in ("2026-10-14 12:00+00","2026-10-15 13:00+00"):
        p=one(a,"select private.dreamsnap_x05_schedule_preflight_v1(%s::timestamptz,now())",(anchor,))
        assert p["scheduleState"]=="invalid_anchor" and not p["positivePublicAllowed"]
    assert one(a,"select private.dreamsnap_x05_schedule_preflight_v1(null,now())")["scheduleState"]=="unknown"
    assert one(a,"select private.dreamsnap_x05_public_activation_v1(%s)",(u(),)) is False
    log("COMM149_OFFICIAL_SCHEDULE_UTC_BOUNDARY_FAILCLOSED_PASS",boundaryCases=len(cases))

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

    digest="b"*64
    grant="select private.dreamsnap_x05_record_creator_grant_v1(%s,%s,%s,%s,%s,%s,%s,true,true)"
    deny_self_capture="select private.dreamsnap_x05_record_creator_grant_v1(%s,%s,%s,%s,%s,%s,%s,false,true)"
    deny_grant="select private.dreamsnap_x05_record_creator_grant_v1(%s,%s,%s,%s,%s,%s,%s,true,false)"
    transition="select private.dreamsnap_x05_owner_transition_v1(%s,%s,%s,%s,%s)"
    assert fail(a,grant,(u(),post,photo_post,media_post,"owner-v1",digest,0))
    assert fail(a,grant,(auth,post,photo_post,media_original,"owner-v1",digest,0))
    assert fail(a,grant,(auth,post,photo_original,media_post,"owner-v1",digest,0))
    assert fail(a,grant,(auth,original,photo_original,media_post,"owner-v1",digest,0))
    assert fail(a,grant,(auth,post,photo_post,media_post,"owner-v1","unknown",0))
    assert fail(a,deny_self_capture,(auth,post,photo_post,media_post,"owner-v1",digest,0))
    assert fail(a,deny_grant,(auth,post,photo_post,media_post,"owner-v1",digest,0))
    for name,sql,args in [
      ("RETIRED_IDENTITY","update public.auth_identities set identity_state='retired' where account_id=%s",(account,)),
      ("ACCOUNT_RESTRICTED","update public.wand_accounts set status='restricted' where account_id=%s",(account,)),
      ("CREATOR_TOMBSTONE","update public.community_entities set deleted_at=now() where entity_id=%s",(creator,)),
      ("PRIVACY_SUPPRESSED","insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,)),
      ("MINOR","update public.dreamsnap_works set managed_under13=true,workspace_relationship_kind='parent_guardian_managed' where work_id=%s",(post,)),
      ("MODERATED","update public.community_works set moderation_state='restricted' where work_id=%s",(post,))
    ]:
        with a.transaction():
            a.execute("SAVEPOINT policycase")
            try:
                a.execute(sql,args)
                assert fail(a,grant,(auth,post,photo_post,media_post,"owner-v1",digest,0)),name
            finally:
                a.execute("ROLLBACK TO SAVEPOINT policycase")
                a.execute("RELEASE SAVEPOINT policycase")
    log("COMM149_OWNER_RETIRE_PRIVACY_MINOR_MODERATION_NEGATIVE_PASS")

    g1=one(a,grant,(auth,original,photo_original,media_original,"owner-v1",digest,0))
    g2=one(a,grant,(auth,post,photo_post,media_post,"owner-v1",digest,0))
    assert g1["kind"]=="OriginalCompetition" and g2["kind"]=="PostEventCreation"
    assert g1["rowVersion"]==1 and g2["rowVersion"]==1
    assert not g1["publicActivationAllowed"] and not g2["publicActivationAllowed"]
    assert one(a,"select private.dreamsnap_x05_control_live_v1(%s)",(post,)) is True
    assert fail(a,grant,(auth,post,photo_post,media_post,"owner-v1",digest,0))
    assert fail(a,grant,(auth,post,photo_post,media_original,"owner-v2",digest,1))
    assert fail(a,transition,(u(),post,1,"withdraw",None))
    assert fail(a,transition,(auth,post,2,"withdraw",None))
    log("COMM149_TYPED_WORK_CONSENT_CAS_POSITIVE_PASS",kinds=[g1["kind"],g2["kind"]])

    # Two genuinely separate DB backends race on ONE expected rowVersion.
    def grant_race():
        with psycopg.connect(DSN,autocommit=True) as c:
            try:
                v=one(c,grant,(auth,post,photo_post,media_post,"owner-v2","c"*64,1))
                return ("success",v["rowVersion"])
            except psycopg.Error as e: return ("blocked",e.sqlstate)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:grant_race(),(0,1)))
    assert sum(x[0]=="success" for x in results)==1,results
    assert sum(x[0]=="blocked" for x in results)==1,results
    assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(post,))==2
    assert fail(a,grant,(auth,post,photo_post,media_post,"owner-v3","d"*64,1))
    log("COMM149_TWO_PG_CONCURRENT_CREATOR_GRANT_CAS_PASS",outcomes=results)

    pre=one(a,transition,(auth,post,2,"preflight",None))
    assert pre["state"]=="preflight_blocked"
    assert pre["scheduledPreflight"]["scheduleState"]=="unknown"
    assert not pre["scheduledPreflight"]["positivePublicAllowed"]
    assert one(a,"select private.dreamsnap_x05_public_activation_v1(%s)",(post,)) is False
    assert fail(a,transition,(auth,post,2,"preflight",None))
    rev_concept=u()
    a.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,2,%s)",(rev_concept,post,account))
    assert fail(a,transition,(auth,post,3,"concept",photo_original))
    assert fail(a,transition,(auth,post,3,"concept",photo_post))
    updated=one(a,transition,(auth,post,3,"concept",rev_concept))
    assert updated["rowVersion"]==4
    assert one(a,"select concept_revision_id from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,))==rev_concept
    assert one(a,"select immutable_photo_revision_id from private.dreamsnap_post_event_staged_v1 where work_id=%s",(post,))==photo_post
    assert one(a,"select current_published_revision_id from public.community_works where work_id=%s",(post,))==photo_post
    log("COMM149_NO_PUBLIC_PREFLIGHT_AND_DRAFT_CONCEPT_FROZEN_IMAGE_PASS")

    # Original public -> private is the existing Source144/145/146 and signer gate,
    # not just a new shadow-table flag. No historical Source148 reacceptance runs.
    assert one(a,"select private.dreamsnap_public_work_accessible_r20(%s)",(original,)) is True
    withdrawn=one(a,transition,(auth,original,1,"withdraw",None))
    assert withdrawn["state"]=="withdrawn"
    assert one(a,"select visibility from public.community_works where work_id=%s",(original,))=="private"
    assert one(a,"select publication_state from public.dreamsnap_gallery_publications where work_id=%s",(original,))=="unpublished"
    assert one(a,"select private.dreamsnap_public_work_accessible_r20(%s)",(original,)) is False
    assert one(a,"select private.dreamsnap_shared_public_work_metadata_v1(%s)",(original,)) is None
    assert fail(a,transition,(auth,original,1,"withdraw",None))
    assert fail(a,grant,(auth,original,photo_original,media_original,"owner-v2",digest,2))
    log("COMM149_WITHDRAW_LEGACY_READER_GALLERY_SYNC_SUPPRESSION_PASS")

    deleted=one(a,transition,(auth,post,4,"delete",None))
    assert deleted["state"]=="delete_requested" and deleted["purgeState"]=="requested"
    assert one(a,"select request_state from private.dreamsnap_x05_purge_tracking_v1 where work_id=%s",(post,))=="requested"
    assert one(a,"select verified_at from private.dreamsnap_x05_purge_tracking_v1 where work_id=%s",(post,)) is None
    assert one(a,"select withdrawn_at is not null from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,)) is True
    assert fail(a,transition,(auth,post,5,"preflight",None))
    assert fail(a,transition,(auth,post,5,"concept",rev_concept))
    assert one(a,"select count(*) from public.outbox_events where aggregate_id in (%s,%s) and event_type ~ '^dreamsnap[.]x05_nonpublic_'",(original,post))==4
    for work in (original,post):
        assert one(a,"select public_activation_allowed from private.dreamsnap_x05_work_control_v1 where work_id=%s",(work,)) is False
    log("COMM149_ATOMIC_WITHDRAW_DELETE_OUTBOX_PURGE_REQUEST_NO_PROVIDER_CLAIM_PASS")
    log("COMM149_SOURCE_LOCAL_COMPLETE",migrations=149,backends=[one(a,"select pg_backend_pid()"),one(b,"select pg_backend_pid()")])
