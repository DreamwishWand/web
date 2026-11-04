#!/usr/bin/env python3
"""04 QR independent Source160 QA. Disposable ES256 GoTrue + two PostgreSQL processes only.
Never access production, Stage116, Provider or real personal records.
"""
import base64,json,os,secrets,subprocess,urllib.request,urllib.error,uuid
from contextlib import closing
import psycopg
assert os.environ.get('DDVRE_E2_LOCAL_DISPOSABLE')=='APPROVED'
assert not any(os.environ.get(k) for k in ['DATABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_ID'])
env={}
for line in subprocess.check_output(['supabase','status','-o','env'],text=True,stderr=subprocess.DEVNULL).splitlines():
 if '=' in line:
  k,v=line.split('=',1);env[k]=v.strip('"\'')
assert env['ANON_KEY'] and env['SERVICE_ROLE_KEY']
API='http://127.0.0.1:54321'
DSN='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
def call(path,payload=None,token=None,service=False,method='POST'):
 key=env['SERVICE_ROLE_KEY'] if service else env['ANON_KEY']
 h={'apikey':key,'Accept':'application/json'}
 if service:h['Authorization']='Bearer '+key
 elif token:h['Authorization']='Bearer '+token
 if payload is not None:h['Content-Type']='application/json'
 req=urllib.request.Request(API+path,headers=h,method=method,
  data=json.dumps(payload).encode() if payload is not None else None)
 try:
  with urllib.request.urlopen(req,timeout=40) as r:return r.status,json.loads(r.read(200000) or b'null')
 except urllib.error.HTTPError as e:
  try:res=json.loads(e.read(200000))
  except Exception:res={}
  return e.code,res
def jwt(token,index=1):
 s=token.split('.')[index];return json.loads(base64.urlsafe_b64decode(s+'='*(-len(s)%4)))
