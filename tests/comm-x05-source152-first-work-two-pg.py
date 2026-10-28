#!/usr/bin/env python3
"""Source152 NEW-ONLY disposable full152 PG, signed JWT GUC simulated.
Uses only synthetic pre-registered READY Media; NO actual upload/Provider proof.
"""
import os,uuid,json,time,psycopg
from concurrent.futures import ThreadPoolExecutor
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u=uuid.uuid4
def one(db,q,args=()):return db.execute(q,args).fetchone()[0]
def log(s,**kw):print(json.dumps(dict(marker=s,**kw),sort_keys=True,default=str),flush=True)
def case(db,subject,sql,args=(),role="authenticated",missing_session=False):
 with db.transaction():
  db.execute("set local role "+role)
  claims={"role":role,"sub":str(subject),"session_id":None if missing_session else str(u()),"iat":int(time.time())}
  db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
  db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
  db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
  try:
   with db.transaction():value=one(db,sql,args)
   return ("ok",value)
  except psycopg.Error as e:return ("denied",e.sqlstate,str(e).split("\n")[0][:190])
def reg(db,subject,kind,challenge,media,key,entry=False,caption="A screenshot",**kw):
 return case(db,subject,"""select public.community_dreamsnap_x05_register_initial_work_v1(
 %s,%s,%s,%s,%s,%s)""",(kind,challenge,media,caption,key,entry),**kw)
def pre(db,subject,work):
 return case(db,subject,"select public.community_dreamsnap_x05_pregrant_read_v1(%s)",(work,))
