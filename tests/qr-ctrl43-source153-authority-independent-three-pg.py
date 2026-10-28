#!/usr/bin/env python3
"""04 QR CTRL43 independent Source153 authority-only validation. Genuine local FULL153 three-PG.
Not the COMM Owner runner. JWT GUC, READY Media and optional Policy are synthetic.
No actual signed JWT, real Provider, Stage or public/physical write.
"""
import os,json,uuid,time,hashlib
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
new=uuid.uuid4
def scalar(c,sql,args=()):return c.execute(sql,args).fetchone()[0]
def emit(key,**kwargs):print(json.dumps({'marker':key,**kwargs},default=str,sort_keys=True),flush=True)
def authority(c,sub,work,rv=None,epoch=None,role='authenticated',anonymous=False,missing_session=False):
 with c.transaction():
  c.execute('set local role '+role)
  claims={'role':role,'sub':str(sub),'session_id':None if missing_session else str(new()),'iat':int(time.time()),'is_anonymous':anonymous}
  for k,v in [('request.jwt.claims',json.dumps(claims)),('request.jwt.claim.sub',str(sub)),('request.jwt.claim.role',role)]:
   c.execute('select set_config(%s,%s,true)',(k,v))
  try:
   with c.transaction():
    val=scalar(c,'select public.community_dreamsnap_x05_owner_authority_v2(%s,%s,%s)',(work,rv,epoch))
   return ('ok',val)
  except psycopg.Error as ex:return ('denied',ex.sqlstate,str(ex).split('\n')[0][:180])
def success(r,k='positive authorisation'):assert r[0]=='ok',(k,r);return r[1]
def denied(r,k):assert r[0]=='denied',(k,r)
def bounded(projection,entry=False):
 assert projection['contractVersion']=='wand.dreamsnaps.owner-authority-projection@1'
 assert projection['consumerTarget']=='wand.dreamsnaps.private-owner-consumer@2'
 w,a,g,d,e,c=[projection[x] for x in ('work','authority','grant','deletion','externalEvidence','capabilities')]
 assert a['ownerAuthorized'] is True and a['authenticatedAccountBound'] is True
 assert a['activeIdentityVerified'] is True and a['creatorOwnerVerified'] is True
 assert a['workPhotoBindingVerified'] is True and a['mediaOwnershipVerified'] is True
 assert g['mediaId']==w['photoMediaId'] and g['photoRevisionId']==w['photoRevisionId']
 assert g['creatorSelfCaptureDeclared'] is True and g['explicitGrantAccepted'] is True
 assert g['consentRecorded'] is True and g['publicUsageAuthorized'] is False
 assert g['scopeStatus']=='UNVERIFIED' and g['policyReceiptVerified'] is False
 assert 'scopeId' not in g and 'approvedPurposeIds' not in g
 assert d['globalPurgeScopeComplete'] is False and d['cloudCdnIssuedBearerStatus']=='UNKNOWN'
 assert d['localProviderScope']=='SINGLE_FROZEN_MEDIA_RECORD'
 assert all(v is False for v in e.values()) and all(v is False for v in c.values())
 assert 'ownerAccountId' not in json.dumps(projection)
 for secret in ('storageKey','signedUrl','bearer','secret','jwt','accessToken','refreshToken'):
  assert secret not in json.dumps(projection),secret
 assert ('entryId' in w)==entry
 assert ('frozenEntryRevisionId' in w)==entry
 if entry:assert w['frozenEntryRevisionId']==w['photoRevisionId']
