#!/usr/bin/env python3
"""Reuse the already accepted E2 signed fixture *bootstrap*; only new acceptance
is genuine signed Chromium CAS403 recovery without prior suite replay. No live Provider, Stage or real
Owner actors. Zero JWTs, emails, passwords and ID values are printed.
"""
import os
from pathlib import Path

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(k) for k in ["DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"])
original=Path("tests/comm-e2-source153-signed-positive.py").read_text()
# Reuse existing upstream fixture setup; do not reimplement Source149-153,
# Source153 Edge/Decoder, Policy/Grant mock, signed GoTrue issuer, or test suite.
source_line='users[who]={"id":uid,"token":token}'
assert original.count(source_line)==1, "ACCEPTED_E2_FIXTURE_DRIFT"
original=original.replace(source_line,
    'users[who]={"id":uid,"token":token,"email":email,"password":password}')
cut='    # Required negative cases are new post-Grant tests (no historic E1 replay).'
assert original.count(cut)==1, "E2_ACCEPTED_MARKER_DRIFT"
source=original.split(cut,1)[0]
assert 'marker("E2-P05"' in source and 'marker("E2-P04"' in source
# Final code executes inside the same disposable local DB test transaction
# scope. No new Grant/Withdraw/Delete/Publish endpoint is exposed in the UI.
source+='''
    import subprocess
    import urllib.request
    # Browser receives only credentials created inside this ephemeral runner.
    # It logs no token, password, Account, Work or Media identifiers.
    env=os.environ.copy()
    env["VITE_DDVRE_E2_OWNER_READONLY"]="LOCAL_DISPOSABLE_ONLY"
    env["VITE_DDVRE_E2_LOCAL_ANON_KEY"]=anon
    env["E2_ORIGINAL_WORK_ID"]=str(original)
    env["E2_POST_WORK_ID"]=str(post)
    for who,key in [("A","OWNER"),("B","B"),("M","M")]:
        env["E2_"+key+"_EMAIL"]=users[who]["email"]
        env["E2_"+key+"_PASSWORD"]=users[who]["password"]
    child=subprocess.Popen(
        ["npm","run","dev","--","--config","scripts/vite-source153-e2.config.mjs","--host","127.0.0.1","--port","4175"],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env)
    try:
        for _ in range(80):
            if child.poll() is not None:
                raise AssertionError("LOCAL_WAND_SERVER_EXITED")
            try:
                with urllib.request.urlopen("http://127.0.0.1:4175/dreamsnaps/my/manage/source153-e2/",timeout=2) as resp:
                    if resp.status==200: break
            except Exception: time.sleep(1)
        else: raise AssertionError("LOCAL_WAND_SERVER_TIMEOUT")
        # New-only two-phase runner handshake. Browser never controls SQL:
        # only the test runner issues a genuine signed Owner withdrawal.
        proc=subprocess.Popen(["node","scripts/web-owner-revalidation-chrome.mjs"],
            env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,text=True,bufsize=1)
        try:
            ready=proc.stdout.readline().strip()
            assert ready=="WEB403_READY_WITH_CAS1",("SIGNED_403_CAS1_SYNC_FAILED",)
            st,h,r=owner("A","action",original,action="withdraw",
                expectedRowVersion=1,expectedAuthorizationEpoch=1)
            assert st==200 and safe_edge_headers(h) and r.get("ok") is True, ("SIGNED_WITHDRAW_FAILED",st)
            assert scalar("select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
            assert scalar("select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
            proc.stdin.write("WITHDRAW_DONE\\n");proc.stdin.flush()
            ready=proc.stdout.readline().strip()
            assert ready=="WEB403_REVOKE_READY",("SIGNED_403_FRESH_SYNC_FAILED",ready[:40])
            with db.transaction():
                db.execute("update public.auth_identities set identity_state='retired' where account_id=%s",(account["A"],))
            assert scalar("select identity_state::text from public.auth_identities where account_id=%s",(account["A"],))=="retired"
            proc.stdin.write("REVOKE_DONE\\n");proc.stdin.flush()
            out,err=proc.communicate(timeout=180)
            diagnostic=next((line for line in out.splitlines() if line.startswith("WEB403_CASELINE ")), "LINE_UNKNOWN")
            assert proc.returncode==0,("SIGNED_403_BROWSER_FAILED",proc.returncode,diagnostic)
            assert "WEB_OWNER_403_RECOVERY_SIGNED_CHROMIUM_NEW_ONLY_PASS_LOCAL" in out, ("MISSING_NEW_BROWSER_MARKER",)
            http_status={}
            for key in ("STALE_CAS","EXPLICIT_FRESH","REVOKED_READ","REVOKED_FRESH"):
                line=next((v for v in out.splitlines() if v.startswith("WEB403_HTTP_"+key+"=")),None)
                assert line is not None, ("MISSING_STATUS_ONLY",key)
                http_status[key]=int(line.rsplit("=",1)[1])
            assert http_status["STALE_CAS"]==403 and http_status["EXPLICIT_FRESH"]==200
            assert http_status["REVOKED_READ"] in (401,403,404)
            assert http_status["REVOKED_FRESH"] in (401,403,404)
            print("WEB403_HTTP_STATUS_ONLY stale={} fresh={} revokedRead={} revokedFresh={}".format(
                http_status["STALE_CAS"],http_status["EXPLICIT_FRESH"],
                http_status["REVOKED_READ"],http_status["REVOKED_FRESH"]))
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.communicate()
        marker("WEB_OWNER_403_RECOVERY_NEW_ONLY","SIGNED_CAS403_THEN_MANUAL_FRESH_WITHDRAWN_THEN_REVOKED_DENIED")
    finally:
        child.terminate()
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:child.kill()
'''
# Execute only frozen E2 setup followed by novel Chromium browser assertion.
exec(compile(source,"accepted-e2-fixture-prefix-in-memory.py","exec"),
    {"__name__":"__main__"})
