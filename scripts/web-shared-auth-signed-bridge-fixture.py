#!/usr/bin/env python3
"""Disposable genuine GoTrue ES256 + Source153 browser bridge.

Reuse previously accepted E2 FULL153 setup; only new test is real shared
Community Browser Auth candidate -> PR291 controller -> strict WEB267.
No remote credentials, Stage116, Provider or persistent Writer.
"""
import os
from pathlib import Path

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert not any(os.getenv(k) for k in
               ["DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"])
upstream=Path("tests/comm-e2-source153-signed-positive.py").read_text()
needle='users[who]={"id":uid,"token":token}'
assert upstream.count(needle)==1,"ACCEPTED_SIGNED_FIXTURE_DRIFT"
upstream=upstream.replace(needle,
    'users[who]={"id":uid,"token":token,"email":email,"password":password}')
split='    # Required negative cases are new post-Grant tests (no historic E1 replay).'
assert upstream.count(split)==1,"ACCEPTED_SIGNED_E2_BOUNDARY_DRIFT"
source=upstream.split(split,1)[0]
assert 'marker("E2-P05"' in source and 'marker("E2-P04"' in source
source+='''
    import subprocess
    import urllib.request
    env=os.environ.copy()
    env["VITE_DDVRE_E2_OWNER_READONLY"]="LOCAL_DISPOSABLE_ONLY"
    env["VITE_DDVRE_SHARED_BRIDGE"]="LOCAL_DISPOSABLE_ONLY"
    # The actual Community browser client requires HTTPS in its candidate
    # contract. The test's browser-only fetch shim maps THIS virtual URL
    # to the accepted Vite loopback proxy, NOT a production BFF.
    env["VITE_SUPABASE_URL"]="https://wand-disposable-e2.invalid"
    # Shared CommunityClient strictly requires sb_publishable_ format.
    # The current FULL153 legacy local ANON_KEY is valid for real GoTrue,
    # but incompatible with CommunityClient assertConfig. Chrome's isolated
    # request shim translates this disposable public alias to local anon.
    env["VITE_SUPABASE_PUBLISHABLE_KEY"]="sb_publishable_disposable_local_bridge_only"
    env["E2_REAL_LOCAL_ANON_PUBLIC_KEY"]=anon
    env["E2_ORIGINAL_WORK_ID"]=str(original)
    env["E2_POST_WORK_ID"]=str(post)
    for who,key in [("A","OWNER"),("B","B"),("M","M")]:
        env["E2_"+key+"_EMAIL"]=users[who]["email"]
        env["E2_"+key+"_PASSWORD"]=users[who]["password"]
    app=subprocess.Popen(
        ["npm","run","dev","--","--config","scripts/vite-source153-e2.config.mjs",
         "--host","127.0.0.1","--port","4175"],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env)
    try:
        for _ in range(80):
            if app.poll() is not None:
                raise AssertionError("DISPOSABLE_VITE_SERVER_FAILED")
            try:
                with urllib.request.urlopen(
                    "http://127.0.0.1:4175/disposable-owner-signed-bridge/",
                    timeout=2) as response:
                    if response.status==200:break
            except Exception:time.sleep(1)
        else:raise AssertionError("DISPOSABLE_VITE_SERVER_TIMEOUT")
        browser=subprocess.Popen(
            ["node","scripts/web-shared-auth-signed-bridge-chrome.mjs"],
            env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,text=True,bufsize=1)
        try:
            ready=browser.stdout.readline().strip()
            if ready!="BRIDGE_CAS_READY":
                # Never leak raw browser stderr (it may contain ephemeral URLs,
                # user IDs or credentials). Report the exception type and
                # script location only, sufficient for scoped fixture repair.
                import re
                details=browser.stderr.read()
                kind=next((name for name in
                    ("AssertionError","TimeoutError","TypeError","SyntaxError","Error")
                    if name in details),"UNKNOWN")
                locations=re.findall(r'web-shared-auth-signed-bridge-chrome[.]mjs:([0-9]+)',details)
                raise AssertionError(("SIGNED_BRIDGE_FIRST_PHASE_FAILED",kind,
                    locations[-1] if locations else "UNKNOWN"))
            # Signed Source153 write is performed ONLY inside this accepted
            # existing disposable fixture, never via the Owner browser.
            st,h,r=owner("A","action",original,action="withdraw",
                expectedRowVersion=1,expectedAuthorizationEpoch=1)
            assert st==200 and safe_edge_headers(h) and r.get("ok") is True,("SIGNED_WITHDRAW_DENIED",st)
            assert scalar("select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
            assert scalar("select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
            browser.stdin.write("WITHDRAW_DONE\\n");browser.stdin.flush()
            output,stderr=browser.communicate(timeout=180)
            assert browser.returncode==0,("SIGNED_BRIDGE_BROWSER_FAILED",browser.returncode,
                (stderr or "")[-350:].replace("\\n"," "))
            for indicator in ("WEB_SHARED_SIGNED_BRIDGE_LOCAL_BROWSER_PASS",
                "WEB_SHARED_SIGNED_BRIDGE_CACHE_FOUR_VISIBLE_STRIP_REJECTED",
                "WEB_SHARED_SIGNED_BRIDGE_ACTOR_CAS_LOGOUT_STALE_DENIED"):
                assert indicator in output,("MISSING_BROWSER_RESULT",indicator)
            print("WEB_SHARED_SIGNED_BRIDGE_ACTUAL_LOCAL_ES256_BROWSER_PASS")
        finally:
            if browser.poll() is None:
                browser.kill()
                browser.communicate()
    finally:
        app.terminate()
        try:app.wait(timeout=10)
        except subprocess.TimeoutExpired:app.kill()
'''
exec(compile(source,"accepted-full153-e2-prefix-in-memory.py","exec"),
     {"__name__":"__main__"})
