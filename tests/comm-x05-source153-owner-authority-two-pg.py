#!/usr/bin/env python3
"""SOURCE153 ONLY: disposable full153 PostgreSQL, 2 actual connections.
Signed-JWT GUC, Media READY, provider receipts, and Policy approval are
SYNTHETIC LOCAL fixtures. Never claim live JWT, external Media or owner approval.
"""
import os,uuid,json,time,hashlib,psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL")=="CONFIRMED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u=uuid.uuid4
def one(d,q,args=()):return d.execute(q,args).fetchone()[0]
def log(tag,**v):print(json.dumps(dict(marker=tag,**v),sort_keys=True,default=str),flush=True)
def call(db,subject,work,role="authenticated",version=None,epoch=None,anonymous=False):
 with db.transaction():
  db.execute("set local role "+role)
  claims={"role":role,"sub":str(subject),"session_id":str(u()),"iat":int(time.time()),"is_anonymous":anonymous}
  db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
  db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
  db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
  try:
   with db.transaction():
    val=one(db,"select public.community_dreamsnap_x05_owner_authority_v2(%s,%s,%s)",(work,version,epoch))
   return ("ok",val)
  except psycopg.Error as e:return ("denied",e.sqlstate,str(e).split("\n")[0][:220])
def deny(result,tag):assert result[0]=="denied",(tag,result)
with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
 assert one(a,"select count(*) from supabase_migrations.schema_migrations")==153
 pid=[one(x,"select pg_backend_pid()") for x in (a,b)]
 assert pid[0]!=pid[1]
 oid=one(a,"select %s::regprocedure::oid",("public.community_dreamsnap_x05_owner_authority_v2(uuid,bigint,bigint)",))
 for role in ("anon","authenticated","service_role"):
  assert bool(one(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid)))==(role=="authenticated")
 assert one(a,"select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
 assert one(a,"select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
 account,subject,creator,challenge=[u() for _ in range(4)]
 original,post=[u(),u()]
 photo_o,photo_p=[u(),u()]
 media_o,media_p=[u(),u()]
 entry=u()
 with a.transaction():
  a.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
  a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'Source153 Synthetic')",(creator,account,'comm153_'+u().hex[:16]))
  a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
      submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
      formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
      minimum_real_eligible_creators,is_synthetic)
      values(%s,%s,'Local Synthetic Challenge','results',now()-interval '8 days',now()-interval '7 days',
      now()-interval '6 days',now()-interval '5 days',now()-interval '4 days',
      now()+interval '1 day',2,1,1,1,false)""",(challenge,"comm153_"+u().hex[:19]))
  for work,rev,media in ((original,photo_o,media_o),(post,photo_p,media_p)):
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
   a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
        values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
   a.execute("insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13) values(%s,%s,'self',false)",(work,challenge))
   a.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(rev,work,account))
   a.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,no_external_edits_attested,integrity_state)
    values(%s,%s,true,true,'eligible')""",(rev,challenge))
   a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
    values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",(media,account,"comm153/synthetic/"+str(media),"a"*64))
   a.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev,media))
   a.execute("update public.community_works set current_published_revision_id=%s,lifecycle_state='published',visibility='private',published_at=now() where work_id=%s",(rev,work))
  a.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
   values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,challenge,original,account,photo_o))
  a.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,photo_o))
  a.execute("""insert into private.dreamsnap_post_event_staged_v1(
    work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
    values(%s,%s,%s,%s,%s,%s)""",(post,challenge,creator,photo_p,media_p,photo_p))
  # IMPORTANT: This synthetic policy is inserted ONLY into disposable CI DB.
  policy_text="SYNTHETIC LOCAL TEST: not owner-approved, not Disney licence, no live publishing."
  dig=hashlib.sha256(policy_text.encode("utf8")).hexdigest()
  a.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,false)",(dig,))
  for work,rev,media,kind in ((original,photo_o,media_o,'OriginalCompetition'),(post,photo_p,media_p,'PostEventCreation')):
   a.execute("""insert into private.dreamsnap_x05_work_control_v1(
      work_id,owner_account_id,creator_profile_id,challenge_id,work_kind,
      frozen_photo_revision_id,frozen_media_id,concept_revision_id,grant_policy_version,
      grant_policy_digest,creator_self_capture_declared)
      values(%s,%s,%s,%s,%s,%s,%s,%s,'v1',%s,true)""",
      (work,account,creator,challenge,kind,rev,media,rev,dig))
   a.execute("""insert into private.dreamsnap_x05_consent_events_v1(work_id,event_version,action,account_id,policy_version,policy_digest)
      values(%s,1,'grant',%s,'v1',%s)""",(work,account,dig))
 log("COMM153_LOCAL_ONLY_FIXTURE_POLICY_UNAPPROVED")
 deny(call(b,u(),post),"foreign actor")
 deny(call(b,subject,post,role="anon"),"anon")
 deny(call(b,subject,post,role="service_role"),"service")
 deny(call(b,subject,post,anonymous=True),"anonymous")
 rpost=call(b,subject,post);rorig=call(b,subject,original)
 assert rpost[0]=="ok" and rorig[0]=="ok",(rpost,rorig)
 postv,origv=rpost[1],rorig[1]
 assert postv["contractVersion"]=="wand.dreamsnaps.owner-authority-projection@1"
 assert postv["consumerTarget"]=="wand.dreamsnaps.private-owner-consumer@2"
 assert postv["authority"]["authenticatedAccountBound"]
 assert postv["authority"]["workPhotoBindingVerified"] and postv["authority"]["mediaOwnershipVerified"]
 assert postv["grant"]["mediaId"]==str(media_p)
 assert postv["grant"]["lastGrantConsentRevision"]==1
 assert postv["grant"]["creatorSelfCaptureDeclared"] and postv["grant"]["explicitGrantAccepted"]
 assert postv["grant"]["policyReceiptVerified"] is False and postv["grant"]["scopeStatus"]=="UNVERIFIED"
 assert "scopeId" not in postv["grant"] and "approvedPurposeIds" not in postv["grant"]
 assert "entryId" not in postv["work"] and origv["work"]["entryId"]==str(entry)
 assert origv["work"]["frozenEntryRevisionId"]==str(photo_o)
 assert "ownerAccountId" not in json.dumps(postv)
 assert postv["deletion"]["globalPurgeScopeComplete"] is False
 assert postv["externalEvidence"]["storageProviderObjectVerified"] is False
 assert not any(postv["capabilities"].values())
 assert rorig[1]["grant"]["mediaId"]==str(media_o)
 log("COMM153_AUTHENTICATED_WORK_SCOPES_UNAPPROVED_PASS")
 deny(call(b,subject,post,version=2,epoch=1),"stale CAS rowVersion")
 deny(call(b,subject,post,version=1,epoch=2),"stale epoch")
 def neg(sql,args,name):
  with a.transaction():
   a.execute("savepoint negative")
   a.execute(sql,args)
   deny(call(a,subject,post),name)
   a.execute("rollback to savepoint negative")
   a.execute("release savepoint negative")
 neg("update public.auth_identities set identity_state='retired' where account_id=%s",(account,),"retired")
 neg("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account,),"privacy")
 neg("update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,),"moderation")
 neg("update private.dreamsnap_x05_work_control_v1 set frozen_media_id=%s where work_id=%s",(media_o,post),"same Account different Work Media")
 neg("update private.dreamsnap_x05_work_control_v1 set frozen_photo_revision_id=%s where work_id=%s",(photo_o,post),"other Work revision")
 neg("update private.dreamsnap_post_event_staged_v1 set publication_state='staged',concept_revision_id=%s where work_id=%s",(photo_o,post),"revision mismatch")
 log("COMM153_PRIVACY_RETIRE_MEDIA_REVISIONS_CAS_NEGATIVES_PASS")
 # Real local retention hold row; not proof of any external Provider hold.
 with a.transaction():
  a.execute("savepoint local_hold")
  a.execute("""insert into private.account_retention_holds(account_id,hold_type,reason,created_by_account_id)
      values(%s,'legal','SYNTHETIC LOCAL HOLD',%s)""",(account,account))
  x=call(a,subject,post)
  assert x[0]=="ok" and x[1]["deletion"]["activeAccountLegalHold"] is True,x
  assert x[1]["deletion"]["globalPurgeScopeComplete"] is False
  a.execute("rollback to savepoint local_hold")
  a.execute("release savepoint local_hold")
 log("COMM153_LOCAL_LEGAL_HOLD_SCOPE_PASS")
 # Inject an R19 predicate only inside a rolled-back fixture transaction.
 # This proves Source153 fails closed on incident predicate, NOT a Provider incident.
 with a.transaction():
  a.execute("savepoint injected_incident")
  a.execute("""create or replace function private.preset_storage_work_quarantined_r19(p_work_id uuid)
    returns boolean language sql stable security definer set search_path=pg_catalog as $$
    select p_work_id=%s::uuid $$""".replace("%s::uuid","'"+str(post)+"'::uuid"))
  deny(call(a,subject,post),"incident suppression predicate")
  a.execute("rollback to savepoint injected_incident")
  a.execute("release savepoint injected_incident")
 log("COMM153_INJECTED_INCIDENT_PREDICATE_ONLY_PASS")
 # Withdraw one Work: version2/epoch2, last *grant* event still version1.
 a.execute("""update private.dreamsnap_x05_work_control_v1
    set row_version=2,authorization_epoch=2,control_state='withdrawn',withdrawn_at=now()
    where work_id=%s""",(post,))
 a.execute("""insert into private.dreamsnap_x05_consent_events_v1(work_id,event_version,action,account_id,policy_version,policy_digest)
    values(%s,2,'withdraw',%s,'v1',%s)""",(post,account,dig))
 x=call(b,subject,post,version=2,epoch=2)
 assert x[0]=="ok",x
 assert x[1]["authority"]["rowVersion"]==2 and x[1]["authority"]["authorizationEpoch"]==2
 assert x[1]["grant"]["lastGrantConsentRevision"]==1 and x[1]["grant"]["state"]=="withdrawn"
 assert x[1]["deletion"]["controlState"]=="withdrawn"
 assert x[1]["deletion"]["publicDisabled"] is True
 assert x[1]["grant"]["publicUsageAuthorized"] is False
 log("COMM153_WITHDRAW_ROWVERSION_EPOCH_VS_LAST_GRANT_EVENT_PASS")
 log("COMM153_FULL153_SOURCE_LOCAL_COMPLETE",backendPids=pid,migrations=153)
