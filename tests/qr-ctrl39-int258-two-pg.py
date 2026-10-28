#!/usr/bin/env python3
"""Independent CTRL39 INT258: actual isolated FULL151 SQL -> Source150 owner envelope -> WEB252 typed adapter.
All fixtures are synthetic and do NOT certify real policy, signed JWT or media."""
import json,os,time,uuid,hashlib
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def one(c,q,p=()):return c.execute(q,p).fetchone()[0]
def token(c,subject,sql,p=()):
 with c.transaction():
  c.execute('set local role authenticated')
  claims={'role':'authenticated','sub':str(subject),'session_id':str(U()),'iat':int(time.time()),'is_anonymous':False}
  for setting,value in [('request.jwt.claims',json.dumps(claims)),('request.jwt.claim.sub',str(subject)),
                        ('request.jwt.claim.role','authenticated')]:
   c.execute('select set_config(%s,%s,true)',(setting,value))
  try:
   with c.transaction():
    return ('ok',one(c,sql,p))
  except psycopg.Error as e:return ('denied',e.sqlstate,str(e).split('\n')[0][:140])
with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
 assert one(a,'select count(*) from supabase_migrations.schema_migrations')==151
 assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
 assert one(a,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 account,subject,creator,challenge,work,rev,media=[U() for _ in range(7)]
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
  a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'INT258 independent')",(creator,account,'qr258_'+U().hex[:15]))
  a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
    formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'INT258 local','results',now()-interval '8 days',now()-interval '7 days',
     now()-interval '6 days',now()-interval '5 days',now()-interval '4 days',now()+interval '2 days',2,1,1,1,false)""",
    (challenge,'qr258_'+U().hex[:15]))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
  a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
    values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
  a.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(rev,work,account))
  a.execute("insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13) values(%s,%s,'self',false)",(work,challenge))
  a.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
    no_external_edits_attested,integrity_state,caption) values(%s,%s,true,true,'eligible','synthetic')""",(rev,challenge))
  a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
    width,height,checksum_sha256,processing_state,moderation_state)
    values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
    (media,account,'int258-local/'+str(media),'a'*64))
  a.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev,media))
  a.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(rev,work))
  a.execute("""insert into private.dreamsnap_post_event_staged_v1(
    work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
    values(%s,%s,%s,%s,%s,%s)""",(work,challenge,creator,rev,media,rev))
 pre=token(b,subject,'select public.community_dreamsnap_x05_pregrant_read_v1(%s)',(work,))
 assert pre[0]=='ok' and pre[1]['state']=='NEED_POLICY_ARTIFACT' and pre[1]['grantAvailable'] is False,pre
 assert pre[1]['expectedRowVersion']==0 and pre[1]['expectedAuthorizationEpoch']==0
 assert 'policyReceipt' not in pre[1] and pre[1]['publicActivationAllowed'] is False
 # Synthetic grant is only to exercise real PostgreSQL projection, not an approved Owner policy.
 text='SYNTHETIC 04 QR INT258 local-only image policy never Owner-approved or publicly licensable.'
 version='v704'
 digest=hashlib.sha256(text.encode('utf8')).hexdigest()
 a.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values(%s,%s,false)",(version,digest))
 a.execute("""insert into private.dreamsnap_x05_policy_receipt_v1(policy_version,canonical_text,approval_reference,approved_at)
 values(%s,%s,%s,now()-interval '1 hour')""",(version,text,'LOCAL_SYNTHETIC_POLICY_NOT_OWNER_APPROVED'))
 a.execute('update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version=%s',(version,))
 pre2=token(b,subject,'select public.community_dreamsnap_x05_pregrant_read_v1(%s)',(work,))
 assert pre2[0]=='ok' and pre2[1]['state']=='PREGRANT_READY',pre2
 grant=token(b,subject,"select public.community_dreamsnap_x05_owner_action_v1(%s,0,0,'grant',%s,%s,%s,%s,true,true,null)",
   (work,rev,media,version,digest))
 assert grant[0]=='ok',grant
 assert one(a,'select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s',(work,))==1
 own=token(b,subject,'select public.community_dreamsnap_x05_owner_read_v1(%s)',(work,))
 assert own[0]=='ok' and own[1]['rowVersion']==1 and own[1]['imageGrant']['consentRevision']==1,own
 outbox_before=one(a,'select count(*) from public.outbox_events where aggregate_id=%s',(work,))
 withdrawn=token(b,subject,"select public.community_dreamsnap_x05_owner_action_v1(%s,1,1,'withdraw',null,null,null,null,null,null,null)",(work,))
 assert withdrawn[0]=='ok' and withdrawn[1]['publicActivationAllowed'] is False,withdrawn
 after=token(b,subject,'select public.community_dreamsnap_x05_owner_read_v1(%s)',(work,))
 assert after[0]=='ok',after
 data=after[1]
 assert data['rowVersion']==2 and data['authorizationEpoch']==2
 assert data['imageGrant']['consentRevision']==1 and data['imageGrant']['state']=='withdrawn'
 assert data['erasure']['state']=='PUBLIC_DISABLED'
 assert one(a,'select visibility::text from public.community_works where work_id=%s',(work,))=='private'
 assert one(a,'select count(*) from public.outbox_events where aggregate_id=%s',(work,))==outbox_before+1
 assert token(b,subject,"select public.community_dreamsnap_x05_owner_action_v1(%s,1,1,'withdraw',null,null,null,null,null,null,null)",(work,))[0]=='denied'
 assert token(b,U(),'select public.community_dreamsnap_x05_owner_read_v1(%s)',(work,))[0]=='denied'
 obj={'workId':str(work),'envelope':{'ok':True,'operation':'read',
   'contractVersion':'wand.dreamsnaps.owner-management-service@1','data':data}}
 with open('/tmp/qr-ctrl39-int258-real-pg-adapter.json','w',encoding='utf8') as file:
  json.dump(obj,file)
 print(json.dumps({'marker':'QR_INT258_REAL_FULL151_PG_TO_WEB_FAILCLOSED_READY',
   'pids':[one(a,'select pg_backend_pid()'),one(b,'select pg_backend_pid()')],
   'signedJwt':False,'approvedPolicy':False,'realMedia':False}),flush=True)