with psycopg.connect(DSN,autocommit=True) as A,psycopg.connect(DSN,autocommit=True) as B,psycopg.connect(DSN,autocommit=True) as C:
 assert scalar(A,'select count(*) from supabase_migrations.schema_migrations')==153
 pids=[scalar(d,'select pg_backend_pid()') for d in (A,B,C)]
 assert len(set(pids))==3
 proc=scalar(A,'select %s::regprocedure::oid',('public.community_dreamsnap_x05_owner_authority_v2(uuid,bigint,bigint)',))
 for role in ('anon','service_role','authenticated'):
  assert scalar(A,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,proc))==(role=='authenticated'),role
 assert scalar(A,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 assert scalar(A,'select count(*) from private.dreamsnap_x05_policy_receipt_v1')==0
 acct,sub,creator,ch,ow,pw,orv,prv,om,pm,entry=[new() for _ in range(11)]
 with A.transaction():
  A.execute('insert into public.wand_accounts(account_id) values(%s)',(acct,))
  A.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(acct,str(sub)))
  A.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  A.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR43 synthetic')",(creator,acct,'qr43_'+new().hex[:19]))
  A.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
    formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'QR43 synthetic','results',now()-interval '8 days',now()-interval '7 days',
     now()-interval '6 days',now()-interval '5 days',now()-interval '4 days',now()+interval '1 day',
     2,1,1,1,false)""",(ch,'qr43_'+new().hex[:19]))
  for work,rev,media in ((ow,orv,om),(pw,prv,pm)):
   A.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
   A.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
     values(%s,%s,%s,'dreamsnap','draft','private')""",(work,acct,creator))
   A.execute("insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13) values(%s,%s,'self',false)",(work,ch))
   A.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(rev,work,acct))
   A.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,no_external_edits_attested,integrity_state)
     values(%s,%s,true,true,'eligible')""",(rev,ch))
   A.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
     values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",(media,acct,'qr43-no-real-provider/'+str(media),'a'*64))
   A.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev,media))
   A.execute("update public.community_works set current_published_revision_id=%s,lifecycle_state='published',published_at=now() where work_id=%s",(rev,work))
  A.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
     values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,ch,ow,acct,orv))
  A.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,orv))
  A.execute("""insert into private.dreamsnap_post_event_staged_v1(work_id,challenge_id,creator_profile_id,
    immutable_photo_revision_id,media_id,concept_revision_id) values(%s,%s,%s,%s,%s,%s)""",(pw,ch,creator,prv,pm,prv))
 policy='QR43 SYNTHETIC LOCAL TEST ONLY, not owner approved. No image publishing permissions or actual provider rights.'
 digest=hashlib.sha256(policy.encode()).hexdigest()
 A.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,false)",(digest,))
 with A.transaction():
  for work,rev,media,kind in ((ow,orv,om,'OriginalCompetition'),(pw,prv,pm,'PostEventCreation')):
   A.execute("""insert into private.dreamsnap_x05_work_control_v1(
      work_id,owner_account_id,creator_profile_id,challenge_id,work_kind,frozen_photo_revision_id,
      frozen_media_id,concept_revision_id,grant_policy_version,grant_policy_digest,creator_self_capture_declared)
      values(%s,%s,%s,%s,%s,%s,%s,%s,'v1',%s,true)""",(work,acct,creator,ch,kind,rev,media,rev,digest))
   A.execute("""insert into private.dreamsnap_x05_consent_events_v1(work_id,event_version,action,account_id,policy_version,policy_digest)
     values(%s,1,'grant',%s,'v1',%s)""",(work,acct,digest))
 # Independent actual permission/identity/Work-specific checks.
 denied(authority(B,sub,pw,role='anon'),'anon SQL')
 denied(authority(B,sub,pw,role='service_role'),'service-role SQL')
 denied(authority(B,sub,pw,anonymous=True),'anonymous')
 denied(authority(B,sub,pw,missing_session=True),'no session')
 denied(authority(B,new(),pw),'forged actor')
 denied(authority(B,sub,new()),'forged work')
 first=success(authority(B,sub,pw,1,1),'positive PostEvent')
 orig=success(authority(C,sub,ow,1,1),'positive Original')
 bounded(first,entry=False);bounded(orig,entry=True)
 assert first['work']['workId']==str(pw) and first['work']['photoMediaId']==str(pm)
 assert orig['work']['entryId']==str(entry) and orig['work']['photoRevisionId']==str(orv)
 assert orig['work']['photoMediaId']==str(om) and orig['grant']['mediaId']==str(om)
 assert first['authority']['mediaReady'] is True
 assert first['authority']['rowVersion']==1 and first['authority']['authorizationEpoch']==1
 assert first['grant']['lastGrantConsentRevision']==1
 assert scalar(A,'select count(*) from public.dreamsnap_entries where work_id=%s',(pw,))==0
 assert scalar(A,'select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s',(pw,))==1
 # Genuine concurrent independent sessions reading same committed state; DTOs identical.
 with ThreadPoolExecutor(max_workers=2) as pool:
  a,b=list(pool.map(lambda c:authority(c,sub,pw,1,1),(B,C)))
 assert success(a,'concurrent A')==success(b,'concurrent B')==first
 emit('QR43_AUTHENTICATED_3PG_FROZEN_WORK_ENTRY_POLICY_UNAPPROVED_PASS',backendPids=pids)
 for rv,epoch in ((2,1),(1,2),(0,1),(1,0)):
  denied(authority(B,sub,pw,rv,epoch),'stale or invalid CAS')
 # Rollback each independently injected local mutation; no fixture change persists.
 def mutation(sql,args,label,work=pw):
  with A.transaction():
   try:
    with A.transaction():
     A.execute(sql,args)
     denied(authority(A,sub,work),label)
     raise RuntimeError('rollback_QR43_fixture')
   except RuntimeError as e:assert str(e)=='rollback_QR43_fixture'
  assert success(authority(B,sub,pw))['work']['photoMediaId']==str(pm)
 mutation("update public.auth_identities set identity_state='retired' where account_id=%s",(acct,),'retired identity')
 mutation("insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(acct,),'privacy suppression')
 mutation("update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,),'creator moderation')
 mutation("update public.community_works set moderation_state='restricted' where work_id=%s",(pw,),'work moderation')
 # The existing seal_current_work_revision trigger independently rejects assigning
 # a revision from another Work; Source153's own concept_revision guard is tested next.
 mutation("update private.dreamsnap_x05_work_control_v1 set frozen_photo_revision_id=%s where work_id=%s",(orv,pw),'cross-work revision')
 mutation("update private.dreamsnap_x05_work_control_v1 set frozen_media_id=%s where work_id=%s",(om,pw),'same owner other work media')
 mutation("update public.media_assets set moderation_state='restricted' where media_id=%s",(pm,),'media moderation')
 # The existing DreamSnap eligible-photo CHECK prevents a contradictory attestation
 # combination before it reaches the projection. Per-Work provenance is tested above.
 # PostEvent's persisted STAGED unknown-authority invariants are verified above.
 # Real official phase/Provider evidence remains outside isolated QR scope.
 # Synthetic incident-predicate rollback DOES NOT represent actual Provider incident.
 with A.transaction():
  try:
   with A.transaction():
    A.execute("""create or replace function private.preset_storage_media_quarantined_r19(p_media_id uuid)
      returns boolean language sql stable security definer set search_path=pg_catalog as $$
      select p_media_id='%s'::uuid $$"""%pm)
    denied(authority(A,sub,pw),'local predicate-only incident')
    raise RuntimeError('rollback_incident')
  except RuntimeError:pass
 emit('QR43_INDEPENDENT_PRIVACY_IDENTITY_CREATOR_REVISION_MEDIA_INCIDENT_PREDICATE_PASS')
 # A real local retention hold asserts only local control, not Provider/CDN.
 with A.transaction():
  try:
   with A.transaction():
    A.execute("""insert into private.account_retention_holds(account_id,hold_type,reason,created_by_account_id)
      values(%s,'legal','QR43 SYNTHETIC LOCAL HOLD',%s)""",(acct,acct))
    hold=success(authority(A,sub,pw),'local hold')['deletion']
    assert hold['activeAccountLegalHold'] is True
    assert hold['globalPurgeScopeComplete'] is False
    assert hold['cloudCdnIssuedBearerStatus']=='UNKNOWN'
    raise RuntimeError('rollback_hold')
  except RuntimeError:pass
 emit('QR43_LOCAL_HOLD_IS_NOT_GLOBAL_PROVIDER_CDN_PROOF_PASS')
 # Attempt to activate a Policy with a false-hash "receipt": prior Source151
 # activation guard MUST reject it before Source153 can ever claim a scope.
 with A.transaction():
  try:
   with A.transaction():
    A.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(policy_version,canonical_text,approval_reference,approved_at)
      values('v1',%s,'QR43 WRONG DIGEST - NOT APPROVED',now())""",(policy+' mismatched',))
    try:
     with A.transaction():
      A.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
    except psycopg.Error as ex:
     assert 'X05_POLICY_ARTIFACT_REQUIRED_OR_DIGEST_MISMATCH' in str(ex),str(ex)
    else:raise AssertionError('INVALID_POLICY_ACTIVATION_UNEXPECTEDLY_ACCEPTED')
    bad=success(authority(A,sub,pw),'inactive mismatched receipt')
    assert bad['grant']['scopeStatus']=='UNVERIFIED'
    assert bad['grant']['policyReceiptVerified'] is False
    assert 'scopeId' not in bad['grant'] and 'approvedPurposeIds' not in bad['grant']
    raise RuntimeError('rollback_fake_receipt')
  except RuntimeError as ex:assert str(ex)=='rollback_fake_receipt'
 assert scalar(A,'select count(*) from private.dreamsnap_x05_policy_receipt_v1')==0
 assert scalar(A,"select is_active from private.dreamsnap_x05_owner_policy_v1 where policy_version='v1'") is False
 emit('QR43_ACTIVE_BUT_INCORRECT_POLICY_RECEIPT_NO_SCOPE_PASS')
 # Withdraw: CAS and last GRANT consentRevision are distinct from current control version.
 with A.transaction():
  A.execute("update private.dreamsnap_x05_work_control_v1 set row_version=2,authorization_epoch=2,control_state='withdrawn',withdrawn_at=now() where work_id=%s",(pw,))
  A.execute("""insert into private.dreamsnap_x05_consent_events_v1(work_id,event_version,action,account_id,policy_version,policy_digest)
    values(%s,2,'withdraw',%s,'v1',%s)""",(pw,acct,digest))
 denied(authority(B,sub,pw,1,1),'stale from last grant')
 post=success(authority(B,sub,pw,2,2),'post-withdraw')
 bounded(post,entry=False)
 assert post['authority']['rowVersion']==2 and post['authority']['authorizationEpoch']==2
 assert post['authority']['controlState']=='withdrawn'
 assert post['grant']['lastGrantConsentRevision']==1 and post['grant']['state']=='withdrawn'
 assert post['deletion']['localState']=='PUBLIC_DISABLED' and post['deletion']['publicDisabled'] is True
 assert post['deletion']['globalPurgeScopeComplete'] is False
 assert scalar(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action='grant'",(pw,))==1
 assert scalar(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action='withdraw'",(pw,))==1
 emit('QR43_SOURCE149_CAS_2_2_LAST_GRANT_1_LOCAL_DELETION_SEPARATE_PASS')
 emit('QR43_INDEPENDENT_FULL153_SOURCE153_ONLY_DONE',backendPids=pids,migrations=153,
     signedJWT=False,providerObjectVerified=False,policyApproved=False)
