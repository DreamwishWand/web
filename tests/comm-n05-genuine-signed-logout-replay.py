#!/usr/bin/env python3
"""Test-only N05–N07 augmentation of the PR288 genuine GoTrue ES256/FULL153 fixture.

No copy of Source153, WEB267, test signer, keys or real users. The accepted E2
positive fixture is executed unchanged except in-memory insertion of bounded
logout/refresh/replay cases and additional ephemeral password handles.
All outgoing requests hit 127.0.0.1 inside disposable Supabase CLI stack.
All logs are case labels and numeric HTTP codes, never tokens/IDs/passwords.
"""
import os
import sys
from pathlib import Path

assert os.environ.get("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert not any(os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
source_path=Path("tests/comm-e2-source153-signed-positive.py")
original=source_path.read_text(encoding="utf-8")
assert original.count('users={}')==1
assert original.count('    password=secrets.token_urlsafe(32)+"_A1"')==1
assert original.count('    users[who]={"id":uid,"token":token}')==1
hook='    # Required negative cases are new post-Grant tests (no historic E1 replay).'
final_hook='    marker("E2_TARGETED_SIGNED_SOURCE153_TO_WEB267_PASS","LOCAL_TEST_ONLY_NOT_REAL_POLICY_CONSENT_OR_PROVIDER")'
assert original.count(hook)==1 and original.count(final_hook)==1
source=original.replace("users={}","users={}\npasswords={}",1)
source=source.replace('    password=secrets.token_urlsafe(32)+"_A1"',
                      '    password=secrets.token_urlsafe(32)+"_A1"\n    passwords[who]=password',1)
source=source.replace('    users[who]={"id":uid,"token":token}',
                      '    users[who]={"id":uid,"token":token,"refresh":login["refresh_token"]}',1)

# Inserted INSIDE the already disposable DB context, after synthetic Grant
# and authenticated Source153 positive read, BEFORE the previous E2 negatives.
signed_cases=r"""
    # N05–N07: all real GoTrue ES256, real Edge/DB, but local disposable ONLY.
    # Preserve initial A JWT exactly, including exp, for replay.
    replay_a=users["A"]["token"]
    initial_a_refresh=users["A"]["refresh"]
    assert jwt_payload(replay_a)["exp"] > time.time()+30, "N05_JWT_PRE_EXPIRY_NOT_TESTABLE"
    def signed_read(token,work=post,version=1,epoch=1):
        return http(path,body={"operation":"authority","workId":str(work),
            "expectedRowVersion":version,"expectedAuthorizationEpoch":epoch},token=token)

    def private_receipt(case,token,expected_success=None):
        st,h,body=signed_read(token)
        assert st in (200,401,403,404,409), "N05_UNEXPECTED_SOURCE_HTTP"
        assert safe_edge_headers(h), "N05_SOURCE153_PRIVATE_CACHE_MISSING"
        if st==200:
            assert body.get("ok") is True
            assert body["data"]["authority"]["ownerAuthorized"] is True
            assert body["data"]["work"]["workId"]==str(post)
        else:
            assert str(post) not in json.dumps(body), "N05_PRIVATE_WORK_LEAK_ON_DENY"
        if expected_success is not None:
            assert (st==200) is expected_success, "N05_UNEXPECTED_SIGNED_AUTHORITY"
        marker(case,"REAL_GOTRUE_ES256_SOURCE153_HTTP",st)
        return st

    def new_a_login():
        st,h,body=http("/auth/v1/token?grant_type=password",body={
          "email":prefix+"-a@example.invalid","password":passwords["A"]})
        assert st==200 and body.get("access_token") and body.get("refresh_token"),"N05_FRESH_LOCAL_LOGIN_FAILED"
        tok=body["access_token"]
        hdr=jwt_json_chunk(tok,0); claims=jwt_payload(tok)
        assert hdr["alg"]=="ES256" and claims["sub"]==str(users["A"]["id"]) and claims.get("session_id")
        assert claims["exp"]>time.time()+30
        return tok,body["refresh_token"]

    marker("N05-SIGNED-PRE-EXPIRY","LOCAL_GOTRUE_REAL_ES256_A_B_M")
    private_receipt("N05-01-BASELINE-A",replay_a,True)
    private_receipt("N06-01-FOREIGN-B",users["B"]["token"],False)
    private_receipt("N06-02-REGISTERED-M",users["M"]["token"],False)

    # This does not send any logout to GoTrue. Two logical live tabs/old
    # bundles can still hold the same JWT; NOT an actual 2-tab Chrome test.
    private_receipt("N07-01-CANDIDATE-ONLY-LOGOUT-REPLAY",replay_a,True)
    # Synthetic offline/no-network to GoTrue: fail before sending any request.
    try:
        urllib.request.urlopen("http://127.0.0.1:1/auth/v1/logout?scope=local",timeout=1)
        raise AssertionError("N05_OFFLINE_ENDPOINT_UNEXPECTEDLY_REACHABLE")
    except urllib.error.URLError:
        pass
    private_receipt("N05-02-NO-GOTRUE-REQUEST-REPLAY",replay_a,True)

    # Genuine GoTrue local logout. A remote refresh revocation is not by
    # itself proof of a just-issued signed Access JWT's invalidity.
    st,_,_=http("/auth/v1/logout?scope=local",token=replay_a)
    assert st in (200,204), "N05_GOTRUE_LOCAL_LOGOUT_UNEXPECTED"
    marker("N05-03-GOTRUE-LOCAL-LOGOUT","REAL_LOCAL_LOGOUT_HTTP",st)
    private_receipt("N05-04-SAME-PREEXPIRY-ACCESS-JWT-AFTER-LOCAL-LOGOUT",replay_a)
    user_st,_,_=http("/auth/v1/user",method="GET",token=replay_a)
    marker("N05-05-GOTRUE-USER-SAME-ACCESS-JWT","AUTH_USER_HTTP",user_st)
    rst,_,rbody=http("/auth/v1/token?grant_type=refresh_token",
          body={"refresh_token":initial_a_refresh})
    assert rst in (200,400,401,403,422), "N05_GOTRUE_LOCAL_REFRESH_UNEXPECTED"
    marker("N05-06-OLD-REFRESH-AFTER-LOCAL-LOGOUT",
      "REFRESH_ISSUED" if rst==200 else "REFRESH_REJECTED",rst)

    # A fresh independent local GoTrue session allows genuine global logout.
    global_jwt,global_refresh=new_a_login()
    private_receipt("N05-07-NEW-A-BEFORE-GLOBAL-LOGOUT",global_jwt,True)
    gst,_,_=http("/auth/v1/logout?scope=global",token=global_jwt)
    assert gst in (200,204),"N05_GLOBAL_GOTRUE_LOGOUT_FAILED"
    marker("N05-08-GOTRUE-GLOBAL-LOGOUT","REAL_GLOBAL_LOGOUT_HTTP",gst)
    private_receipt("N05-09-SAME-PREEXPIRY-ACCESS-JWT-AFTER-GLOBAL-LOGOUT",global_jwt)
    grst,_,_=http("/auth/v1/token?grant_type=refresh_token",
           body={"refresh_token":global_refresh})
    assert grst in (200,400,401,403,422),"N05_GLOBAL_REFRESH_STATUS_UNEXPECTED"
    marker("N05-10-OLD-REFRESH-AFTER-GLOBAL-LOGOUT",
      "REFRESH_ISSUED" if grst==200 else "REFRESH_REJECTED",grst)

    # Reestablish A's *new* valid session before the original 04 QR accepted
    # E2 negative Work/Policy/Consent test sequence.
    resumed,ref=new_a_login()
    users["A"]["token"]=resumed
    users["A"]["refresh"]=ref
    private_receipt("N05-11-NEW-LOGIN-A-RESTORES-CURRENT-OWNER-READ",resumed,True)
    marker("N07-02-LOGICAL-OLD-TAB-STILL-HOLDS-ORIGINAL-JWT",
      "NO_BROWSER_OR_MIXED_VERSION_IN_THIS_TEST")
"""
source=source.replace(hook,signed_cases+"\n"+hook,1)
# Additional genuine Source153 DB-enforced cutoff AFTER original E2 negatives,
# because the original negative suite uses A and should not be disrupted.
cutoff_cases=r"""
    # N06 – server-side authored session cutoff is separate from GoTrue logout.
    # The E2 fixture leaves the policy inactive: Owner may still read a
    # private UNVERIFIED projection, not a public grant.
    old_a=users["A"]["token"]
    assert jwt_payload(old_a)["exp"]>time.time()+20
    st,h,b=owner("A","authority",post,expectedRowVersion=1,expectedAuthorizationEpoch=1)
    assert st==200 and safe_edge_headers(h) and b["data"]["grant"]["scopeStatus"]=="UNVERIFIED"
    marker("N06-03-INACTIVE-POLICY-PRIVATE-OWNER-UNVERIFIED","SIGNED_READ_NOT_PUBLIC_GRANT",st)
    # Set native Source cutoff ahead of token iat second: no synthetic JWT
    # claim GUC, no source changes, and no provider session assumptions.
    with db.transaction():
        db.execute("update public.auth_identities set sessions_valid_after="
          "date_trunc('second',clock_timestamp())+interval '1 second' "
          "where provider='supabase' and provider_subject=%s and identity_state='active'",
          (str(users["A"]["id"]),))
    cut,h,body=signed_read(old_a)
    assert cut in (401,403,404),"N06_SERVER_CUTOFF_DID_NOT_BLOCK_OWNER_READ"
    assert safe_edge_headers(h) and str(post) not in json.dumps(body)
    marker("N06-04-SOURCE153-DB-CUTOFF-OLD-SIGNED-JWT",
      "REAL_SIGNED_SERVER_DENY_PREEXPIRY",cut)
    assert jwt_payload(old_a)["exp"]>time.time(),"N06_CUTOFF_TEST_JWT_EXPIRED"
    marker("N06-05-JWT-SIGNATURE-STILL-NOT-REMOTE-OWNER-AUTHORIZATION",
      "DB_CUTOFF_DISTINCT_FROM_PROVIDER_LOGOUT")
    marker("N05_N07_SIGNED_REPLAY_SUITE_PASS",
      "DISPOSABLE_GOTRUE_AND_FULL153_NO_MANAGED_INGRESS")
"""
source=source.replace(final_hook,cutoff_cases+"\n"+final_hook,1)
# Explicitly redact any exception traceback. On failure the only diagnostics
# are the pre-error test-case markers; token and query/body never enter output.
try:
    exec(compile(source,str(source_path), "exec"),{"__name__":"__main__"})
except BaseException as exc:
    print("N05_N07_SIGNED_REPLAY_TEST_FAILED "+type(exc).__name__,flush=True)
    sys.exit(1)
