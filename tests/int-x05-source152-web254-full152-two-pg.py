#!/usr/bin/env python3
"""09 INT NEW cross-lineage FULL152 integration only. Synthetic local DB, no signed JWT or provider."""
import os,json,uuid,time,hashlib,psycopg
from concurrent.futures import ThreadPoolExecutor
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
def uid():return uuid.uuid4()
def one(db,q,args=()):return db.execute(q,args).fetchone()[0]
def call(db,subject,query,args=(),role="authenticated",missing_session=False):
 with db.transaction():
  db.execute("set local role "+role)
  claims={"role":role,"sub":str(subject),"session_id":None if missing_session else str(uid()),"iat":int(time.time()),"is_anonymous":False}
  db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
  db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
  db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
  try:
   with db.transaction():return ("ok",one(db,query,args))
  except psycopg.Error as e:return ("blocked",e.sqlstate,str(e).split("\n")[0][:240])
def registration(db,subject,kind,challenge,media,key,entry=False,caption="INT152 synthetic screenshot",**kw):
 return call(db,subject,"""select public.community_dreamsnap_x05_register_initial_work_v1(%s,%s,%s,%s,%s,%s)""",
  (kind,challenge,media,caption,key,entry),**kw)
def pre(db,subject,work):return call(db,subject,"select public.community_dreamsnap_x05_pregrant_read_v1(%s)",(work,))
def read(db,subject,work):return call(db,subject,"select public.community_dreamsnap_x05_owner_read_v1(%s)",(work,))
def grant(db,subject,work,photo,media,digest):
 return call(db,subject,"""select public.community_dreamsnap_x05_owner_action_v1(
 %s,0,0,'grant',%s,%s,'v1',%s,true,true,null)""",(work,photo,media,digest))
def withdraw(db,subject,work):
 return call(db,subject,"""select public.community_dreamsnap_x05_owner_action_v1(
 %s,1,1,'withdraw',null,null,null,null,null,null,null)""",(work,))
