#!/usr/bin/env python3
"""QR CTRL40 independent targeted Source152 post-TRUE-RED reacceptance.
Disposable FULL152, two separate genuine PostgreSQL connections. No prior QR260 runner.
JWT GUC, READY Media and challenge are synthetic; no real issuer/upload/Policy approval.
"""
import os,uuid,time,json
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED'
assert not os.getenv('DATABASE_URL') and not os.getenv('SUPABASE_ACCESS_TOKEN')
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
U=uuid.uuid4
def get(c,sql,params=()):return c.execute(sql,params).fetchone()[0]
def marker(key,**data):print(json.dumps({'marker':key,**data},default=str,sort_keys=True),flush=True)
def register(c,sub,kind,challenge,media,key,entry=False,caption='Independent normalized work'):
 with c.transaction():
  c.execute('set local role authenticated')
  claims={'role':'authenticated','sub':str(sub),'session_id':str(U()),'iat':int(time.time()),'is_anonymous':False}
  c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps(claims),))
  c.execute("select set_config('request.jwt.claim.sub',%s,true)",(str(sub),))
  c.execute("select set_config('request.jwt.claim.role',%s,true)",('authenticated',))
  try:
   with c.transaction():
    result=get(c,'select public.community_dreamsnap_x05_register_initial_work_v1(%s,%s,%s,%s,%s,%s)',
               (kind,challenge,media,caption,key,entry))
   return 'ok',result
  except psycopg.Error as e:return 'denied',e.sqlstate,str(e).split('\n')[0][:130]
def check_persisted(c,account,key,expected):
 stored=get(c,'select response from public.idempotency_keys where account_id=%s and idempotency_key=%s',
            (account,'x05:'+key))
 assert stored==expected,('PERSISTED_RESPONSE_MISMATCH',stored,expected)
 return stored
