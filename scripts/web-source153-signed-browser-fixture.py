#!/usr/bin/env python3
"""Reuse the already accepted E2 signed fixture *bootstrap*; only new acceptance
is signed Chromium browser OwnerAuthority UI. No live Provider, Stage or real
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
        ["npm","run","dev","--","--host","127.0.0.1","--port","4175"],
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
        subprocess.run(["node","scripts/web-source153-signed-owner-chrome.mjs"],
            check=True,env=env,timeout=240)
        marker("WEB_E2_OWNER_SIGNED_CHROME","REAL_ES256_LOCAL_BROWSER_READONLY_VERIFIED_NO_PUBLIC_ACTIVATION")
    finally:
        child.terminate()
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:child.kill()
'''
# Execute only frozen E2 setup followed by novel Chromium browser assertion.
exec(compile(source,"accepted-e2-fixture-prefix-in-memory.py","exec"),
    {"__name__":"__main__"})
