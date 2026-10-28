#!/usr/bin/env python3
"""CTRL41 QR: independent real FULL152 3-PG cross-product register→pregrant→test policy→grant→read→withdraw.
Only disposable synthetic JWT GUC and DB READY Media. NEVER Stage, Provider or real Policy.
"""
import os,uuid,time,json,hashlib
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.environ.get("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.environ.get("DATABASE_URL") and not os.environ.get("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
U=uuid.uuid4
def one(c,s,args=()):return c.execute(s,args).fetchone()[0]
def traced(tag,**v):print(json.dumps({"marker":tag,**v},sort_keys=True,default=str),flush=True)
def actor(c,subject,query,params=(),role="authenticated",expired=False,missing=False):
 with c.transaction():
  c.execute("set local role "+role)
  claims={"role":role,"sub":str(subject),"session_id":None if missing else str(U()),"iat":int(time.time())-(100000 if expired else 0),"is_anonymous":False}
  for n,v in [("request.jwt.claims",json.dumps(claims)),("request.jwt.claim.sub",str(subject)),("request.jwt.claim.role",role)]:
   c.execute("select set_config(%s,%s,true)",(n,v))
  try:
   with c.transaction():value=one(c,query,params)
   return ("ok",value)
  except psycopg.Error as e:return ("denied",e.sqlstate,str(e).split("\n")[0][:140])
def register(c,sub,kind,challenge,media,key,entry=False,caption="QR41 local original screenshot",**kw):
 return actor(c,sub,"select public.community_dreamsnap_x05_register_initial_work_v1(%s,%s,%s,%s,%s,%s)",
  (kind,challenge,media,caption,key,entry),**kw)
def pre(c,sub,w):return actor(c,sub,"select public.community_dreamsnap_x05_pregrant_read_v1(%s)",(w,))
def read(c,sub,w):return actor(c,sub,"select public.community_dreamsnap_x05_owner_read_v1(%s)",(w,))
def action(c,sub,w,rv,epoch,operation,rev=None,media=None,digest=None):
 return actor(c,sub,"select public.community_dreamsnap_x05_owner_action_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
  (w,rv,epoch,operation,rev,media,"v1" if operation=="grant" else None,digest,True if operation=="grant" else None,True if operation=="grant" else None,None))
def yes(v,label):assert v[0]=="ok",(label,v);return v[1]
def no(v,label):assert v[0]=="denied",(label,v)
with psycopg.connect(DSN,autocommit=True) as A,psycopg.connect(DSN,autocommit=True) as B,psycopg.connect(DSN,autocommit=True) as C:
 assert one(A,"select count(*) from supabase_migrations.schema_migrations")==152
 pids=[one(q,"select pg_backend_pid()") for q in (A,B,C)]
 assert len(set(pids))==3,pids
 assert one(A,"select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
 assert one(A,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
 account,sub,creator,open_ch,closed_ch=[U() for _ in range(5)]
 om,pm,spare=[U() for _ in range(3)]
 with A.transaction():
  A.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
  A.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(sub)))
  A.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  A.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR41 disposable')",(creator,account,"qr41_"+U().hex[:17]))
  for ch,state in [(open_ch,"submission_open"),(closed_ch,"results")]:
   A.execute("""insert into public.dreamsnap_challenges(
   challenge_id,challenge_key,title,lifecycle_state,submission_opens_at,submission_closes_at,
   judging_opens_at,judging_closes_at,results_at,closes_at,formal_vote_allowance,special_pick_allowance,
   minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
   values(%s,%s,'QR41 local',%s,
   case when %s='submission_open' then now()-interval '2 hours' else now()-interval '8 days' end,
   case when %s='submission_open' then now()+interval '1 day' else now()-interval '7 days' end,
   case when %s='submission_open' then now()+interval '2 days' else now()-interval '6 days' end,
   case when %s='submission_open' then now()+interval '3 days' else now()-interval '5 days' end,
   case when %s='submission_open' then now()+interval '4 days' else now()-interval '4 days' end,
   case when %s='submission_open' then now()+interval '5 days' else now()+interval '2 days' end,2,1,1,1,false)""",
   (ch,"qr41_"+U().hex[:17],state,state,state,state,state,state,state))
  for m in (om,pm,spare):
   A.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(m,))
   A.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
     values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",(m,account,"qr41-disposable/"+str(m),"a"*64))
 # Independently targeted cross-product negatives on the same new server registration.
 no(register(B,U(),"PostEventCreation",closed_ch,pm,"qr41-negative-actor-001"),"foreign")
 no(register(B,sub,"PostEventCreation",closed_ch,pm,"qr41-negative-anon-001",role="anon"),"anon")
 no(register(B,sub,"PostEventCreation",closed_ch,pm,"qr41-negative-session-001",missing=True),"missing session")
 with A.transaction():
  A.execute("savepoint blocked")
  A.execute("update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,))
  no(register(A,sub,"PostEventCreation",closed_ch,pm,"qr41-negative-moderation-001"),"creator restricted")
  A.execute("rollback to savepoint blocked")
  A.execute("savepoint blocked2")
  A.execute("update public.media_assets set processing_state='quarantined' where media_id=%s",(pm,))
  no(register(A,sub,"PostEventCreation",closed_ch,pm,"qr41-negative-unready-001"),"media nonready")
  A.execute("rollback to savepoint blocked2")
  A.execute("savepoint blocked3")
  A.execute("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,))
  no(register(A,sub,"PostEventCreation",closed_ch,pm,"qr41-negative-privacy-001"),"privacy suppression")
  A.execute("rollback to savepoint blocked3")
  A.execute("savepoint blocked4")
  A.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
  no(register(A,sub,"PostEventCreation",closed_ch,pm,"qr41-negative-retired-001"),"retired identity")
  A.execute("rollback to savepoint blocked4")
 traced("QR41_INDEPENDENT_ACTOR_IDENTITY_PRIVACY_MODERATION_MEDIA_NEGATIVES_PASS")
 # PostEvent concurrent, distinct keys, exact persisted normalized replay.
 k1,k2="qr41-post-race-alpha-001","qr41-post-race-bravo-001"
 with ThreadPoolExecutor(max_workers=2) as pool:
  f=pool.submit(register,B,sub,"PostEventCreation",closed_ch,pm,k1)
  g=pool.submit(register,C,sub,"PostEventCreation",closed_ch,pm,k2)
  race=[f.result(),g.result()]
 assert sum(z[0]=="ok" for z in race)==1,race
 assert sum(z[0]=="denied" for z in race)==1,race
 winner=next(z[1] for z in race if z[0]=="ok")
 key=k1 if race[0][0]=="ok" else k2
 assert "entryId" not in winner and winner["publicActivationAllowed"] is False
 assert winner["storageValidatedBySource152"] is False and winner["officialChallengePhaseVerified"] is False
 assert yes(register(A,sub,"PostEventCreation",closed_ch,pm,key),"post replay")==winner
 assert one(A,"select response from public.idempotency_keys where account_id=%s and idempotency_key=%s",(account,"x05:"+key))==winner
 no(register(B,sub,"PostEventCreation",closed_ch,pm,key,caption="MUTATED"),"payload mismatch")
 no(register(B,sub,"PostEventCreation",closed_ch,pm,"qr41-different-key-001"),"same media different key")
 post=winner["workId"]
 assert one(A,"select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s",(post,))==1
 assert one(A,"select count(*) from public.dreamsnap_entries where work_id=%s",(post,))==0
 # Original WAND Entry ID has actual relational binding to same photo and Media.
 orig=yes(register(B,sub,"OriginalCompetition",open_ch,om,"qr41-original-entry-001",True),"original")
 assert orig["entryId"] and orig["entryId"] not in (orig["workId"],orig["photoRevisionId"],orig["photoMediaId"])
 assert yes(register(C,sub,"OriginalCompetition",open_ch,om,"qr41-original-entry-001",True),"orig replay")==orig
 assert one(A,"select response from public.idempotency_keys where account_id=%s and idempotency_key=%s",(account,"x05:qr41-original-entry-001"))==orig
 assert one(A,"select count(*) from public.dreamsnap_entries where work_id=%s and entry_id=%s and entry_revision_id=%s and eligibility_state='eligible' and entry_state='entered'",
  (orig["workId"],orig["entryId"],orig["photoRevisionId"]))==1
 assert one(A,"select count(*) from public.work_revision_media where work_revision_id=%s and media_id=%s",(orig["photoRevisionId"],om))==1
 assert one(A,"select count(*) from public.work_revision_media where work_revision_id=%s and media_id=%s",(winner["photoRevisionId"],pm))==1
 traced("QR41_INDEPENDENT_REGISTER_BOTH_KINDS_REAL_RELATIONS_REPLAY_AND_RACE_PASS")
 # Strong independent negative: deliberately roll back after successful registration and
 # prove no Work-media or idempotency persists, then use that media in normal flow.
 try:
  with A.transaction():
   temp=yes(register(A,sub,"PostEventCreation",closed_ch,spare,"qr41-rollback-test-001"),"rollback write")
   assert temp["workId"]
   raise RuntimeError("rollback_injected")
 except RuntimeError as e:
  assert str(e)=="rollback_injected"
 assert one(B,"select count(*) from public.work_revision_media where media_id=%s",(spare,))==0
 assert one(B,"select count(*) from public.idempotency_keys where account_id=%s and idempotency_key='x05:qr41-rollback-test-001'",(account,))==0
 assert yes(register(C,sub,"PostEventCreation",closed_ch,spare,"qr41-retry-after-rollback-001"),"post-rollback registration")
 traced("QR41_INDEPENDENT_REAL_PG_POST_INSERT_ROLLBACK_AND_RETRY_PASS")
 # Both newly registered Work types feed real Source151. Policy truly absent.
 snapshots={}
 for label,item in [("post",winner),("original",orig)]:
  work=item["workId"]
  p=yes(pre(B,sub,work),"policy-unseeded")
  assert p["state"]=="NEED_POLICY_ARTIFACT" and p["grantAvailable"] is False
  assert "policyReceipt" not in p and p["grantRecorded"] is False
  assert (p["expectedRowVersion"],p["expectedAuthorizationEpoch"])==(0,0)
  assert p["photoRevisionId"]==item["photoRevisionId"] and p["photoMediaId"]==item["photoMediaId"]
  assert p["challengeId"]==item["challengeId"]
  if label=="post":assert "entryId" not in p
  else:assert p["entryId"]==item["entryId"]
  no(pre(C,U(),work),"foreign pregrant")
  snapshots[label]={"register":item,"pregrant":p}
 assert one(A,"select count(*) from private.dreamsnap_x05_consent_events_v1")==0
 # Independent local-only fake policy. Deny Grant before receipt and activation.
 policy="QR CTRL41 DISPOSABLE FIXTURE ONLY - never approved by Owner, not an actual licence or DDV entitlement."
 digest=hashlib.sha256(policy.encode()).hexdigest()
 A.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,false)",(digest,))
 no(action(B,sub,post,0,0,"grant",winner["photoRevisionId"],pm,digest),"unapproved Policy")
 assert one(A,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
 A.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(policy_version,canonical_text,approval_reference,approved_at)
 values('v1',%s,'LOCAL SYNTHETIC ONLY NEVER OWNER APPROVED',now())""",(policy,))
 A.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
 for label,item in [("post",winner),("original",orig)]:
  p=yes(pre(B,sub,item["workId"]),"synthetic ready")
  assert p["state"]=="PREGRANT_READY" and p["policyReceipt"]["policyDigest"]==digest
  # Extra independent cross-product negative: Grant must reject swapped Photo Media,
  # even though both Media are READY and owned by exactly the same Account.
  wrong=om if label=="post" else pm
  no(action(B,sub,item["workId"],0,0,"grant",item["photoRevisionId"],wrong,digest),"cross-Work media swap")
  assert one(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(item["workId"],))==0
 # Post Grant(0,0) CAS concurrent with separate genuine PG backend sessions.
 with ThreadPoolExecutor(max_workers=2) as pool:
  f=pool.submit(action,B,sub,post,0,0,"grant",winner["photoRevisionId"],pm,digest)
  g=pool.submit(action,C,sub,post,0,0,"grant",winner["photoRevisionId"],pm,digest)
  cas=[f.result(),g.result()]
 assert sum(q[0]=="ok" for q in cas)==1,cas
 assert sum(q[0]=="denied" for q in cas)==1,cas
 yes(action(B,sub,orig["workId"],0,0,"grant",orig["photoRevisionId"],om,digest),"Original Grant")
 for label,item in [("post",winner),("original",orig)]:
  work=item["workId"]
  g=yes(read(B,sub,work),"postgrant OwnerRead")
  assert (g["rowVersion"],g["authorizationEpoch"],g["imageGrant"]["consentRevision"])==(1,1,1)
  assert g["photoRevisionId"]==item["photoRevisionId"] and g["photoMediaId"]==item["photoMediaId"]
  assert g["capabilities"]["publicMedia"] is False and g["capabilities"]["publish"] is False
  no(pre(B,sub,work),"PreGrant cannot authorize another first grant")
  outbox=one(A,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))
  withdrawn=yes(action(B,sub,work,1,1,"withdraw"),"withdraw")
  after=withdrawn["owner"]
  assert (after["rowVersion"],after["authorizationEpoch"],after["imageGrant"]["consentRevision"])==(2,2,1)
  assert after["imageGrant"]["state"]=="withdrawn"
  assert after["erasure"]["state"]=="PUBLIC_DISABLED" and after["erasure"]["physicalPurgeVerified"] is False
  assert after["capabilities"]["publicMedia"] is False
  assert one(A,"select visibility::text from public.community_works where work_id=%s",(work,))=="private"
  assert one(A,"select count(*) from public.outbox_events where aggregate_id=%s",(work,))==outbox+1
  no(action(B,sub,work,1,1,"withdraw"),"stale withdraw CAS")
  no(read(C,U(),work),"foreign owner read")
  assert one(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action='grant'",(work,))==1
  assert one(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action='withdraw'",(work,))==1
  snapshots[label]["owner"]=yes(read(B,sub,work),"real postwithdraw OwnerRead")
  # All actual SQL responses recorded, not fabricated WEB envelopes.
 with open("/tmp/qr-ctrl41-full152-db-to-web.json","w",encoding="utf-8") as f:
  json.dump({"syntheticLocalOnly":True,"post":snapshots["post"],"original":snapshots["original"]},f)
 traced("QR41_INDEPENDENT_FULL152_REGISTER_PREGRANT_CAS_WITHDRAW_DB_BRIDGE_PASS",pids=pids,
       signedJwt=False,realMedia=False,policyApproved=False)
