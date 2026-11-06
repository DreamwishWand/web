#!/usr/bin/env python3
"""03 COMM post-Source163 Follow Creator privileged SQL authority; synthetic disposable only.
Two target Creator Profiles are disposable synthetic GoTrue accounts; no public Writer activation.
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
actor=None;others=[]
try:
    email="comm-follow-creator-"+secrets.token_hex(6)+"@example.invalid"
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
          "handle":"qa_"+secrets.token_hex(7),"displayName":"Local Follow Creator Authority Probe"}},token=a1)
    assert status==200 and boot.get("ok"),("A0_BOOTSTRAP_INVALID",status)
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])
    targets=[]
    for index in (1,2):
        email2="comm-unfollow-target-"+secrets.token_hex(6)+"@example.invalid"
        pw2=secrets.token_urlsafe(23)+"B2!"
        status,u=req("/auth/v1/admin/users",{"email":email2,"password":pw2,"email_confirm":True},service=True)
        assert status in (200,201) and u.get("id"),("TARGET_CREATE",status)
        sub=uuid.UUID(u["id"]);others.append(sub)
        status,tok=req("/auth/v1/token?grant_type=password",{"email":email2,"password":pw2})
        assert status==200 and tok.get("access_token"),("TARGET_LOGIN",status)
        assert claims(tok["access_token"],0).get("alg")=="ES256"
        status,profile=req("/functions/v1/community-command",{
            "command":"ensureAccountCreator",
            "payload":{"handle":"qa_"+secrets.token_hex(7),"displayName":"Follow Local Target "+str(index)}
        },token=tok["access_token"])
        assert status==200 and profile.get("ok"),("TARGET_PROFILE",status,profile)
        targets.append(uuid.UUID(profile["data"]["creatorProfileId"]))
    assert targets[0]!=targets[1] and creator not in targets
    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==163
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        sig="public.community_follow_creator(uuid,uuid)"
        roles={role:scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig))
               for role in ("anon","authenticated","service_role")}
        assert roles=={"anon":False,"authenticated":False,"service_role":True},roles
        f=scalar(pre,"select pg_get_functiondef(to_regprocedure(%s))",(sig,))
        assert "security definer" in f.lower() and "community_authorize_signed_session_v2" not in f
        for target in targets:
            assert scalar(pre,"select exists(select 1 from public.creator_profiles where creator_profile_id=%s)",(target,))
        mark("FOLLOW_CREATOR_EFFECTIVE_SQL_AUTHORITY",
             threeRoleExecute=roles,sameTransactionSignedV2=False,twoSyntheticCreatorTargets=True)
        def snapshot():
            return scalar(pre,"select count(*) from public.follows where follower_account_id=%s and creator_profile_id=any(%s::uuid[])",(account,targets))
        def outbox():
            return scalar(pre,"select count(*) from public.outbox_events where event_type='creator.followed' and aggregate_id=any(%s::uuid[])",(targets,))
        def apply(target):
            with writer.transaction():
                writer.execute("set local role service_role")
                data=scalar(writer,"select public.community_follow_creator(%s,%s)",(actor,target))
            assert isinstance(data,dict) and data.get("creatorProfileId")==str(target) and data.get("following") is True,("FOLLOW_SQL_BAD_RETURN",data)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("ELIGIBLE_A2_NOT_200",status)
        assert snapshot()==0 and outbox()==0,"INITIAL_FOLLOW_OR_OUTBOX_NOT_EMPTY"
        apply(targets[0])
        assert snapshot()==1 and outbox()==1,("ELIGIBLE_A2_FOLLOW_NOT_COMMITTED",snapshot(),outbox())
        mark("FOLLOW_CREATOR_ELIGIBLE_SIGNED_A2_DIRECT_SERVICE_SQL_COMMIT",
             eligibleA2PositiveFollowPersisted=True,realGoTrueES256=True,twoSeparatePgBackends=True)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("OLD_A1_NOT_REVOKED",status)
        status,refreshed=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refreshed.get("access_token"),"REAL_REFRESH_FAILED"
        jwt=refreshed["access_token"]
        assert claims(jwt)["session_id"]==str(c1[2]),"REAL_REFRESH_SESSION_CHANGED"
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=jwt)
        assert status==401,("REFRESHED_A1_NOT_REVOKED",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("HEALTHY_SIBLING_A2_NOT_200",status)
        apply(targets[1])
        assert snapshot()==2 and outbox()==2,("POSTREVOKE_FOLLOW_OUTBOX_COMMIT_NOT_PROVEN",snapshot(),outbox())
        mark("FOLLOW_CREATOR_POSTREVOKE_DIRECT_SERVICE_SQL_COMMIT_TRUE_RED",
             originalAndActualRefreshedA1_401=True,healthySiblingA2_200=True,
             separatePostgreSQLServiceRoleCommit=True,twoFollowAndOutboxRowsPersisted=True,
             publicHttpAttackProven=False,providerBytesUsed=False)
finally:
    for sub in others:
        try:req("/auth/v1/admin/users/"+str(sub),method="DELETE",service=True)
        except Exception:pass
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
