#!/usr/bin/env python3
"""Source157 signed GoTrue and two-Postgres old comments v2 ACL no-write gate.

Only the retired legacy v2 RPC is tested. Does not create a DreamSnaps Work,
issue Storage URLs or pretend all legacy Writers have signed in-txn guards.
Source155/156 signed behavior remains independently accepted separately.
"""
import base64
import json
import os
import secrets
import subprocess
import urllib.request
import urllib.error
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing

import psycopg

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert not any(os.getenv(v) for v in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ENV={}
for s in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in s:
        k,v=s.split("=",1)
        ENV[k.strip()]=v.strip().strip("'\"")
assert ENV.get("SERVICE_ROLE_KEY") and ENV.get("ANON_KEY")

def http(path, *, body=None, token=None, service=False, method="POST"):
    headers={"apikey":ENV["SERVICE_ROLE_KEY"] if service else ENV["ANON_KEY"],
             "Accept":"application/json"}
    if service:
        headers["Authorization"]="Bearer "+ENV["SERVICE_ROLE_KEY"]
    elif token:
        headers["Authorization"]="Bearer "+token
    if body is not None:
        headers["Content-Type"]="application/json"
    req=urllib.request.Request(API+path,headers=headers,method=method,
        data=json.dumps(body).encode("utf-8") if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=40) as resp:
            data=resp.read(90000)
            return resp.status, dict(resp.headers), json.loads(data or b"null")
    except urllib.error.HTTPError as exc:
        data=exc.read(90000)
        try: response=json.loads(data)
        except Exception: response={}
        return exc.code,dict(exc.headers),response

def claim(token):
    bits=token.split(".")
    assert len(bits)==3
    return json.loads(base64.urlsafe_b64decode(bits[1]+"="*((-len(bits[1]))%4)))

def marker(case,outcome):
    print(json.dumps({"case":case,"result":outcome},sort_keys=True),flush=True)

email="comm-s157-"+secrets.token_hex(7)+"@example.invalid"
password=secrets.token_urlsafe(26)+"A1!"
status,_,u=http("/auth/v1/admin/users",body={
    "email":email,"password":password,"email_confirm":True
},service=True)
assert status in (200,201) and u.get("id")
subject=uuid.UUID(u["id"])

def login():
    st,_,o=http("/auth/v1/token?grant_type=password",body={"email":email,"password":password})
    assert st==200 and o.get("access_token") and o.get("refresh_token")
    jwt=o["access_token"];j=claim(jwt)
    assert j["sub"]==str(subject) and j.get("session_id") and j["role"]=="authenticated"
    header=json.loads(base64.urlsafe_b64decode(jwt.split(".")[0]+"="*((-len(jwt.split(".")[0]))%4)))
    assert header.get("alg")=="ES256"
    return jwt,o["refresh_token"],(subject,int(j["iat"]),uuid.UUID(j["session_id"]))

def me(t):
    st,h,o=http("/functions/v1/community-query",body={"query":"me","payload":{}},token=t)
    lower={k.lower():v for k,v in h.items()}
    assert lower.get("cache-control") and lower.get("cdn-cache-control"),"PRIVATE_HEADERS_MISSING"
    return st,o

def state(conn):
    return conn.execute("""select
        (select count(*) from public.dreamsnap_gallery_publications),
        (select count(*) from public.search_documents),
        (select count(*) from public.audit_events where action_type='gallery.comments_enabled'),
        (select count(*) from public.ddv_profile_workspaces),
        (select count(*) from public.idempotency_keys)
    """).fetchone()

def direct_v2_as_service(conn,sub):
    try:
        with conn.transaction():
            conn.execute("set local role service_role")
            conn.execute(
                "select public.community_set_gallery_comments_enabled_v2(%s,%s,true)",
                (sub,uuid.uuid4()),
            ).fetchone()
    except psycopg.Error as exc:
        assert exc.sqlstate=="42501", "LEGACY_V2_UNEXPECTED_SQLSTATE_"+str(exc.sqlstate)
        return "42501"
    raise AssertionError("SOURCE157_SERVICE_ROLE_EXECUTED_OLD_V2")

try:
    a1,refresh1,c1=login()
    st,h,b=http("/functions/v1/community-command",body={
        "command":"ensureAccountCreator",
        "payload":{"handle":"s157_"+secrets.token_hex(6),"displayName":"Local signed ACL"}
    },token=a1)
    assert st==200 and b.get("ok") is True,"LOCAL_SOURCE155_BOOTSTRAP_FAILED"
    a2,_,c2=login()
    assert c1[2]!=c2[2]
    assert me(a1)[0]==200 and me(a2)[0]==200
    with closing(psycopg.connect(DSN,autocommit=True)) as reader,\
         closing(psycopg.connect(DSN,autocommit=True)) as writer:
        pid1=reader.execute("select pg_backend_pid()").fetchone()[0]
        pid2=writer.execute("select pg_backend_pid()").fetchone()[0]
        assert pid1!=pid2,"NOT_TWO_POSTGRES_CONNECTIONS"
        assert reader.execute("select count(*) from supabase_migrations.schema_migrations").fetchone()[0]==157
        base=state(reader)

        # Writer-first: even a real live signed owner cannot reach the
        # unregistered old v2 via service_role; revocation commits second.
        reader.execute("select public.community_authorize_signed_session_v2(%s,%s,%s)",c1)
        assert direct_v2_as_service(writer,subject)=="42501"
        assert state(reader)==base
        writer.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c1)
        assert me(a1)[0]==401 and me(a2)[0]==200
        assert state(reader)==base
        marker("SOURCE157_WRITER_FIRST_THEN_REVOKE","TWO_PG_TRUE_ES256_42501_NO_DB_DIFF")

        # Revoker-first with a fresh actual GoTrue signed third session.
        a3,refresh3,c3=login()
        assert c3[2] not in (c1[2],c2[2])
        assert me(a3)[0]==200
        reader.execute("select public.community_authorize_signed_session_v2(%s,%s,%s)",c3)
        writer.execute("select public.community_revoke_signed_session_v1(%s,%s,%s,'local')",c3)
        assert direct_v2_as_service(reader,subject)=="42501"
        assert state(writer)==base
        assert me(a3)[0]==401 and me(a2)[0]==200
        marker("SOURCE157_REVOKER_FIRST_THEN_WRITER","TWO_PG_TRUE_ES256_42501_NO_DB_DIFF")

        # GoTrue refresh may itself return 200 for a terminal Wand Session.
        # If so, same lineage must still be forbidden by server v2.
        rst,_,rot=http("/auth/v1/token?grant_type=refresh_token",body={"refresh_token":refresh3})
        assert rst in (200,400,401,403,422)
        if rst==200:
            assert uuid.UUID(claim(rot["access_token"])["session_id"])==c3[2]
            assert me(rot["access_token"])[0]==401
        assert direct_v2_as_service(reader,subject)=="42501"
        assert state(reader)==base
        marker("SOURCE157_REAL_REFRESHED_OLD_SESSION","REFRESH_IF_ACCEPTED_401_DIRECT_V2_42501")

        # A live unrelated sibling session remains functional; repeated
        # direct v2 service invocations remain denied with no audit/search.
        assert me(a2)[0]==200
        with ThreadPoolExecutor(max_workers=2) as pool:
            def attempt(_):
                with psycopg.connect(DSN,autocommit=True) as c:
                    return direct_v2_as_service(c,subject)
            outcomes=list(pool.map(attempt,range(2)))
        assert outcomes==["42501","42501"] and state(reader)==base
        marker("SOURCE157_SERVICE_RPC_PARALLEL_REPLAY","TWO_DENIALS_NO_WORK_SEARCH_AUDIT_CHANGE")
    marker("SOURCE157_GOTRUE_SIGNED_LOCAL_TARGETED_ACL_PASS",
           "OLD_V2_OFF_R16_UNTOUCHED_NOT_PUBLIC_OR_FULL_WRITER_QA")
finally:
    # Guaranteed only local disposable seeded identity; never a user/Stage.
    http("/auth/v1/admin/users/"+str(subject),method="DELETE",service=True)
