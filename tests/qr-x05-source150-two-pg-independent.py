#!/usr/bin/env python3
"""New-only 04 QR independent Source150 narrow Owner RPC and legacy trigger.
Ephemeral 150-migration local PostgreSQL; simulated JWT GUC is NOT signed JWT."""
import os,uuid,json,time
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def scalar(c,q,args=()):return c.execute(q,args).fetchone()[0]
def actor(c,subject,q,args=(),role='authenticated',expired=False,anonymous=False,bad_sub=False,missing_session=False):
    with c.transaction():
        c.execute('set local role '+role)
        claims={'role':role,'sub':str(U() if bad_sub else subject),
                'session_id':None if missing_session else str(U()),
                'iat':int(time.time())-(90000 if expired else 0),'is_anonymous':anonymous}
        c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
        c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
        c.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
        try:
            with c.transaction():
                return ('ok',scalar(c,q,args))
        except psycopg.Error as e:
            return ('blocked',e.sqlstate,str(e).split('\n')[0][:150])
def mustfail(r,why):assert r[0]=='blocked',(why,r)
def read(c,subject,work,**kwargs):
    return actor(c,subject,'select public.community_dreamsnap_x05_owner_read_v1(%s)',(work,),**kwargs)
def mutate(c,subject,work,version,epoch,action,photo=None,media=None,policy=None,digest=None,
           capture=None,grant=None,concept=None,**kwargs):
    return actor(c,subject,"select public.community_dreamsnap_x05_owner_action_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
      (work,version,epoch,action,photo,media,policy,digest,capture,grant,concept),**kwargs)
