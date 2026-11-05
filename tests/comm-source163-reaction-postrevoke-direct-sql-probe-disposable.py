#!/usr/bin/env python3
"""03 COMM post-Source163 Reaction legacy authority reachability; synthetic disposable only.
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
    email="comm-reaction-"+secrets.token_hex(6)+"@example.invalid"
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
          "handle":"qa_"+secrets.token_hex(7),"displayName":"Local Reaction Authority Probe"}},token=a1)
    assert status==200 and boot.get("ok"),("A0_BOOTSTRAP_INVALID",status)
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])
    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==163
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        reaction_sig="public.community_add_reaction(uuid,uuid,text)"
        ask_sig="public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)"
        roles={role:scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,reaction_sig))
              for role in ("anon","authenticated","service_role")}
        assert roles=={"anon":False,"authenticated":False,"service_role":True},("EFFECTIVE_REACTION_ACL",roles)
        assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(ask_sig,))
        effective=scalar(pre,"select pg_get_functiondef(to_regprocedure(%s))",(reaction_sig,))
        assert "security definer" in effective.lower() and "community_authorize_signed_session_v2" not in effective
        mark("REACTION_EFFECTIVE_SQL_AUTHORITY",threeRoleExecute=roles,
             signedSameTxn=False,askQuestionSource160DirectOff=True)
        # ONLY disposable DB-OWNER creates historical current public Question
        # as fixture. Source160 disables question creation at service-role Edge.
        question_json=scalar(pre,"""select public.community_ask_question_v1(
           %s,%s,'Disposable current reaction Question','Local direct SQL authority fixture',
           %s::text[],'switch','1.25.0',%s)""",
           (actor,creator,["local_fixture"],"fixture-"+secrets.token_hex(8)))
        assert question_json and question_json.get("questionId"),"NOT_VALID_PUBLISHED_QUESTION_FIXTURE"
        question=uuid.UUID(question_json["questionId"])
        assert scalar(pre,"select private.can_access_entity(%s,%s)",(question,account))
        mark("REACTION_POSITIVE_FIXTURE_VALID",previouslyPublishedOwnerDbOnly=True,
             noPublicQuestionWriterEnabled=True,canAccessEntity=True)
        def snapshot():
            return pre.execute("""select
                (select count(*) from public.reactions where target_entity_id=%s and account_id=%s),
                (select count(*) from public.outbox_events
                 where aggregate_id=%s and event_type='reaction.added' and payload->>'actorAccountId'=%s)
            """,(question,account,question,str(account))).fetchone()
        def add(kind):
            with writer.transaction():
                writer.execute("set local role service_role")
                result=scalar(writer,"select public.community_add_reaction(%s,%s,%s)",
                    (actor,question,kind))
            assert isinstance(result,dict) and result.get("targetEntityId"),"REACTION_POSITIVE_NOT_COMMITTED"
            return result
        before=snapshot()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("ELIGIBLE_A2_HTTP_NOT_200",status)
        add("local_probe_like_"+secrets.token_hex(5))
        positive=snapshot()
        assert positive==tuple(x+1 for x in before),("ELIGIBLE_REACTION_NOT_PERSISTED",before,positive)
        mark("REACTION_ELIGIBLE_SIGNED_A2_SERVICE_SQL_COMMIT",
             realGoTrueES256=True,twoDistinctPostgresBackends=True,
             reactionAndOutboxPersisted=True,providerBytesUsed=False)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("REVOKED_ORIGINAL_A1_NOT_401",status)
        status,refreshed_data=req("/auth/v1/token?grant_type=refresh_token",
            {"refresh_token":refresh1})
        assert status==200 and refreshed_data.get("access_token"),"GOTRUE_REFRESH_FAILED"
        refreshed=refreshed_data["access_token"]
        assert claims(refreshed)["session_id"]==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=refreshed)
        assert status==401,("REVOKED_REAL_REFRESHED_A1_NOT_401",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("HEALTHY_SIBLING_A2_NOT_200",status)
        add("local_probe_postrev_"+secrets.token_hex(5))
        after=snapshot()
        assert after==tuple(x+1 for x in positive),("POSTREVOKE_REACTION_NOT_COMMITTED",positive,after)
        mark("REACTION_POSTREVOKE_DIRECT_SERVICE_SQL_COMMIT_TRUE_RED",
             genuineOldAndRefreshedA1_401=True,healthySiblingA2_200=True,
             separateBackendServiceSqlCommit=True,reactionAndOutboxPersisted=True,
             publicHttpExploitProven=False,leakedServiceRoleKey=False)

finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
