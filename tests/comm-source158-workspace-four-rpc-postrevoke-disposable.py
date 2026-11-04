#!/usr/bin/env python3
"""03 COMM W-COMM-006: exact FULL158 real ES256 DDV Workspace Legacy RPC gap.

Genuine GoTrue signed A1/A2; independent SQL backend calls selected four
service-role Workspace/identity RPCs after A1 Local revoke is committed.
This is direct SQL authority evidence, not proof of a client-side exploit.
Only fabricated Workspace/Identity rows in disposable local FULL158 are used.
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
assert all(not os.getenv(k) for k in
           ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
env={}
for s in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in s:
        k,v=s.split("=",1)
        env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")

def req(path,body=None,token=None,service=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
    h={"apikey":key,"Accept":"application/json"}
    if service:h["Authorization"]="Bearer "+key
    elif token:h["Authorization"]="Bearer "+token
    if body is not None:h["Content-Type"]="application/json"
    r=urllib.request.Request(API+path,headers=h,method=method,
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(r,timeout=35) as res:
            return res.status,json.loads(res.read(100000) or b"null")
    except urllib.error.HTTPError as err:
        raw=err.read(100000)
        try:payload=json.loads(raw)
        except Exception:payload={}
        return err.code,payload

def claims(token,index=1):
    part=token.split(".")[index]
    return json.loads(base64.urlsafe_b64decode(part+"="*(-len(part)%4)))

def mark(key,value):
    print(json.dumps({"case":key,**value},sort_keys=True),flush=True)

def scalar(c,sql,p=()):return c.execute(sql,p).fetchone()[0]

actor=None
try:
    e="comm-workspace-"+secrets.token_hex(7)+"@example.invalid"
    pw=secrets.token_urlsafe(25)+"A1!"
    st,u=req("/auth/v1/admin/users",{"email":e,"password":pw,"email_confirm":True},service=True)
    assert st in (200,201) and u.get("id"),"LOCAL_CREATE_USER_FAILED"
    actor=uuid.UUID(u["id"])
    def login():
        s,x=req("/auth/v1/token?grant_type=password",{"email":e,"password":pw})
        assert s==200 and x.get("access_token")
        jwt=x["access_token"];head=claims(jwt,0);cl=claims(jwt,1)
        assert head.get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
        return jwt,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"])),x.get("refresh_token")
    a1,c1,refresh1=login()
    a2,c2,refresh2=login()
    assert c1[2]!=c2[2]
    st,boot=req("/functions/v1/community-command",{"command":"ensureAccountCreator","payload":{
        "handle":"ws_"+secrets.token_hex(7),"displayName":"Workspace isolated owner"}},token=a1)
    assert st==200 and boot.get("ok"),"A0_REAL_SIGNED_BOOTSTRAP_FAILED"
    data=boot["data"]
    account=uuid.UUID(data["accountId"])
    creator=uuid.UUID(data["creatorProfileId"])

    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==158
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signatures={
            "create":"public.community_create_ddv_profile_workspace_v1(uuid,text)",
            "update":"public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)",
            "associate":"public.community_associate_ddv_identity_v1(uuid,uuid,text)",
            "unlink":"public.community_unlink_ddv_identity_v1(uuid,uuid)",
            "delete_signed":"public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
        }
        for name,sig in signatures.items():
            if name=="delete_signed": continue
            perms={role:bool(scalar(pre,
                 "select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)))
                   for role in ("anon","authenticated","service_role")}
            assert perms=={"anon":False,"authenticated":False,"service_role":True},(name,perms)
            proc=pre.execute("select p.prosrc,p.prosecdef from pg_proc p where p.oid=to_regprocedure(%s)",
                             (sig,)).fetchone()
            assert proc and proc[1] and "community_authorize_signed_session_v2" not in proc[0]
            mark("WORKSPACE_LEGACY_SQL_CATALOG_"+name.upper(),{
                "roles":perms,"sameTransactionSignedSessionGuard":False})
        assert bool(scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",
                           (signatures["delete_signed"],)))

        def command(name,sql,args):
            try:
                with writer.transaction():
                    writer.execute("set local role service_role")
                    result=scalar(writer,sql,args)
                return "COMMITTED",result
            except psycopg.Error as ex:
                return "REJECTED",str(ex.sqlstate or "UNKNOWN")

        def snap():
            return pre.execute("""select
                (select count(*) from public.ddv_profile_workspaces where account_id=%s),
                (select count(*) from private.ddv_identity_associations where account_id=%s),
                (select count(*) from public.audit_events where actor_account_id=%s
                  and action_type like 'ddv_profile_workspace.%%')
                """,(account,account,account)).fetchone()

        def make_new():
            return command("create",
                "select public.community_create_ddv_profile_workspace_v1(%s,'self')",(actor,))
        def update(workspace_id,name):
            return command("update",
                "select public.community_update_ddv_profile_workspace_v1(%s,%s,%s,'archived')",
                (actor,workspace_id,name))
        def bind(workspace_id,hashkey):
            return command("associate",
                "select public.community_associate_ddv_identity_v1(%s,%s,%s)",
                (actor,workspace_id,hashkey))
        def unbind(workspace_id):
            return command("unlink",
                "select public.community_unlink_ddv_identity_v1(%s,%s)",
                (actor,workspace_id))

        # A2 writer-before-revoke establishes eligible actor, owner, ACL, SQL
        # prerequisites, and the actual schema. It is not an independent QA.
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        before=snap()
        status,result=make_new()
        assert status=="COMMITTED" and result.get("workspaceId"),(status,result)
        target=uuid.UUID(result["workspaceId"])
        after=snap()
        assert after[0]==before[0]+1 and after[2]==before[2]+1
        status,result=update(target,"Eligible Workspace")
        assert status=="COMMITTED" and result.get("displayName")=="Eligible Workspace",(status,result)
        digest1="hmac-sha256:v1:"+secrets.token_hex(32)
        status,result=bind(target,digest1)
        assert status=="COMMITTED" and result.get("identityAssociated"),(status,result)
        status,result=unbind(target)
        assert status=="COMMITTED" and result.get("unlinked"),(status,result)
        assert snap()[1]==0
        mark("WORKSPACE_SIGNED_A2_ELIGIBLE_SQL_FOUR_POSITIVE",{
            "genuineGoTrueES256":True,"registered":True,
            "createUpdateAssociateUnlinkEligible":True,
            "separatePostgreSQLBackends":True})

        # Now A1 Edge-equivalent signed preflight succeeds. Local terminal
        # revocation is committed in a different transaction and PG backend.
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("REVOKED_A1_OLD_JWT_NOT_401",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("HEALTHY_A2_NOT_200",status)
        # Refresh may be permitted by GoTrue but Source154 terminal v2 must
        # reject any new access token still bound to the revoked session ID.
        status,refreshed=req("/auth/v1/token?grant_type=refresh_token",
                            {"refresh_token":refresh1})
        assert status==200 and refreshed.get("access_token"),("GOTRUE_REFRESH_NOT_200",status)
        cl=claims(refreshed["access_token"],1)
        assert cl.get("session_id")==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},
                     token=refreshed["access_token"])
        assert status==401,("REVOKED_REFRESHED_TOKEN_NOT_401",status)
        mark("WORKSPACE_REAL_GO_TRUE_REVOKED_SIGNED_A1_HTTP401",{
          "original401":True,"refreshedSameSession401":True,"healthyA2Http200":True})

        def prove(action,fn,expected_change,check):
            baseline=snap()
            state,result=fn()
            current=snap()
            changed=check(baseline,current)
            mark("WORKSPACE_AFTER_A1_REVOKE_"+action.upper(),{
                "status":state,
                "dbMutationObserved":changed,
                "separateSignedPreflight":True,
                "source158Unchanged":True,
                "eligibleOwner":True,
                "originalAndRefreshedA1Http401":True})
            assert state=="COMMITTED" and changed,("ELIGIBLE_SIGNED_GAP_NOT_REPRODUCED",action,state,result,baseline,current)
            return result

        # After a signed session is terminally revoked, old subject-only
        # service_role RPCs still see an *active Account* and commit changes.
        created=prove("create",make_new,1,
                      lambda a,b:b[0]==a[0]+1 and b[2]==a[2]+1)
        revoked_workspace=uuid.UUID(created["workspaceId"])
        prove("update",lambda:update(target,"Revoked Session Changed Workspace"),1,
              lambda a,b:b[2]==a[2]+1)
        row=pre.execute("select display_name from public.ddv_profile_workspaces where workspace_id=%s",
                        (target,)).fetchone()
        assert row and row[0]=="Revoked Session Changed Workspace"
        digest2="hmac-sha256:v1:"+secrets.token_hex(32)
        prove("associate",lambda:bind(target,digest2),1,
              lambda a,b:b[1]==a[1]+1 and b[2]==a[2]+1)
        prove("unlink",lambda:unbind(target),1,
              lambda a,b:b[1]==a[1]-1 and b[2]==a[2]+1)
        assert pre.execute("select count(*) from public.ddv_profile_workspaces where workspace_id=%s",
                           (revoked_workspace,)).fetchone()[0]==1
        mark("WORKSPACE_SIGNED_LOCAL_FOUR_OLD_SERVICE_ROLE_WRITERS_POSTREVOKE_COMMIT",{
            "classification":"DISPOSABLE_SQL_SEPARATE_PREFLIGHT_TRUE_RED",
            "allFourEligibleCurrentActorPostRevokeCommitted":True,
            "publicDirectClientExploitProved":False,
            "inFlightEdgeHTTPRaceProved":False,
            "sessionBoundSignedDeleteCheckedSeparately":False,
            "noProviderOrProductionUser":True})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
