#!/usr/bin/env python3
"""04 QR R17 new actual Source131 concurrency: Photo/Moderator and Photo/Phase1 Privacy."""
import json
import os
import uuid
import psycopg

assert os.getenv("DDVRE_QR_R17_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL")
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OWNER_HEAD = "83395094d5780ef0c9894d41a50b099823d55dad"
def uid():
    return uuid.uuid4()
def one(db, query, args=()):
    return db.execute(query, args).fetchone()[0]
def deny(db, call, messages):
    try:
        call()
    except psycopg.Error as error:
        assert any(s in str(error) for s in messages), (error.sqlstate, str(error), messages)
        return error.sqlstate
    raise AssertionError("R17_UNSAFE_PHOTO_WRITER_ACCEPTED")
def work_state(db, work, owner, key):
    return tuple(db.execute("""select
        (select count(*) from public.community_work_revisions where work_id=%s),
        (select count(*) from public.outbox_events where aggregate_id=%s),
        (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s),
        (select current_published_revision_id from public.community_works where work_id=%s),
        (select row_version from public.community_works where work_id=%s),
        (select moderation_state from public.community_works where work_id=%s)
    """, (work,work,owner,key,work,work,work)).fetchone())

with psycopg.connect(DSN,autocommit=True) as seed:
    assert one(seed,"select count(*) from supabase_migrations.schema_migrations") == 131
    owner,owner_auth,creator,staff,staff_auth,staff_session,owner_session,subject = [uid() for _ in range(8)]
    token=uid().hex
    media_mod,media_priv=uid(),uid()
    with seed.transaction():
        for account,actor in [(owner,owner_auth),(staff,staff_auth)]:
            seed.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
            seed.execute("""insert into public.auth_identities(
              account_id,provider,provider_subject,last_verified_at,identity_state)
              values(%s,'supabase',%s,clock_timestamp(),'active')""",(account,str(actor)))
            seed.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(actor,))
        seed.execute("insert into public.account_roles(account_id,role) values(%s,'moderator')",(staff,))
        for sess,actor in [(owner_session,owner_auth),(staff_session,staff_auth)]:
            seed.execute("""insert into auth.sessions(id,user_id,created_at)
                values(%s,%s,clock_timestamp())""",(sess,actor))
        seed.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        seed.execute("""insert into public.creator_profiles(
            creator_profile_id,owner_account_id,handle,display_name)
            values(%s,%s,%s,'QA concurrency creator')""",(creator,owner,"qr17_race_"+token[:13]))
        for media in [media_mod,media_priv]:
            seed.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
            seed.execute("""insert into public.media_assets(
                media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
                checksum_sha256,processing_state,moderation_state)
                values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
                (media,owner,"qa-r17-concurrency/"+str(media)+".png","d"*64))
        seed.execute("""insert into public.gallery_verified_subjects(
            subject_id,gallery_kind,subject_type,canonical_target_id,
            platform,game_version,build_id,profile_schema,evidence_ref,verification_state)
            values(%s,'outdoor','biome',%s,'switch','1.25.0','52BD625D9B4E0053',
            624,%s,'verified')""",(subject,"qr17-concurrency-"+token,"qa-isolated-"+token))
    def photo(db, work, expected, media, key, title):
        return one(db,"""select public.community_publish_gallery_photo_v1(
            %s,%s,%s,%s,'outdoor',%s,%s,'QA synthetic media metadata',
            %s::uuid[],%s,true,%s)""",
            (owner_auth,creator,work,expected,subject,title,[media],media,key))
    mod_created=photo(seed,None,None,media_mod,"qr17-race-mod-create-"+token,"Initial moderation race")
    priv_created=photo(seed,None,None,media_priv,"qr17-race-priv-create-"+token,"Initial privacy race")
    work_mod=uuid.UUID(mod_created["workId"])
    work_priv=uuid.UUID(priv_created["workId"])
    mod_case=uid()
    seed.execute("""insert into public.moderation_cases(case_id,target_entity_id,status)
        values(%s,%s,'open')""",(mod_case,work_mod))

# A holds Owner root FOR UPDATE; Photo must refuse NOWAIT/lock_timeout, but real
# moderator RPC on separate staff session must still be able to restrict Gallery.
with psycopg.connect(DSN,autocommit=True) as a, psycopg.connect(DSN,autocommit=True) as b, psycopg.connect(DSN,autocommit=True) as m:
    assert len({one(x,"select pg_backend_pid()") for x in [a,b,m]}) == 3
    initial=work_state(b,work_mod,owner,"qr17-mod-photo-denied")
    a.execute("begin")
    one(a,"select account_id from public.wand_accounts where account_id=%s for update",(owner,))
    b.execute("begin")
    b.execute("set local lock_timeout='250ms'")
    denied=deny(b,lambda:photo(
        b,work_mod,initial[4],media_mod,"qr17-mod-photo-denied","Owner blocked by account"),
        ["could not obtain lock"])
    assert denied=="55P03",denied
    b.execute("rollback")
    assert work_state(b,work_mod,owner,"qr17-mod-photo-denied")==initial
    m.execute("set statement_timeout='2500ms'")
    epoch=one(m,"select extract(epoch from clock_timestamp())::bigint")
    moderated=one(m,"""select public.community_moderate_entity_v5(
        %s,%s,%s,%s,'restrict','QA emergency restrict while owner account held')""",
        (staff_auth,staff_session,epoch,mod_case))
    assert moderated is not None
    assert one(m,"select moderation_state from public.community_works where work_id=%s",(work_mod,))=="restricted"
    assert one(m,"select count(*) from public.moderation_actions where case_id=%s and action_type='restrict'",(mod_case,))==1
    assert one(m,"select count(*) from public.search_documents where work_id=%s",(work_mod,))==0
    a.execute("rollback")
    changed=work_state(b,work_mod,owner,"qr17-mod-photo-denied")
    assert changed[:4]==initial[:4],(initial,changed)
    assert changed[5]=="restricted",changed
    deny(b,lambda:photo(b,work_mod,changed[4],media_mod,"qr17-mod-photo-retry","Blocked after emergency restrict"),
        ["GALLERY_WORK_NOT_PUBLIC_EDITABLE"])
    assert work_state(b,work_mod,owner,"qr17-mod-photo-denied")==changed
    print(json.dumps({"case":"QR_R17_PHOTO_MODERATOR_EMERGENCY_LIVENESS",
        "realPostgresModeratorV5":True,"staffSignedJWT":False,
        "moderatorBypassedOwnerAccountLock":True,"ownerWriter55P03":True,
        "moderatorRemovedSearch":True,"photoPostModerationDenied":True}))

# The actual Photo RPC holds Account FOR SHARE and Work FOR UPDATE for the
# complete client transaction; Phase1 root FOR UPDATE cannot cross it.
with psycopg.connect(DSN,autocommit=True) as writer,psycopg.connect(DSN,autocommit=True) as privacy:
    assert one(writer,"select pg_backend_pid()") != one(privacy,"select pg_backend_pid()")
    before=work_state(writer,work_priv,owner,"qr17-privacy-photo-commit")
    writer.execute("begin")
    committed_result=photo(writer,work_priv,before[4],media_priv,
        "qr17-privacy-photo-commit","Photo before privacy suppression")
    assert committed_result["revisionId"]
    privacy.execute("begin")
    privacy.execute("set local lock_timeout='250ms'")
    epoch=one(privacy,"select extract(epoch from clock_timestamp())::bigint")
    sql="""select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')"""
    denied=deny(privacy,lambda:one(privacy,sql,(owner_auth,owner_session,epoch)),
        ["could not obtain lock"])
    assert denied=="55P03",denied
    privacy.execute("rollback")
    assert one(privacy,"select private.is_account_privacy_suppressed(%s)",(owner,)) is False
    writer.execute("commit")
    after=work_state(privacy,work_priv,owner,"qr17-privacy-photo-commit")
    assert after[0]==before[0]+1 and after[1]==before[1]+1 and after[2]==before[2]+1,(before,after)
    assert after[3]!=before[3] and after[4]>before[4],(before,after)
    epoch=one(privacy,"select extract(epoch from clock_timestamp())::bigint")
    suppressed=one(privacy,sql,(owner_auth,owner_session,epoch))
    assert suppressed["privacyState"]=="suppressed_cleanup_pending",suppressed
    assert one(privacy,"select private.is_account_privacy_suppressed(%s)",(owner,)) is True
    after_suppression=work_state(privacy,work_priv,owner,"qr17-privacy-photo-after-deny")
    deny(privacy,lambda:photo(privacy,work_priv,after[4],media_priv,
        "qr17-privacy-photo-after-deny","Photo after committed privacy cutoff"),
        ["ACCOUNT_PRIVACY_SUPPRESSED","R17_PHOTO_ACTOR_INVALID"])
    assert work_state(privacy,work_priv,owner,"qr17-privacy-photo-after-deny")==after_suppression
    print(json.dumps({"case":"QR_R17_PHOTO_INFLIGHT_PRIVACY_PHASE1_SERIALIZED",
       "twoActualPgBackends":True,"phase1HeldLock55P03":True,
       "writerBeforeSuppressionCommittedOnce":True,
       "suppressionCommittedAfterWriter":True,
       "newPhotoDeniedAfterPrivacy":True,
       "externalSignedActor":False,"physicalErasure":False}))

print(json.dumps({"result":"QR_R17_ACTUAL_SOURCE131_MODERATOR_PRIVACY_RACES_PASS",
    "ownerFrozenHead":OWNER_HEAD,"migrationCount":131,
    "sourceLocalSynthetic":True,"signedModeratorHTTP":False,
    "signedGalleryStaging":False,"cloudOrMediaBytes":False}))
