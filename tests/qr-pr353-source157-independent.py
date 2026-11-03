#!/usr/bin/env python3
"""Independent 04 QR exact Source157 effective privilege and signed two-PG NEGATIVE gate.
Only isolated local disposable GoTrue/PG. No managed deployment, private fixtures, or Writer enrollment.
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
assert not any(os.getenv(k) for k in ("DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
OLD="public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)"
R16="public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)"
keys={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k,v=line.split("=",1)
        keys[k.strip()]=v.strip().strip("'\"")
assert keys.get("SERVICE_ROLE_KEY") and keys.get("ANON_KEY")

def req(path,body=None,token=None,service=False,method="POST"):
    h={"apikey":keys["SERVICE_ROLE_KEY"] if service else keys["ANON_KEY"],"Accept":"application/json"}
    if service:h["Authorization"]="Bearer "+keys["SERVICE_ROLE_KEY"]
    if token:h["Authorization"]="Bearer "+token
    if body is not None:h["Content-Type"]="application/json"
    r=urllib.request.Request(API+path,method=method,headers=h,data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(r,timeout=35) as response:
            return response.status,dict(response.headers),json.loads(response.read(80000) or b"null")
    except urllib.error.HTTPError as e:
        b=e.read(80000)
        try:v=json.loads(b)
        except Exception:v={}
        return e.code,dict(e.headers),v

def jwt_claims(jwt):
    header,payload,_=jwt.split(".")
    dec=lambda x:json.loads(base64.urlsafe_b64decode(x+"="*(-len(x)%4)))
    assert dec(header).get("alg")=="ES256"
    return dec(payload)

def emit(label):
    print("QR_SOURCE157_"+label+"_PASS",flush=True)

def snapshot(db):
    return db.execute("""select
      (select count(*) from public.dreamsnap_gallery_publications),
      (select count(*) from public.search_documents),
      (select count(*) from public.audit_events),
      (select count(*) from public.ddv_profile_workspaces),
      (select count(*) from public.idempotency_keys)
    """).fetchone()

def effective(db,role,signature):
    return db.execute("select has_function_privilege(%s,%s,'EXECUTE')",(role,signature)).fetchone()[0]

def denied(db,role,sub):
    try:
        with db.transaction():
            db.execute("set local role "+role)
            db.execute("select public.community_set_gallery_comments_enabled_v2(%s,%s,true)",(sub,uuid.uuid4())).fetchone()
    except psycopg.Error as e:
        assert e.sqlstate=="42501", ("WRONG_SQLSTATE",role,e.sqlstate)
        return
    raise AssertionError("FORBIDDEN_LEGACY_SQL_EXECUTED_"+role)

def login(email,pw,subject):
    status,_,o=req("/auth/v1/token?grant_type=password",{"email":email,"password":pw})
    assert status==200 and o.get("access_token") and o.get("refresh_token")
    t=o["access_token"];j=jwt_claims(t)
    assert j["sub"]==str(subject) and j["role"]=="authenticated" and j.get("session_id")
    return t,o["refresh_token"],(subject,int(j["iat"]),uuid.UUID(j["session_id"]))

def me(t):
    status,headers,_=req("/functions/v1/community-query",{"query":"me","payload":{}},token=t)
    low={k.lower():v for k,v in headers.items()}
    assert low.get("cache-control") and low.get("cdn-cache-control")
    return status

email="qr157-"+secrets.token_hex(7)+"@example.invalid"
pw=secrets.token_urlsafe(22)+"A1!"
subject=None
try:
    status,_,user=req("/auth/v1/admin/users",{"email":email,"password":pw,"email_confirm":True},service=True)
    assert status in (200,201) and user.get("id")
    subject=uuid.UUID(user["id"])
    a1,refresh1,c1=login(email,pw,subject)
    s,_,response=req("/functions/v1/community-command",{"command":"ensureAccountCreator",
        "payload":{"handle":"qr157_"+secrets.token_hex(6),"displayName":"Local QA"}},token=a1)
    assert s==200 and response.get("ok") is True
    a2,_,c2=login(email,pw,subject)
    assert c1[2]!=c2[2] and me(a1)==200 and me(a2)==200

    with closing(psycopg.connect(DSN,autocommit=True)) as pg1,closing(psycopg.connect(DSN,autocommit=True)) as pg2:
        assert pg1.execute("select pg_backend_pid()").fetchone()[0]!=pg2.execute("select pg_backend_pid()").fetchone()[0]
        assert pg1.execute("select count(*) from supabase_migrations.schema_migrations").fetchone()[0]==157
        before=snapshot(pg1)
        for role in ("anon","authenticated","service_role"):
            assert effective(pg1,role,OLD) is False,("LEGACY_ROLE_EXECUTE",role)
            denied(pg2,role,subject)
        assert effective(pg1,"service_role",R16) is True
        assert snapshot(pg2)==before
        emit("THREE_ROLE_42501_AND_R16_PRESERVED")

        # Verify temporary recovery GRANT cannot leave a capability open after ROLLBACK.
        with pg1.transaction(force_rollback=True):
            pg1.execute("grant execute on function "+OLD+" to service_role")
            assert effective(pg1,"service_role",OLD) is True
            assert effective(pg2,"service_role",OLD) is False
        assert effective(pg1,"service_role",OLD) is False
        denied(pg2,"service_role",subject)
        assert snapshot(pg1)==before
        emit("TRANSACTIONAL_ROLLBACK_GRANT_NOT_PERSISTED")

        # Writer-first (live owner) and revoker-first (new session) use distinct PostgreSQL backends.
        denied(pg2,"service_role",subject)
        pg1.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        assert me(a1)==401 and me(a2)==200
        denied(pg2,"service_role",subject)
        assert snapshot(pg1)==before
        emit("TWO_PG_WRITER_FIRST_REVOKE_NO_MUTATION")

        a3,refresh3,c3=login(email,pw,subject)
        assert c3[2] not in (c1[2],c2[2]) and me(a3)==200
        pg2.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c3)
        assert me(a3)==401 and me(a2)==200
        denied(pg1,"service_role",subject)
        assert snapshot(pg2)==before
        emit("TWO_PG_REVOKER_FIRST_WRITER_NO_MUTATION")

        rst,_,fresh=req("/auth/v1/token?grant_type=refresh_token",{"refresh_token":refresh3})
        assert rst in (200,400,401,403,422)
        if rst==200:
            assert uuid.UUID(jwt_claims(fresh["access_token"])["session_id"])==c3[2]
            assert me(fresh["access_token"])==401
        for role in ("anon","authenticated","service_role"):
            denied(pg1,role,subject)
        assert snapshot(pg1)==before
        assert me(a2)==200
        emit("REFRESH_REPLAY_DENIED_DB_UNCHANGED")

    emit("INDEPENDENT_GENUINE_SIGNED_LOCAL_TARGETED")
finally:
    if subject is not None:
        req("/auth/v1/admin/users/"+str(subject),service=True,method="DELETE")
