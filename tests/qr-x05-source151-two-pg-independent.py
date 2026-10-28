#!/usr/bin/env python3
"""04 QR new-only Source151: disposable 151-migration FULL PG, original test oracle.
All Account, policy, image and JWT claims are synthetic; no approved real Policy."""
import os,json,time,uuid,hashlib
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.environ.get('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def one(db,q,p=()): return db.execute(q,p).fetchone()[0]
def event(label,**details): print(json.dumps({'marker':label,**details},sort_keys=True,default=str),flush=True)
def issue(db,sub,q,p=(),role='authenticated',revoked=False,anonymous=False,missing_session=False,foreign_sub=False):
    with db.transaction():
        db.execute('set local role '+role)
        claims={'role':role,'sub':str(U() if foreign_sub else sub),
          'iat':int(time.time())-90000 if revoked else int(time.time()),
          'session_id':None if missing_session else str(U()),'is_anonymous':anonymous}
        db.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
        db.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(sub),))
        db.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
        try:
            with db.transaction():return ('ok',one(db,q,p))
        except psycopg.Error as e:return ('blocked',e.sqlstate,str(e).split('\n')[0][:190])
def pre(db,sub,work,**kw):
 return issue(db,sub,'select public.community_dreamsnap_x05_pregrant_read_v1(%s)',(work,),**kw)
def grant(db,sub,work,rev,media,version,digest,rv=0,epoch=0):
 return issue(db,sub,"select public.community_dreamsnap_x05_owner_action_v1(%s,%s,%s,'grant',%s,%s,%s,%s,true,true,null)",
              (work,rv,epoch,rev,media,version,digest))
def owner_read(db,sub,work):
 return issue(db,sub,'select public.community_dreamsnap_x05_owner_read_v1(%s)',(work,))
def denied(x,label):assert x[0]=='blocked',(label,x)
def rejects_sql(db,q,p=()):
 try:
  with db.transaction(): db.execute(q,p)
 except psycopg.Error:return True
 return False

