#!/usr/bin/env python3
"""03 COMM W-COMM-006: Source160 real signed Gallery draft/create residual probe.
Exactly two previously unaccepted `createGalleryDraft` and `createGalleryWork`
legacy SQL RPCs tested on entirely disposable FULL160. No Gallery publication,
real media, Provider or managed runtime. Direct service-role SQL after signed
A1 revoke does NOT prove client HTTP race or leaked credentials.
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
    e="comm-gallerydraft-"+secrets.token_hex(7)+"@example.invalid"
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
        "handle":"qa_"+secrets.token_hex(7),"displayName":"Gallery Draft isolated owner"}},token=a1)
    assert st==200 and boot.get("ok"),"A0_REAL_SIGNED_BOOTSTRAP_FAILED"
    data=boot["data"]
    account=uuid.UUID(data["accountId"])
    creator=uuid.UUID(data["creatorProfileId"])




    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==160
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signs={
         "createGalleryDraft":"public.community_create_gallery_draft(uuid,uuid,text,text,text)",
         "createGalleryWork":"public.community_create_gallery_work_v1(uuid,uuid,text,text)"
        }
        for op,sig in signs.items():
            perms={role:bool(scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)))
                   for role in ("anon","authenticated","service_role")}
            assert perms=={"anon":False,"authenticated":False,"service_role":True},(op,perms)
            row=pre.execute("select p.prosecdef,p.prosrc from pg_proc p where p.oid=to_regprocedure(%s)",(sig,)).fetchone()
            assert row and row[0] and "community_authorize_signed_session_v2" not in row[1],op
            mark("GALLERY_DRAFT_CATALOG_"+op.upper(),{"roleExecute":perms,
                "signedSameTransaction":False,"source160Unchanged":True})
        for disabled in [
         "public.community_create_ddv_profile_workspace_v1(uuid,text)",
         "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
         "public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)"
        ]:
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(disabled,))
        assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",
               ("public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",))

        def snapshot():
            return pre.execute("""select
              (select count(*) from public.community_works where owner_account_id=%s and work_type='gallery'),
              (select count(*) from public.gallery_works g join public.community_works w on w.work_id=g.work_id
               where w.owner_account_id=%s),
              (select count(*) from public.community_entities e join public.community_works w on w.work_id=e.entity_id
               where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.outbox_events o join public.community_works w on w.work_id=o.aggregate_id
               where w.owner_account_id=%s and w.work_type='gallery'),
              (select count(*) from public.idempotency_keys
               where account_id=%s and command_name in ('create_gallery_draft','create_gallery_work_v1')),
              (select count(*) from public.search_documents s join public.community_works w on w.work_id=s.work_id
               where w.owner_account_id=%s and w.work_type='gallery')
            """,(account,)*6).fetchone()

        def call(op,key,kind="outdoor"):
            if op=="createGalleryDraft":
                query="select public.community_create_gallery_draft(%s,%s,'private',%s,%s)"
            elif op=="createGalleryWork":
                query="select public.community_create_gallery_work_v1(%s,%s,%s,%s)"
            else:raise AssertionError("UNKNOWN_OP")
            try:
                with writer.transaction():
                    writer.execute("set local role service_role")
                    resp=scalar(writer,query,(actor,creator,kind,key))
                return "COMMITTED",resp
            except psycopg.Error as e:
                return "REJECTED",str(e.sqlstate or "UNKNOWN")

        def make(op,phase):
            return call(op,"gcreate-"+phase+"-"+op+"-"+secrets.token_hex(6))

        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        for op in signs:
            before=snapshot()
            status,resp=make(op,"eligible")
            after=snapshot()
            assert status=="COMMITTED" and resp.get("workId"),(op,status,resp)
            assert all(after[i]==before[i]+1 for i in range(5)),(op,before,after)
            assert after[5]==before[5],"Draft must not appear in public Search"
            work=pre.execute("select lifecycle_state,visibility,work_type from public.community_works where work_id=%s",
                             (uuid.UUID(resp["workId"]),)).fetchone()
            assert work and work[0]=="draft" and work[2]=="gallery",("NOT_DRAFT_GALLERY",work)
            # Valid fresh request duplicate idempotency key should return same receipt
            # and MUST NOT duplicate Work/Outbox rows.
            key="gcreate-idem-"+op+"-"+secrets.token_hex(6)
            status,first=call(op,key)
            assert status=="COMMITTED", (op,status,first)
            snap=snapshot()
            status,repeat=call(op,key)
            assert status=="COMMITTED" and repeat==first and snapshot()==snap,("IDEMPOTENCY_REPLAY_FAIL",op)
            status,_=call(op,key,kind="indoor")
            assert status=="REJECTED" and snapshot()==snap,("CAS_IDEMPOTENCY_CONFLICT_NOT_DENIED",op,status)
        mark("GALLERY_DRAFT_GENUINE_SIGNED_A2_BOTH_ELIGIBLE_POSITIVE_IDEM_REPLAY_PASS",{
           "bothWorkDraftAndGalleryRowsCommitted":True,"privateMediaExcluded":True,
           "idempotencySameKeyExactlyOnce":True,"differentInputSameKeyRejected":True})

        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,"A1_OLD_REVOKED_401"
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,"A2_LIVE_200"
        status,tok=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and tok.get("access_token")
        assert claims(tok["access_token"],1).get("session_id")==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=tok["access_token"])
        assert status==401,"A1_REFRESHED_REVOKED_401"
        mark("GALLERY_DRAFT_A1_LOCAL_REVOKED_OLD_REFRESH401_A2_200",{
           "realGoTrueES256":True,"signedValidPreflightThenSeparateRevokeCommit":True,
           "originalAndRealRefreshedA1Denied401":True,"healthyA2Http200":True,
           "twoRealPostgresBackends":True})

        # Intentional second-PG direct service-role call after revoked A1.
        # Not a public HTTP exploit nor actual in-flight Edge race proof.
        for op in signs:
            before=snapshot()
            status,resp=make(op,"postrevoke")
            after=snapshot()
            mut=all(after[i]==before[i]+1 for i in range(5)) and after[5]==before[5]
            mark("GALLERY_DRAFT_POST_REVOKE_"+op.upper(),{
             "directSQLState":status,"workGalleryEntityOutboxIdempotencyMutated":mut,
             "workPubliclyPublished":False,"sourceWriterOperation":"draft_creation",
             "signedPreflightSeparateCommittedRevoke":True,
             "verifiedHttpRaceExploit":False})
            assert status=="COMMITTED" and mut,("LOCAL_SIGNED_SQL_GAP_NOT_REPRODUCED",op,status,resp,before,after)
        mark("GALLERY_DRAFT_TWO_LEGACY_SQL_POST_REVOKE_COMMIT_LOCAL_RED",{
            "classification":"CONFIRMED_DISPOSABLE_SQL_SEPARATE_PREFLIGHT_TRUE_RED",
            "exactOperations":list(signs),
            "postRevokeWritesOnlyDraftWorks":True,
            "providerOrMediaAccess":False,"publicHttpExploitProved":False})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
