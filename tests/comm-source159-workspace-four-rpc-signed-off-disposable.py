#!/usr/bin/env python3
"""03 COMM W-COMM-006: exact FULL159 real ES256 DDV Workspace Legacy RPC OFF.

Genuine GoTrue signed A1/A2 + two PostgreSQL backends after strictly forward Source159.
Four legacy subject-only Workspace/Identity operations stay 409/401 and direct
SQLSTATE42501, with original-first accepted Source155/R16/157/158 grants held.
All Workspaces and Identity rows are synthetic and disposable; no Provider.
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
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==159
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()"),"NOT_TWO_PG_BACKENDS"
        signatures={
            "create":"public.community_create_ddv_profile_workspace_v1(uuid,text)",
            "update":"public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)",
            "associate":"public.community_associate_ddv_identity_v1(uuid,uuid,text)",
            "unlink":"public.community_unlink_ddv_identity_v1(uuid,uuid)",
        }
        for op,sig in signatures.items():
            roles={role:bool(scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",
                                     (role,sig)))
                    for role in ("anon","authenticated","service_role")}
            assert roles=={"anon":False,"authenticated":False,"service_role":False},(op,roles)
            mark("SOURCE159_WORKSPACE_ACL_"+op.upper(),{
                "roles":roles,"effectiveServiceRoleExecute":False})
        assert not bool(scalar(pre,"select has_function_privilege('service_role',"
                   "'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)',"
                   "'EXECUTE')"))
        assert not bool(scalar(pre,"select has_function_privilege('service_role',"
                   "'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE')"))
        assert bool(scalar(pre,"select has_function_privilege('service_role',"
                   "'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)',"
                   "'EXECUTE')"))
        assert bool(scalar(pre,"select has_function_privilege('service_role',"
                   "'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)',"
                   "'EXECUTE')"))
        assert bool(scalar(pre,"select has_function_privilege('service_role',"
                   "'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE')"))
        # Fabricated eligible target rows only, because the old RPCs are
        # deliberately disabled even for otherwise-authorized fresh users.
        w_update,w_associate,w_unlink=uuid.uuid4(),uuid.uuid4(),uuid.uuid4()
        with writer.transaction():
            for slot,work in enumerate((w_update,w_associate,w_unlink),1):
                writer.execute("""insert into public.ddv_profile_workspaces(
                    workspace_id,account_id,slot_index,relationship_kind,display_name,
                    lifecycle_state) values(%s,%s,%s,'self','Before', 'active')""",
                    (work,account,slot))
            writer.execute("""insert into private.ddv_identity_associations(
                workspace_id,account_id,binding_key_hash) values(%s,%s,%s)""",
                (w_unlink,account,"hmac-sha256:v1:"+secrets.token_hex(32)))

        def snapshot():
            return (
                pre.execute("""select workspace_id,slot_index,display_name,
                    lifecycle_state,relationship_kind from public.ddv_profile_workspaces
                    where account_id=%s order by slot_index""",(account,)).fetchall(),
                pre.execute("""select workspace_id,binding_key_hash from
                    private.ddv_identity_associations where account_id=%s
                    order by workspace_id""",(account,)).fetchall(),
                pre.execute("""select action_type,count(*) from public.audit_events
                    where actor_account_id=%s and action_type like 'ddv_profile_workspace.%%'
                    group by action_type order by action_type""",(account,)).fetchall()
            )
        before=snapshot()

        calls={
            "create":("select public.community_create_ddv_profile_workspace_v1(%s,'self')",
                      (actor,),{"relationshipKind":"self"}),
            "update":("select public.community_update_ddv_profile_workspace_v1(%s,%s,%s,'archived')",
                      (actor,w_update,"Unauthorized Update"),
                      {"workspaceId":str(w_update),"displayName":"Unauthorized Update","lifecycleState":"archived"}),
            "associate":("select public.community_associate_ddv_identity_v1(%s,%s,%s)",
                      (actor,w_associate,"hmac-sha256:v1:"+secrets.token_hex(32)),
                      {"workspaceId":str(w_associate),"bindingKeyHash":"hmac-sha256:v1:"+secrets.token_hex(32)}),
            "unlink":("select public.community_unlink_ddv_identity_v1(%s,%s)",
                      (actor,w_unlink),{"workspaceId":str(w_unlink)})
        }

        def direct(op,role):
            sql,args,_=calls[op]
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    scalar(writer,sql,args)
                return "UNEXPECTED_SUCCESS"
            except psycopg.Error as ex:
                return str(ex.sqlstate or "UNKNOWN")

        def edge(token,op):
            _,_,payload=calls[op]
            return req("/functions/v1/community-command",{
                "command":{
                    "create":"createDdvProfileWorkspace",
                    "update":"updateDdvProfileWorkspace",
                    "associate":"associateDdvIdentity",
                    "unlink":"unlinkDdvIdentity"
                }[op],
                "payload":payload
            },token=token)

        # Valid A2 has real signed claims but NO permitted Workspace old Writer.
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        for op in calls:
            status,ret=edge(a2,op)
            assert status==409 and ret.get("error")=="SOURCE159_WORKSPACE_WRITER_NOT_ENROLLED",(op,status,ret)
            for role in ("anon","authenticated","service_role"):
                assert direct(op,role)=="42501",("SOURCE159_DIRECT_ROLE_FAILED",op,role)
        assert snapshot()==before,"SOURCE159_LIVE_A2_DB_DIFF"
        mark("SOURCE159_WORKSPACE_LIVE_A2_ALL_EDGE409_ALL_THREE_ROLE_SQL42501_NO_DIFF",{
            "signedA2":True,"fourOldOperationsDisabled":True,
            "threeRolesDenied":True,"dbUnchanged":True})

        # Source154 separate terminal Local revoke, true original+refreshed JWT401
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,"A1_ORIGINAL_MUST_401"
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,"A2_SIBLING_MUST_200"
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        assert claims(refresh["access_token"],1)["session_id"]==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=refresh["access_token"])
        assert status==401,"A1_REFRESHED_MUST_401"
        for token in (a1,refresh["access_token"]):
            for op in calls:
                status,ret=edge(token,op)
                assert status==401,("REVOKED_EDGE_MUST_401",op,status)
        # Two real PG backends, multiple replays all denied in the *actual SQL*
        for op in calls:
            for _ in range(2):
                assert direct(op,"service_role")=="42501",("REVOKED_SERVICE_EXEC_UNEXPECTED",op)
        assert snapshot()==before,"SOURCE159_REVOKED_A1_DB_DIFF"
        mark("SOURCE159_WORKSPACE_REVOKED_A1_OLD_REFRESHED_401_TWO_PG_REPLAY_SQL42501_NO_DIFF",{
            "genuineOldAndRefresh401":True,"siblingA2Http200":True,
            "twoActualDatabaseBackends":True,"allFourReplaysDenied":True,
            "workspaceIdentityAuditUnchanged":True})
        # Rollback-only temporary local privilege demonstration (no execution).
        pre.execute("begin")
        try:
            for sig in signatures.values():
                pre.execute("grant execute on function "+sig+" to service_role")
                assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        finally:
            pre.execute("rollback")
        for sig in signatures.values():
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",
                              (sig,)),"TEMP_GRANT_LEAKED_AFTER_ROLLBACK"
        assert snapshot()==before
        mark("SOURCE159_WORKSPACE_ALL_FOUR_TEMP_GRANT_ROLLBACK_REMAIN_OFF",{
            "allFourServiceRoleGrantsReverted":True,
            "noWorkspaceIdentityAuditChange":True})
        mark("SOURCE159_WORKSPACE_SIGNED_LOCAL_OFF_COMPLETE",{
            "source154_158Immutable":True,"genuineES256":True,
            "productWriterEnabled":False,"providerUsed":False,
            "classification":"OWNER_GENUINE_SIGNED_LOCAL_OFF_NOT_INDEPENDENT_QA"})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