def denied(value,scenario):assert value[0]=='denied',(scenario,value)
with psycopg.connect(DSN,autocommit=True) as a, psycopg.connect(DSN,autocommit=True) as b:
 assert get(a,'select count(*) from supabase_migrations.schema_migrations')==152
 assert get(a,'select pg_backend_pid()')!=get(b,'select pg_backend_pid()')
 assert get(a,'select count(*) from private.dreamsnap_x05_owner_policy_v1')==0
 assert get(a,'select count(*) from private.dreamsnap_x05_policy_receipt_v1')==0
 account,sub,creator,original_challenge,post_challenge=[U() for _ in range(5)]
 original_media,post_media,rollback_media=[U() for _ in range(3)]
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(account,))
  a.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(sub)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'QR40 local')",(creator,account,'qr40_'+U().hex[:20]))
  for challenge,phase,start,end in [
    (original_challenge,'submission_open','-2 hours','+1 day'),
    (post_challenge,'results','-8 days','+2 days')]:
   a.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
     submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
     formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,minimum_real_eligible_creators,is_synthetic)
     values(%s,%s,'QR40 local',%s,
     case when %s='submission_open' then now()-interval '2 hours' else now()-interval '8 days' end,
     case when %s='submission_open' then now()+interval '1 day' else now()-interval '7 days' end,
     case when %s='submission_open' then now()+interval '2 days' else now()-interval '6 days' end,
     case when %s='submission_open' then now()+interval '3 days' else now()-interval '5 days' end,
     case when %s='submission_open' then now()+interval '4 days' else now()-interval '4 days' end,
     case when %s='submission_open' then now()+interval '5 days' else now()+interval '2 days' end,
     2,1,1,1,false)""",(challenge,'qr40_'+U().hex[:20],phase,phase,phase,phase,phase,phase,phase))
  for media in (original_media,post_media,rollback_media):
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
   a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,
     width,height,checksum_sha256,processing_state,moderation_state)
     values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
     (media,account,'qr40-no-real-upload/'+str(media),'a'*64))
 # Repeat the old independent TRUE RED scenario directly, checking persisted DB JSONB too.
 post_key='qr40-post-replay-001'
 first=register(a,sub,'PostEventCreation',post_challenge,post_media,post_key)
 assert first[0]=='ok',first
 initial=first[1]
 assert 'entryId' not in initial,initial
 check_persisted(b,account,post_key,initial)
 replay=register(b,sub,'PostEventCreation',post_challenge,post_media,post_key)
 assert replay==first,('PREVIOUS_QR260_TRUE_RED_REPRODUCED',first,replay)
 assert 'entryId' not in replay[1]
 check_persisted(a,account,post_key,replay[1])
 work=initial['workId']
 assert get(a,'select count(*) from private.dreamsnap_post_event_staged_v1 where work_id=%s',(work,))==1
 assert get(a,'select count(*) from public.dreamsnap_entries where work_id=%s',(work,))==0
 assert get(a,'select visibility::text from public.community_works where work_id=%s',(work,))=='private'
 assert initial['publicActivationAllowed'] is False and initial['officialChallengePhaseVerified'] is False
 assert initial['storageValidatedBySource152'] is False and initial['requiresPolicyGrant'] is True
 marker('QR_CTRL40_POSTEVENT_FIRST_REPLAY_PERSISTED_JSON_IDENTICAL_ENTRY_ABSENT_PASS',
       workId=work,keys=sorted(initial))
 # Same key, altered payload: reject without additional Work or mutated persisted receipt.
 denied(register(b,sub,'PostEventCreation',post_challenge,post_media,post_key,caption='Changed payload'),'same-key changed payload')
 assert check_persisted(a,account,post_key,initial)==initial
 denied(register(b,sub,'PostEventCreation',post_challenge,post_media,'qr40-post-otherkey-001'),'different-key same Media')
 assert get(a,'select count(*) from public.community_work_revisions where work_id=%s',(work,))==1
 # Explicit Original competition entry must still exist and survive replay and DB persistence.
 original_key='qr40-origin-replay-001'
 ofirst=register(b,sub,'OriginalCompetition',original_challenge,original_media,original_key,True)
 assert ofirst[0]=='ok',ofirst
 original=ofirst[1]
 assert original['entryId'] and uuid.UUID(original['entryId'])
 assert original['kind']=='OriginalCompetition'
 assert original['publicActivationAllowed'] is False
 assert get(a,'select count(*) from public.dreamsnap_entries where work_id=%s',(original['workId'],))==1
 assert get(a,'select entry_revision_id from public.dreamsnap_entries where work_id=%s',(original['workId'],))==uuid.UUID(original['photoRevisionId'])
 assert get(a,'select visibility::text from public.community_works where work_id=%s',(original['workId'],))=='private'
 check_persisted(a,account,original_key,original)
 assert register(a,sub,'OriginalCompetition',original_challenge,original_media,original_key,True)==ofirst
 check_persisted(b,account,original_key,original)
 denied(register(a,sub,'OriginalCompetition',original_challenge,original_media,original_key,True,caption='different'),'original mutated payload')
 marker('QR_CTRL40_ORIGINAL_FROZEN_ENTRY_REPLAY_AND_PERSISTED_JSON_PASS')
 # Independent 2 real PostgreSQL backends racing different idempotency keys for a third Media.
 # A failed request must leave no Work or idem key.
 prior_count=get(a,"select count(*) from public.community_works where owner_account_id=%s and work_type='dreamsnap'",(account,))
 with ThreadPoolExecutor(max_workers=2) as pool:
  fa=pool.submit(register,a,sub,'PostEventCreation',post_challenge,rollback_media,'qr40-race-alpha-001')
  fb=pool.submit(register,b,sub,'PostEventCreation',post_challenge,rollback_media,'qr40-race-bravo-001')
  race=[fa.result(),fb.result()]
 assert sum(item[0]=='ok' for item in race)==1,race
 assert sum(item[0]=='denied' for item in race)==1,race
 winner=race[0] if race[0][0]=='ok' else race[1]
 winner_key='qr40-race-alpha-001' if race[0][0]=='ok' else 'qr40-race-bravo-001'
 assert 'entryId' not in winner[1]
 assert register(b,sub,'PostEventCreation',post_challenge,rollback_media,winner_key)==winner
 check_persisted(a,account,winner_key,winner[1])
 assert get(a,"select count(*) from public.community_works where owner_account_id=%s and work_type='dreamsnap'",(account,))==prior_count+1
 assert get(a,'select count(*) from public.dreamsnap_entries where work_id=%s',(winner[1]['workId'],))==0
 assert get(a,'select visibility::text from public.community_works where work_id=%s',(winner[1]['workId'],))=='private'
 assert get(a,'select count(*) from public.idempotency_keys where account_id=%s and idempotency_key in (%s,%s)',
       (account,'x05:qr40-race-alpha-001','x05:qr40-race-bravo-001'))==1
 assert get(a,'select count(*) from private.dreamsnap_x05_consent_events_v1')==0
 marker('QR_CTRL40_TWO_PG_DUPLICATE_RACE_ATOMICITY_REPLAY_NO_CONSENT_PASS',
        pids=[get(a,'select pg_backend_pid()'),get(b,'select pg_backend_pid()')])
 marker('QR_CTRL40_INDEPENDENT_POST_TRUE_RED_FULL152_COMPLETE',
        migrations=152,signedJWT=False,approvedPolicy=False,realMediaUpload=False)
