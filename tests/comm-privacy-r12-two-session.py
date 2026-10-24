#!/usr/bin/env python3
"""03 COMM #139: disposable 2-PG-backend privacy barrier regression only.
Never connect to Staging, Production, cloud Supabase, or real user accounts.
"""
import json, os, uuid
import psycopg

DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert os.getenv("DATABASE_URL") is None, "No remote DATABASE_URL permitted"

def one(c, sql, params=()):
    return c.execute(sql,params).fetchone()[0]

with psycopg.connect(DSN,autocommit=True,connect_timeout=3) as setup:
    account,subject,creator,work=setup.execute("""
       select a.account_id,a.provider_subject::uuid,c.creator_profile_id,w.work_id
       from public.auth_identities a
       join public.creator_profiles c on c.owner_account_id=a.account_id
       join public.community_works w on w.owner_account_id=a.account_id
       where c.handle='isolated_bootstrap_creator' and a.provider='supabase'
         and w.work_type='gallery' limit 1
    """).fetchone()
    verified=one(setup,"select subject_id from public.gallery_verified_subjects where verification_state='verified' and subject_type='floating_island' limit 1")
    session=uuid.uuid4()
    media=uuid.uuid4(); revision=uuid.uuid4()
    with setup.transaction():
        setup.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(subject,))
        setup.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,subject))
        setup.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
        setup.execute("""insert into public.media_assets(
          media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
          checksum_sha256,processing_state,moderation_state
          ) values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
          (media,account,"ci-only/privacy-two-session-"+str(media)+".png","b"*64))
        setup.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(work,))
        setup.execute("""insert into public.gallery_photo_subjects(
          work_id,subject_id,owner_account_id,creator_profile_id) values(%s,%s,%s,%s)""",
          (work,verified,account,creator))
        setup.execute("""insert into public.community_work_revisions(
          revision_id,work_id,revision_number,created_by_account_id)
          values(%s,%s,1,%s)""",(revision,work,account))
        setup.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'CI Privacy Race')",(revision,))
        setup.execute("""insert into public.work_revision_media(
          work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')""",(revision,media))
        setup.execute("""insert into public.gallery_photo_revision_fields(
          revision_id,subject_id,cover_media_id,originality_attested)
          values(%s,%s,%s,true)""",(revision,verified,media))
        setup.execute("""update public.community_works
          set lifecycle_state='published', visibility='public',
              current_published_revision_id=%s,published_at=now()
          where work_id=%s""",(revision,work))
        setup.execute("""insert into public.search_documents(
          entity_id,work_id,work_type,creator_profile_id,title,published_at)
          values(%s,%s,'gallery',%s,'Privacy Two-session',now())""",
          (work,work,creator))
    assert one(setup,"select private.is_discoverable_work(%s)",(work,)) is True

with psycopg.connect(DSN,autocommit=True) as a, psycopg.connect(DSN,autocommit=True) as b:
    assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
    issued=one(b,"select extract(epoch from clock_timestamp())::bigint")
    # Account row lock serializes same-owner suppression requests.
    a.execute("begin")
    a.execute("select account_id from public.wand_accounts where account_id=%s for update",(account,))
    b.execute("begin")
    b.execute("set local lock_timeout='250ms'")
    timed_out=False
    try:
        b.execute("select public.community_tombstone_account(%s,%s,%s,'DELETE')",
                  (subject,session,issued))
    except psycopg.Error as e:
        assert e.sqlstate=="55P03",(e.sqlstate,str(e))
        timed_out=True
    assert timed_out
    b.execute("rollback")
    assert one(a,"select count(*) from private.account_privacy_suppressions where account_id=%s",(account,))==0
    a.execute("rollback")

    # An unrelated Gallery Work lock must NOT delay emergency read suppression.
    a.execute("begin")
    a.execute("select work_id from public.community_works where work_id=%s for update",(work,))
    b.execute("begin")
    b.execute("set local lock_timeout='750ms'")
    result=one(b,"select public.community_tombstone_account(%s,%s,%s,'DELETE')",
               (subject,session,issued))
    assert result["privacyState"]=="suppressed_cleanup_pending",result
    assert result["fullDeletionComplete"] is False
    b.execute("commit")
    assert one(b,"select private.is_discoverable_work(%s)",(work,)) is False
    assert one(b,"select count(*) from public.search_documents where work_id=%s",(work,))==0
    assert one(b,"select lifecycle_state from public.community_works where work_id=%s",(work,))=="published"
    # A delayed publisher holding an old row lock cannot make it public again.
    a.execute("savepoint delayed_publish")
    rejected=False
    try:
        a.execute("""update public.community_works
          set current_published_revision_id=%s where work_id=%s""",(uuid.uuid4(),work))
    except psycopg.Error as e:
        assert "ACCOUNT_PRIVACY_SUPPRESSED" in str(e),str(e)
        rejected=True
    assert rejected
    a.execute("rollback to savepoint delayed_publish")
    a.execute("rollback")
    replay=one(b,"select public.community_tombstone_account(%s,%s,%s,'DELETE')",
               (subject,session,issued))
    assert replay["alreadySuppressed"] is True
    assert replay["suppressedAt"]==result["suppressedAt"]
    assert one(b,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='account.privacy_suppressed'",(account,))==1
    assert one(b,"select private.is_discoverable_work(%s)",(work,)) is False
    print(json.dumps({
      "result":"03COMM_PRIVACY_R12_TWO_BACKEND_LOCAL_PASS",
      "separatePostgresBackends":True,
      "accountLockTimeout":"55P03",
      "galleryWorkLockDidNotBlockSuppression":True,
      "actualTombstoneRpcReturnsSuppressionOnly":True,
      "oldGalleryRevisionPreserved":True,
      "delayedPositivePublisherRejected":True,
      "idempotentReplay":True,
      "previousBearerRevocationProved":False,
      "signedStagingActorProved":False,
      "fullAccountErasureComplete":False
    }))
