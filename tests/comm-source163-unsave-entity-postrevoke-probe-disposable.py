#!/usr/bin/env python3
"""03 COMM post-Source163 Unsave Entity legacy authority reachability; synthetic disposable only.
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
    email="comm-unsave-entity-"+secrets.token_hex(6)+"@example.invalid"
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
          "handle":"qa_"+secrets.token_hex(7),"displayName":"Local Unsave Entity Authority Probe"}},token=a1)
    assert status==200 and boot.get("ok"),("A0_BOOTSTRAP_INVALID",status)
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])
    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==163
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        sig="public.community_unsave_entity(uuid,uuid)"
        ask="public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)"
        roles={r:scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(r,sig))
               for r in ("anon","authenticated","service_role")}
        assert roles=={"anon":False,"authenticated":False,"service_role":True},roles
        assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(ask,))
        effective=scalar(pre,"select pg_get_functiondef(to_regprocedure(%s))",(sig,))
        assert "security definer" in effective.lower()
        assert "community_authorize_signed_session_v2" not in effective
        mark("UNSAVE_ENTITY_EFFECTIVE_SQL_AUTHORITY",threeRoleExecute=roles,
             sameTransactionSignedV2=False,source160OldQuestionWriterStillOff=True)
        # Two previously published Question fixtures created with disposable
        # PostgreSQL OWNER only; no Source160 external Help question Writer enabled.
        targets=[]
        for index in (1,2):
            question=scalar(pre,"""select public.community_ask_question_v1(
              %s,%s,%s,'Synthetic local Save Entity authority fixture',
              %s::text[],'switch','1.25.0',%s)""",
              (actor,creator,"Disposable save item "+str(index),["local_fixture"],
               "fixture-"+secrets.token_hex(8)))
            assert isinstance(question,dict) and question.get("questionId")
            target=uuid.UUID(question["questionId"])
            assert scalar(pre,"select private.can_access_entity(%s,%s)",(target,account))
            targets.append(target)
        assert targets[0]!=targets[1]
        mark("UNSAVE_ENTITY_POSITIVE_FIXTURE_VALID",twoPublishedWorks=True,
             onlyLocalOwnerDbFixture=True,Source160OldQuestionWriterOff=True)
        def snapshot():
            return scalar(pre,"select count(*) from public.saved_items where account_id=%s and target_entity_id=any(%s::uuid[])",(account,targets))
        def apply(target,operation):
            with writer.transaction():
                writer.execute("set local role service_role")
                data=scalar(writer,"select public.community_"+operation+"_entity(%s,%s)",(actor,target))
            assert isinstance(data,dict),"LEGACY_ENTITY_RESULT_MISSING"
        assert scalar(pre,"select has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')"),"SAVE_PREREQUISITE_ROLE_NOT_AVAILABLE"
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("SIGNED_A2_NOT_ELIGIBLE",status)
        assert snapshot()==0,"EXPECTED_EMPTY_SAVED_ITEMS"
        apply(targets[0],"save");apply(targets[1],"save")
        assert snapshot()==2,("SOURCE_FIXTURE_SAVE_FAILED",snapshot())
        mark("UNSAVE_ENTITY_TWO_PUBLISHED_SAVED_FIXTURES",
             onlyLocalOwnerDbQuestionFixture=True,realGoTrueES256=True,twoDistinctPostgreSQL=True)
        apply(targets[0],"unsave")
        mid=snapshot()
        assert mid==1,("ELIGIBLE_UNSAVE_ENTITY_DB_NO_DIFF",mid)
        mark("UNSAVE_ENTITY_ELIGIBLE_SIGNED_A2_DIRECT_SERVICE_SQL_COMMIT",
             realGoTrueES256=True,twoDistinctPostgreSQL=True,savedItemsDecremented=True)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("A1_OLD_REVOKE_FAILED",status)
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token"),"REFRESH_MISSING"
        jwt=refresh["access_token"]
        assert claims(jwt)["session_id"]==str(c1[2]),"WRONG_REFRESH_SESSION"
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=jwt)
        assert status==401,("A1_REAL_REFRESH_NOT_REVOKED",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("SIGNED_SIBLING_A2_NOT_HEALTHY",status)
        apply(targets[1],"unsave")
        final=snapshot()
        assert final==0,("POSTREVOKE_UNSAVE_ENTITY_DB_NO_DIFF",mid,final)
        mark("UNSAVE_ENTITY_POSTREVOKE_DIRECT_SERVICE_SQL_COMMIT_TRUE_RED",
             A1OriginalAndTrueRefreshed401=True,healthySiblingA2_200=True,
             separatePgBackendServiceRoleCommit=True,twoDistinctSavedItemsRemoved=True,
             realPublicHttpExploitProven=False,providerBytesUsed=False)
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
