#!/usr/bin/env python3
"""W-COMM-006 / post Source162: genuine signed disposable Preset envelope authority PROBE.
TEST ONLY. No SQL/Edge/Provider mutations outside ephemeral local Supabase.
Positive must COMMIT before any finding is accepted; absence of fixture is NOT_RUN.
A signed preflight plus a separate privileged SQL transaction is NOT a user HTTP exploit.
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
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ENV={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        key,value=line.split("=",1)
        ENV[key.strip()]=value.strip().strip("'\"")
assert ENV.get("ANON_KEY") and ENV.get("SERVICE_ROLE_KEY")
def req(path,body=None,token=None,service=False,method="POST"):
    key=ENV["SERVICE_ROLE_KEY"] if service else ENV["ANON_KEY"]
    headers={"apikey":key,"Accept":"application/json"}
    if service: headers["Authorization"]="Bearer "+key
    elif token: headers["Authorization"]="Bearer "+token
    if body is not None: headers["Content-Type"]="application/json"
    request=urllib.request.Request(API+path,headers=headers,method=method,
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(request,timeout=35) as response:
            return response.status,json.loads(response.read(100000) or b"null")
    except urllib.error.HTTPError as error:
        try: result=json.loads(error.read(100000) or b"{}")
        except Exception: result={}
        return error.code,result
def claims(jwt,part=1):
    body=jwt.split(".")[part]
    return json.loads(base64.urlsafe_b64decode(body+"="*(-len(body)%4)))
def scalar(conn,sql,params=()):
    return conn.execute(sql,params).fetchone()[0]
def mark(name,**kwargs):
    print(json.dumps({"case":name,**kwargs},sort_keys=True),flush=True)

actor=None
try:
    email="comm-preset-probe-"+secrets.token_hex(6)+"@example.invalid"
    password=secrets.token_urlsafe(23)+"A1!"
    status,created=req("/auth/v1/admin/users",
       {"email":email,"password":password,"email_confirm":True},service=True)
    assert status in (200,201) and created.get("id"),"DISPOSABLE_USER_CREATE_FAILED"
    actor=uuid.UUID(created["id"])
    def login():
        status,body=req("/auth/v1/token?grant_type=password",{"email":email,"password":password})
        assert status==200 and body.get("access_token"),"REAL_GOTRUE_LOGIN_FAILED"
        jwt=body["access_token"]; header=claims(jwt,0); payload=claims(jwt)
        assert header.get("alg")=="ES256" and payload["sub"]==str(actor)
        assert payload.get("session_id"),"NO_REAL_SESSION_ID"
        return jwt,(actor,int(payload["iat"]),uuid.UUID(payload["session_id"])),body["refresh_token"]
    a1,c1,refresh1=login()
    a2,c2,_=login()
    assert c1[2]!=c2[2]
    status,boot=req("/functions/v1/community-command",
        {"command":"ensureAccountCreator","payload":{
           "handle":"qa_"+secrets.token_hex(7),
           "displayName":"Synthetic Local Preset Authority Probe"}},token=a1)
    assert status==200 and boot.get("ok"),"REAL_SIGNED_A0_BOOTSTRAP_FAILED"
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])

    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==162
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signature=("public.community_publish_preset_envelope("
           "uuid,uuid,text,text,text,text,text,integer,text,bigint,text,jsonb,text)")
        roles={role:scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,signature))
               for role in ("anon","authenticated","service_role")}
        function_body=scalar(pre,"select pg_get_functiondef(to_regprocedure(%s))",(signature,))
        assert "security definer" in function_body.lower()
        assert "community_authorize_signed_session_v2" not in function_body
        mark("PRESET_ENVELOPE_EFFECTIVE_SQL_SOURCE",
             threeRoleExecute=roles,securityDefiner=True,
             inTransactionSignedV2=False,disposableLocal=True)

        def snapshot():
            return pre.execute("""select
              (select count(*) from public.community_works where owner_account_id=%s and work_type='preset'),
              (select count(*) from public.artifact_blobs where owner_account_id=%s),
              (select count(*) from public.preset_artifacts where owner_account_id=%s),
              (select count(*) from public.preset_revisions r join public.preset_artifacts p on p.preset_artifact_id=r.preset_artifact_id where p.owner_account_id=%s),
              (select count(*) from public.community_work_revisions r join public.community_works w
                  on r.work_id=w.work_id where w.owner_account_id=%s and w.work_type='preset'),
              (select count(*) from public.search_documents d join public.community_works w
                  on d.work_id=w.work_id where w.owner_account_id=%s and w.work_type='preset'),
              (select count(*) from public.outbox_events o join public.community_works w
                  on o.aggregate_id=w.work_id where w.owner_account_id=%s and w.work_type='preset'),
              (select count(*) from public.idempotency_keys where account_id=%s
                  and command_name='publish_preset_envelope')
            """,(account,)*8).fetchone()

        assert "R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED" in function_body
        mark("PRESET_ENVELOPE_EFFECTIVE_R18_GUARD",
             historicalServiceRoleExecuteTrue=roles["service_role"],
             effectiveFunctionUnconditionallyFailsClosed=True)
        def direct(tag,role):
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    scalar(writer,"""select public.community_publish_preset_envelope(
                        %s,%s,'public','scene','Synthetic disposable preset','No physical Provider bytes',
                        %s,1,'application/json',100,%s,'{}'::jsonb,%s)""",
                        (actor,creator,"local/no-provider/preset-probe/"+tag,"a"*64,tag))
                return "UNEXPECTED_COMMIT",""
            except psycopg.Error as exc:
                return str(exc.sqlstate or "UNKNOWN"),str(exc.diag.message_primary or "")
        before=snapshot()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200
        for role in ("anon","authenticated"):
            code,_=direct("before-"+secrets.token_hex(6),role)
            assert code=="42501",(role,code)
        code,msg=direct("valid-a2-"+secrets.token_hex(6),"service_role")
        assert code=="P0001" and "R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED" in msg,(code,msg)
        assert snapshot()==before
        mark("PRESET_ENVELOPE_VALID_A2_DIRECT_SQL_FAILCLOSED_NO_DIFF",
             realGoTrueES256=True,externalAnonAuthenticatedDenied=True,
             serviceRoleLegacyFunctionInert=True,workGraphUnchanged=True)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("ORIGINAL_A1_NOT_REVOKED",status)
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        refreshed=refresh["access_token"]
        assert claims(refreshed)["session_id"]==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=refreshed)
        assert status==401,("REFRESHED_A1_NOT_REVOKED",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("SIBLING_A2_NOT_HEALTHY",status)
        for _ in range(2):
            code,msg=direct("revoked-"+secrets.token_hex(6),"service_role")
            assert code=="P0001" and "R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED" in msg,(code,msg)
        assert snapshot()==before,"POST_REVOKE_PRESET_GRAPH_CHANGED"
        mark("PRESET_ENVELOPE_POSTREVOKE_R18_FAILCLOSED_TWO_PG_NO_DIFF",
             realGoTrueSignedA1Original401=True,realRefreshSameSession401=True,
             healthySiblingA2Http200=True,distinctPgBackends=True,
             serviceRoleStillDeniedByFunction=True,workBlobSearchOutboxIdemNoDiff=True,
             actualPublicHttpExploitProven=False,providerBytesUsed=False)

finally:
    if actor is not None:
        try: req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception: pass