with psycopg.connect(DSN,autocommit=True) as db,psycopg.connect(DSN,autocommit=True) as peer:
 assert one(db,'select count(*) from supabase_migrations.schema_migrations')==151
 assert one(db,'select pg_backend_pid()')!=one(peer,'select pg_backend_pid()')
 for role in ('anon','authenticated','service_role'):
  for sign in ['private.dreamsnap_x05_policy_activate_guard_v1()',
    'private.dreamsnap_x05_policy_receipt_immutable_v1()',
    'private.dreamsnap_x05_verified_db_subject_v1()',
    'private.dreamsnap_x05_record_creator_grant_v1(uuid,uuid,uuid,uuid,text,text,bigint,boolean,boolean)',
    'public.community_dreamsnap_x05_pregrant_read_v1(uuid)']:
   oid=one(db,'select %s::regprocedure::oid',(sign,))
   assert one(db,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid))==(role=='authenticated' and sign.startswith('public.')),(role,sign)
  for name in ('private.dreamsnap_x05_policy_receipt_v1','private.dreamsnap_x05_owner_policy_v1'):
   for right in ('SELECT','INSERT','UPDATE','DELETE'):
    assert not one(db,'select has_table_privilege(%s,%s::regclass,%s)',(role,name,right))
 assert one(db,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 assert one(db,'select count(*) from private.dreamsnap_x05_policy_receipt_v1')==0
 event('QR151_PRIVATE_ROLE_AND_EMPTY_POLICY_REGISTRY_PASS')

 account,sub,creator,challenge=[U() for _ in range(4)]
 work,photo,media,entry=[U() for _ in range(4)]
 staged_work,staged_photo,staged_media=[U() for _ in range(3)]
 with db.transaction():
  db.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
  db.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
    values(%s,'supabase',%s,now(),'active')""",(account,str(sub)))
  db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  db.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'Independent 151')",
    (creator,account,'qr151_'+U().hex[:20]))
  db.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
   submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
   formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
   values(%s,%s,'Independent local','results',now()-interval '8 hours',now()-interval '7 hours',
   now()-interval '6 hours',now()-interval '5 hours',now()-interval '4 hours',
   now()+interval '1 hour',2,1,1,1,false)""",(challenge,'qr151_'+U().hex[:20]))
  for w,r,m in [(work,photo,media),(staged_work,staged_photo,staged_media)]:
   db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(w,m))
   db.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
      values(%s,%s,%s,'dreamsnap','draft','private')""",(w,account,creator))
   db.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(r,w,account))
   db.execute("insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13) values(%s,%s,'self',false)",(w,challenge))
   db.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
     no_external_edits_attested,integrity_state,caption) values(%s,%s,true,true,'eligible','synthetic')""",(r,challenge))
   db.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
      width,height,checksum_sha256,processing_state,moderation_state)
      values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
     (m,account,'qr151/local/'+str(m),'a'*64))
   db.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(r,m))
   db.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(r,w))
  db.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,
     managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
     values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,challenge,work,account,photo))
  db.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,photo))
  db.execute("""insert into private.dreamsnap_post_event_staged_v1(
    work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
    values(%s,%s,%s,%s,%s,%s)""",(staged_work,challenge,creator,staged_photo,staged_media,staged_photo))

 def counts(w):
  return (one(db,'select count(*) from private.dreamsnap_x05_work_control_v1 where work_id=%s',(w,)),
   one(db,'select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s',(w,)),
   one(db,'select count(*) from public.outbox_events where aggregate_id=%s',(w,)),
   one(db,'select visibility::text from public.community_works where work_id=%s',(w,)))
 before=counts(work)
 assert before[0:3]==(0,0,0)
 for w,k in [(work,'OriginalCompetition'),(staged_work,'PostEventCreation')]:
  r=pre(peer,sub,w)
  assert r[0]=='ok',r
  d=r[1]
  assert d['contractVersion']=='wand.dreamsnaps.pregrant-service@1'
  assert d['state']=='NEED_POLICY_ARTIFACT' and d['grantAvailable'] is False
  assert 'policyReceipt' not in d
  assert d['kind']==k and d['expectedRowVersion']==0 and d['expectedAuthorizationEpoch']==0
  assert d['grantRecorded'] is False and d['publicActivationAllowed'] is False
  assert d['officialChallengePhaseVerified'] is False
  assert d['photoMediaId']==str(media if w==work else staged_media)
  if w==work:
   assert d['entryId']==str(entry) and d['frozenEntryRevisionId']==str(photo)
  else:assert 'entryId' not in d and 'frozenEntryRevisionId' not in d
 assert counts(work)==before
 assert counts(staged_work)[:3]==(0,0,0)
 for kw in [{'role':'anon'},{'role':'service_role'},{'anonymous':True},
    {'missing_session':True},{'foreign_sub':True}]:
  denied(pre(peer,sub,work,**kw),'AUTH_PREGRANT_'+str(kw))
 with db.transaction():
  db.execute('savepoint qr151_session_cutoff')
  try:
   db.execute("update public.auth_identities set sessions_valid_after=clock_timestamp()-interval '1 hour' where account_id=%s",(account,))
   denied(pre(db,sub,work,revoked=True),'JWT_ISSUED_BEFORE_SESSION_CUTOFF')
  finally:
   db.execute('rollback to savepoint qr151_session_cutoff')
   db.execute('release savepoint qr151_session_cutoff')
 denied(pre(peer,U(),work),'FOREIGN_SUBJECT')
 for typ in ['retired','privacy','moderation','under13']:
  with db.transaction():
   db.execute('savepoint qr151_negative')
   try:
    if typ=='retired':db.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
    elif typ=='privacy':db.execute('insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())',(account,))
    elif typ=='moderation':db.execute("update public.community_works set moderation_state='restricted' where work_id=%s",(work,))
    else:db.execute("update public.dreamsnap_works set managed_under13=true where work_id=%s",(work,))
    denied(pre(db,sub,work),typ)
   finally:
    db.execute('rollback to savepoint qr151_negative')
    db.execute('release savepoint qr151_negative')
 assert counts(work)==before
 event('QR151_REAL_ORIGINAL_POSTEVENT_OWNED_PREGRANT_READ_ONLY_AND_DENIAL_PASS')

 policy='SYNTHETIC TEST ONLY — creator photo display scope, not actual Owner-approved policy.'
 version='v901'
 digest=hashlib.sha256(policy.encode('utf-8')).hexdigest()
 assert rejects_sql(db,"insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values(%s,%s,true)",(version,digest))
 db.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values(%s,%s,false)",(version,digest))
 assert rejects_sql(db,"update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version=%s",(version,))
 db.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(
    policy_version,canonical_text,approval_reference,approved_at)
    values(%s,%s,%s,now()-interval '1 hour')""",
    (version,policy,'SYNTHETIC_LOCAL_METADATA_NOT_ACTUAL_APPROVAL'))
 assert rejects_sql(db,"update private.dreamsnap_x05_policy_receipt_v1 set canonical_text='forged' where policy_version=%s",(version,))
 assert rejects_sql(db,"delete from private.dreamsnap_x05_policy_receipt_v1 where policy_version=%s",(version,))
 assert rejects_sql(db,"update private.dreamsnap_x05_owner_policy_v1 set policy_digest=%s,is_active=true where policy_version=%s",('0'*64,version))
 db.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version=%s",(version,))
 ready=pre(peer,sub,work)
 assert ready[0]=='ok' and ready[1]['state']=='PREGRANT_READY',ready
 assert ready[1]['policyReceipt']=={'policyVersionText':version,'policyDigest':digest,
  'scopeId':'wand.dreamsnaps.creator-photo-grant@1','canonicalText':policy}
 assert ready[1]['grantRecorded'] is False and counts(work)==before
 event('QR151_POLICY_SHA256_IMMUTABLE_RECEIPT_ACTIVATION_GATE_SYNTHETIC_ONLY_PASS')

 # Race TWO actual backend connections to insert first control with expected (0,0).
 with ThreadPoolExecutor(max_workers=2) as executor:
  fa=executor.submit(grant,db,sub,work,photo,media,version,digest,0,0)
  fb=executor.submit(grant,peer,sub,work,photo,media,version,digest,0,0)
  pair=[fa.result(),fb.result()]
 assert sum(x[0]=='ok' for x in pair)==1,pair
 assert sum(x[0]=='blocked' for x in pair)==1,pair
 assert one(db,'select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s',(work,))==1
 assert one(db,'select count(*) from private.dreamsnap_x05_work_control_v1 where work_id=%s',(work,))==1
 after=owner_read(peer,sub,work)
 assert after[0]=='ok' and after[1]['imageGrant']['consentRevision']==1,after
 assert after[1]['imageGrant']['policyVersionText']==version
 denied(pre(peer,sub,work),'CONTROL_PRESENT')
 denied(grant(peer,sub,work,photo,media,version,digest,0,0),'FIRST_GRANT_REPLAY')
 assert one(db,'select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s',(work,))==1
 assert one(db,'select private.dreamsnap_x05_public_activation_v1(%s)',(work,)) is False
 event('QR151_TWO_REAL_PG_FIRST_GRANT_CAS_ONE_EVENT_AND_POSTGRANT_READ_PASS',
  pids=[one(db,'select pg_backend_pid()'),one(peer,'select pg_backend_pid()')])
 event('QR151_INDEPENDENT_FULL151_LOCAL_DONE',signedJwt=False,approvedPolicy=False)
