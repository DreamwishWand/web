#!/usr/bin/env python3
"""Local-only genuine GoTrue ES256 + Source154 Chromium acceptance.

Runs original accepted PR288 FULL153 fixture in-memory with the ONE migration
count adjustment to 154, then calls unchanged PR301 DEV route via Chrome.
Never uses Stage116, remote JWT, product Logout or managed ingress.
"""
import os, subprocess, time, urllib.request
from pathlib import Path

assert os.environ.get("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(k) for k in
    ["DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"])
accepted=Path("tests/comm-e2-source153-signed-positive.py").read_text()
needle='    users[who]={"id":uid,"token":token}'
assert accepted.count(needle)==1,"SIGNED_SOURCE154_FIXTURE_DRIFT"
accepted=accepted.replace(needle,
    '    users[who]={"id":uid,"token":token,"email":email,"password":password}',1)
migration='    assert scalar("select count(*) from supabase_migrations.schema_migrations")==153'
assert accepted.count(migration)==1,"SIGNED_SOURCE154_COUNT_DRIFT"
accepted=accepted.replace(migration,migration.replace("==153","==154"),1)
boundary='    # Required negative cases are new post-Grant tests (no historic E1 replay).'
assert accepted.count(boundary)==1,"SIGNED_SOURCE154_E2_BOUNDARY_DRIFT"
source=accepted.split(boundary,1)[0]
assert 'marker("E2-P04"' in source and 'marker("E2-P05"' in source
source+='''
    # This original E2 real GoTrue/Work/Policy/Consent setup creates all
    # disposable A/B/M identities and private post Work in REAL PostgreSQL.
    # Only the browser owns the new Source154 negative scenarios; no second
    # Source153 or Community client implementation is introduced.
    env=os.environ.copy()
    env["VITE_DDVRE_E2_OWNER_READONLY"]="LOCAL_DISPOSABLE_ONLY"
    env["VITE_DDVRE_SHARED_BRIDGE"]="LOCAL_DISPOSABLE_ONLY"
    env["VITE_SUPABASE_URL"]="https://wand-disposable-e2.invalid"
    env["VITE_SUPABASE_PUBLISHABLE_KEY"]="sb_publishable_disposable_local_bridge_only"
    env["E2_REAL_LOCAL_ANON_PUBLIC_KEY"]=anon
    env["E2_POST_WORK_ID"]=str(original)  # accepted PR301 original Work; env key is test-only
    for who,name in [("A","OWNER"),("B","B")]:
        env["E2_"+name+"_EMAIL"]=users[who]["email"]
        env["E2_"+name+"_PASSWORD"]=users[who]["password"]
    app=subprocess.Popen(["npm","run","dev","--",
         "--config","scripts/vite-source153-e2.config.mjs",
         "--host","127.0.0.1","--port","4175"],
         env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            if app.poll() is not None:raise AssertionError("SIGNED154_VITE_NOT_STARTED")
            try:
                with urllib.request.urlopen(
                   "http://127.0.0.1:4175/disposable-owner-signed-bridge/",
                   timeout=2) as response:
                    if response.status==200:break
            except Exception:time.sleep(1)
        else:raise AssertionError("SIGNED154_VITE_TIMEOUT")
        chrome=subprocess.run(["node","scripts/web-source154-signed-browser-chrome.mjs"],
           env=env,stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=450)
        if chrome.returncode:
            # Errors are sanitized to categorical code only. Browser stderr
            # may contain disposable JWT, URL, email or WorkID: NEVER output it.
            import re
            permitted=("AssertionError","TimeoutError","TypeError","SyntaxError","Error")
            category=next((x for x in permitted if x in chrome.stderr),"UNKNOWN")
            # Whitelisted categorical status/HTTP, never token, URL or work ID.
            diagnostic=re.search(
              r'WEB154_INITIAL_A1_PROJECTION_(?:BACKEND_UNAVAILABLE|AUTH_REQUIRED|AUTH_UNAVAILABLE|SOURCE_CONTRACT_REJECTED|UNSAFE_CACHE_POLICY|REVALIDATION_REQUIRED|REFRESH_REQUIRED|SIGNED_LOCAL_SESSION_CANDIDATE|READING_SOURCE|OTHER)_HTTP_[0-9]{1,3}',chrome.stderr)
            if diagnostic:
                match=re.fullmatch(r'WEB154_INITIAL_A1_PROJECTION_(.*?)_HTTP_([0-9]{1,3})',diagnostic.group(0))
                if match:
                    print('A1_PREFLIGHT_UI',match.group(1),'HTTP',match.group(2),flush=True)
                    category='A1_PREFLIGHT'
            script_lines=re.findall(r'web-source154-signed-browser-chrome[.]mjs:([0-9]+)',chrome.stderr)
            raise AssertionError(("SOURCE154_CHROME_FAILED",category,
                script_lines[-1] if script_lines else "UNKNOWN"))
        required=(
            "WEB154_REAL_BROWSER_DISTINCT_A1_A2_SIGNED_200",
            "WEB154_REAL_BROWSER_FOUR_PRIVATE_HEADERS_FAIL_CLOSED",
            "WEB154_REAL_BROWSER_LOCAL_A1_401_A2_200_DOM_CLEARED",
            "WEB154_REAL_BROWSER_REFRESH_CANNOT_REAUTHORIZE_REVOKED_A1",
            "WEB154_REAL_BROWSER_MISSED_NOTICE_OLD_JWT_SERVER_DENIED",
            "WEB154_REAL_BROWSER_GLOBAL_A1_A2_401",
            "WEB154_REAL_BROWSER_NONOWNER_B_UNAFFECTED_403",
            "WEB154_REAL_BROWSER_HELD_200_CANNOT_RESTORE_LOGGED_OUT_VIEW",
            "WEB154_DISPOSABLE_SIGNED_BROWSER_NEGATIVE_PASS")
        for marker_name in required:
            assert marker_name in chrome.stdout,("MISSING_SIGNED_BROWSER_CASE",marker_name)
        print("WEB154_ACTUAL_ES256_LOCAL_CHROME_NEGATIVE_PASS")
    finally:
        app.terminate()
        try:app.wait(timeout=10)
        except subprocess.TimeoutExpired:app.kill()
'''
exec(compile(source,"accepted-pr288-e2-prefix-source154-in-memory.py","exec"),
     {"__name__":"__main__"})
