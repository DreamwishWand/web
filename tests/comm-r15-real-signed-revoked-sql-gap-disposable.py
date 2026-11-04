#!/usr/bin/env python3
"""Source158 R15 Gallery real issuer + disposable EXECUTE OFF verification.

This is a scoped AUTHORIZATION PROBE, not a release acceptance. It deliberately
stages an authorized service_role SQL writer *after a separately committed
signed preflight* and a verified Source154 local session revocation, matching
the Edge preflight-to-service RPC transaction gap. A direct service_role SQL
call is not a client-visible exploit; label the result precisely.
No provider, actual media bytes, stage, or production user is contacted.
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
    e="comm-r15-"+secrets.token_hex(7)+"@example.invalid"
    pw=secrets.token_urlsafe(25)+"A1!"
    st,u=req("/auth/v1/admin/users",{"email":e,"password":pw,"email_confirm":True},service=True)
    assert st in (200,201) and u.get("id"),"LOCAL_CREATE_USER_FAILED"
    actor=uuid.UUID(u["id"])
    def login():
        s,x=req("/auth/v1/token?grant_type=password",{"email":e,"password":pw})
        assert s==200 and x.get("access_token")
        jwt=x["access_token"];head=claims(jwt,0);cl=claims(jwt,1)
        assert head.get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
        return jwt,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"]))
    a1,c1=login()
    a2,c2=login()
    assert c1[2]!=c2[2]
    st,boot=req("/functions/v1/community-command",{"command":"ensureAccountCreator","payload":{
        "handle":"r15_"+secrets.token_hex(7),"displayName":"R15 disposable owner"}},token=a1)
    assert st==200 and boot.get("ok"),"A0_REAL_SIGNED_BOOTSTRAP_FAILED"
    data=boot["data"]
    account=uuid.UUID(data["accountId"])
    creator=uuid.UUID(data["creatorProfileId"])
    with closing(psycopg.connect(DSN,autocommit=True)) as pre,\
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert scalar(pre,"select count(*) from supabase_migrations.schema_migrations")==161
        assert scalar(pre,"select pg_backend_pid()")!=scalar(writer,"select pg_backend_pid()")
        assert not scalar(pre,"select has_function_privilege('service_role',"
            "'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)',"
            "'EXECUTE')"),"SOURCE158_R15_SERVICE_ROLE_GRANT_STILL_ON"
        assert not scalar(pre,"select has_function_privilege('authenticated',"
            "'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)',"
            "'EXECUTE')"),"R15_UNEXPECTED_AUTHENTICATED_GRANT"

        def seed_g():
            g={"work":uuid.uuid4(),"media":uuid.uuid4(),"key":"r15_"+secrets.token_hex(7)}
            with writer.transaction():
                writer.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",
                               (g["work"],g["media"]))
                writer.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
                  values(%s,%s,%s,'gallery','public','clear')""",(g["work"],account,creator))
                writer.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(g["work"],))
                writer.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(g["work"],))
                writer.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
                  checksum_sha256,processing_state,moderation_state) values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
                  (g["media"],account,"ci-only/r15-"+str(g["media"])+".png","f"*64))
            g["version"]=scalar(pre,"select row_version from public.community_works where work_id=%s",(g["work"],))
            g["pin"]=scalar(pre,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
                              (actor,g["work"],[]))["expectedGraphSha256"]
            return g
        def snapshot(g):
            return pre.execute("""select
               (select row_version from public.community_works where work_id=%s),
               (select lifecycle_state::text from public.community_works where work_id=%s),
               (select count(*) from public.community_work_revisions where work_id=%s),
               (select count(*) from public.search_documents where work_id=%s),
               (select count(*) from public.outbox_events where aggregate_id=%s),
               (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s)
            """,(g["work"],g["work"],g["work"],g["work"],g["work"],account,g["key"])).fetchone()
        def publish(g,conn):
            try:
                with conn.transaction():
                    conn.execute("set local role service_role")
                    result=scalar(conn,"""select public.community_publish_gallery_pinned_r15(
                        %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
                        (actor,g["work"],g["version"],"R15 signed local probe",
                         "local no Storage object",[g["media"]],[],[],[],None,g["key"],g["pin"]))
                return "COMMITTED",result
            except psycopg.Error as ex:
                return "REJECTED",str(ex.sqlstate or "UNKNOWN")

        # Live real ES256 Session: previously positive R15 must be OFF.
        live=seed_g()
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2)
        live_before=snapshot(live)
        status,response=req("/functions/v1/community-command",{
            "command":"publishGallery","payload":{"workId":str(live["work"])}
        },token=a2)
        assert status==409 and response.get("error")=="R15_GALLERY_PUBLISH_WRITER_NOT_ENROLLED"
        outcome,res=publish(live,writer)
        assert outcome=="REJECTED" and res=="42501",(outcome,res)
        assert snapshot(live)==live_before
        mark("SOURCE158_R15_LIVE_A2_EDGE409_SQL42501_NO_DIFF",{
          "signedA2":True,"oldServiceRoleExecOff":True,"dbUnchanged":True})
        # Revoker-first: A1 passed the *separate* Edge-equivalent genuine signed
        # v2 verification. Then terminal Source154 revocation commits before
        # R15 service RPC invocation in an independent PostgreSQL backend.
        revoked=seed_g()
        base=snapshot(revoked)
        scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        scalar(pre,"select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        assert req("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)[0]==401
        assert req("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)[0]==200
        try:
            scalar(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
            raise AssertionError("REVOKED_A1_SIGNED_DB_AUTH_ACCEPTED")
        except psycopg.Error:
            pass
        status,response=req("/functions/v1/community-command",{
            "command":"publishGallery","payload":{"workId":str(revoked["work"])}
        },token=a1)
        assert status==401,"REVOKED_A1_MUST_401"
        result,detail=publish(revoked,writer)
        assert result=="REJECTED" and detail=="42501",(result,detail)
        assert snapshot(revoked)==base,"REVOKED_SQL_WROTE_DB"
        mark("SOURCE158_R15_REVOKED_A1_EDGE401_SQL42501_NO_DIFF",{
          "revokerFirst":True,"twoPg":True,"signedA1Original401":True,
          "liveSiblingA2":True,"dbUnchanged":True})
        # A reversible GRANT exercise exists ONLY in a rolled-back local
        # transaction. Never regrant an unsafe public or real service role.
        pre.execute("begin")
        try:
            pre.execute("grant execute on function public.community_publish_gallery_pinned_r15("
                "uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text) to service_role")
            assert scalar(pre,"select has_function_privilege('service_role',"
              "'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)',"
              "'EXECUTE')")
        finally:
            pre.execute("rollback")
        assert not scalar(pre,"select has_function_privilege('service_role',"
          "'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)',"
          "'EXECUTE')"),"R15_GRANT_LEAKED_AFTER_ROLLBACK"
        mark("SOURCE158_R15_TEMP_GRANT_ROLLBACK_OFF",{"serviceRoleExec":False})
        mark("SOURCE158_R15_DISPOSABLE_SIGNED_OFF_COMPLETE",{
            "source157Unchanged":True,"publicWriterEnabled":False,
            "providerUsed":False,"signedIssuerReal":True,
            "result":"OWNER_LOCAL_SIGNED_SQL_OFF_NOT_INDEPENDENT_QA"})
finally:
    if actor is not None:
        try:req("/auth/v1/admin/users/"+str(actor),method="DELETE",service=True)
        except Exception:pass
