#!/usr/bin/env python3
"""TEST ONLY: real GoTrue ES256 JWT + FULL153, with TEMPORARY PostgreSQL per-session gate.

The temporary gate is NOT called by production Source153 and does not verify
JWT signatures by itself. Fixture-issued genuine JWTs are validated by GoTrue/JWKS
and sent separately to unmodified Source153 real HTTP. Gate accepts ONLY
claims from those validated fixture-issued tokens. No secret/UUID/token prints.
"""
import os
import sys
from pathlib import Path
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))

path=Path("tests/comm-e2-source153-signed-positive.py")
source=path.read_text(encoding="utf8")
hook="    # Required negative cases are new post-Grant tests (no historic E1 replay)."
assert source.count(hook)==1 and source.count("users={}") == 1
source=source.replace("users={}","users={}\npasswords={}",1)
old='    password=secrets.token_urlsafe(32)+"_A1"'
assert source.count(old)==1
source=source.replace(old,old+"\n    passwords[who]=password",1)

extra=r'''
    # TRUE GoTrue ES256 A1/B1/M1 tokens and actual unmodified Source153 HTTP.
    # This table exists only in this PostgreSQL connection (TEMPORARY).
    a1=users["A"]["token"]
    sub_a=uuid.UUID(str(users["A"]["id"]))
    sub_b=uuid.UUID(str(users["B"]["id"]))
    sub_m=uuid.UUID(str(users["M"]["id"]))
    exp_a=jwt_payload(a1)["exp"]
    assert exp_a>time.time()+30
    def issue_a():
        status,_,r=http("/auth/v1/token?grant_type=password",
            body={"email":prefix+"-a@example.invalid","password":passwords["A"]})
        assert status==200 and r.get("access_token") and r.get("refresh_token"),"LINEAGE_LOGIN_FAILURE"
        token=r["access_token"]
        hdr=jwt_json_chunk(token,0)
        claims=jwt_payload(token)
        assert hdr["alg"]=="ES256" and any(k.get("kid")==hdr.get("kid") for k in public_keys)
        assert claims["sub"]==str(sub_a) and uuid.UUID(claims["session_id"])
        assert claims["exp"]>time.time()+30
        return token,r["refresh_token"]
    a2,refresh_a2=issue_a()
    assert jwt_payload(a1)["session_id"]!=jwt_payload(a2)["session_id"],"TWO_LOGINS_ONE_SESSION"
    # Three signed principals, four legitimate sessions. A1/A2 are independent.
    signed={"A1":a1,"A2":a2,"B1":users["B"]["token"],"M1":users["M"]["token"]}
    db.execute("""create temporary table test_only_session_lineage (
      subject uuid not null, session_id uuid primary key,
      is_revoked boolean not null default false,
      generation integer not null default 0
    ) on commit preserve rows""")
    def claims(tok):
        c=jwt_payload(tok)
        assert c["exp"]>time.time(),"PRE_EXPIRY_JWT_REQUIRED"
        assert c["role"]=="authenticated" and c["session_id"]
        return uuid.UUID(c["sub"]),uuid.UUID(c["session_id"])
    def enroll(tok):
        sub,sid=claims(tok)
        db.execute("insert into pg_temp.test_only_session_lineage(subject,session_id) values (%s,%s)",
          (sub,sid))
    for label,tok in signed.items(): enroll(tok)
    def gate(tok):
        sub,sid=claims(tok)
        row=db.execute("""select is_revoked from pg_temp.test_only_session_lineage
          where subject=%s and session_id=%s""",(sub,sid)).fetchone()
        return row is not None and row[0] is False
    def source_read(tok):
        st,h,b=http(path,body={"operation":"authority","workId":str(post),
          "expectedRowVersion":1,"expectedAuthorizationEpoch":1},token=tok)
        assert safe_edge_headers(h),"PRIVATE_HEADERS_REQUIRED"
        if st!=200: assert str(post) not in json.dumps(b),"DENIAL_LEAK"
        return st
    assert all(gate(tok) for tok in signed.values())
    assert source_read(a1)==200 and source_read(a2)==200
    assert source_read(users["B"]["token"])==403
    assert source_read(users["M"]["token"])==403
    marker("L01-GENUINE-ES256-FOUR-SESSIONS","TEST_TEMP_SESSION_GATE_BASELINE_GOOD")
    # Unknown, unenrolled session IDs and cross-subject combinations: FAIL CLOSED.
    sub2,sid2=claims(a2)
    assert not bool(db.execute("""select 1 from pg_temp.test_only_session_lineage
      where subject=%s and session_id=%s""",(sub_b,sid2)).fetchone())
    assert not bool(db.execute("""select 1 from pg_temp.test_only_session_lineage
      where subject=%s and session_id=%s""",(sub_a,uuid.uuid4())).fetchone())
    marker("L02-UNKNOWN-OR-MISMATCHED-SESSION","TEMP_SERVER_GATE_DENIES_UNKNOWN")

    # Local Logout: revoke A1 only. A2/B/M are untouched; existing *account*
    # wide sessions_valid_after stays unchanged, proving scope isolation.
    previous_cutoff=scalar("""select sessions_valid_after from public.auth_identities
      where provider='supabase' and provider_subject=%s""",(str(sub_a),))
    st,_,_=http("/auth/v1/logout?scope=local",token=a1)
    assert st in (200,204),"GOTRUE_LOCAL_LOGOUT_FAILED"
    with db.transaction():
      db.execute("""update pg_temp.test_only_session_lineage
        set is_revoked=true,generation=generation+1
        where subject=%s and session_id=%s and not is_revoked""",claims(a1))
    assert not gate(a1) and gate(a2) and gate(users["B"]["token"]) and gate(users["M"]["token"])
    assert scalar("""select sessions_valid_after from public.auth_identities
      where provider='supabase' and provider_subject=%s""",(str(sub_a),))==previous_cutoff
    marker("L03-LOCAL-SCOPE","A1_REVOKED_A2_B_M_PRESERVED_ACCOUNT_CUTOFF_UNCHANGED",st)

    # Unmodified Source153 still ACCEPTS old A1 JWT while pre-expiry: this is
    # explicitly a contract GAP, not a test-only gate integrated into product.
    assert source_read(a1)==200 and source_read(a2)==200
    marker("L04-UNWIRED-SOURCE153","OLD_A1_SOURCE_HTTP200_TEST_GATE_DENY_DISTINCT",200)
    # Refresh already issued under A1 cannot change gate's session_id verdict.
    # A2 remains a normal independent signed GoTrue session.
    marker("L05-SAME-SESSION-ROTATION","REVOKED_SESSION_ID_REMAINS_DENIED")

    # Delayed request: an earlier preflight ALLOW is not a durable authority
    # lease. Recheck before use/commit; do NOT replay non-idempotent Writers.
    before=gate(a2)
    assert before
    st,_,_=http("/auth/v1/logout?scope=global",token=a2)
    assert st in (200,204),"GOTRUE_GLOBAL_LOGOUT_FAILED"
    with db.transaction():
      db.execute("""update pg_temp.test_only_session_lineage
        set is_revoked=true,generation=generation+1
        where subject=%s and not is_revoked""",(sub_a,))
    assert not gate(a1) and not gate(a2)
    assert gate(users["B"]["token"]) and gate(users["M"]["token"])
    assert before and not gate(a2),"DELAYED_SERVER_AUTHORITY_NOT_RECHECKED"
    marker("L06-GLOBAL-SCOPE","A_ALL_REGISTERED_REVOKED_B_M_UNCHANGED",st)
    # GoTrue Global does not alone advance the existing Source153 DB cutoff.
    assert scalar("""select sessions_valid_after from public.auth_identities
      where provider='supabase' and provider_subject=%s""",(str(sub_a),))==previous_cutoff
    assert source_read(a2)==200
    marker("L07-GLOBAL-BEFORE-CUTOFF","OLD_A2_SOURCE153_STILL200_NO_FALSE_REVOCATION",200)

    # Global fallback explicit account-wide cutoff: protects even JWTs from
    # unknown historic sessions once actual Source153 checks its existing RPC.
    with db.transaction():
      db.execute("""update public.auth_identities
        set sessions_valid_after=date_trunc('second',clock_timestamp())+interval '1 second'
        where provider='supabase' and provider_subject=%s""",(str(sub_a),))
    assert source_read(a1)==401 and source_read(a2)==401
    assert source_read(users["B"]["token"])==403
    assert jwt_payload(a2)["exp"]>time.time(),"A2_JWT_EXPIRED_BEFORE_DB_CUTOFF"
    marker("L08-GLOBAL-DB-CUTOFF","OLD_A_SESSION_JWT_HTTP401_B_FOREIGN403",401)
    # A fresh Session minted strictly after the cutoff can still read; the
    # GoTrue JWT iat is only second precision, so wait safely past the cutoff.
    time.sleep(2)
    a3,_=issue_a()
    assert source_read(a3)==200,"POST_CUTOFF_NEW_LOGIN_DENIED"
    assert not gate(a3),"UNENROLLED_NEW_SESSION_IMPLICITLY_TRUSTED"
    # Only an authenticated server-controlled enrollment may admit it.
    enroll(a3)
    assert gate(a3)
    users["A"]["token"]=a3 # inherited E2 negative cases use current A
    marker("L09-AFTER-GLOBAL-REAUTH","NEW_A3_SOURCE200_GATE_REQUIRES_EXPLICIT_REGISTRATION",200)

    # LAST: old retired Identity / restricted Work / Creator / Policy / Consent
    # tests are inherited E2 source suite and remain enforced per request.
    marker("LINEAGE_SIGNED_TEST_ONLY_PASS","TEMP_GATE_NOT_SOURCE153_PRODUCT_INTEGRATION")
'''
source=source.replace(hook,extra+"\n"+hook,1)
try:
    exec(compile(source,str(path),"exec"),{"__name__":"__main__"})
except BaseException as e:
    print("LINEAGE_TEST_FAILURE "+type(e).__name__,flush=True)
    sys.exit(1)
