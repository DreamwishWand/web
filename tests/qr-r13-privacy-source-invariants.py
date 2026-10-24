#!/usr/bin/env python3
"""Independent 04 QR R13 invariants, synthetic 115-source localhost PG only."""
import os,uuid,json
import psycopg
assert os.getenv("DDVRE_QR_R13_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL")
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def scalar(c,s,a=()):return c.execute(s,a).fetchone()[0]
with psycopg.connect(dsn,autocommit=True) as db:
  account,work,creator,rev=db.execute("""
    select w.owner_account_id,w.work_id,w.creator_profile_id,w.current_published_revision_id
    from public.community_works w join private.account_privacy_suppressions s
    on s.account_id=w.owner_account_id
    where w.work_type='gallery' and w.lifecycle_state='published' limit 1
  """).fetchone()
  assert rev is not None
  assert scalar(db,"select private.is_discoverable_work(%s)",(work,)) is False
  assert scalar(db,"select count(*) from public.search_documents where work_id=%s",(work,))==0
  assert scalar(db,"select cleanup_state from private.account_privacy_suppressions where account_id=%s",(account,))=="suppressed_cleanup_pending"
  assert scalar(db,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='account.privacy_suppressed'",(account,))==1
  media=scalar(db,"select media_id from public.work_revision_media where work_revision_id=%s limit 1",(rev,))
  for sql,param in [
    ("select public.community_get_public_media_storage_v1(%s)",media),
    ("select public.community_get_creator_public_v1(%s)",creator)
  ]:
    try:
      db.execute(sql,(param,)).fetchone()
      raise AssertionError("SUPPRESSED_PUBLIC_READ_ACCEPTED")
    except psycopg.Error:pass
  assert scalar(db,"select count(*) from public.work_revision_media where work_revision_id=%s",(rev,))>=1
  for fn in ("community_search_questions_v1","community_get_gallery_dreamsnap_public_v1",
             "community_get_dreamsnap_results_public_v1","community_get_dreamsnap_judge_v1"):
    body=scalar(db,"select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=%s order by p.oid limit 1",(fn,))
    assert "is_account_privacy_suppressed" in body or "is_discoverable_work" in body,fn
  db.execute("begin")
  db.execute("update public.community_works set moderation_state='restricted' where work_id=%s",(work,))
  assert scalar(db,"select moderation_state from public.community_works where work_id=%s",(work,))=="restricted"
  db.execute("rollback")

  second=db.execute("""select i.account_id,i.provider_subject::uuid
    from public.auth_identities i where i.provider='supabase' and i.identity_state='active'
    and not private.is_account_privacy_suppressed(i.account_id) limit 1""").fetchone()
  assert second is not None
  aid,sub=second;session=uuid.uuid4()
  db.execute("insert into auth.users(id) values(%s) on conflict(id) do nothing",(sub,))
  db.execute("insert into auth.sessions(id,user_id,created_at) values(%s,%s,clock_timestamp())",(session,sub))
  issued=scalar(db,"select extract(epoch from clock_timestamp())::bigint")
  db.execute("begin")
  result=scalar(db,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",(sub,session,issued))
  assert result["privacyState"]=="suppressed_cleanup_pending"
  db.execute("rollback")
  assert scalar(db,"select count(*) from private.account_privacy_suppressions where account_id=%s",(aid,))==0
  assert scalar(db,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='account.privacy_suppressed'",(aid,))==0
  first=scalar(db,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",(sub,session,issued))
  replay=scalar(db,"select public.community_request_privacy_suppression_v1(%s,%s,%s,'DELETE')",(sub,session,issued))
  assert first["alreadySuppressed"] is False and replay["alreadySuppressed"] is True
  assert first["suppressedAt"]==replay["suppressedAt"]
  assert first["fullDeletionComplete"] is False and first["previousBearerUrlsRevoked"] is False
  assert scalar(db,"select count(*) from public.outbox_events where aggregate_id=%s and event_type='account.privacy_suppressed'",(aid,))==1
  assert scalar(db,"select cleanup_state from private.account_privacy_suppressions where account_id=%s",(aid,))=="suppressed_cleanup_pending"
print(json.dumps({"result":"QR_R13_115_SOURCE_LOCAL_PRIVACY_INDEPENDENT_PASS",
  "galleryPublishedRawPreserved":True,"newGalleryMediaAndCreatorReadDenied":True,
  "searchRemoved":True,"qaAndDreamSnaps":"SOURCE_CODE_ONLY",
  "moderationRestrict":"LOCAL_DIRECT_SQL_ROLLBACK",
  "initialSuppressionCommitAndReplay":True,"outboxCount":1,
  "faultInjectionRollbackNoPartial":True,"priorBearerRevoked":False,
  "actualSignedJWT":False,"cloudMediaDeletion":False},sort_keys=True))
