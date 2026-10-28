#!/usr/bin/env python3
"""CTRL39 QR Source152 independent new-only ephemeral full152 / two PG sessions.
Synthetic claims and pre-registered READY media; no signed JWT or provider upload."""
import os,time,uuid,json
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.environ.get('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.environ.get('DATABASE_URL') and not os.environ.get('SUPABASE_ACCESS_TOKEN')
DB='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def val(c,q,p=()):return c.execute(q,p).fetchone()[0]
def note(s,**kw):print(json.dumps(dict(marker=s,**kw),default=str,sort_keys=True),flush=True)
def invoke(c,subject,kind,ch,media,key,opt=False,caption='Independent local image',role='authenticated',anonymous=False,old=False):
 with c.transaction():
  c.execute('set local role '+role)
  claims={'role':role,'sub':str(subject),'session_id':str(U()),
          'iat':int(time.time())-(90000 if old else 0),'is_anonymous':anonymous}
  c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
  c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(subject),))
  c.execute("select set_config('request.jwt.claim.role',%s,true)",(role,))
  try:
   with c.transaction():
    data=val(c,'select public.community_dreamsnap_x05_register_initial_work_v1(%s,%s,%s,%s,%s,%s)',
       (kind,ch,media,caption,key,opt))
   return ('ok',data)
  except psycopg.Error as e:return ('blocked',e.sqlstate,str(e).split('\n')[0][:150])
def deny(x,label):assert x[0]=='blocked',(label,x)
def blocked_sql(c,q,p=()):
 try:
  with c.transaction():c.execute(q,p)
 except psycopg.Error:return True
 return False
