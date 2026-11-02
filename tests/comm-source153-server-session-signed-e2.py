#!/usr/bin/env python3
"""NEW signed Source153 HTTP; PR288 genuine GoTrue E2 fixture reused unchanged on disk.
No Stage116, provider internet or token logging. In-memory injection has no
client JWT-signing, no session self-enrollment, no bypass of original E2 setup.
"""
import os,sys
from pathlib import Path
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
orig=Path("tests/comm-e2-source153-signed-positive.py").read_text()
assert orig.count("users={}") ==1
orig=orig.replace("users={}","users={}\npasswords={}",1)
pw='    password=secrets.token_urlsafe(32)+"_A1"'
assert orig.count(pw)==1
orig=orig.replace(pw,pw+"\n    passwords[who]=password",1)
line='    users[who]={"id":uid,"token":token}'
assert orig.count(line)==1
orig=orig.replace(line,'    users[who]={"id":uid,"token":token,"refresh":login["refresh_token"]}',1)
migration_assert='    assert scalar("select count(*) from supabase_migrations.schema_migrations")==153'
assert orig.count(migration_assert)==1
orig=orig.replace(migration_assert,migration_assert.replace("==153","==154"),1)
hook='    marker("E2_TARGETED_SIGNED_SOURCE153_TO_WEB267_PASS","LOCAL_TEST_ONLY_NOT_REAL_POLICY_CONSENT_OR_PROVIDER")'
assert orig.count(hook)==1
cases=r'''
    # New P0 genuine-session assertions are executed AFTER the inherited E2
    # positive/negative fixture. Original historical cases are not reaccepted.
    def a_login():
        st,_,r=http("/auth/v1/token?grant_type=password",body={
          "email":prefix+"-a@example.invalid","password":passwords["A"]})
        assert st==200 and r.get("access_token") and r.get("refresh_token"),"A_LOGIN_FAILED"
        t=r["access_token"]; c=jwt_payload(t); h=jwt_json_chunk(t,0)
        assert h.get("alg")=="ES256" and any(k.get("kid")==h.get("kid") for k in public_keys)
        assert c["sub"]==str(users["A"]["id"]) and c.get("session_id") and c["exp"]>time.time()+30
        return t,r["refresh_token"]

    def e2_http(token,body):
        st,h,r=http(path,body=body,token=token)
        assert safe_edge_headers(h),"SIGNED_PRIVATE_HEADERS_MISSING"
        return st,r
    def auth_read(t):
        assert jwt_payload(t)["exp"]>time.time(),"REPLAY_JWT_EXPIRED"
        st,r=e2_http(t,{"operation":"authority","workId":str(post),
           "expectedRowVersion":1,"expectedAuthorizationEpoch":1})
        if st!=200: assert str(post) not in json.dumps(r),"PRIVATE_DENIAL_LEAK"
        return st
    a1=users["A"]["token"]
    a1_refresh=users["A"]["refresh"]
    a2,a2_refresh=a_login()
    assert jwt_payload(a1)["session_id"]!=jwt_payload(a2)["session_id"]
    assert auth_read(a1)==200 and auth_read(a2)==200
    assert auth_read(users["B"]["token"])==403
    assert auth_read(users["M"]["token"])==403
    # Real GoTrue itself must have registered every legitimate session.
    for tok in (a1,a2,users["B"]["token"],users["M"]["token"]):
        c=jwt_payload(tok)
        assert scalar("select exists(select 1 from auth.sessions where id=%s and user_id=%s)",
          (uuid.UUID(c["session_id"]),uuid.UUID(c["sub"])))
    marker("R01-FOUR-GOTRUE-REGISTERED-SIGNED-SESSIONS",
        "REAL_AUTH_SESSION_TABLE_AND_SOURCE153_200_A1_A2_403_FOREIGN")

    old_global_cutoff=scalar("select sessions_valid_after from public.auth_identities where provider='supabase' and provider_subject=%s",
        (str(users["A"]["id"]),))
    st,r=e2_http(a1,{"operation":"session-revoke","scope":"local"})
    assert st==200 and r.get("ok") is True and r.get("state")=="revoked","LOCAL_REVOKE_FAILED"
    assert auth_read(a1)==401 and auth_read(a2)==200
    assert auth_read(users["B"]["token"])==403 and auth_read(users["M"]["token"])==403
    assert scalar("select sessions_valid_after from public.auth_identities where provider='supabase' and provider_subject=%s",
        (str(users["A"]["id"]),))==old_global_cutoff
    marker("R02-LOCAL-A1-REVOKE","REAL_SOURCE153_A1_401_A2_200_B_M_403_CUTOFF_UNCHANGED",401)
    # Direct authenticated PostgREST SQL RPC must NOT bypass Edge verification.
    # The forward-only migration extends the ORIGINAL private Source150 verifier
    # inside the same authenticated SQL transaction.
    for rpc,args in (
      ("community_dreamsnap_x05_owner_authority_v2",{
         "p_work_id":str(post),"p_expected_row_version":1,
         "p_expected_authorization_epoch":1}),
      ("community_dreamsnap_x05_owner_read_v1",{"p_work_id":str(post)}),
    ):
      st,_,result=http("/rest/v1/rpc/"+rpc,body=args,token=a1)
      assert st in (400,401,403),"REVOKED_DIRECT_RPC_BYPASS"
      assert str(post) not in json.dumps(result),"DIRECT_RPC_PRIVATE_LEAK"
      st2,_,_=http("/rest/v1/rpc/"+rpc,body=args,token=a2)
      assert st2==200,"SIBLING_A2_DIRECT_RPC_DENIED"
    # Authenticated callers cannot write revocations or forge service RPC
    # subject/session parameters outside the authenticated Edge.
    assert not scalar("select has_table_privilege('authenticated','private.wand_verified_session_revocations_v1','INSERT')")
    assert not scalar("select has_function_privilege('authenticated',"
      "'public.community_revoke_signed_session_v1(uuid,bigint,uuid,text)','EXECUTE')")
    marker("R02B-DIRECT-RPC-GUARD","REVOKED_A1_DENIED_A2_ALLOWED_BOTH_SQL_READ_PATHS")


    # Same original JWT can at most repeat its terminal revoke, not re-register.
    st,r=e2_http(a1,{"operation":"session-revoke","scope":"local"})
    assert st==200 and r.get("state")=="already-revoked","LOCAL_NOT_IDEMPOTENT"
    st,r=e2_http(a1,{"operation":"session-revoke","scope":"global"})
    assert st==401,"REVOKED_A1_UPGRADED_TO_GLOBAL"
    assert auth_read(a2)==200
    marker("R03-TERMINAL-IDEMPOTENCY","REPEAT_LOCAL_NOOP_UPGRADE_DENIED",st)

    # Refresh is a REAL GoTrue request. Even if it succeeds, the old Session
    # ID must remain revoked by Source153 (no self-registration bypass).
    st,_,ref=http("/auth/v1/token?grant_type=refresh_token",
         body={"refresh_token":a1_refresh})
    assert st in (200,400,401,403,422),"UNEXPECTED_REFRESH_STATUS"
    if st==200:
        t=ref["access_token"]
        assert jwt_payload(t)["session_id"]==jwt_payload(a1)["session_id"]
        assert auth_read(t)==401,"ROTATED_TOKEN_REVIVED_REVOKED_SESSION"
    marker("R04-REFRESH-A1","REFRESH_CANNOT_RESTORE_REVOKED_SESSION",st)
    # Source153 revocation persisted even with no GoTrue logout request.
    assert auth_read(a1)==401
    marker("R05-PROVIDER-LOGOUT-UNREACHABLE","SERVER_REVOKED_WITHOUT_GOTRUE_LOGOUT",401)

    st,r=e2_http(a2,{"operation":"session-revoke","scope":"global"})
    assert st==200 and r.get("state")=="revoked","GLOBAL_REVOKE_FAILED"
    assert auth_read(a1)==401 and auth_read(a2)==401
    assert auth_read(users["B"]["token"])==403 and auth_read(users["M"]["token"])==403
    marker("R06-GLOBAL-A-REVOKE","REAL_SOURCE153_A1_A2_401_B_M_SESSION_PRESERVED",401)
    for tok in (a1,a2):
      dst,_,dresponse=http("/rest/v1/rpc/community_dreamsnap_x05_owner_authority_v2",
        body={"p_work_id":str(post),"p_expected_row_version":1,
              "p_expected_authorization_epoch":1},token=tok)
      assert dst in (400,401,403) and str(post) not in json.dumps(dresponse), "GLOBAL_DIRECT_RPC_BYPASS"
    marker("R06B-GLOBAL-DIRECT-RPC","A1_A2_POSTGREST_DENIED_NO_BYPASS")

    cutoff=scalar("select sessions_valid_after from public.auth_identities where provider='supabase' and provider_subject=%s",
       (str(users["A"]["id"]),))
    assert cutoff>old_global_cutoff
    st,r=e2_http(a2,{"operation":"session-revoke","scope":"global"})
    assert st==200 and r.get("state")=="already-revoked"
    assert scalar("select sessions_valid_after from public.auth_identities where provider='supabase' and provider_subject=%s",
       (str(users["A"]["id"]),))==cutoff,"GLOBAL_REPLAY_MOVED_CUTOFF"
    marker("R07-GLOBAL-IDEMPOTENCY","REPLAY_CANNOT_SHIFT_CUTOFF",st)

    # Fresh A3 minted after the next whole-second JWT cutoff must be allowed.
    time.sleep(2)
    a3,_=a_login()
    assert jwt_payload(a3)["session_id"] not in (
       jwt_payload(a1)["session_id"],jwt_payload(a2)["session_id"])
    assert auth_read(a3)==200
    assert auth_read(a1)==401 and auth_read(a2)==401
    marker("R08-A3-POSTCUTOFF","NEW_GOTRUE_SESSION_REAL_SOURCE153_200_OLD_401",200)
    dst,_,_=http("/rest/v1/rpc/community_dreamsnap_x05_owner_authority_v2",
        body={"p_work_id":str(post),"p_expected_row_version":1,
          "p_expected_authorization_epoch":1},token=a3)
    assert dst==200, "NEW_A3_DIRECT_RPC_REGRESSION"
    marker("R08B-NEW-A3-DIRECT-RPC","NEW_VERIFIED_SESSION_SQL_AUTHORITY_200",dst)


    # A genuine old signed JWT for a GoTrue-REMOVED session must be denied;
    # no Wand self-registration path exists. GoTrue's provider behavior is
    # deliberately measured instead of assumed.
    a4,_=a_login()
    assert auth_read(a4)==200
    st,_,_=http("/auth/v1/logout?scope=local",token=a4)
    assert st in (200,204),"A4_GOTRUE_LOGOUT_UNEXPECTED"
    old=auth_read(a4)
    session_exists=scalar("select exists(select 1 from auth.sessions where id=%s and user_id=%s)",
      (uuid.UUID(jwt_payload(a4)["session_id"]),users["A"]["id"]))
    marker("R09-PROVIDER-SESSION-REMOVAL","OLD_GOTRUE_LOGGED_OUT_SOURCE_HTTP",old)
    assert not session_exists and old==401,"PROVIDER_REMOVED_SESSION_JWT_STILL_ACCEPTED"

    # Cannot impersonate a missing session via client-supplied JSON; strict
    # parser rejects unknown field and the Edge only uses verified ctx claims.
    st,r=e2_http(a3,{"operation":"authority","workId":str(post),
       "sessionId":str(uuid.uuid4())})
    assert st==400,"CLIENT_SUPPLIED_SESSION_ID_ACCEPTED"
    marker("R10-UNTRUSTED-SESSION-ID","CLIENT_JSON_DID_NOT_SELECT_AUTHORITY",st)

    # Never use a signed old token to re-enroll or restore revoked state.
    assert scalar("select count(*) from private.wand_verified_session_revocations_v1 where provider_subject=%s",
       (users["A"]["id"],))==2
    users["A"]["token"]=a3
    marker("SOURCE153_SERVER_ENFORCED_SIGNED_SESSION_PASS",
      "REAL_SIGNED_EDGE_SQL_NOT_TEMP_GATE_NOT_MANAGED_RUNTIME")
'''
orig=orig.replace(hook,cases+"\n"+hook,1)
try:
    exec(compile(orig,"tests/comm-e2-source153-signed-positive.py","exec"),{"__name__":"__main__"})
except BaseException as exc:
    print("SOURCE153_SIGNED_SESSION_TEST_FAILED "+type(exc).__name__,flush=True)
    sys.exit(1)
