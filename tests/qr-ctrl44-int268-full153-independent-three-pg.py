#!/usr/bin/env python3
"""04 QR CTRL44 independent INT268 FULL153 cross-product acceptance.
Fresh fixture + three actual PG sessions, not INT268 Owner or historic QR tests.
Synthetic DB JWT GUC, synthetic READY rows, synthetic canonical Policy receipt only.
No Stage, signed issuer, external upload, CDN, policy approval or real deletion.
"""
import os,uuid,json,time,hashlib
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def val(c,q,args=()):return c.execute(q,args).fetchone()[0]
def log(k,**x):print(json.dumps(dict(marker=k,**x),sort_keys=True,default=str),flush=True)
def rpc(c,sub,sql,args=(),role='authenticated',no_session=False):
 with c.transaction():
  c.execute('set local role '+role)
  cl=dict(role=role,sub=str(sub),session_id=None if no_session else str(U()),iat=int(time.time()),is_anonymous=False)
  for k,v in [('request.jwt.claims',json.dumps(cl)),('request.jwt.claim.sub',str(sub)),('request.jwt.claim.role',role)]:
   c.execute('select set_config(%s,%s,true)',(k,v))
  try:
   with c.transaction():return ('ok',val(c,sql,args))
  except psycopg.Error as e:return ('denied',e.sqlstate,str(e).split('\n')[0][:180])
def ok(z,name):assert z[0]=='ok',(name,z);return z[1]
def deny(z,name):assert z[0]=='denied',(name,z)
def reg(c,s,kind,ch,media,key,entry=False,caption='QR44 independent private design'):
 return rpc(c,s,'select public.community_dreamsnap_x05_register_initial_work_v1(%s,%s,%s,%s,%s,%s)',(kind,ch,media,caption,key,entry))
def pre(c,s,w):return rpc(c,s,'select public.community_dreamsnap_x05_pregrant_read_v1(%s)',(w,))
def action(c,s,w,ver,epoch,kind,rev=None,media=None,digest=None):
 return rpc(c,s,'select public.community_dreamsnap_x05_owner_action_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
  (w,ver,epoch,kind,rev,media,'v1' if kind=='grant' else None,
   digest,True if kind=='grant' else None,True if kind=='grant' else None,None))
def read(c,s,w):return rpc(c,s,'select public.community_dreamsnap_x05_owner_read_v1(%s)',(w,))
def authority(c,s,w,ver=2,epoch=2):
 return rpc(c,s,'select public.community_dreamsnap_x05_owner_authority_v2(%s,%s,%s)',(w,ver,epoch))