with psycopg.connect(DB,autocommit=True) as a,psycopg.connect(DB,autocommit=True) as b:
 assert val(a,'select count(*) from supabase_migrations.schema_migrations')==152
 assert val(a,'select pg_backend_pid()')!=val(b,'select pg_backend_pid()')
 sig='public.community_dreamsnap_x05_register_initial_work_v1(text,uuid,uuid,text,text,boolean)'
 for role in ('anon','authenticated','service_role'):
  allowed=val(a,"select has_function_privilege(%s,%s::regprocedure,'EXECUTE')",(role,sig))
  assert allowed==(role=='authenticated'),(role,allowed)
 assert val(a,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 assert val(a,'select count(*) from private.dreamsnap_x05_policy_receipt_v1')==0
 subject,account,creator,challenge_original,challenge_post=[U() for _ in range(5)]
 media_original,media_post,media_other=[U() for _ in range(3)]
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
  a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR152 independent')",(creator,account,'qr152_'+U().hex[:16]))
  for ch,phase,opens,closes in [
   (challenge_original,'submission_open','-2 hours','+1 day'),
   (challenge_post,'results','-8 days','+2 days')]:
   def interval(v):return ('now()'+("+" if v.startswith("+") else "-")+"interval '"+v[1:]+"'")
   # set each phase synthetic but is_synthetic false to exercise DB-only branch.
   a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
       submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
       formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
       values(%s,%s,'QR152 synthetic',%s,
       now()-interval '10 days',now()-interval '9 days',now()-interval '8 days',
       now()-interval '7 days',now()-interval '6 days',now()+interval '10 days',2,1,1,1,false)""",
      (ch,'qr152_'+U().hex[:16],phase))
  for media in [media_original,media_post,media_other]:
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
   a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
      width,height,checksum_sha256,processing_state,moderation_state)
      values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
     (media,account,'qr152-disposable/'+str(media),'a'*64))
 def count(q,p=()):return val(a,q,p)
 deny(invoke(b,U(),'PostEventCreation',challenge_post,media_post,'qr152-foreign-user-001'),'foreign')
 deny(invoke(b,subject,'PostEventCreation',challenge_post,media_post,'qr152-anon-role-001',role='anon'),'anonymous role')
 deny(invoke(b,subject,'PostEventCreation',challenge_post,media_post,'qr152-svc-role-001',role='service_role'),'service role')
 deny(invoke(b,subject,'PostEventCreation',challenge_post,media_post,'qr152-anon-claim-001',anonymous=True),'anonymous claim')
 deny(invoke(b,subject,'OriginalCompetition',challenge_original,media_original,'qr152-no-optin-001'),'no explicit wand entry')
 deny(invoke(b,subject,'OriginalCompetition',challenge_post,media_original,'qr152-wrong-phase-001',True),'original phase')
 deny(invoke(b,subject,'PostEventCreation',challenge_original,media_post,'qr152-wrong-post-001'),'postevent phase')
 deny(invoke(b,subject,'PostEventCreation',challenge_post,U(),'qr152-wrong-media-001'),'unowned media')
 deny(invoke(b,subject,'PostEventCreation',challenge_post,media_post,'short'),'short idempotency')
 for typ in ['privacy','moderation','not_ready','retired','session']:
  with a.transaction():
   a.execute('savepoint qn')
   try:
    if typ=='privacy':
     a.execute('insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())',(account,))
    elif typ=='moderation':
     a.execute("update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,))
    elif typ=='not_ready':
     a.execute("update public.media_assets set processing_state='quarantined' where media_id=%s",(media_post,))
    elif typ=='retired':
     a.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account,))
    else:
     a.execute("update public.auth_identities set sessions_valid_after=clock_timestamp()-interval '1 hour' where account_id=%s",(account,))
    deny(invoke(a,subject,'PostEventCreation',challenge_post,media_post,'qr152-fail-state-001',old=typ=='session'),typ)
   finally:
    a.execute('rollback to savepoint qn')
    a.execute('release savepoint qn')
 note('QR152_ROLE_PRIVACY_CREATOR_MEDIA_SESSION_NEGATIVES_PASS')
 # True independent PG sessions race the same owned media and challenge with different keys.
 with ThreadPoolExecutor(max_workers=2) as ex:
  f1=ex.submit(invoke,a,subject,'PostEventCreation',challenge_post,media_post,'qr152-race-alpha-001')
  f2=ex.submit(invoke,b,subject,'PostEventCreation',challenge_post,media_post,'qr152-race-bravo-001')
  attempts=[f1.result(),f2.result()]
 assert sum(t[0]=='ok' for t in attempts)==1,attempts
 assert sum(t[0]=='blocked' for t in attempts)==1,attempts
 post=next(t[1] for t in attempts if t[0]=='ok')
 work=post['workId']
 assert post['kind']=='PostEventCreation' and 'entryId' not in post
 assert post['publicActivationAllowed'] is False
 assert post['officialChallengePhaseVerified'] is False
 assert post['storageValidatedBySource152'] is False
 assert count("select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s",(work,))==1
 assert count("select count(*) from public.dreamsnap_entries where work_id=%s",(work,))==0
 assert count("select visibility::text from public.community_works where work_id=%s",(work,))=='private'
 assert count("select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(work,))==0
 deny(invoke(b,subject,'PostEventCreation',challenge_post,media_post,'qr152-different-duplicate-001'),'duplicate media different key')
 # Replay using exact original-winning idempotency key must return exact committed result.
 winner_key='qr152-race-alpha-001' if attempts[0][0]=='ok' else 'qr152-race-bravo-001'
 again=invoke(b,subject,'PostEventCreation',challenge_post,media_post,winner_key)
 assert again==('ok',post),(again,post)
 deny(invoke(b,subject,'PostEventCreation',challenge_post,media_other,winner_key),'key reused with changed media')
 before=count("select count(*) from public.community_works where owner_account_id=%s and work_type='dreamsnap'",(account,))
 original=invoke(b,subject,'OriginalCompetition',challenge_original,media_original,'qr152-original-entry-001',True)
 assert original[0]=='ok',original
 o=original[1];ow=o['workId']
 assert o['kind']=='OriginalCompetition' and o['publicActivationAllowed'] is False and o['entryId']
 assert count('select count(*) from public.dreamsnap_entries where work_id=%s',(ow,))==1
 assert count('select entry_revision_id from public.dreamsnap_entries where work_id=%s',(ow,))==uuid.UUID(o['photoRevisionId'])
 assert count('select visibility::text from public.community_works where work_id=%s',(ow,))=='private'
 assert count('select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s',(ow,))==0
 assert count("select count(*) from public.community_works where owner_account_id=%s and work_type='dreamsnap'",(account,))==before+1
 note('QR152_TWO_PG_ATOMIC_ORIGINAL_POSTEVENT_RACE_IDEMPOTENCY_ROLLBACK_PASS',pids=[val(a,'select pg_backend_pid()'),val(b,'select pg_backend_pid()')])
 note('QR152_INDEPENDENT_FULL152_LOCAL_COMPLETE',migrations=152,verifiedUpload=False,approvedPolicy=False,signedJWT=False)
