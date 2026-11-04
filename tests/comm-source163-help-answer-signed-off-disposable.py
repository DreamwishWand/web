#!/usr/bin/env python3
"""Source163 only: genuine GoTrue ES256 + 2PG direct Help Answer retired Writer OFF.
Synthetic previous Question via disposable DB-owner; no public/Provider mutations.
"""
import base64,json,os,secrets,subprocess,urllib.request,urllib.error,uuid
from contextlib import closing
import psycopg
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
API="http://127.0.0.1:54321";DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
env={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
 if "=" in line:
  k,v=line.split("=",1);env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")
def req(path,data=None,jwt=None,service=False,method="POST"):
 key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
 h={"apikey":key,"Accept":"application/json"}
 if service:h["Authorization"]="Bearer "+key
 elif jwt:h["Authorization"]="Bearer "+jwt
 if data is not None:h["Content-Type"]="application/json"
 request=urllib.request.Request(API+path,data=json.dumps(data).encode() if data is not None else None,headers=h,method=method)
 try:
  with urllib.request.urlopen(request,timeout=35) as res:return res.status,json.loads(res.read(100000) or b"null")
 except urllib.error.HTTPError as e:
  try:body=json.loads(e.read(100000) or b"{}")
  except Exception:body={}
  return e.code,body
def claims(jwt,index=1):
 p=jwt.split(".")[index];return json.loads(base64.urlsafe_b64decode(p+"="*(-len(p)%4)))
def one(c,sql,args=()):return c.execute(sql,args).fetchone()[0]
def emit(k,**d):print(json.dumps({"case":k,**d},sort_keys=True),flush=True)
actor=None
try:
 email="answer163-"+secrets.token_hex(6)+"@example.invalid";password=secrets.token_urlsafe(25)+"A1!"
 status,user=req("/auth/v1/admin/users",{"email":email,"password":password,"email_confirm":True},service=True)
 assert status in (200,201) and user.get("id")
 actor=uuid.UUID(user["id"])
 def login():
  status,data=req("/auth/v1/token?grant_type=password",{"email":email,"password":password})
  assert status==200 and data.get("access_token")
  jwt=data["access_token"];cl=claims(jwt)
  assert claims(jwt,0).get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
  return jwt,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"])),data["refresh_token"]
 a1,c1,rf1=login();a2,c2,_=login();assert c1[2]!=c2[2]
 status,boot=req("/functions/v1/community-command",{"command":"ensureAccountCreator","payload":{
  "handle":"qa_"+secrets.token_hex(6),"displayName":"Help Answer 163 Disposable"}},jwt=a1)
 assert status==200 and boot.get("ok")
 account=uuid.UUID(boot["data"]["accountId"]);creator=uuid.UUID(boot["data"]["creatorProfileId"])
 with closing(psycopg.connect(DSN,autocommit=True)) as p,closing(psycopg.connect(DSN,autocommit=True)) as w:
  assert one(p,"select count(*) from supabase_migrations.schema_migrations")==163
  assert one(p,"select pg_backend_pid()")!=one(w,"select pg_backend_pid()")
  signature="public.community_add_answer_v1(uuid,uuid,uuid,text,text)"
  old=["public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
   "public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)",
   "public.community_create_gallery_draft(uuid,uuid,text,text,text)",
   "public.community_create_gallery_work_v1(uuid,uuid,text,text)",
   "public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)"]
  for sig in [signature]+old:
   for role in ("anon","authenticated","service_role"):
    assert not one(p,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)),(role,sig)
  for sig in ["public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
   "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
   "public.community_get_ddv_profile_workspaces_v1(uuid)"]:
   assert one(p,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
  emit("SOURCE163_HELP_ANSWER_EFFECTIVE_ACL_THREE_ROLE_OFF",source160_162Off=True,signedR16WorkspaceGrantsIntact=True)
  # Previous published Question fixture, created by disposable DB owner only.
  q=one(p,"""select public.community_ask_question_v1(%s,%s,'Local question','Not production',
      %s::text[],'switch','1.25.0',%s)""",(actor,creator,["fixture"],"fixture-"+secrets.token_hex(8)))
  assert q and q.get("questionId")
  question=uuid.UUID(q["questionId"])
  def snap():
   return p.execute("""select (select count(*) from public.qa_answers where question_id=%s),
    (select count(*) from public.comments where target_entity_id=%s and author_account_id=%s),
    (select count(*) from public.outbox_events where event_type='answer.created' and payload->>'questionId'=%s),
    (select count(*) from public.idempotency_keys where account_id=%s and command_name='add_answer_v1')""",
    (question,question,account,str(question),account)).fetchone()
  def direct(role):
   try:
    with w.transaction():
     w.execute("set local role "+role)
     one(w,"select public.community_add_answer_v1(%s,%s,%s,%s,%s)",
       (actor,creator,question,"Local Answer","answer-"+secrets.token_hex(7)))
    return "UNEXPECTED_COMMIT"
   except psycopg.Error as e:return e.sqlstate
  def edge(jwt):
   return req("/functions/v1/community-command",{"command":"addAnswer","payload":{
     "creatorProfileId":str(creator),"questionId":str(question),"body":"Local Answer",
     "idempotencyKey":"answer-"+secrets.token_hex(7)}},jwt=jwt)
  before=snap()
  one(p,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
  status,data=edge(a2)
  assert status==409 and data.get("error")=="SOURCE163_HELP_ANSWER_WRITER_NOT_ENROLLED",(status,data)
  for role in ("anon","authenticated","service_role"):assert direct(role)=="42501",role
  assert snap()==before
  emit("SOURCE163_HELP_ANSWER_ACTIVE_A2_409_THREE_ROLE_42501_NO_DIFF",realSignedA2=True)
  one(p,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
  one(p,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
  status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},jwt=a1);assert status==401
  status,body=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":rf1})
  assert status==200 and body.get("access_token")
  fresh=body["access_token"];assert claims(fresh)["session_id"]==str(c1[2])
  status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},jwt=fresh);assert status==401
  status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},jwt=a2);assert status==200
  for jwt in (a1,fresh):
   status,_=edge(jwt);assert status==401,("REVOKED_EDGE_WRONG_CODE",status)
  for _ in range(2):assert direct("service_role")=="42501"
  assert snap()==before
  emit("SOURCE163_HELP_ANSWER_POSTREVOKE_401_TWO_PG_REPLAY_NO_DIFF",oldAndRefreshedA1_401=True,siblingA2_200=True)
  p.execute("begin")
  try:
   p.execute("grant execute on function "+signature+" to service_role")
   assert one(p,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
   assert not one(w,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
  finally:p.execute("rollback")
  assert not one(p,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
  assert snap()==before
  emit("SOURCE163_HELP_ANSWER_TEMP_GRANT_ROLLBACK_OFF",noOtherPgLeak=True)
finally:
 if actor is not None:
  try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
  except Exception:pass
