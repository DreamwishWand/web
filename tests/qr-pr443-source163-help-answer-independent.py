#!/usr/bin/env python3
"""04 QR separate author independent genuine ES256 Source163 Help Answer direct writer OFF.
Only disposable FULL163 localhost GoTrue + two PostgreSQL connections, synthetic Question.
"""
import base64,json,os,secrets,subprocess,urllib.error,urllib.request,uuid
from contextlib import closing
import psycopg

assert os.getenv('DDVRE_E2_LOCAL_DISPOSABLE')=='APPROVED'
assert not any(os.getenv(k) for k in ('DATABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID'))
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
API='http://127.0.0.1:54321'
keys={}
for row in subprocess.check_output(['supabase','status','-o','env'],text=True,stderr=subprocess.DEVNULL).splitlines():
 if '=' in row:
  k,v=row.split('=',1);keys[k.strip()]=v.strip().strip("'\"")
assert keys.get('ANON_KEY') and keys.get('SERVICE_ROLE_KEY')
def http(path,payload=None,jwt=None,admin=False,method='POST'):
 key=keys['SERVICE_ROLE_KEY'] if admin else keys['ANON_KEY']
 headers={'apikey':key,'Accept':'application/json'}
 if jwt or admin:headers['Authorization']='Bearer '+(key if admin else jwt)
 if payload is not None:headers['Content-Type']='application/json'
 request=urllib.request.Request(API+path,headers=headers,method=method,data=json.dumps(payload).encode() if payload is not None else None)
 try:
  with urllib.request.urlopen(request,timeout=35) as res:return res.status,json.loads(res.read(150000) or b'null')
 except urllib.error.HTTPError as err:
  try:return err.code,json.loads(err.read(150000) or b'{}')
  except Exception:return err.code,{}
def claims(jwt,i=1):
 p=jwt.split('.')[i]
 return json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))
def one(pg,sql,args=()):return pg.execute(sql,args).fetchone()[0]
def passmark(x):print('QR163_'+x+'_PASS',flush=True)

answer_sig='public.community_add_answer_v1(uuid,uuid,uuid,text,text)'
old=[
 'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)',
 'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)',
 'public.community_create_gallery_draft(uuid,uuid,text,text,text)',
 'public.community_create_gallery_work_v1(uuid,uuid,text,text)',
 'public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)']
positive=[
 'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)',
 'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)',
 'public.community_get_ddv_profile_workspaces_v1(uuid)']