def denied(r,label):assert r[0]=="blocked",(label,r)
def ok(r,label):assert r[0]=="ok",(label,r);return r[1]
def marker(m):print(m,flush=True)
with psycopg.connect(DSN,autocommit=True) as a, psycopg.connect(DSN,autocommit=True) as b, psycopg.connect(DSN,autocommit=True) as c:
 assert one(a,"select count(*) from supabase_migrations.schema_migrations")==152
 assert len({one(d,"select pg_backend_pid()") for d in [a,b,c]})==3
 assert one(a,"select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
 assert one(a,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
 account,subject,creator,challenge_open,challenge_closed=[uid() for _ in range(5)]
 media_original,media_post,media_spare=[uid() for _ in range(3)]
 with a.transaction():
  a.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
  a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
    values(%s,'supabase',%s,now(),'active')""",(account,str(subject)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
    values(%s,%s,%s,'INT152 SYNTHETIC')""",(creator,account,"int152_"+uid().hex[:18]))
  a.execute("""insert into public.dreamsnap_challenges(
    challenge_id,challenge_key,title,lifecycle_state,submission_opens_at,submission_closes_at,
    judging_opens_at,judging_closes_at,results_at,closes_at,formal_vote_allowance,special_pick_allowance,
    minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'INT152 LOCAL','submission_open',now()-interval '2 hours',
    now()+interval '1 day',now()+interval '2 days',now()+interval '3 days',
    now()+interval '4 days',now()+interval '5 days',2,1,1,1,false)""",
    (challenge_open,"int152_"+uid().hex[:18]))
  a.execute("""insert into public.dreamsnap_challenges(
    challenge_id,challenge_key,title,lifecycle_state,submission_opens_at,submission_closes_at,
    judging_opens_at,judging_closes_at,results_at,closes_at,formal_vote_allowance,special_pick_allowance,
    minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'INT152 LOCAL','results',now()-interval '8 days',
    now()-interval '7 days',now()-interval '6 days',now()-interval '5 days',
    now()-interval '4 days',now()+interval '2 days',2,1,1,1,false)""",
    (challenge_closed,"int152_"+uid().hex[:18]))
  for media in [media_original,media_post,media_spare]:
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
   a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
     width,height,checksum_sha256,processing_state,moderation_state)
     values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
     (media,account,"int152/disposable/"+str(media),"a"*64))
 # Server-pinned subject, role, READY and same owner; neither user AccountID nor media provider grant.
 denied(registration(b,subject,"PostEventCreation",challenge_closed,media_post,"int152-negative-001",role="anon"),"anon")
 denied(registration(b,uid(),"PostEventCreation",challenge_closed,media_post,"int152-negative-001"),"foreign actor")
 denied(registration(b,subject,"PostEventCreation",challenge_closed,media_post,"int152-negative-001",missing_session=True),"missing session")
 with a.transaction():
  a.execute("savepoint privacy")
  a.execute("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,))
  denied(registration(a,subject,"PostEventCreation",challenge_closed,media_post,"int152-negative-001"),"privacy")
  a.execute("rollback to savepoint privacy")
  a.execute("release savepoint privacy")
 with a.transaction():
  a.execute("savepoint unreadymedia")
  a.execute("update public.media_assets set processing_state='quarantined' where media_id=%s",(media_post,))
  denied(registration(a,subject,"PostEventCreation",challenge_closed,media_post,"int152-negative-001"),"unready")
  a.execute("rollback to savepoint unreadymedia")
  a.execute("release savepoint unreadymedia")
 marker("INT152_COMBINED_ACTOR_PRIVACY_READY_DENIAL_PASS")
 # Concurrent registration, no duplicate Works; Source152 normalized replay exact (no entryId/null).
 k1,k2="int152-post-race-alpha-001","int152-post-race-bravo-001"
 with ThreadPoolExecutor(max_workers=2) as pool:
  x=pool.submit(registration,b,subject,"PostEventCreation",challenge_closed,media_post,k1,False)
  y=pool.submit(registration,c,subject,"PostEventCreation",challenge_closed,media_post,k2,False)
  r1,r2=x.result(),y.result()
 assert sum(r[0]=="ok" for r in [r1,r2])==1,(r1,r2)
 assert sum(r[0]=="blocked" for r in [r1,r2])==1,(r1,r2)
 registered=ok(r1 if r1[0]=="ok" else r2,"PostEvent")
 winning_key=k1 if r1[0]=="ok" else k2
 replay=ok(registration(b,subject,"PostEventCreation",challenge_closed,media_post,winning_key,False),"PostEvent replay")
 assert registered==replay and "entryId" not in registered and "entryId" not in replay
 assert one(a,"select response from public.idempotency_keys where account_id=%s and idempotency_key=%s",(account,"x05:"+winning_key))==registered
 work_post=registered["workId"]
 assert registered["kind"]=="PostEventCreation" and registered["publicActivationAllowed"] is False
 assert registered["storageValidatedBySource152"] is False
 assert registered["officialChallengePhaseVerified"] is False
 assert one(a,"select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s",(work_post,))==1
 assert one(a,"select count(*) from public.dreamsnap_entries where work_id=%s",(work_post,))==0
 assert one(a,"select count(*) from public.work_revision_media where media_id=%s",(media_post,))==1
 denied(registration(b,subject,"PostEventCreation",challenge_closed,media_post,"int152-post-other-key-001",False),"duplicate media")
 denied(registration(b,subject,"PostEventCreation",challenge_closed,media_spare,winning_key,False),"changed idempotency key payload")
 marker("INT152_COMBINED_POSTEVENT_REGISTER_RACE_REPLAY_ENTRY_ABSENT_PASS")
 # Original opt-in Wand Entry exists, frozen to identical photo revision; never an official DDV entry assertion.
 orig=ok(registration(b,subject,"OriginalCompetition",challenge_open,media_original,"int152-original-one-001",True),"original")
 orig_replay=ok(registration(b,subject,"OriginalCompetition",challenge_open,media_original,"int152-original-one-001",True),"original replay")
 assert orig==orig_replay and orig["kind"]=="OriginalCompetition"
 assert orig["entryId"] and orig["workId"]!=orig["entryId"]
 assert orig["photoRevisionId"]!=orig["photoMediaId"]
 assert one(a,"select response from public.idempotency_keys where account_id=%s and idempotency_key=%s",(account,"x05:int152-original-one-001"))==orig
 assert one(a,"select count(*) from public.dreamsnap_entries where entry_id=%s and work_id=%s and entry_revision_id=%s and eligibility_state='eligible' and entry_state='entered'",(orig["entryId"],orig["workId"],orig["photoRevisionId"]))==1
 assert one(a,"select count(*) from public.work_revision_media where media_id=%s",(media_original,))==1
 marker("INT152_COMBINED_ORIGINAL_ENTRY_FROZEN_REPLAY_PASS")
 # Registration has never created consent. Full Source151 pregrant follows registered SAME postevent and original IDs.
 assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1")==0
 before={}
 for label,reg in [("post",registered),("original",orig)]:
  work=reg["workId"]
  p=ok(pre(b,subject,work),"pregrant "+label)
  assert p["state"]=="NEED_POLICY_ARTIFACT" and p["expectedRowVersion"]==0 and p["expectedAuthorizationEpoch"]==0
  assert p["grantRecorded"] is False and p["publicActivationAllowed"] is False
  assert p["photoRevisionId"]==reg["photoRevisionId"] and p["photoMediaId"]==reg["photoMediaId"]
  assert p["challengeId"]==reg["challengeId"]
  if label=="post":assert "entryId" not in p and "frozenEntryRevisionId" not in p
  else:assert p["entryId"]==reg["entryId"] and p["frozenEntryRevisionId"]==reg["photoRevisionId"]
  denied(pre(b,uid(),work),"foreign pregrant "+label)
  assert one(a,"select visibility::text from public.community_works where work_id=%s",(work,))=="private"
  before[label]=p
 marker("INT152_COMBINED_REGISTERED_WORK_TO_SOURCE151_PREGRANT_PASS")
 # ONLY disposable local PG: fake canonical text/receipt, never real policy approval.
 policy_text="SYNTHETIC LOCAL TEST ONLY: revocable screenshot grant example, no official DDV rights, no user acceptance."
 digest=hashlib.sha256(policy_text.encode("utf-8")).hexdigest()
 a.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,false)",(digest,))
 assert one(a,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
 denied(grant(b,subject,work_post,registered["photoRevisionId"],media_post,digest),"policy has no approved receipt")
 a.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(policy_version,canonical_text,approval_reference,approved_at)
   values('v1',%s,'SYNTHETIC LOCAL TEST ONLY - NOT OWNER APPROVED',now())""",(policy_text,))
 a.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
 for label,reg in [("post",registered),("original",orig)]:
  pr=ok(pre(b,subject,reg["workId"]),"ready pregrant "+label)
  assert pr["state"]=="PREGRANT_READY" and pr["grantAvailable"] is True
  assert pr["policyReceipt"]["policyDigest"]==digest and pr["policyReceipt"]["policyVersionText"]=="v1"
 marker("INT152_COMBINED_SYNTHETIC_LOCAL_POLICY_ONLY_PASS")
 # Source150 Grant(0,0), original and post paths. Two genuinely separate concurrent CAS on PostEvent.
 with ThreadPoolExecutor(max_workers=2) as pool:
  x=pool.submit(grant,b,subject,work_post,registered["photoRevisionId"],media_post,digest)
  y=pool.submit(grant,c,subject,work_post,registered["photoRevisionId"],media_post,digest)
  pair=[x.result(),y.result()]
 assert sum(z[0]=="ok" for z in pair)==1,pair
 assert sum(z[0]=="blocked" for z in pair)==1,pair
 ok(grant(b,subject,orig["workId"],orig["photoRevisionId"],media_original,digest),"original grant")
 for label,reg in [("post",registered),("original",orig)]:
  work=reg["workId"]
  assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(work,))==1
  current=ok(read(b,subject,work),"owner post grant "+label)
  assert current["rowVersion"]==1 and current["authorizationEpoch"]==1
  assert current["photoRevisionId"]==reg["photoRevisionId"] and current["photoMediaId"]==reg["photoMediaId"]
  assert current["imageGrant"]["consentRevision"]==1
  assert current["capabilities"]["publish"] is False
  denied(pre(b,subject,work),"pregrant unavailable after grant "+label)
  outbox_before=one(a,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))
  action=ok(withdraw(b,subject,work),"withdraw "+label)
  assert action["result"]["rowVersion"]==2 and action["result"]["authorizationEpoch"]==2
  after=action["owner"]
  assert after["rowVersion"]==2 and after["authorizationEpoch"]==2
  assert after["imageGrant"]["consentRevision"]==1 and after["imageGrant"]["state"]=="withdrawn"
  assert after["erasure"]["state"]=="PUBLIC_DISABLED" and after["erasure"]["physicalPurgeVerified"] is False
  assert after["capabilities"]["publicMedia"] is False
  assert one(a,"select visibility::text from public.community_works where work_id=%s",(work,))=="private"
  assert one(a,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))==outbox_before+1
  denied(withdraw(b,subject,work),"withdraw stale CAS "+label)
  denied(read(b,uid(),work),"foreign owner read "+label)
  assert one(a,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))==outbox_before+1
  before[label]={"register":reg,"pregrant":before[label],"owner":after}
 marker("INT152_COMBINED_REGISTER_PREGRANT_GRANT_WITHDRAW_TWO_PG_PASS")
 bridge={
  "post":before["post"],"original":before["original"],
  "serviceContract":"wand.dreamsnaps.owner-management-service@1",
  "syntheticLocalOnly":True
 }
 with open("/tmp/int-x05-source152-full152-web-bridge.json","w",encoding="utf8") as file:
  json.dump(bridge,file)
 marker("INT152_COMBINED_PG_TO_WEB_OWNER_ENVELOPE_READY")