with psycopg.connect(DSN,autocommit=True) as A,psycopg.connect(DSN,autocommit=True) as B,psycopg.connect(DSN,autocommit=True) as C:
 assert val(A,'select count(*) from supabase_migrations.schema_migrations')==153
 pids=[val(c,'select pg_backend_pid()') for c in (A,B,C)]
 assert len(set(pids))==3,pids
 assert val(A,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 assert val(A,'select count(*) from private.dreamsnap_x05_policy_receipt_v1')==0
 account,subject,creator,original_ch,post_ch=[U() for _ in range(5)]
 original_media,post_media=[U() for _ in range(2)]
 with A.transaction():
  A.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
  A.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
  A.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  A.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR44 local')",(creator,account,'qr44_'+U().hex[:19]))
  for ch,phase in ((original_ch,'submission_open'),(post_ch,'results')):
   A.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
     submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
     formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
     values(%s,%s,'QR44 local',%s,
     case when %s='submission_open' then now()-interval '2 hours' else now()-interval '8 days' end,
     case when %s='submission_open' then now()+interval '1 day' else now()-interval '7 days' end,
     case when %s='submission_open' then now()+interval '2 days' else now()-interval '6 days' end,
     case when %s='submission_open' then now()+interval '3 days' else now()-interval '5 days' end,
     case when %s='submission_open' then now()+interval '4 days' else now()-interval '4 days' end,
     case when %s='submission_open' then now()+interval '5 days' else now()+interval '2 days' end,2,1,1,1,false)""",
     (ch,'qr44_'+U().hex[:19],phase,phase,phase,phase,phase,phase,phase))
  for media in (original_media,post_media):
   A.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
   A.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
    values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
    (media,account,'qr44-no-real-upload/'+str(media),'a'*64))
 # Real Source152 registration of TWO separate Work/Photo/Media chains.
 records={}
 for k,kind,ch,media,entry in [
  ('original','OriginalCompetition',original_ch,original_media,True),
  ('post','PostEventCreation',post_ch,post_media,False)]:
  idem='qr44-'+k+'-independent-001'
  r=ok(reg(B,subject,kind,ch,media,idem,entry),'register '+k)
  assert r['kind']==kind and r['photoMediaId']==str(media)
  assert r['publicActivationAllowed'] is False
  assert r['officialChallengePhaseVerified'] is False
  assert r['storageValidatedBySource152'] is False
  assert ok(reg(C,subject,kind,ch,media,idem,entry),'replay '+k)==r
  assert val(A,'select response from public.idempotency_keys where account_id=%s and idempotency_key=%s',(account,'x05:'+idem))==r
  if k=='post':
   assert 'entryId' not in r
   assert val(A,'select count(*) from public.dreamsnap_entries where work_id=%s',(r['workId'],))==0
   assert val(A,'select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s',(r['workId'],))==1
  else:
   assert r['entryId']
   assert val(A,"select count(*) from public.dreamsnap_entries where work_id=%s and entry_id=%s and entry_revision_id=%s and entry_state='entered' and eligibility_state='eligible'",
    (r['workId'],r['entryId'],r['photoRevisionId']))==1
  assert val(A,'select count(*) from public.work_revision_media where work_revision_id=%s and media_id=%s',(r['photoRevisionId'],media))==1
  records[k]={'register':r}
 log('QR44_FULL153_TWO_NATIVE_WORKS_REGISTERED_REPLAY_ENTRY_AND_BINDING_PASS',pids=pids)
 # Source151 PreGrant on actual Source152-created Work; no approved policy.
 for k,row in records.items():
  r=row['register'];p=ok(pre(C,subject,r['workId']),'pregrant '+k)
  assert p['state']=='NEED_POLICY_ARTIFACT' and not p['grantAvailable']
  assert p['expectedRowVersion']==0 and p['expectedAuthorizationEpoch']==0
  assert p['photoRevisionId']==r['photoRevisionId'] and p['photoMediaId']==r['photoMediaId']
  row['pregrant']=p
 assert val(A,'select count(*) from private.dreamsnap_x05_consent_events_v1')==0
 # Synthetic policy is added to disposable local DB ONLY; zero real Owner approval.
 policy='QR44 DISPOSABLE LOCAL TEST POLICY, not Owner-approved, no rights to publish images.'
 digest=hashlib.sha256(policy.encode()).hexdigest()
 A.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,false)",(digest,))
 orig,post=[records[k]['register'] for k in ('original','post')]
 deny(action(B,subject,post['workId'],0,0,'grant',post['photoRevisionId'],post_media,digest),'unapproved grant')
 A.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(policy_version,canonical_text,approval_reference,approved_at)
  values('v1',%s,'QR44 ONLY SYNTHETIC - NOT OWNER APPROVED',now())""",(policy,))
 A.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
 # Novel integration negative: attempt authentic grant from PostEvent while using
 # *Original Work's READY Media belonging to same Account*. Must be rejected.
 deny(action(B,subject,post['workId'],0,0,'grant',post['photoRevisionId'],original_media,digest),
      'cross-Work same-owner READY Media is NOT authority')
 assert val(A,'select count(*) from private.dreamsnap_x05_consent_events_v1')==0
 # Source150 Grant and Withdraw CAS, then Source153 authority on the SAME Work.
 for k,row in records.items():
  r=row['register'];work=r['workId']
  p=ok(pre(C,subject,work),'pregrant ready '+k)
  assert p['state']=='PREGRANT_READY' and p['policyReceipt']['policyDigest']==digest
  ok(action(B,subject,work,0,0,'grant',r['photoRevisionId'],r['photoMediaId'],digest),'grant '+k)
  current=ok(read(C,subject,work),'OwnerRead '+k)
  assert (current['rowVersion'],current['authorizationEpoch'],current['imageGrant']['consentRevision'])==(1,1,1)
  assert current['photoRevisionId']==r['photoRevisionId'] and current['photoMediaId']==r['photoMediaId']
  denied=action(B,subject,work,0,0,'grant',r['photoRevisionId'],r['photoMediaId'],digest)
  deny(denied,'stale Grant '+k)
  w=ok(action(B,subject,work,1,1,'withdraw'),'Withdraw '+k)
  assert (w['owner']['rowVersion'],w['owner']['authorizationEpoch'],w['owner']['imageGrant']['consentRevision'])==(2,2,1)
  assert w['owner']['erasure']['physicalPurgeVerified'] is False
  assert w['owner']['capabilities']['publicMedia'] is False
  assert val(A,"select visibility::text from public.community_works where work_id=%s",(work,))=='private'
  assert val(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action='grant'",(work,))==1
  assert val(A,"select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s and action='withdraw'",(work,))==1
  d=ok(authority(C,subject,work),'v2 authority '+k)
  assert d['contractVersion']=='wand.dreamsnaps.owner-authority-projection@1'
  assert d['consumerTarget']=='wand.dreamsnaps.private-owner-consumer@2'
  assert d['work']['workId']==work
  assert d['work']['photoMediaId']==r['photoMediaId'] and d['work']['photoRevisionId']==r['photoRevisionId']
  assert d['grant']['mediaId']==r['photoMediaId'] and d['grant']['photoRevisionId']==r['photoRevisionId']
  assert d['authority']['rowVersion']==2 and d['authority']['authorizationEpoch']==2
  assert d['grant']['lastGrantConsentRevision']==1 and d['grant']['state']=='withdrawn'
  assert d['grant']['publicUsageAuthorized'] is False
  assert d['deletion']['globalPurgeScopeComplete'] is False
  assert d['deletion']['cloudCdnIssuedBearerStatus']=='UNKNOWN'
  assert d['externalEvidence']['signedRuntimeSessionVerified'] is False
  assert all(v is False for v in d['capabilities'].values())
  if k=='post':assert 'entryId' not in d['work'] and 'frozenEntryRevisionId' not in d['work']
  else:assert d['work']['entryId']==r['entryId'] and d['work']['frozenEntryRevisionId']==r['photoRevisionId']
  deny(authority(B,subject,work,1,1),'stale v2 CAS '+k)
  deny(authority(B,U(),work),'foreign subject '+k)
  row['owner']=w['owner'];row['authority']=d
 log('QR44_FULL153_REGISTER_PREGRANT_GRANT_READ_WITHDRAW_AUTHORITY_BOTH_KINDS_PASS')
 # Race-free independent PostgreSQL authority read and mutation fail-closed.
 for k,row in records.items():
  with ThreadPoolExecutor(max_workers=2) as pool:
   x=pool.submit(authority,B,subject,row['register']['workId'])
   y=pool.submit(authority,C,subject,row['register']['workId'])
   assert ok(x.result(),'read B')==ok(y.result(),'read C')==row['authority']
 # Malicious same-account frozen-Media substitution at Control must fail,
 # and rollback must not change subsequent good authority.
 with A.transaction():
  try:
   with A.transaction():
    A.execute('update private.dreamsnap_x05_work_control_v1 set frozen_media_id=%s where work_id=%s',(original_media,post['workId']))
    deny(authority(A,subject,post['workId']),'forged Control Media')
    raise RuntimeError('qr44_local_rollback')
  except RuntimeError:pass
 assert ok(authority(B,subject,post['workId']),'after rollback')==records['post']['authority']
 # Independent Source153 Policy-negative with SAME registered Work after Withdrawal.
 with A.transaction():
  try:
   with A.transaction():
    A.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=false where policy_version='v1'")
    for row in records.values():
     r=row['register'];d=ok(authority(A,subject,r['workId']),'inactive Policy')
     assert d['grant']['scopeStatus']=='UNVERIFIED'
     assert d['grant']['policyReceiptVerified'] is False
     assert 'scopeId' not in d['grant'] and 'approvedPurposeIds' not in d['grant']
     row['unapproved']=d
    raise RuntimeError('qr44_local_rollback')
  except RuntimeError:pass
 # Account retention HOLD is only local evidence, not Cloud/CDN purged.
 with A.transaction():
  try:
   with A.transaction():
    A.execute("""insert into private.account_retention_holds(account_id,hold_type,reason,created_by_account_id)
      values(%s,'legal','QR44 INDEPENDENT LOCAL HOLD',%s)""",(account,account))
    held=ok(authority(A,subject,post['workId']),'held authority')
    assert held['deletion']['activeAccountLegalHold'] is True
    assert held['deletion']['globalPurgeScopeComplete'] is False
    assert held['deletion']['cloudCdnIssuedBearerStatus']=='UNKNOWN'
    records['post']['hold']=held
    raise RuntimeError('qr44_local_rollback')
  except RuntimeError:pass
 log('QR44_FULL153_CROSS_WORK_MEDIA_UNAPPROVED_POLICY_LOCAL_HOLD_DENIAL_PASS')
 # Actual DB JSON emitted unchanged to standalone strict WEB267 consumer, never a generated mock.
 target='/tmp/qr44-int268-real-source153-web267.json'
 with open(target,'w',encoding='utf8') as f:json.dump({'localSyntheticOnly':True,'migrationCount':153,'pids':pids,'original':records['original'],'post':records['post']},f)
 log('QR44_FULL153_REAL_PG_TO_WEB267_BRIDGE_READY',path=target)
