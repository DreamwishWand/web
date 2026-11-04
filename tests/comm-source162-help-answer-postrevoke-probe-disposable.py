#!/usr/bin/env python3
"""03 COMM post-Source162 Help Answer legacy authority reachability; synthetic disposable only.
Superuser legacy Question is a FIXTURE of an already-published Work, not a supported new Question Writer.
Real ES256 A1/A2 + two distinct PostgreSQL backends, service SQL is NOT public HTTP exploit proof.
"""
import base64
import json
import os
import secrets
import subprocess
import urllib.error
import urllib.request
import uuid
from contextlib import closing
import psycopg
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert all(not os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
API="http://127.0.0.1:54321"; DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
env={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k,v=line.split("=",1);env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")
def req(path,body=None,token=None,service=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
    headers={"apikey":key,"Accept":"application/json"}
    if service: headers["Authorization"]="Bearer "+key
    elif token: headers["Authorization"]="Bearer "+token
    if body is not None:headers["Content-Type"]="application/json"
    request=urllib.request.Request(API+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=35) as res:
            return res.status,json.loads(res.read(100000) or b"null")
    except urllib.error.HTTPError as ex:
        try: result=json.loads(ex.read(100000) or b"{}")
        except Exception: result={}
        return ex.code,result
def claims(jwt,part=1):
    data=jwt.split(".")[part]
    return json.loads(base64.urlsafe_b64decode(data+"="*(-len(data)%4)))
def scalar(c,sql,p=()):return c.execute(sql,p).fetchone()[0]
def mark(key,**data):print(json.dumps({"case":key,**data},sort_keys=True),flush=True)
actor=None
try:
    email="comm-help-answer-"+secrets.token_hex(6)+"@example.invalid"
    pw=secrets.token_urlsafe(23)+"A1!"
    status,user=req("/auth/v1/admin/users",{"email":email,"password":pw,"email_confirm":True},service=True)
    assert status in (200,201) and user.get("id")
    actor=uuid.UUID(user["id"])
    def login():
        status,body=req("/auth/v1/token?grant_type=password",{"email":email,"password":pw})
        assert status==200 and body.get("access_token")
        jwt=body["access_token"];head=claims(jwt,0);cl=claims(jwt)
        assert head.get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
        return jwt,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"])),body["refresh_token"]
    a1,c1,refresh1=login();a2,c2,_=login();assert c1[2]!=c2[2]
    status,boot=req("/functions/v1/community-command",{
        "command":"ensureAccountCreator","payload":{
          "handle":"qa_"+secrets.token_hex(7),"displayName":"Local Help Answer Authority Probe"}},token=a1)
    assert status==200 and boot.get("ok"),("A0_BOOTSTRAP_INVALID",status)
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])
    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==162
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        answer_sig="public.community_add_answer_v1(uuid,uuid,uuid,text,text)"
        ask_sig="public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)"
        roles={role:scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,answer_sig))
              for role in ("anon","authenticated","service_role")}
        assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(ask_sig,))
        body=scalar(pre,"select pg_get_functiondef(to_regprocedure(%s))",(answer_sig,))
        assert "security definer" in body.lower()
        assert "community_authorize_signed_session_v2" not in body
        mark("HELP_ANSWER_EFFECTIVE_SQL_AUTHORITY",roleExecute=roles,
             askQuestionSource160DirectOff=True,answerSameTxnSignedV2=False)

        # A previously published Question, synthetic and locally CREATED AS DB OWNER
        # rather than bypassing Source160's service_role/Edge positive release guard.
        question_result=scalar(pre,"""select public.community_ask_question_v1(
           %s,%s,'Disposable current question','Help answer SQL privilege test',
           %s::text[],'switch','1.25.0',%s)""",
           (actor,creator,["local_fixture"],"fixture-"+secrets.token_hex(8)))
        assert question_result and question_result.get("questionId")
        question=uuid.UUID(question_result["questionId"])
        mark("HELP_ANSWER_POSITIVE_FIXTURE_VALID",
             localDbOwnerOnlyLegacyQuestionFixture=True,questionCurrentPublished=True,
             noRealUserQuestion=True,noPublicQuestionWriterReenabled=True)
        def snapshot():
            return pre.execute("""select
              (select count(*) from public.qa_answers where question_id=%s),
              (select count(*) from public.comments where target_entity_id=%s and author_account_id=%s),
              (select count(*) from public.outbox_events where event_type='answer.created'
                and payload->>'questionId'=%s),
              (select count(*) from public.idempotency_keys where account_id=%s
                and command_name='add_answer_v1')
              """,(question,question,account,str(question),account)).fetchone()
        def add(tag,role):
            with writer.transaction():
                writer.execute("set local role "+role)
                result=scalar(writer,"select public.community_add_answer_v1(%s,%s,%s,%s,%s)",
                    (actor,creator,question,"Synthetic answer for local authority proof",tag))
            assert isinstance(result,dict) and result.get("answerId")
            return result
        base=snapshot()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200
        first=add("eligible-"+secrets.token_hex(8),"service_role")
        positive=snapshot()
        assert all(x==y+1 for x,y in zip(positive,base)),("FIRST_ELIGIBLE_ANSWER_NOT_COMMITTED",base,positive)
        mark("HELP_ANSWER_A2_GENUINE_SIGNED_ELIGIBLE_SQL_COMMIT",
             genuineEs256SignedA2=True,distinctPgBackends=True,
             questionSyntheticPreviouslyPublished=True,answerCommentQaOutboxIdempotencyCommitted=True)

        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("A1_ORIGINAL_NOT_REVOKED",status)
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        jwt2=refresh["access_token"]
        assert claims(jwt2)["session_id"]==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=jwt2)
        assert status==401,("A1_ACTUAL_REFRESH_NOT_REVOKED",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("A2_SIBLING_NOT_HEALTHY",status)
        second=add("after-revoked-"+secrets.token_hex(8),"service_role")
        post=snapshot()
        assert all(x==y+1 for x,y in zip(post,positive)),("SECOND_POSTREVOKE_ANSWER_NOT_COMMITTED",positive,post)
        assert first["answerId"]!=second["answerId"]
        mark("HELP_ANSWER_POSTREVOKE_SERVICE_SQL_COMMIT_TRUE_RED",
             revokedA1OriginalAndRealRefresh401=True,healthySiblingA2Http200=True,
             distinctPgServiceSqlCommitted=True,
             questionAnswerCommentOutboxIdempotencyDbDiff=True,
             noPhysicalProviderBytes=True,actualPublicHttpExploitProven=False)
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