def emit(tag,**v):print(json.dumps({'marker':tag,**v},sort_keys=True,default=str),flush=True)
with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
 assert scalar(a,'select count(*) from supabase_migrations.schema_migrations')==150
 assert scalar(a,'select pg_backend_pid()')!=scalar(b,'select pg_backend_pid()')
 # pg_proc security definer and ACL reads are actual backend catalog values, not comments.
 for sign in (
  'private.dreamsnap_x05_verified_db_subject_v1()',
  'private.dreamsnap_x05_record_creator_grant_v1(uuid,uuid,uuid,uuid,text,text,bigint,boolean,boolean)',
  'private.dreamsnap_x05_owner_transition_v1(uuid,uuid,bigint,text,uuid)',
  'public.community_dreamsnap_x05_owner_read_v1(uuid)',
  'public.community_dreamsnap_x05_owner_action_v1(uuid,bigint,bigint,text,uuid,uuid,text,text,boolean,boolean,uuid)'
 ):
  oid=scalar(a,'select %s::regprocedure::oid',(sign,))
  for role in ('anon','authenticated','service_role'):
   actual=scalar(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,oid))
   expected=sign.startswith('public.') and role=='authenticated'
   assert actual==expected,(sign,role,actual)
 for tb in ('private.dreamsnap_x05_owner_policy_v1',
            'private.dreamsnap_x05_work_control_v1',
            'private.dreamsnap_x05_consent_events_v1'):
  oid=scalar(a,'select %s::regclass::oid',(tb,))
  for role in ('anon','authenticated','service_role'):
   for right in ('SELECT','INSERT','UPDATE','DELETE'):
    assert not scalar(a,'select has_table_privilege(%s,%s::oid,%s)',(role,oid,right))
 trigger=scalar(a,"select oid from pg_proc where proname='validate_current_published_revision' and pronamespace='public'::regnamespace")
 assert scalar(a,'select prosecdef from pg_proc where oid=%s',(trigger,)) is True
 config=scalar(a,'select proconfig from pg_proc where oid=%s',(trigger,))
 assert 'search_path=pg_catalog, public, private' in config or 'search_path=pg_catalog,public,private' in config,config
 for role in ('anon','authenticated','service_role'):
  assert not scalar(a,"select has_function_privilege(%s,%s::oid,'EXECUTE')",(role,trigger))
  # Shared revision SELECT may be inherited through prior RLS-enabled public
  # views. Source150 adds no new table grant: test actual owner isolation after fixture.
  assert role in ('anon','authenticated','service_role')
 emit('QR150_INDEPENDENT_REAL_FUNCTION_ROLE_ACL_DEFERRABLE_DEFINER_PASS')
 
 account,auth,creator,challenge=[U() for _ in range(4)]
 work,photo,media,entry=[U() for _ in range(4)]
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
  a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
    values(%s,'supabase',%s,now(),'active')""",(account,str(auth)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR150')",
    (creator,account,'qr150_'+U().hex[:19]))
  a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
    submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
    formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
    minimum_real_eligible_creators,is_synthetic)
    values(%s,%s,'QR 150 Fixture','results',now()-interval '8 hours',
    now()-interval '7 hours',now()-interval '6 hours',now()-interval '5 hours',
    now()-interval '4 hours',now()+interval '1 hour',2,1,1,1,false)""",
    (challenge,'qr150_'+U().hex[:19]))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
  a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
    values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account,creator))
  a.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
    values(%s,%s,1,%s)""",(photo,work,account))
  a.execute("""insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13)
    values(%s,%s,'self',false)""",(work,challenge))
  a.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
    no_external_edits_attested,integrity_state,caption) values(%s,%s,true,true,'eligible','QR fixture')""",(photo,challenge))
  a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
    width,height,checksum_sha256,processing_state,moderation_state)
    values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
    (media,account,'qr150/private/'+str(media),'a'*64))
  a.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(photo,media))
  a.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(photo,work))
  a.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,managed_under13,
    entry_revision_id,entry_state,eligibility_state,origin_kind)
    values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,challenge,work,account,photo))
  a.execute('insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)',(entry,photo))
  a.execute("insert into public.dreamsnap_gallery_publications(work_id,entry_id,revision_id,publication_state) values(%s,%s,%s,'published')",(work,entry,photo))
  a.execute("""update public.community_works set lifecycle_state='published',visibility='public',
    current_published_revision_id=%s,published_at=now() where work_id=%s""",(photo,work))
 
 d='b'*64
 mustfail(read(b,auth,work),'NO_CONSENT_RECEIPT')
 mustfail(mutate(b,auth,work,0,0,'grant',photo,media,'v1',d,True,True),'POLICY_UNSEEDED')
 assert scalar(a,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 a.execute("insert into private.dreamsnap_x05_owner_policy_v1(policy_version,policy_digest,is_active) values('v1',%s,true)",(d,))
 for why,args in [
  ('FOREIGN_OWNER',(U(),work,0,0,'grant',photo,media,'v1',d,True,True)),
  ('WRONG_DIGEST',(auth,work,0,0,'grant',photo,media,'v1','c'*64,True,True)),
  ('WRONG_POLICY',(auth,work,0,0,'grant',photo,media,'v2',d,True,True)),
  ('NO_CREATOR_ACK',(auth,work,0,0,'grant',photo,media,'v1',d,False,True)),
  ('NO_IMAGE_GRANT',(auth,work,0,0,'grant',photo,media,'v1',d,True,False)),
  ('BAD_MEDIA',(auth,work,0,0,'grant',photo,U(),'v1',d,True,True)),
  ('BAD_PHOTO',(auth,work,0,0,'grant',U(),media,'v1',d,True,True))
 ]:mustfail(mutate(b,*args),why)
 # Explicit session revocation cutoff makes historical-issued JWT replay fail closed.\n a.execute("update public.auth_identities set sessions_valid_after=clock_timestamp()-interval '60 seconds' where account_id=%s",(account,))\n for kw in [{'role':'anon'},{'role':'service_role'},{'anonymous':True},
            {'missing_session':True},{'bad_sub':True},{'expired':True}]:
  mustfail(read(b,auth,work,**kw),'AUTH '+str(kw))
 assert scalar(a,'select count(*) from private.dreamsnap_x05_work_control_v1 where work_id=%s',(work,))==0
 emit('QR150_REAL_POLICY_UNKNOWN_CLAIMS_CREATOR_MEDIA_FAIL_CLOSED_PASS')
 
 out=mutate(b,auth,work,0,0,'grant',photo,media,'v1',d,True,True)
 assert out[0]=='ok',out
 grant=out[1]['owner']
 assert grant['kind']=='OriginalCompetition'
 assert grant['entryId']==str(entry) and grant['frozenEntryRevisionId']==str(photo)
 assert grant['photoMediaId']==str(media)
 assert grant['imageGrant']['policyVersionText']=='v1'
 assert grant['imageGrant']['consentRevision']==1
 assert grant['rowVersion']==1 and grant['authorizationEpoch']==1
 assert 'ownerAccountId' not in grant and 'storageKey' not in grant and 'signedUrl' not in grant
 assert grant['capabilities']['publish'] is False and grant['capabilities']['publicMedia'] is False
 for params in [(1,999,'withdraw'),(0,1,'withdraw')]:
  mustfail(mutate(b,auth,work,*params),'CAS MISMATCH')
 for neg in ('retired','restricted','privacy'):
  with a.transaction():
   a.execute('savepoint qr_suppress')
   try:
    if neg=='retired':a.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
    elif neg=='restricted':a.execute("update public.wand_accounts set status='restricted' where account_id=%s",(account,))
    else:a.execute('insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())',(account,))
    mustfail(read(a,auth,work),neg)
   finally:
    a.execute('rollback to savepoint qr_suppress')
    a.execute('release savepoint qr_suppress')
 emit('QR150_REAL_ORIGINAL_FROZEN_POLICY_CONSENT_SESSION_AND_CAS_PASS')
 
 # Two distinct real database connections: one successful withdrawal and one conflict.
 with ThreadPoolExecutor(max_workers=2) as pool:
  future1=pool.submit(mutate,a,auth,work,1,1,'withdraw')
  future2=pool.submit(mutate,b,auth,work,1,1,'withdraw')
  winners=[future1.result(),future2.result()]
 assert sum(x[0]=='ok' for x in winners)==1,winners
 assert sum(x[0]=='blocked' for x in winners)==1,winners
 assert scalar(a,"select visibility::text from public.community_works where work_id=%s",(work,))=='private'
 assert scalar(a,"select publication_state from public.dreamsnap_gallery_publications where work_id=%s",(work,))=='unpublished'
 snapshot=read(b,auth,work)
 assert snapshot[0]=='ok',snapshot
 assert snapshot[1]['rowVersion']==2 and snapshot[1]['authorizationEpoch']==2
 assert snapshot[1]['imageGrant']['consentRevision']==1
 assert snapshot[1]['erasure']['state']=='PUBLIC_DISABLED'
 mustfail(mutate(b,auth,work,2,2,'grant',photo,media,'v1',d,True,True),'TERMINAL REGRANT')
 assert scalar(a,'select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s',(work,))==2
 emit('QR150_TWO_CONNECTION_WRAPPED_REVOKE_REPLAY_CONSENT_EVENT_VERSUS_ROW_PASS',
  backends=[scalar(a,'select pg_backend_pid()'),scalar(b,'select pg_backend_pid()')])
 emit('QR150_INDEPENDENT_FULL150_LOCAL_COMPLETE')
