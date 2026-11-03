#!/usr/bin/env python3
"""QR337 real signed local test of ONLY new legacy comments Edge OFF route.
Uses the cumulative Source156 signed bootstrap as disposable fixture, never
promotes previously accepted Source156 evidence or tests other Writers.
"""
from pathlib import Path
import os,sys
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert all(not os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source156-cumulative-gotrue-local.py")
src=p.read_text()
capture="s=p.read_text()"
assert src.count(capture)==1
src=src.replace(capture,capture+'''
assert s.count("d0,_=login(D)") == 1, "QR337_FIXTURE_CHANGED"
s=s.replace("d0,_=login(D)","d0,refresh_d0=login(D)",1)
''',1)
anchor='    marker("C03-C08-SAME-ACCOUNT-REVOCATION","A0_LOCAL_REVOKED_ALL_OLD_ROUTES_401_SIBLING_200_NO_UNAUTHORIZED_WORKSPACE",401)'
assert src.count(anchor)==1,"QR337_LEGACY_FIXTURE_ANCHOR_DRIFT"
extra=r'''
    # Only the legacy comments command is under test (not the accepted R16).
    # D1 active sibling must be an eligible REAL GoTrue signed session.
    request_legacy={"command":"setGalleryCommentsEnabled","payload":{
      "workId":str(gw),"enabled":True,
      "authSubject":str(D["id"]),"sessionId":jwt(d0,1)["session_id"]}}
    before=gallery_state()
    s,hh,result=http("/functions/v1/community-command",body=request_legacy,token=d1)
    assert s==409 and private_headers(hh) and result.get("error")=="R17_LEGACY_COMMENTS_WRITER_NOT_ENROLLED",("QR337_LIVE_409",s,result)
    assert gallery_state()==before,"QR337_LIVE_409_DB_MUTATION"
    marker("QR337-SIGNED-ACTIVE-OFF","A2_REAL_JWT_409_RATE_AND_DB_WRITES_BYPASSED",s)
    revoked,rh,_=http("/functions/v1/community-command",body=request_legacy,token=d0)
    assert revoked==401 and private_headers(rh) and gallery_state()==before,("QR337_REVOKED_401",revoked)
    marker("QR337-SIGNED-REVOKED","A1_OLD_JWT_401_DB_UNCHANGED",revoked)
    refresh_status,_,rot=http("/auth/v1/token?grant_type=refresh_token",body={"refresh_token":refresh_d0})
    assert refresh_status==200 and rot.get("access_token"),("QR337_REFRESH_NOT_COMPLETED",refresh_status)
    assert jwt(rot["access_token"],1)["session_id"]==jwt(d0,1)["session_id"],"QR337_REFRESH_SESSION_CHANGED"
    refreshed,fx,_=http("/functions/v1/community-command",body=request_legacy,token=rot["access_token"])
    assert refreshed==401 and private_headers(fx) and gallery_state()==before,("QR337_REFRESHED_REVOKED_401",refreshed)
    marker("QR337-SIGNED-REFRESHED-REVOKED","A1_REFRESH_ROTATED_SAME_SESSION_401_DB_UNCHANGED",refreshed)
    # Actual catalog with final unchanged Source156: untrusted actor roles
    # cannot directly EXECUTE old legacy writer. Service-role may still have
    # unbounded direct privilege; report explicitly, never infer closed.
    legacy="public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)"
    grants={role:bool(scalar("select has_function_privilege(%s,%s,'EXECUTE')",(role,legacy))) for role in ("anon","authenticated","service_role")}
    assert not grants["anon"] and not grants["authenticated"],("QR337_UNTRUSTED_RPC_EXECUTE",grants)
    assert gallery_state()==before,"QR337_ACL_TEST_MUTATED"
    print("QR337_LEGACY_RPC_SERVICE_ROLE_EXECUTE_"+str(grants["service_role"]).upper(),flush=True)
    marker("QR337-ROLE-ACL","ANON_AND_AUTHENTICATED_DIRECT_EXECUTE_DENIED_SERVICE_ROLE_SEPARATE_GATE",403)
    marker("QR337_INDEPENDENT_GOTRUE_SIGNED_OFF_PASS","NEW_LEGACY_COMMAND_ONLY",409)
'''
src=src.replace(anchor,anchor+"\n"+extra,1)
try:
    exec(compile(src,str(p),"exec"),{"__name__":"__main__"})
except BaseException as exc:
    print("QR337_SIGNED_NEW_ONLY_FAIL "+type(exc).__name__+" "+str(exc)[:180],flush=True)
    sys.exit(1)
