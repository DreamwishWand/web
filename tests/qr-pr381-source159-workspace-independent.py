#!/usr/bin/env python3
"""Independent 04 QR W-QR-029: Source159 four workspace legacy SQL Writers OFF.
Disposable GoTrue ES256 + FULL159 2PG, no managed/stage/Provider, no real users.
Source PR381 code, migrations, prior accepted QA PR360/365 are immutable.
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

assert os.environ.get("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert all(not os.environ.get(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
API="http://127.0.0.1:54321"
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
env={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k,v=line.split("=",1);env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")

def http(path,body=None,token=None,service=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
    headers={"apikey":key,"Accept":"application/json"}
    if service:headers["Authorization"]="Bearer "+key
    elif token:headers["Authorization"]="Bearer "+token
    if body is not None:headers["Content-Type"]="application/json"
    req=urllib.request.Request(API+path,headers=headers,method=method,
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=45) as r:
            return r.status,json.loads(r.read(90000) or b"null")
    except urllib.error.HTTPError as ex:
        raw=ex.read(90000)
        try:obj=json.loads(raw)
        except Exception:obj={}
        return ex.code,obj

def jwt(token,index=1):
    segment=token.split(".")[index]
    return json.loads(base64.urlsafe_b64decode(segment+"="*(-len(segment)%4)))

def q(conn,sql,args=()):
    return conn.execute(sql,args).fetchone()[0]

def marker(name):
    print("QR_159_"+name+"_PASS",flush=True)

S={
 "create":"public.community_create_ddv_profile_workspace_v1(uuid,text)",
 "update":"public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)",
 "associate":"public.community_associate_ddv_identity_v1(uuid,uuid,text)",
 "unlink":"public.community_unlink_ddv_identity_v1(uuid,uuid)"
}
allow={
 "list":"public.community_get_ddv_profile_workspaces_v1(uuid)",
 "delete":"public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
 "r16":"public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)"
}
deny={
 "v2":"public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)",
 "r15":"public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)"
}
actor=None
try:
    email="qr159-"+secrets.token_hex(7)+"@example.invalid"
    password=secrets.token_urlsafe(23)+"A1!"
    status,user=http("/auth/v1/admin/users",{"email":email,"password":password,"email_confirm":True},service=True)
    assert status in (200,201) and user.get("id"),"DISPOSABLE_ACCOUNT_UNAVAILABLE"
    actor=uuid.UUID(user["id"])

    def signin():
        s,d=http("/auth/v1/token?grant_type=password",{"email":email,"password":password})
        assert s==200 and d.get("access_token") and d.get("refresh_token")
        t=d["access_token"];header=jwt(t,0);claim=jwt(t)
        assert header["alg"]=="ES256" and claim["sub"]==str(actor) and claim.get("session_id")
        return t,d["refresh_token"],(actor,int(claim["iat"]),uuid.UUID(claim["session_id"]))
    a1,refresh1,c1=signin()
    a2,_,c2=signin()
    assert c1[2]!=c2[2]
    st,bootstrap=http("/functions/v1/community-command",{
      "command":"ensureAccountCreator",
      "payload":{"handle":"qr159_"+secrets.token_hex(5),"displayName":"Independent Source159 QA"}
    },token=a2)
    assert st==200 and bootstrap.get("ok") is True
    account=uuid.UUID(bootstrap["data"]["accountId"])

    with closing(psycopg.connect(DSN,autocommit=True)) as revoker,closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert q(revoker,"select count(*) from supabase_migrations.schema_migrations")==159
        assert q(revoker,"select pg_backend_pid()")!=q(writer,"select pg_backend_pid()")
        for op,sig in S.items():
            for role in ("anon","authenticated","service_role"):
                assert q(revoker,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)) is False,(op,role)
        for sig in allow.values():
            assert q(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is True,sig
        for sig in deny.values():
            assert q(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)) is False,sig
        marker("FOUR_RPC_THREE_ROLE_ACL_SIGNED_DELETE_READ_R16_PRESERVED")

        ws_update,ws_assoc,ws_unlink=[uuid.uuid4() for _ in range(3)]
        with writer.transaction():
            for n,w in enumerate((ws_update,ws_assoc,ws_unlink),1):
                writer.execute("""insert into public.ddv_profile_workspaces
                   (workspace_id,account_id,slot_index,relationship_kind,display_name,lifecycle_state)
                   values (%s,%s,%s,'self','Snapshot','active')""",(w,account,n))
            writer.execute("""insert into private.ddv_identity_associations
                  (workspace_id,account_id,binding_key_hash) values(%s,%s,%s)""",
                  (ws_unlink,account,"hmac-sha256:v1:"+secrets.token_hex(32)))
        def snap():
            return (
                revoker.execute("""select workspace_id,slot_index,display_name,lifecycle_state,relationship_kind
                   from public.ddv_profile_workspaces where account_id=%s order by slot_index""",(account,)).fetchall(),
                revoker.execute("""select workspace_id,binding_key_hash
                   from private.ddv_identity_associations where account_id=%s order by workspace_id""",(account,)).fetchall(),
                revoker.execute("""select action_type,count(*) from public.audit_events
                   where actor_account_id=%s group by action_type order by action_type""",(account,)).fetchall(),
                revoker.execute("""select 'work',count(*) from public.community_works
                   union all select 'search',count(*) from public.search_documents
                   union all select 'outbox',count(*) from public.outbox_events
                   union all select 'idempotency',count(*) from public.idempotency_keys
                   order by 1""").fetchall()
            )
        before=snap()
        calls={
          "create":("select public.community_create_ddv_profile_workspace_v1(%s,'self')",(actor,),{"relationshipKind":"self"},"createDdvProfileWorkspace"),
          "update":("select public.community_update_ddv_profile_workspace_v1(%s,%s,%s,'archived')",(actor,ws_update,"Should Not Commit"),{"workspaceId":str(ws_update),"displayName":"Should Not Commit","lifecycleState":"archived"},"updateDdvProfileWorkspace"),
          "associate":("select public.community_associate_ddv_identity_v1(%s,%s,%s)",(actor,ws_assoc,"hmac-sha256:v1:"+secrets.token_hex(32)),{"workspaceId":str(ws_assoc),"bindingKeyHash":"hmac-sha256:v1:"+secrets.token_hex(32)},"associateDdvIdentity"),
          "unlink":("select public.community_unlink_ddv_identity_v1(%s,%s)",(actor,ws_unlink),{"workspaceId":str(ws_unlink)},"unlinkDdvIdentity")
        }
        def direct(operation,role="service_role"):
            sql,args,_,_=calls[operation]
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    writer.execute(sql,args).fetchone()
            except psycopg.Error as err:
                assert err.sqlstate=="42501",(operation,role,err.sqlstate)
                return
            raise AssertionError("UNEXPECTED_LEGACY_SQL_COMMITTED_"+operation+"_"+role)
        def edge(token,operation):
            _,_,payload,command=calls[operation]
            return http("/functions/v1/community-command",{"command":command,"payload":payload},token=token)
        # Signed A2 is ACTIVE. Only legacy RPC must 409; no SQL side-effect.
        q(revoker,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        for operation in calls:
            status,response=edge(a2,operation)
            assert status==409 and response.get("error")=="SOURCE159_WORKSPACE_WRITER_NOT_ENROLLED",(operation,status)
            for role in ("anon","authenticated","service_role"):
                direct(operation,role)
        assert snap()==before
        marker("A2_FOUR_EDGE409_TWELVE_SQL42501_DB_SNAPSHOT_UNCHANGED")

        # A1 true session preflight, independent connection revocation, then old+refreshed JWT deny.
        q(revoker,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        q(revoker,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)[0]==401
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)[0]==200
        status,refresh=http("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        new1=refresh["access_token"]
        assert jwt(new1)["session_id"]==str(c1[2])
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=new1)[0]==401
        for token in (a1,new1):
            for operation in calls:
                assert edge(token,operation)[0]==401
        for operation in calls:
            for replay in range(2):
                direct(operation)
        assert snap()==before
        marker("REVOKED_A1_OLD_REFRESHED_401_SIBLING_200_TWO_PG_REPLAY_DB_UNCHANGED")

        # Temporary revoker connection grants are never visible to separate writer connection.
        with revoker.transaction(force_rollback=True):
            for signature in S.values():
                revoker.execute("grant execute on function "+signature+" to service_role")
                assert q(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,)) is True
                assert q(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,)) is False
        for signature in S.values():
            assert q(revoker,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,)) is False
        for operation in calls:direct(operation)
        assert snap()==before
        marker("TWO_PG_GRANT_ROLLBACK_FOUR_WRITERS_STILL_OFF")
        marker("INDEPENDENT_ES256_FULL159_SOURCE_ONLY_TARGETED")
finally:
    if actor:
        try:http("/auth/v1/admin/users/"+str(actor),service=True,method="DELETE")
        except Exception:pass
