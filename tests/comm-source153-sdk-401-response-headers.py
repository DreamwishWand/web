#!/usr/bin/env python3
"""New-only genuine ES256 local Owner SDK 401 response cache header closure.
No Stage/remote DB, Policy/Grant/Provider/Signer, or real user/media.
Do not print JWT, private keys, emails or UUIDs.
"""
import base64
import contextlib
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid

import psycopg

assert os.getenv("DDVRE_E1_LOCAL_DISPOSABLE") == "APPROVED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
assert not os.getenv("SUPABASE_PROJECT_ID")
def marker(case,outcome,status=None):
    print(json.dumps({"case":case,"outcome":outcome,**({"http":status} if status is not None else {})}),flush=True)

envout=subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL)
env=dict(line.split("=",1) for line in envout.splitlines() if "=" in line)
anon=env["ANON_KEY"].strip("'\"")
admin=env["SERVICE_ROLE_KEY"].strip("'\"")
API="http://127.0.0.1:54321"
def http(path,method="POST",body=None,token=None,key=None):
    headers={"apikey":key or anon,"Accept":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    if body is not None:headers["Content-Type"]="application/json"
    req=urllib.request.Request(API+path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=25) as r:
            raw=r.read(10000)
            try:out=json.loads(raw or b"null")
            except Exception:out={}
            return r.status,dict(r.headers),out
    except urllib.error.HTTPError as ex:
        raw=ex.read(10000)
        try:data=json.loads(raw)
        except Exception:data={}
        return ex.code,dict(ex.headers),data
def headers_lower(h):return {k.lower():v for k,v in h.items()}
def private_headers(h):
    h=headers_lower(h)
    varies={x.strip().lower() for x in h.get("vary","").split(",")}
    return ("private" in h.get("cache-control","").lower()
        and "no-store" in h.get("cache-control","").lower()
        and h.get("cdn-cache-control","").lower()=="no-store"
        and h.get("surrogate-control","").lower()=="no-store"
        and {"authorization","origin"}.issubset(varies))
def decode_chunk(token,index):
    x=token.split(".")
    assert len(x)==3
    return json.loads(base64.urlsafe_b64decode(x[index]+"="*(-len(x[index])%4)))

with psycopg.connect("postgresql://postgres:postgres@127.0.0.1:54322/postgres",autocommit=True) as pg:
    assert pg.execute("select count(*) from supabase_migrations.schema_migrations").fetchone()[0]==153
    assert pg.execute("select count(*) from private.dreamsnap_x05_owner_policy_v1").fetchone()[0]==0
    assert pg.execute("select count(*) from private.dreamsnap_x05_policy_receipt_v1").fetchone()[0]==0
    assert pg.execute("select count(*) from private.dreamsnap_x05_work_control_v1").fetchone()[0]==0
    marker("SDK401_SAFE_STACK","FULL153_NO_POLICY_NO_CONTROL")

    target=uuid.uuid4()
    st,h,j=http("/functions/v1/community-dreamsnap-owner",
                body={"operation":"pregrant","workId":str(target)})
    assert st==401 and bool(headers_lower(h).get("x-supabase-server-error"))
    assert private_headers(h),"SDK_EARLY_401_MISSING_STRICT_PRIVATE_CACHE_HEADERS"
    assert isinstance(j,dict) and (j.get("source")=="@supabase/server" or "code" in j)
    assert str(target) not in json.dumps(j)
    marker("SDK401_ANONYMOUS","AUTH_MIDDLEWARE_401_PRIVATE_NOSTORE",st)

    st,h,_=http("/auth/v1/.well-known/jwks.json",method="GET")
    assert st==200
    marker("SDK401_GOTRUE_JWKS","LOCAL_ISSUER_JWKS_AVAILABLE",st)

    email="sdk401-"+secrets.token_hex(9)+"@example.invalid"
    passwd=secrets.token_urlsafe(30)+"_A1"
    st,_,j=http("/auth/v1/admin/users",
        body={"email":email,"password":passwd,"email_confirm":True},token=admin,key=admin)
    assert st in (200,201) and j.get("id")
    subject=uuid.UUID(j["id"])
    st,_,login=http("/auth/v1/token?grant_type=password",body={"email":email,"password":passwd})
    assert st==200 and login.get("access_token")
    bearer=login["access_token"]
    head=decode_chunk(bearer,0)
    assert head["alg"]=="ES256" and head.get("kid")
    st,_,jwks=http("/auth/v1/.well-known/jwks.json",method="GET")
    assert st==200 and any(k.get("kid")==head["kid"] and k.get("kty")=="EC" and k.get("crv")=="P-256" and "d" not in k for k in jwks["keys"])
    st,_,user=http("/auth/v1/user",method="GET",token=bearer)
    assert st==200 and user["id"]==str(subject)
    marker("SDK401_SIGNED_ACTOR","AUTHENTIC_ES256_JWT_CONFIRMED",st)

    account=uuid.uuid4()
    pg.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
    pg.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
    st,h,j=http("/functions/v1/community-dreamsnap-owner",
        body={"operation":"pregrant","workId":str(target)},token=bearer)
    assert st==403 and headers_lower(h).get("x-supabase-server-error") is None
    assert private_headers(h) and isinstance(j,dict) and j.get("error")=="OWNER_REQUEST_DENIED"
    assert str(target) not in json.dumps(j)
    marker("SDK401_AUTHENTICATED_DENY","OWNER_SECURITY_PATH_UNCHANGED",st)

    st,h,j=http("/functions/v1/community-dreamsnap-owner",method="GET",token=bearer)
    assert st==405 and private_headers(h) and j.get("error")=="METHOD_NOT_ALLOWED"
    marker("SDK401_AUTHENTICATED_METHOD","METHOD_GUARD_UNCHANGED",st)
    st,h,j=http("/functions/v1/community-dreamsnap-owner",method="OPTIONS",token=bearer)
    assert st in (200,204) and "no-store" in headers_lower(h).get("cache-control","")
    marker("SDK401_OPTIONS","CORS_PREFLIGHT_UNCHANGED",st)

    assert pg.execute("select count(*) from private.dreamsnap_x05_owner_policy_v1").fetchone()[0]==0
    assert pg.execute("select count(*) from private.dreamsnap_x05_work_control_v1").fetchone()[0]==0
    with contextlib.suppress(Exception):
        http("/auth/v1/admin/users/"+str(subject),method="DELETE",token=admin,key=admin)
    marker("SDK401_CLEAN","LOCAL_SYNTHETIC_AUTH_DELETE_ATTEMPTED")
marker("SDK401_BOUNDARY_TARGETED_PASS","RESPONSE_ONLY_NO_AUTH_OR_SQL_CHANGE")