actor=None
try:
 email='qr163-'+secrets.token_hex(8)+'@example.invalid'
 password=secrets.token_urlsafe(23)+'A1!'
 c,u=http('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},admin=True)
 assert c in (200,201) and u.get('id'),'GOTRUE_SIGNED_A0_CREATE_FAILED'
 actor=uuid.UUID(u['id'])
 def login():
  status,z=http('/auth/v1/token?grant_type=password',{'email':email,'password':password})
  assert status==200 and z.get('access_token') and z.get('refresh_token')
  token=z['access_token'];hdr=claims(token,0);cl=claims(token)
  assert hdr.get('alg')=='ES256' and cl.get('sub')==str(actor) and cl.get('session_id')
  return token,z['refresh_token'],(actor,int(cl['iat']),uuid.UUID(cl['session_id']))
 a1,refresh1,session1=login();a2,_,session2=login()
 assert session1[2]!=session2[2]
 code,data=http('/functions/v1/community-command',{
   'command':'ensureAccountCreator','payload':{
   'handle':'qr163_'+secrets.token_hex(8),'displayName':'QR163 local independent'}},jwt=a1)
 assert code==200 and data.get('ok'),('SIGNED_A0_FAILED',code,data.get('error'))
 account=uuid.UUID(data['data']['accountId'])
 creator=uuid.UUID(data['data']['creatorProfileId'])
 with closing(psycopg.connect(DSN,autocommit=True)) as check,closing(psycopg.connect(DSN,autocommit=True)) as separate:
  assert one(check,'select count(*) from supabase_migrations.schema_migrations')==163
  assert one(check,'select pg_backend_pid()')!=one(separate,'select pg_backend_pid()')
  for sig in [answer_sig]+old:
   for role in ('anon','authenticated','service_role'):
    assert one(check,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)) is False,(sig,role)
  for sig in positive:
   assert one(check,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)),sig
  passmark('FRESH_FULL163_PRIOR157_162_ACL_AND_R16_SIGNED_GRANTS')
  # Explicit DB-owner fixture is NOT a valid public Help Writer or public release.
  question_data=one(check,"""select public.community_ask_question_v1(
    %s,%s,'QA synthetic Question','Not public','{qa}'::text[],
    'switch','1.25.0',%s)""",(actor,creator,'qr163-fixture-'+secrets.token_hex(8)))
  assert question_data and question_data.get('questionId')
  q=uuid.UUID(question_data['questionId'])
  def snapshot():
   return check.execute("""select
     (select count(*) from public.qa_answers where question_id=%s),
     (select count(*) from public.comments where target_entity_id=%s and author_account_id=%s),
     (select count(*) from public.outbox_events where event_type='answer.created' and payload->>'questionId'=%s),
     (select count(*) from public.idempotency_keys where account_id=%s and command_name='add_answer_v1')""",
     (q,q,account,str(q),account)).fetchone()
  base=snapshot()
  def direct(role):
   try:
    with separate.transaction():
     separate.execute('set local role '+role)
     one(separate,"select public.community_add_answer_v1(%s,%s,%s,%s,%s)",
        (actor,creator,q,'QR163 synthetic Answer','qr163-'+secrets.token_hex(12)))
   except psycopg.Error as err:
    assert err.sqlstate=='42501',(role,err.sqlstate)
    return
   raise AssertionError('POSTREVOKE_SOURCE163_ANSWER_COMMITTED')
  def edge(token):
   return http('/functions/v1/community-command',{'command':'addAnswer','payload':{
    'creatorProfileId':str(creator),'questionId':str(q),
    'body':'Synthetic Answer no rights','idempotencyKey':'qr163-'+secrets.token_hex(8)}},jwt=token)
  one(check,'select public.community_authorize_signed_session_v2(%s,%s,%s)',session2)
  status,body=edge(a2)
  assert status==409 and body.get('error')=='SOURCE163_HELP_ANSWER_WRITER_NOT_ENROLLED',(status,body)
  for role in ('anon','authenticated','service_role'):direct(role)
  assert snapshot()==base,'LIVE_A2_ANSWER_DB_MUTATED'
  passmark('ACTIVE_A2_409_THREEROLE_SQL42501_ANSWER_GRAPH_UNCHANGED')
  one(check,'select public.community_authorize_signed_session_v2(%s,%s,%s)',session1)
  one(check,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",session1)
  assert http('/functions/v1/community-query',{'query':'me','payload':{}},jwt=a1)[0]==401
  assert http('/functions/v1/community-query',{'query':'me','payload':{}},jwt=a2)[0]==200
  st,ref=http('/auth/v1/token?grant_type=refresh_token',{'refresh_token':refresh1})
  assert st==200 and ref.get('access_token')
  newtoken=ref['access_token'];assert claims(newtoken)['session_id']==str(session1[2])
  assert http('/functions/v1/community-query',{'query':'me','payload':{}},jwt=newtoken)[0]==401
  for jwt in (a1,newtoken):assert edge(jwt)[0]==401
  for _ in range(5):direct('service_role')
  assert snapshot()==base,'POSTREVOKE_ANSWER_COMMENT_OUTBOX_IDEM_CHANGED'
  passmark('REVOKED_OLD_AND_REAL_REFRESH_A1_401_SIBLING_A2_200_FIVEREPLAY_NODIFF')
  check.execute('begin')
  try:
   check.execute('grant execute on function '+answer_sig+' to service_role')
   assert one(check,"select has_function_privilege('service_role',%s,'EXECUTE')",(answer_sig,))
   assert not one(separate,"select has_function_privilege('service_role',%s,'EXECUTE')",(answer_sig,))
  finally:
   check.execute('rollback')
  assert not one(check,"select has_function_privilege('service_role',%s,'EXECUTE')",(answer_sig,))
  assert not one(separate,"select has_function_privilege('service_role',%s,'EXECUTE')",(answer_sig,))
  direct('service_role')
  assert snapshot()==base
  passmark('TWO_POSTGRES_BACKENDS_TEMP_GRANT_ROLLBACK_STILL_42501')
  passmark('INDEPENDENT_REAL_ES256_LOCAL_SOURCE163_DIRECT_ANSWER_ONLY_NOT_PUBLIC')
finally:
 if actor:
  try:http('/auth/v1/admin/users/'+str(actor),admin=True,method='DELETE')
  except Exception:pass