def deny(r,name):assert r[0]=="denied",(name,r)
with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
 assert one(a,"select count(*) from supabase_migrations.schema_migrations")==152
 assert one(a,"select pg_backend_pid()")!=one(b,"select pg_backend_pid()")
 sig="public.community_dreamsnap_x05_register_initial_work_v1(text,uuid,uuid,text,text,boolean)"
 oid=one(a,"select %s::regprocedure::oid",(sig,))
 for role in ["anon","authenticated","service_role"]:
  assert bool(one(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid)))==(role=="authenticated")
 assert one(a,"select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
 assert one(a,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
 account,subject,creator,live,post=[u() for _ in range(5)]
 media_o,media_p,media_third=[u() for _ in range(3)]
 with a.transaction():
  a.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
  a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'SOURCE152 SYNTHETIC')",(creator,account,"comm152_"+u().hex[:18]))
  a.execute("""insert into public.dreamsnap_challenges(
    challenge_id,challenge_key,title,lifecycle_state,
    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,
    results_at,closes_at,formal_vote_allowance,special_pick_allowance,
    minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'SOURCE152 LOCAL', 'submission_open',now()-interval '2 hours',
    now()+interval '1 day',now()+interval '2 days',now()+interval '3 days',
    now()+interval '4 days',now()+interval '5 days',2,1,1,1,false)""",
    (live,"comm152_"+u().hex[:18]))
  a.execute("""insert into public.dreamsnap_challenges(
    challenge_id,challenge_key,title,lifecycle_state,
    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,
    results_at,closes_at,formal_vote_allowance,special_pick_allowance,
    minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'SOURCE152 LOCAL', 'results',now()-interval '8 days',
    now()-interval '7 days',now()-interval '6 days',now()-interval '5 days',
    now()-interval '4 days',now()+interval '2 days',2,1,1,1,false)""",
    (post,"comm152_"+u().hex[:18]))
  for media in (media_o,media_p,media_third):
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
   a.execute("""insert into public.media_assets(
     media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,
     processing_state,moderation_state)
     values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
     (media,account,"comm152/disposable/"+str(media),"a"*64))
 log("COMM152_ROLE_POLICY_UNSEEDED_AND_MEDIA_READY_FIXTURE_PASS")
 deny(reg(b,subject,"PostEventCreation",post,media_p,"safe-152-negative-001",False,role="anon"),"anon")
 deny(reg(b,subject,"PostEventCreation",post,media_p,"safe-152-negative-001",False,role="service_role"),"admin")
 deny(reg(b,u(),"PostEventCreation",post,media_p,"safe-152-negative-001",False),"wrong user")
 deny(reg(b,subject,"PostEventCreation",post,media_p,"safe-152-negative-001",False,missing_session=True),"session")
 deny(reg(b,subject,"PostEventCreation",post,media_p,"safe-152-negative-001",True),"postevent entry")
 deny(reg(b,subject,"OriginalCompetition",post,media_p,"safe-152-negative-001",True),"wrong phase")
 deny(reg(b,subject,"OriginalCompetition",live,media_o,"safe-152-negative-001",False),"missing explicit entry")
 with a.transaction():
  a.execute("savepoint media_denied")
  a.execute("update public.media_assets set processing_state='quarantined' where media_id=%s",(media_p,))
  deny(reg(a,subject,"PostEventCreation",post,media_p,"safe-152-negative-001",False),"unready media")
  a.execute("rollback to savepoint media_denied");a.execute("release savepoint media_denied")
 with a.transaction():
  a.execute("savepoint creator_denied")
  a.execute("update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,))
  deny(reg(a,subject,"PostEventCreation",post,media_p,"safe-152-negative-001",False),"Creator moderation")
  a.execute("rollback to savepoint creator_denied");a.execute("release savepoint creator_denied")
 log("COMM152_AUTH_MEDIA_MODERATION_ENTRY_NEGATIVES_PASS")
 with psycopg.connect(DSN,autocommit=True) as c:
  with ThreadPoolExecutor(max_workers=2) as pool:
   f=pool.submit(reg,b,subject,"PostEventCreation",post,media_p,"safe-152-race-aaa",False)
   g=pool.submit(reg,c,subject,"PostEventCreation",post,media_p,"safe-152-race-bbb",False)
   race=[f.result(),g.result()]
 assert sum(x[0]=="ok" for x in race)==1,race
 assert sum(x[0]=="denied" for x in race)==1,race
 registered=next(x[1] for x in race if x[0]=="ok")
 w=registered["workId"]
 assert registered["kind"]=="PostEventCreation" and "entryId" not in registered
 assert registered["publicActivationAllowed"] is False
 assert registered["requiresPolicyGrant"] is True
 assert registered["storageValidatedBySource152"] is False
 assert one(a,"select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s",(w,))==1
 assert one(a,"select count(*) from public.dreamsnap_entries where work_id=%s",(w,))==0
 # Source152 QR260 TRUE RED regression: initial and same-key replay MUST be byte-equivalent JSON shapes.
 winning_key="safe-152-race-aaa" if race[0][0]=="ok" else "safe-152-race-bbb"
 replay=reg(b,subject,"PostEventCreation",post,media_p,winning_key,False)
 assert replay[0]=="ok" and replay[1]==registered,(replay,registered)
 assert "entryId" not in replay[1] and "entryId" not in registered
 log("COMM152_TRUE_RED_POSTEVENT_IDENTICAL_REPLAY_NORMALIZED_PASS")
 pr=pre(b,subject,w)
 assert pr[0]=="ok" and pr[1]["state"]=="NEED_POLICY_ARTIFACT",pr
 assert pr[1]["photoRevisionId"]==registered["photoRevisionId"]
 assert pr[1]["photoMediaId"]==str(media_p)
 assert one(a,"select count(*) from private.dreamsnap_x05_consent_events_v1")==0
 deny(reg(b,subject,"PostEventCreation",post,media_p,"safe-152-different-key",False),"duplicate image registration")
 log("COMM152_TWO_PG_POSTEVENT_STAGED_ORPHAN_FREE_PREGRANT_PASS")
 orig=reg(b,subject,"OriginalCompetition",live,media_o,"safe-152-original-001",True)
 assert orig[0]=="ok",orig
 origdata=orig[1]
 assert origdata["entryId"] is not None
 assert origdata["kind"]=="OriginalCompetition" and origdata["publicActivationAllowed"] is False
 ow=origdata["workId"]
 assert one(a,"select visibility::text from public.community_works where work_id=%s",(ow,))=="private"
 assert one(a,"select count(*) from public.dreamsnap_entries where work_id=%s",(ow,))==1
 op=pre(b,subject,ow)
 assert op[0]=="ok" and op[1]["kind"]=="OriginalCompetition",op
 assert op[1]["entryId"]==origdata["entryId"]
 again=reg(b,subject,"OriginalCompetition",live,media_o,"safe-152-original-001",True)
 assert again[0]=="ok" and again[1]==origdata,again
 deny(reg(b,subject,"OriginalCompetition",live,media_third,"safe-152-original-001",True),"key different payload")
 assert one(a,"select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s",(account,"x05:safe-152-original-001"))==1
 log("COMM152_EXISTING_WORK_ENTRY_NATIVE_WRITERS_AND_IDEMPOTENCY_PASS")
 log("COMM152_SOURCE_LOCAL_COMPLETE",migrations=152,backends=[one(a,"select pg_backend_pid()"),one(b,"select pg_backend_pid()")])
