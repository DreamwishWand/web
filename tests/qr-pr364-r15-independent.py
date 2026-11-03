#!/usr/bin/env python3
"""04 QR independent NEW Source158 R15 pinned Gallery OFF verification.
Disposable local GoTrue ES256/PG only. No external assets, managed Provider,
real user, Source157 rerun or enrollment of any legacy Writer.
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

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert all(not os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
R15="public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)"
R16="public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)"
OLD157="public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)"
env={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k,v=line.split("=",1)
        env[k.strip()]=v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")

def http(path,body=None,token=None,service=False,method="POST"):
    key=env["SERVICE_ROLE_KEY"] if service else env["ANON_KEY"]
    hdr={"apikey":key,"Accept":"application/json"}
    if service:hdr["Authorization"]="Bearer "+key
    elif token:hdr["Authorization"]="Bearer "+token
    if body is not None:hdr["Content-Type"]="application/json"
    req=urllib.request.Request(API+path,headers=hdr,method=method,
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=45) as resp:
            return resp.status,json.loads(resp.read(90000) or b"null")
    except urllib.error.HTTPError as exc:
        data=exc.read(90000)
        try:obj=json.loads(data)
        except Exception:obj={}
        return exc.code,obj

def jwt(token,index):
    part=token.split(".")[index]
    return json.loads(base64.urlsafe_b64decode(part+"="*(-len(part)%4)))

def single(conn,sql,args=()):
    return conn.execute(sql,args).fetchone()[0]

def effective(conn,role,signature):
    return single(conn,"select has_function_privilege(%s,%s,'EXECUTE')",(role,signature))

def stamp(label):
    print("QR_SOURCE158_"+label+"_PASS",flush=True)

def snapshot(conn,owner,fixture):
    return conn.execute("""select
      (select row_version from public.community_works where work_id=%s),
      (select lifecycle_state::text from public.community_works where work_id=%s),
      (select count(*) from public.community_work_revisions where work_id=%s),
      (select count(*) from public.search_documents where work_id=%s),
      (select count(*) from public.outbox_events where aggregate_id=%s),
      (select count(*) from public.idempotency_keys where account_id=%s and idempotency_key=%s)
    """,(fixture["work"],fixture["work"],fixture["work"],fixture["work"],fixture["work"],
        owner,fixture["key"])).fetchone()

actor=None
try:
    email="qr158-"+secrets.token_hex(7)+"@example.invalid"
    password=secrets.token_urlsafe(22)+"A1!"
    st,created=http("/auth/v1/admin/users",{"email":email,"password":password,"email_confirm":True},service=True)
    assert st in (200,201) and created.get("id"),"DISPOSABLE_USER_CREATE_FAILED"
    actor=uuid.UUID(created["id"])
    def login():
        s,resp=http("/auth/v1/token?grant_type=password",{"email":email,"password":password})
        assert s==200 and resp.get("access_token")
        t=resp["access_token"];hd=jwt(t,0);cl=jwt(t,1)
        assert hd.get("alg")=="ES256" and cl["sub"]==str(actor) and cl.get("session_id")
        return t,(actor,int(cl["iat"]),uuid.UUID(cl["session_id"]))
    a1,c1=login()
    a2,c2=login()
    a3,c3=login()
    assert len({c1[2],c2[2],c3[2]})==3
    st,boot=http("/functions/v1/community-command",{
      "command":"ensureAccountCreator",
      "payload":{"handle":"qr158_"+secrets.token_hex(6),"displayName":"QA local R15"}
    },token=a2)
    assert st==200 and boot.get("ok") is True
    account=uuid.UUID(boot["data"]["accountId"])
    creator=uuid.UUID(boot["data"]["creatorProfileId"])

    with closing(psycopg.connect(DSN,autocommit=True)) as pre,\
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        assert single(pre,"select count(*) from supabase_migrations.schema_migrations")==158
        assert single(pre,"select pg_backend_pid()") != single(writer,"select pg_backend_pid()")
        assert effective(pre,"service_role",R16) is True
        assert effective(pre,"service_role",OLD157) is False
        for role in ("anon","authenticated","service_role"):
            assert effective(pre,role,R15) is False,("UNEXPECTED_R15_EXECUTE",role)

        def seed():
            f={"work":uuid.uuid4(),"media":uuid.uuid4(),"key":"qr158_"+secrets.token_hex(8)}
            with writer.transaction():
                writer.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(f["work"],f["media"]))
                writer.execute("""insert into public.community_works
                  (work_id,owner_account_id,creator_profile_id,work_type,visibility,moderation_state)
                  values(%s,%s,%s,'gallery','public','clear')""",(f["work"],account,creator))
                writer.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(f["work"],))
                writer.execute("insert into public.gallery_work_settings(work_id,comments_enabled) values(%s,true)",(f["work"],))
                writer.execute("""insert into public.media_assets
                  (media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
                   checksum_sha256,processing_state,moderation_state)
                   values(%s,%s,%s,'image/png',128,10,10,%s,'ready','clear')""",
                   (f["media"],account,"qa-only/r15-"+str(f["media"])+".png","f"*64))
            f["version"]=single(pre,"select row_version from public.community_works where work_id=%s",(f["work"],))
            f["pin"]=single(pre,"select public.community_gallery_graph_preflight_r15(%s,%s,%s::uuid[])",
                (actor,f["work"],[]))["expectedGraphSha256"]
            return f

        def denied(conn,role,f):
            try:
                with conn.transaction():
                    conn.execute("set local role "+role)
                    conn.execute("""select public.community_publish_gallery_pinned_r15(
                      %s,%s,%s,%s,%s,%s::uuid[],%s::uuid[],%s::bigint[],%s::bigint[],%s,%s,%s)""",
                      (actor,f["work"],f["version"],"QA disposable title","QA no asset",
                       [f["media"]],[],[],[],None,f["key"],f["pin"])).fetchone()
            except psycopg.Error as err:
                assert err.sqlstate=="42501",("WRONG_DENIAL",role,err.sqlstate)
                return
            raise AssertionError("UNACCEPTED_R15_EXECUTED_"+role)

        f_live=seed()
        live_before=snapshot(pre,account,f_live)
        assert single(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c2) is not None
        status,response=http("/functions/v1/community-command",{
            "command":"publishGallery","payload":{"workId":str(f_live["work"])}
        },token=a2)
        assert status==409 and response.get("error")=="R15_GALLERY_PUBLISH_WRITER_NOT_ENROLLED"
        for role in ("anon","authenticated","service_role"):
            denied(writer,role,f_live)
        assert snapshot(pre,account,f_live)==live_before
        stamp("LIVE_A2_409_THREE_ROLES_42501_DB_UNCHANGED")

        # Writer first, then revoke. Distinct backends ensure this is not just
        # a single transaction rollback. Signed A1 preflight is genuine.
        f_writer_first=seed()
        base=snapshot(pre,account,f_writer_first)
        assert single(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c1) is not None
        denied(writer,"service_role",f_writer_first)
        pre.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=a1)[0]==401
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)[0]==200
        assert snapshot(pre,account,f_writer_first)==base
        stamp("TWO_PG_WRITER_FIRST_REVOKE_NO_DIFF")

        # Revoker first, then distinct DB service-role direct invocation.
        f_revoker_first=seed()
        base=snapshot(pre,account,f_revoker_first)
        assert single(pre,"select public.community_authorize_signed_session_v2(%s,%s,%s)",c3) is not None
        writer.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c3)
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=a3)[0]==401
        assert http("/functions/v1/community-query",{"query":"me","payload":{}},token=a2)[0]==200
        assert http("/functions/v1/community-command",{
            "command":"publishGallery","payload":{"workId":str(f_revoker_first["work"])}
        },token=a3)[0]==401
        denied(pre,"service_role",f_revoker_first)
        assert snapshot(pre,account,f_revoker_first)==base
        stamp("TWO_PG_REVOKER_FIRST_WRITER_401_42501_NO_DIFF")

        # Test a temporary unsafe GRANT in a guaranteed rolled-back private
        # transaction. Never execute an actual permission restore.
        with pre.transaction(force_rollback=True):
            pre.execute("grant execute on function "+R15+" to service_role")
            assert effective(pre,"service_role",R15) is True
            assert effective(writer,"service_role",R15) is False
        assert effective(pre,"service_role",R15) is False
        denied(writer,"service_role",f_live)
        assert snapshot(pre,account,f_live)==live_before
        assert effective(pre,"service_role",OLD157) is False
        assert effective(pre,"service_role",R16) is True
        stamp("ROLLBACK_R16_157_UNCHANGED")

    stamp("INDEPENDENT_GENUINE_ES256_LOCAL_TARGETED")
finally:
    if actor is not None:
        try:http("/auth/v1/admin/users/"+str(actor),service=True,method="DELETE")
        except Exception:pass
