#!/usr/bin/env python3
"""03 COMM W-COMM-006: Source161 genuine signed Gallery Draft/Work OFF gate.
PR413 already established isolated FULL160 direct service-role post-revoke
SQL COMMIT for precisely two draft creation RPCs (no public publication).
Fresh FULL161 signed A2 Edge409, revoked A1 old/refreshed401, 3-role
direct SQL42501/no DB diff/replay, temp GRANT rollback in two real PGs.
Parent Gallery Photo SECURITY DEFINER may internally invoke Work creation;
that transitive pathway remains separately UNVERIFIED/NOT_CLOSED.
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
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==161
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        signatures={
         "createGalleryDraft":"public.community_create_gallery_draft(uuid,uuid,text,text,text)",
         "createGalleryWork":"public.community_create_gallery_work_v1(uuid,uuid,text,text)"
        }
        for op,sig in signatures.items():
            perms={r:bool(scalar(pre,"select has_function_privilege(%s,%s,'EXECUTE')",(r,sig)))
                   for r in ("anon","authenticated","service_role")}
            assert perms=={"anon":False,"authenticated":False,"service_role":False},(op,perms)
            mark("SOURCE161_GALLERY_ACL_"+op.upper(),{"roles":perms})
        protected=[
          "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
          "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
          "public.community_get_ddv_profile_workspaces_v1(uuid)"
        ]
        for sig in protected:
            assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        for sig in [
          "public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)",
          "public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)",
          "public.community_create_ddv_profile_workspace_v1(uuid,text)",
          "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
          "public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)"
        ]:
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        # An internal SECURITY DEFINER parent is NOT assumed denied; this
        # test checks ONLY the two external RPC signatures and Edge guards.

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

        def direct(op,role,key):
            if op=="createGalleryDraft":
                sql="select public.community_create_gallery_draft(%s,%s,'private','outdoor',%s)"
            elif op=="createGalleryWork":
                sql="select public.community_create_gallery_work_v1(%s,%s,'outdoor',%s)"
            else:raise AssertionError("UNSUPPORTED")
            try:
                with writer.transaction():
                    writer.execute("set local role "+role)
                    scalar(writer,sql,(actor,creator,key))
                return "UNEXPECTED_COMMIT"
            except psycopg.Error as e:
                return str(e.sqlstate or "UNKNOWN")

        def edge(token,op):
            return req("/functions/v1/community-command",{"command":op,
                "payload":{"creatorProfileId":str(creator),"visibility":"private",
                   "galleryKind":"outdoor",
                   "idempotencyKey":"source161-edge-"+op+"-"+secrets.token_hex(7)}},
                token=token)

        baseline=snapshot()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        for op in signatures:
            status,result=edge(a2,op)
            assert status==409 and result.get("error")=="SOURCE161_GALLERY_DRAFT_WRITER_NOT_ENROLLED",(op,status,result)
            for role in ("anon","authenticated","service_role"):
                sqlstate=direct(op,role,"source161-direct-"+op+"-"+role+"-"+secrets.token_hex(8))
                assert sqlstate=="42501",(op,role,sqlstate)
        assert snapshot()==baseline,"SOURCE161_SIGNED_A2_WRITER_MUTATION"
        mark("SOURCE161_GALLERY_A2_BOTH_EDGE409_THREE_ROLES_SQL42501_NO_DIFF",{
          "genuineGoTrueA2":True,"allRolesDenied":True,
          "draftWorkEntityGalleryOutboxIdempotencyUnchanged":True,
          "noSearchOrPublicPublish":True})

        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)
        assert status==401,("ORIGINAL_A1_NOT401",status)
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)
        assert status==200,("LIVE_A2_NOT200",status)
        status,ref=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh1})
        assert status==200 and ref.get("access_token")
        assert claims(ref["access_token"],1).get("session_id")==str(c1[2])
        status,_=req("/functions/v1/community-query",{"query":"me","payload":{}},
                     token=ref["access_token"])
        assert status==401,"REFRESHED_A1_NOT401"
        for token in (a1,ref["access_token"]):
            for op in signatures:
                status,_=edge(token,op)
                assert status==401,("SOURCE161_REVOKED_EDGE_WRITER_NOT_401",op,status)
        for op in signatures:
            for attempt in range(3):
                state=direct(op,"service_role","source161-replay-"+op+str(attempt)+secrets.token_hex(6))
                assert state=="42501",(op,state)
        assert snapshot()==baseline,"SOURCE161_REVOKED_SQL_MUTATION"
        mark("SOURCE161_GALLERY_A1_REVOKED_OLD_REFRESH401_TWO_PG_REPLAY42501_DB_UNCHANGED",{
          "oldAndTrueRefreshedSameSessionA1Http401":True,
          "liveSiblingA2Http200":True,"separatePostgresConnections":True,
          "allReplaySQLDenied":True,"draftWorkOutboxIdempotencyUnchanged":True})

        # Temp role grant stays inside one uncommitted local transaction;
        # even that grant must not leak to independent writer connection.
        pre.execute("begin")
        try:
            for sig in signatures.values():
                pre.execute("grant execute on function "+sig+" to service_role")
                assert scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
                assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        finally:
            pre.execute("rollback")
        for sig in signatures.values():
            assert not scalar(pre,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
            assert not scalar(writer,"select has_function_privilege('service_role',%s,'EXECUTE')",(sig,))
        assert snapshot()==baseline
        mark("SOURCE161_GALLERY_TEMP_GRANT_ROLLBACK_BOTH_RPC_OFF",{
          "twoRoleGrantsRolledBack":True,"notVisibleOtherPostgresBackend":True,
          "noWorkOrIdempotencyWrites":True})
        mark("SOURCE161_GALLERY_SIGNED_LOCAL_DIRECT_RPC_OFF_OWNER_COMPLETE",{
          "source154_160SQLImmutable":True,"productPublicWriterProviderFlagsOff":True,
          "independentQA":"NOT_RUN","photoParentTransitiveRisk":"UNVERIFIED"})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
