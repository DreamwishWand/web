#!/usr/bin/env python3
"""03 COMM W-COMM-006: genuine GoTrue ES256 Help Question/Tip Writer probe.
Only fully disposable Source158 fixture, no Provider, no real users or media.
A1/A2 genuine signed and independent two PostgreSQL backends, positive
legacy service_role SQL, then revoked A1 direct SQL with exact persisted diffs.
Never infer public-client exploit from privileged direct SQL capability.
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
    e="comm-helpqa-"+secrets.token_hex(7)+"@example.invalid"
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
        "handle":"qa_"+secrets.token_hex(7),"displayName":"Help QA isolated owner"}},token=a1)
    assert st==200 and boot.get("ok"),"A0_REAL_SIGNED_BOOTSTRAP_FAILED"
    data=boot["data"]
    account=uuid.UUID(data["accountId"])
    creator=uuid.UUID(data["creatorProfileId"])


    with closing(psycopg.connect(DSN,autocommit=True)) as pre, \
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==158
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signatures={
            "askQuestion":"public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
            "createTip":"public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)"
        }
        for op,sig in signatures.items():
            privileges={role:bool(scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)))
                 for role in ("anon","authenticated","service_role")}
            assert privileges=={"anon":False,"authenticated":False,"service_role":True},(op,privileges)
            proc=pre.execute("select p.prosecdef,p.prosrc from pg_proc p where p.oid=to_regprocedure(%s)",(sig,)).fetchone()
            assert proc and proc[0] and "community_authorize_signed_session_v2" not in proc[1]
            mark("HELP_QA_LEGACY_CATALOG_"+op.upper(),{"privileges":privileges,
                "inTxnSignedSession":False,"eligibleSourceBody":True})

        def snapshot():
            return pre.execute("""select
              (select count(*) from public.community_works where owner_account_id=%s and work_type in ('question','tip')),
              (select count(*) from public.community_work_revisions r join public.community_works w on w.work_id=r.work_id
                where w.owner_account_id=%s and w.work_type in ('question','tip')),
              (select count(*) from public.search_documents s join public.community_works w on w.work_id=s.work_id
                where w.owner_account_id=%s and w.work_type in ('question','tip')),
              (select count(*) from public.outbox_events o join public.community_works w on w.work_id=o.aggregate_id
                where w.owner_account_id=%s and w.work_type in ('question','tip')),
              (select count(*) from public.idempotency_keys where account_id=%s
                and command_name in ('ask_question_v1','create_tip_v1')),
              (select count(*) from public.qa_question_state qs join public.community_works w on w.work_id=qs.work_id
                where w.owner_account_id=%s),
              (select count(*) from public.qa_tip_state ts join public.community_works w on w.work_id=ts.work_id
                where w.owner_account_id=%s)
            """,(account,)*7).fetchone()

        def write(op,key):
            if op=="askQuestion":
                sql="""select public.community_ask_question_v1(
                  %s,%s,'Signed Help Question','Disposable source-tagged question',
                  ARRAY['gameplay','help'],NULL,NULL,%s)"""
            elif op=="createTip":
                sql="""select public.community_create_tip_v1(
                  %s,%s,'Signed Help Tip','Disposable source-tagged tip',
                  ARRAY['gameplay','help'],NULL,NULL,NULL,NULL,%s)"""
            else: raise AssertionError("OP_NOT_ALLOWED")
            try:
                with writer.transaction():
                    writer.execute("set local role service_role")
                    result=scalar(writer,sql,(actor,creator,key))
                return "COMMITTED",result
            except psycopg.Error as exc:
                return "REJECTED",str(exc.sqlstate or "UNKNOWN")

        # Genuine A2 controls must first prove a valid eligible creator / full
        # idempotency + publication and Search/Outbox graph, not a blocked input.
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        initial=snapshot()
        for op in signatures:
            status,result=write(op,"help-positive-"+op+"-"+secrets.token_hex(7))
            assert status=="COMMITTED" and isinstance(result,dict),(op,status,result)
            after=snapshot()
            assert after[0]==initial[0]+1 and after[1]==initial[1]+1
            assert after[2]==initial[2]+1 and after[3]==initial[3]+1
            assert after[4]==initial[4]+1
            if op=="askQuestion":assert after[5]==initial[5]+1
            else:assert after[6]==initial[6]+1
            initial=after
        mark("HELP_QA_GENUINE_A2_ELIGIBLE_BOTH_WRITERS_COMMIT",{
            "creatorOwnerValid":True,"bothWorkRevisionSearchOutboxIdemPublished":True})

        # A1 genuine signed v2 preflight succeeds and separately terminally
        # revokes. Old/refreshed JWT denied, live sibling A2 remains authorized.
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("ORIGINAL_REVOKED_A1_NOT_401",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("A2_SIBLING_NOT_200",status)
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token"),("REFRESH_NOT_200",status)
        assert claims(refresh["access_token"],1).get("session_id")==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},
                    token=refresh["access_token"])
        assert status==401,("REAL_REFRESHED_A1_NOT_401",status)
        mark("HELP_QA_REAL_A1_OLD_AND_REFRESHED_REVOKED401",{
            "old401":True,"refreshedSameSession401":True,"siblingA2Http200":True,
            "twoDifferentDatabaseBackends":True})

        # A direct service-role RPC call deliberately bypasses public HTTP.
        # Classify strictly as POST-PREFLIGHT SQL reachability if it commits.
        for op in signatures:
            before=snapshot()
            status,result=write(op,"help-postrevoked-"+op+"-"+secrets.token_hex(7))
            after=snapshot()
            changed=all(after[i]==before[i]+1 for i in (0,1,2,3,4))
            if op=="askQuestion":changed=changed and after[5]==before[5]+1
            else:changed=changed and after[6]==before[6]+1
            mark("HELP_QA_POST_REVOKE_"+op.upper(),{
                "status":status,"workRevisionSearchOutboxIdemMutation":changed,
                "firstPreflightSignedV2":True,"revokedA1RealRefresh401":True,
                "clientHttpExploitObserved":False})
            assert status=="COMMITTED" and changed,("POSTREVOKE_LEGACY_WRITE_NOT_REPRODUCED",op,status,result,before,after)
        mark("HELP_QA_TWO_LEGACY_WRITERS_POSTREVOKE_DISPOSABLE_SQL_RED",{
            "classification":"CONFIRMED_DISPOSABLE_SQL_SEPARATE_PREFLIGHT_TRUE_RED",
            "twoGenuineGoTrueSessions":True,"twoRealPostgresBackends":True,
            "workRevisionSearchOutboxIdempotencyMutated":True,
            "notVerifiedPublicHttpExploit":True,"publicAndProviderFlagsOff":True})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
