#!/usr/bin/env python3
"""03 COMM W-COMM-006: Source160 real ES256 old Help Question/Tip OFF.
Source158 positive/revocation PR395 is fixed prior LOCAL SQL RED evidence.
Source160 new forward-only ACL and signed A2 Edge409, A1 revoked401,
2PG SQL42501 no-diff replay, temporary grant rollback. No live public
backend/Provider/real user data or writer enrollment.
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
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==160
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signatures={
            "askQuestion":"public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
            "createTip":"public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)"
        }
        for op,sig in signatures.items():
            roles={role:bool(scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(role,sig)))
                for role in ("anon","authenticated","service_role")}
            assert roles=={"anon":False,"authenticated":False,"service_role":False},(op,roles)
            mark("SOURCE160_HELP_QA_ACL_"+op.upper(),{"roles":roles})
        for protected in [
          "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
          "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
          "public.community_get_ddv_profile_workspaces_v1(uuid)"]:
            assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(protected,))
        for disabled in [
          "public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)",
          "public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)",
          "public.community_create_ddv_profile_workspace_v1(uuid,text)",
          "public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)",
          "public.community_associate_ddv_identity_v1(uuid,uuid,text)",
          "public.community_unlink_ddv_identity_v1(uuid,uuid)"]:
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(disabled,))

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

        calls={
          "askQuestion":("select public.community_ask_question_v1(%s,%s,%s,%s,%s,NULL,NULL,%s)",
            "signed Question", "source160 denied question"),
          "createTip":("select public.community_create_tip_v1(%s,%s,%s,%s,%s,NULL,NULL,NULL,NULL,%s)",
            "signed Tip", "source160 denied tip")
        }
        def direct(op,role):
            sql,title,body=calls[op]
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    scalar(writer,sql,(actor,creator,title,body,["gameplay","help"],
                                       "source160-"+op+"-"+secrets.token_hex(6)))
                return "UNEXPECTED_COMMIT"
            except psycopg.Error as e:
                return str(e.sqlstate or "UNKNOWN")
        def edge(token,op):
            _,title,body=calls[op]
            return req("/functions/v1/community-command",{"command":op,
                "payload":{"creatorProfileId":str(creator),"title":title,"body":body,
                           "contextTags":["gameplay","help"],
                           "idempotencyKey":"source160-"+op+"-"+secrets.token_hex(6)}},
                token=token)

        before=snapshot()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        for op in calls:
            status,result=edge(a2,op)
            assert status==409 and result.get("error")=="SOURCE160_HELP_QA_WRITER_NOT_ENROLLED",(op,status,result)
            for role in ("anon","authenticated","service_role"):
                assert direct(op,role)=="42501",(op,role,"UNEXPECTED_GRANT")
        assert snapshot()==before,"LIVE_A2_QA_WORK_DATA_CHANGED"
        mark("SOURCE160_HELP_QA_A2_BOTH_EDGE409_THREE_ROLE42501_NO_DIFF",{
          "genuineSignedA2":True,"allThreeRolesDenied":True,
          "qaWorkRevisionSearchOutboxIdemUnchanged":True})

        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("ORIGINAL_A1_401",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("SIBLING_A2_200",status)
        status,refresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and refresh.get("access_token")
        assert claims(refresh["access_token"],1).get("session_id")==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},
                     token=refresh["access_token"])
        assert status==401,("REFRESHED_A1_401",status)
        for token in (a1,refresh["access_token"]):
            for op in calls:
                status,_=edge(token,op)
                assert status==401,("SOURCE160_REVOKED_EDGE_NOT_401",op,status)
        for op in calls:
            for _ in range(2):
                assert direct(op,"service_role")=="42501",("REPLAY_NOT_ACL_DENIED",op)
        assert snapshot()==before,"REVOKED_A1_QA_DATA_CHANGED"
        mark("SOURCE160_HELP_QA_A1_OLD_REFRESHED_401_TWO_PG_REPLAY42501_NO_DIFF",{
          "genuineGoTrueA1Original401":True,"refreshedSameSession401":True,
          "liveSiblingA2Http200":True,"twoRealPostgreSQLBackends":True,
          "workRevisionSearchOutboxIdempotencyUnchanged":True})

        # Local transaction-only privilege dry-run, rollback never reopens
        # real service_role after commit. Do not execute these Writers.
        pre.execute("begin")
        try:
            for signature in signatures.values():
                pre.execute("grant execute on function "+signature+" to service_role")
                assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
                assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(signature,))
        finally:
            pre.execute("rollback")
        for signature in signatures.values():
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",
                              (signature,)),"HELP_QA_TEMP_GRANT_LEAKED"
            assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",
                              (signature,)),"HELP_QA_OTHER_BACKEND_GRANT_LEAKED"
        assert snapshot()==before,"SOURCE160_ROLLBACK_CREATED_ROWS"
        mark("SOURCE160_HELP_QA_ROLLBACK_BOTH_RPC_STILL_OFF",{
          "temporaryGrantsNotVisibleToOtherPg":True,
          "bothRestoredOff":True,"noQaDbDiff":True})
        mark("SOURCE160_HELP_QA_REAL_SIGNED_LOCAL_OFF_OWNER_COMPLETE",{
          "source154_159Immutable":True,"productWriterEnabled":False,
          "providerUsed":False,"independentQa":"NOT_RUN"})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