def one(c,sql,args=()):return c.execute(sql,args).fetchone()[0]
S={
 'askQuestion':'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)',
 'createTip':'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)'
}
SIGNED='public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)'
KEEP=[
 SIGNED,
 'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)',
 'public.community_get_ddv_profile_workspaces_v1(uuid)'
]
BLOCK=[
 'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)',
 'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)',
 'public.community_create_ddv_profile_workspace_v1(uuid,text)',
 'public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)',
 'public.community_associate_ddv_identity_v1(uuid,uuid,text)',
 'public.community_unlink_ddv_identity_v1(uuid,uuid)'
]
def mark(s):print('QR_160_'+s+'_PASS',flush=True)
owner=None
try:
 email='qr160-'+secrets.token_hex(9)+'@example.invalid'
 passwd=secrets.token_urlsafe(23)+'A1!'
 status,user=call('/auth/v1/admin/users',{'email':email,'password':passwd,'email_confirm':True},service=True)
 assert status in (200,201) and user.get('id')
 owner=uuid.UUID(user['id'])
 def login():
  s,x=call('/auth/v1/token?grant_type=password',{'email':email,'password':passwd})
  assert s==200 and x.get('access_token') and x.get('refresh_token')
  token=x['access_token'];head=jwt(token,0);claims=jwt(token)
  assert head['alg']=='ES256' and claims['sub']==str(owner) and claims.get('session_id')
  return token,x['refresh_token'],(owner,int(claims['iat']),uuid.UUID(claims['session_id']))
 a1,refresh1,c1=login()
 a2,_,c2=login()
 assert c1[2]!=c2[2]
 s,b=call('/functions/v1/community-command',
  {'command':'ensureAccountCreator','payload':{'handle':'qr160_'+secrets.token_hex(6),
  'displayName':'Independent QA160 isolated creator'}},token=a2)
 assert s==200 and b.get('ok') and b.get('data',{}).get('creatorProfileId')
 account=uuid.UUID(b['data']['accountId'])
 creator=uuid.UUID(b['data']['creatorProfileId'])
 with closing(psycopg.connect(DSN,autocommit=True)) as revoker,closing(psycopg.connect(DSN,autocommit=True)) as writer:
  assert one(revoker,'select count(*) from supabase_migrations.schema_migrations')==160
  assert one(revoker,'select pg_backend_pid()')!=one(writer,'select pg_backend_pid()')
  for op,sig in S.items():
   for role in ['anon','authenticated','service_role']:
    assert one(revoker,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)) is False,(op,role)
  for sig in KEEP:
   assert one(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is True,sig
  for sig in BLOCK:
   assert one(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is False,sig
  mark('TWO_RPC_THREE_ROLE_REVOKE_SIGNED_R16_SOURCE159_UNCHANGED')
  def snapshot():
   return revoker.execute("""select
    (select count(*) from public.community_works where owner_account_id=%s and work_type in ('question','tip')),
    (select count(*) from public.community_work_revisions r join public.community_works w on w.work_id=r.work_id where w.owner_account_id=%s and w.work_type in ('question','tip')),
    (select count(*) from public.search_documents s join public.community_works w on w.work_id=s.work_id where w.owner_account_id=%s and w.work_type in ('question','tip')),
    (select count(*) from public.outbox_events o join public.community_works w on w.work_id=o.aggregate_id where w.owner_account_id=%s and w.work_type in ('question','tip')),
    (select count(*) from public.idempotency_keys where account_id=%s and command_name in ('ask_question_v1','create_tip_v1')),
    (select count(*) from public.qa_question_state qs join public.community_works w on w.work_id=qs.work_id where w.owner_account_id=%s),
    (select count(*) from public.qa_tip_state ts join public.community_works w on w.work_id=ts.work_id where w.owner_account_id=%s)
   """,(account,)*7).fetchone()
  before=snapshot()
  def params(op):
   token='qr160-'+secrets.token_hex(10)
   return (owner,creator,'QA isolated '+op,'Must not commit '+op,['help','gameplay'],token)
  def direct(op,role):
   p=params(op)
   sql=('select public.community_ask_question_v1(%s,%s,%s,%s,%s,NULL,NULL,%s)' if op=='askQuestion'
        else 'select public.community_create_tip_v1(%s,%s,%s,%s,%s,NULL,NULL,NULL,NULL,%s)')
   try:
    with writer.transaction():
     writer.execute('set local role '+role)
     writer.execute(sql,p).fetchone()
   except psycopg.Error as e:
    assert e.sqlstate=='42501',(op,role,e.sqlstate)
    return
   raise AssertionError('DIRECT_LEGACY_SQL_COMMIT_'+op)
  def edge(token,op):
   return call('/functions/v1/community-command',{'command':op,'payload':{
     'creatorProfileId':str(creator),'title':'QA isolated '+op,'body':'Must not commit',
     'contextTags':['help','gameplay'],'idempotencyKey':'qr160-'+secrets.token_hex(10)}},token=token)
  one(revoker,'select public.community_authorize_signed_session_v2(%s,%s,%s)',c2)
  for op in S:
   status,response=edge(a2,op)
   assert status==409 and response.get('error')=='SOURCE160_HELP_QA_WRITER_NOT_ENROLLED',(op,status)
   for role in ['anon','authenticated','service_role']:direct(op,role)
  assert snapshot()==before
  mark('A2_SIGNED_TWO_EDGE409_SIX_SQL42501_DB_NO_DIFF')
  one(revoker,'select public.community_authorize_signed_session_v2(%s,%s,%s)',c1)
  one(revoker,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
  assert call('/functions/v1/community-query',{'query':'me','payload':{}},token=a1)[0]==401
  assert call('/functions/v1/community-query',{'query':'me','payload':{}},token=a2)[0]==200
  s,r=call('/auth/v1/token?grant_type=refresh_token',{'refresh_token':refresh1})
  assert s==200 and r.get('access_token') and jwt(r['access_token'])['session_id']==str(c1[2])
  assert call('/functions/v1/community-query',{'query':'me','payload':{}},token=r['access_token'])[0]==401
  for token in [a1,r['access_token']]:
   for op in S:assert edge(token,op)[0]==401
  for op in S:
   for _ in range(3):direct(op,'service_role')
  assert snapshot()==before
  mark('REVOKED_A1_OLD_REFRESHED_401_A2_200_TWO_PG_REPLAY_NO_DIFF')
  # Uncommitted transactional grant in separate revoker PG never becomes visible to writer.
  with revoker.transaction(force_rollback=True):
   for sig in S.values():
    revoker.execute('grant execute on function '+sig+' to service_role')
    assert one(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is True
    assert one(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is False
  for sig in S.values():
   assert one(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is False
   assert one(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is False
  for op in S:direct(op,'service_role')
  assert snapshot()==before
  mark('TWO_PG_TEMP_GRANT_ROLLBACK_REMAINS_DENIED')
  mark('INDEPENDENT_GENUINE_ES256_FULL160_SOURCE_ONLY')
finally:
 if owner:
  try:call('/auth/v1/admin/users/'+str(owner),service=True,method='DELETE')
  except Exception:pass
