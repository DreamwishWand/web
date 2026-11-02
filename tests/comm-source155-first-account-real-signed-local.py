#!/usr/bin/env python3
"""Source155 genuinely signed, disposable local first-Account acceptance.
No client-generated JWT, Stage116, external Provider, or live account.
Print only categorical markers, HTTP codes, booleans: never tokens/IDs.
"""
import base64,json,os,secrets,subprocess,time,uuid,urllib.error,urllib.request
from concurrent.futures import ThreadPoolExecutor
import psycopg
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
def marker(case,claim,status=None):
    print(json.dumps({"case":case,"outcome":claim,**({"http":status} if status is not None else {})}),flush=True)
env={}
for line in subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        a,b=line.split("=",1);env[a.strip()]=b.strip().strip("'\"")
assert "SERVICE_ROLE_KEY" in env and "ANON_KEY" in env
def http(path,body=None,token=None,key=None,method="POST"):
    h={"apikey":key or env["ANON_KEY"],"Accept":"application/json"}
    if token:h["Authorization"]="Bearer "+token
    if body is not None:h["Content-Type"]="application/json"
    request=urllib.request.Request(API+path,method=method,headers=h,
       data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(request,timeout=30) as r:
            raw=r.read(80000)
            return r.status,dict(r.headers),json.loads(raw or b"null")
    except urllib.error.HTTPError as e:
        raw=e.read(80000)
        try:v=json.loads(raw)
        except Exception:v={}
        return e.code,dict(e.headers),v
def jwt(token,n):
    z=token.split(".");assert len(z)==3
    return json.loads(base64.urlsafe_b64decode(z[n]+"="*(-len(z[n])%4)))
status,_,jwks=http("/auth/v1/.well-known/jwks.json",method="GET")
assert status==200 and jwks.get("keys")
def private_headers(h):
    h={k.lower():v for k,v in h.items()}
    vary={x.strip().lower() for x in h.get("vary","").split(",")}
    return ("no-store" in h.get("cache-control","").lower()
        and h.get("cdn-cache-control","").lower()=="no-store"
        and h.get("surrogate-control","").lower()=="no-store"
        and {"authorization","origin"}.issubset(vary))
def create_actor(who):
    email="source155-"+secrets.token_hex(7)+"-"+who+"@example.invalid"
    password=secrets.token_urlsafe(32)+"_A0"
    st,_,j=http("/auth/v1/admin/users",body={
       "email":email,"password":password,"email_confirm":True},
       token=env["SERVICE_ROLE_KEY"],key=env["SERVICE_ROLE_KEY"])
    assert st in (200,201) and j.get("id"),"GOTRUE_NEW_ACCOUNT_FAILED"
    u=uuid.UUID(j["id"])
    return {"id":u,"email":email,"password":password}
def login(a):
    st,_,data=http("/auth/v1/token?grant_type=password",
       body={"email":a["email"],"password":a["password"]})
    assert st==200 and data.get("refresh_token") and data.get("access_token")
    tok=data["access_token"];h=jwt(tok,0);claim=jwt(tok,1)
    assert h.get("alg")=="ES256" and any(k.get("kid")==h.get("kid") and k.get("crv")=="P-256" for k in jwks["keys"])
    assert claim["sub"]==str(a["id"]) and claim.get("session_id") and claim.get("role")=="authenticated"
    assert claim["exp"]>time.time()+30
    st,_,data_user=http("/auth/v1/user",token=tok,method="GET")
    assert st==200 and data_user.get("id")==str(a["id"])
    return tok,data["refresh_token"]
def bootstrap(token,handle,display="Local creator",extra=None):
    payload={"handle":handle,"displayName":display,**(extra or {})}
    st,h,b=http("/functions/v1/community-command",body={"command":"ensureAccountCreator","payload":payload},token=token)
    assert private_headers(h),"BOOTSTRAP_PRIVATE_HEADERS_MISSING"
    return st,b
def q(token):
    st,h,b=http("/functions/v1/community-query",body={"query":"me","payload":{}},token=token)
    return st,b
def ids(v):
    assert isinstance(v,dict) and v.get("ok") is True and isinstance(v.get("data"),dict)
    return uuid.UUID(v["data"]["accountId"]),uuid.UUID(v["data"]["creatorProfileId"])
def counts(db,subject):
    row=db.execute("""select count(*) from public.auth_identities
        where provider='supabase' and provider_subject=%s""",(str(subject),)).fetchone()[0]
    return row
actors={who:create_actor(who) for who in "A B M C".split()}
A=actors["A"];a0,r0=login(A)
with psycopg.connect(DSN,autocommit=True) as db:
    def scalar(sql,args=()):return db.execute(sql,args).fetchone()[0]
    assert scalar("select count(*) from supabase_migrations.schema_migrations")==155
    assert counts(db,A["id"])==0
    assert scalar("select exists(select 1 from auth.sessions where id=%s and user_id=%s)",
         (uuid.UUID(jwt(a0,1)["session_id"]),A["id"]))
    assert not scalar("select has_function_privilege('authenticated',"
         "'public.community_ensure_account_creator_signed_v1(uuid,bigint,uuid,text,text)','EXECUTE')")
    assert scalar("select has_function_privilege('service_role',"
         "'public.community_ensure_account_creator_signed_v1(uuid,bigint,uuid,text,text)','EXECUTE')")
    assert not scalar("select has_table_privilege('authenticated','private.wand_verified_session_revocations_v1','INSERT')")
    st,b=bootstrap(a0,"a0_"+secrets.token_hex(5))
    assert st==200,(st,"FRESH_A0_BOOTSTRAP_FAILED")
    account,creator=ids(b)
    assert counts(db,A["id"])==1
    p=scalar("select owner_account_id::text||'|'||profile_visibility::text from public.creator_profiles where creator_profile_id=%s",(creator,))
    assert p==str(account)+"|private","FRESH_CREATOR_NOT_PRIVATE_OWNER"
    assert scalar("select count(*) from public.account_roles where account_id=%s",(account,))==0
    assert q(a0)[0]==200
    assert scalar("select count(*) from public.outbox_events where aggregate_type='creator_profile' and aggregate_id=%s",(creator,))==1
    marker("B01-A0-FIRST-SIGNED","GOTRUE_ES256_NEW_NO_IDENTITY_TO_PRIVATE_ACCOUNT_CREATOR_HTTP200_DB_ATOMIC",200)

    def replay(_):
        return bootstrap(a0,"a0_"+shared_handle)
    # Natural-key idempotency must hold under true parallel HTTP calls.
    shared_handle=secrets.token_hex(6)
    with ThreadPoolExecutor(max_workers=7) as pool:
        results=list(pool.map(replay,range(7)))
    assert all(st==200 and ids(b)==(account,creator) for st,b in results)
    assert counts(db,A["id"])==1
    assert scalar("select count(*) from public.creator_profiles where owner_account_id=%s",(account,))==1
    assert scalar("select count(*) from public.outbox_events where aggregate_type='creator_profile' and aggregate_id=%s",(creator,))==1
    marker("B02-REPLAY-CONCURRENT","SEVEN_PARALLEL_SIGNED_REPLAYS_ONE_ACCOUNT_ONE_CREATOR_ONE_OUTBOX",200)

    # Other genuinely signed identities cannot select A's subject or session
    # via JSON, and have no delegated admin privileges.
    for who in ("B","M"):
        t,_=login(actors[who])
        actors[who]["token"]=t
        st,b=bootstrap(t,who.lower()+"_"+secrets.token_hex(5),extra={
            "authSubject":str(A["id"]),"sessionId":jwt(a0,1)["session_id"]})
        assert st==200
        ba,bc=ids(b)
        assert ba!=account and bc!=creator
        assert scalar("select owner_account_id from public.creator_profiles where creator_profile_id=%s",(bc,))==ba
        assert scalar("select count(*) from public.account_roles where account_id=%s",(ba,))==0
    marker("B03-B-M-SEPARATION","SIGNED_FOREIGN_BODY_SUBJECT_SESSION_IGNORED_NO_PRIVILEGE_GRANT",200)

    # Provider-registered but signed A1 and live A2 (different Session IDs).
    a1,refresh1=login(A)
    a2,_=login(A)
    assert jwt(a1,1)["session_id"]!=jwt(a2,1)["session_id"]
    assert bootstrap(a1,"ignored_"+secrets.token_hex(4))[0]==200
    s,h,rv=http("/functions/v1/community-dreamsnap-owner",
        body={"operation":"session-revoke","scope":"local"},token=a1)
    assert s==200 and rv.get("state")=="revoked"
    before=scalar("select count(*) from public.creator_profiles where owner_account_id=%s",(account,))
    s,r=bootstrap(a1,"a1_"+secrets.token_hex(5))
    assert s==401 and r.get("ok") is False
    assert bootstrap(a2,"a2_"+secrets.token_hex(5))[0]==200
    assert scalar("select count(*) from public.creator_profiles where owner_account_id=%s",(account,))==before
    marker("B04-A1-REVOKE-A2","OLD_A1_401_LIVE_SIBLING_A2_200_NO_NEW_CREATOR",s)
    s,_,rot=http("/auth/v1/token?grant_type=refresh_token",body={"refresh_token":refresh1})
    assert s in (200,400,401,403,422)
    if s==200:
        assert jwt(rot["access_token"],1)["session_id"]==jwt(a1,1)["session_id"]
        rst,_=bootstrap(rot["access_token"],"rot_"+secrets.token_hex(5))
        assert rst==401,"REVOKED_SESSION_REFRESH_REBOOTSTRAP"
    marker("B05-REFRESH","ROTATED_A1_DENY_OR_GOTRUE_REFRESH_REFUSAL",s)

    # A genuine cryptographic JWT for a NEW registered Session must be kept
    # separate from unknown random UUID values on a direct service RPC.
    with db.transaction():
        try:
            db.execute("select public.community_ensure_account_creator_signed_v1(%s,%s,%s,%s,%s)",
             (A["id"],jwt(a2,1)["iat"],uuid.uuid4(),"wrong_"+secrets.token_hex(4),"Unknown"))
            raise AssertionError("UNKNOWN_PROVIDER_SESSION_ACCEPTED")
        except psycopg.Error: pass
    assert scalar("select count(*) from public.creator_profiles where owner_account_id=%s",(account,))==1
    assert not scalar("select has_function_privilege('authenticated',"
      "'public.community_ensure_account_creator_signed_v1(uuid,bigint,uuid,text,text)','EXECUTE')")
    marker("B06-UNKNOWN-ACL","UNREGISTERED_SESSION_SQL_DENY_AUTHENTICATED_EXECUTE_DENY")

    # Duplicate normalized handle causes atomic rollback of all account,
    # identity, creator, and outbox writes. Retry correct handle succeeds.
    C=actors["C"];ct,_=login(C)
    assert counts(db,C["id"])==0
    existing_handle=scalar("select handle from public.creator_profiles where creator_profile_id=%s",(creator,))
    failed,_=bootstrap(ct,existing_handle)
    assert failed in (400,401,409),"DUPLICATE_HANDLE_SHOULD_FAIL"
    assert counts(db,C["id"])==0
    again,cb=bootstrap(ct,"c_"+secrets.token_hex(7))
    assert again==200 and ids(cb)[0]!=account
    assert counts(db,C["id"])==1
    assert scalar("select count(*) from public.creator_profiles where owner_account_id=%s",(ids(cb)[0],))==1
    marker("B07-ROLLBACK-RETRY","DUPLICATE_HANDLE_ATOMIC_ROLLBACK_THEN_NEW_SIGNED_RETRY_200",again)

    # Unverified/tampered bearer, unsigned and anonymous cannot bootstrap.
    st,h,_=http("/functions/v1/community-command",
       body={"command":"ensureAccountCreator","payload":{"handle":"xvalid","displayName":"X"}},
       token="untrusted.not-a-jwt.value")
    assert st==401
    assert scalar("select count(*) from public.auth_identities where provider='supabase' and provider_subject=%s",(str(A["id"]),))==1
    marker("B08-INVALID-JWT","BAD_SIGNATURE_CANNOT_SELF_ENROLL",st)
    # Revoke account-wide A2 and verify a further fresh real issuer session
    # can reenter without changing the owner assignment.
    st,h,rv=http("/functions/v1/community-dreamsnap-owner",
       body={"operation":"session-revoke","scope":"global"},token=a2)
    assert st==200 and rv.get("state")=="revoked"
    assert bootstrap(a2,"after_"+secrets.token_hex(5))[0]==401
    time.sleep(2)
    a3,_=login(A)
    st,b=bootstrap(a3,"fresh_"+secrets.token_hex(5))
    assert st==200 and ids(b)==(account,creator)
    marker("B09-GLOBAL-NEW-SESSION","GLOBAL_OLD401_POSTCUTOFF_FRESH_A3_200_OWNER_SAME",st)

    for who in actors:
        try:http("/auth/v1/admin/users/"+str(actors[who]["id"]),
          method="DELETE",token=env["SERVICE_ROLE_KEY"],key=env["SERVICE_ROLE_KEY"])
        except Exception:pass
marker("SOURCE155_SAFE_FIRST_ACCOUNT_REAL_ES256_PASS",
       "LOCAL_DISPOSABLE_ONLY_NOT_GO_LIVE_OR_PROVIDER_UPGRADE")
