# Executed inside the accepted PR288 disposable E2 Python fixture scope
# after its genuine signed Source153 P05 positive and before its old N-cases.
# No production records or external providers. The hook only drives a browser.
import os
import tempfile
import subprocess
import json
from pathlib import Path

payload={
  "original":str(original),
  "post":str(post),
  "mediaOriginal":str(mo),
  "mediaPost":str(mp),
  "users":{k:{"email":users[k]["email"],"password":users[k]["password"]} for k in "ABM"}
}
fd,private_path=tempfile.mkstemp(prefix="ddvre-local-browser-",suffix=".json")
os.chmod(private_path,0o600)
try:
    with os.fdopen(fd,"w",encoding="utf8") as out:
        json.dump(payload,out)
    env=os.environ.copy()
    env["DDVRE_SIGNED_BROWSER_FIXTURE"]=private_path
    browser=subprocess.run(["node","scripts/web-x05-local-signed-owner-browser.mjs"],
      capture_output=True,text=True,env=env,timeout=180)
    # Never forward console output, request bodies, private IDs or credentials
    # from a failing browser process into Actions logs.
    if browser.returncode != 0:
        import re
        matches=re.findall(r'WEB_X05_BROWSER_DIAGNOSTIC_[A-Z0-9_]+',browser.stderr)
        print(matches[-1] if matches else 'WEB_X05_BROWSER_DIAGNOSTIC_NO_STAGE',flush=True)
        raise AssertionError('LOCAL_SIGNED_CHROMIUM_TEST_FAILED')
    assert "WEB_X05_GENUINE_GOTRUE_ES256_BROWSER_9_OF_9_PASS" in browser.stdout,\
        "SIGNED_CHROME_PASS_MARKER_NOT_FOUND"
    marker("WEB_X05_GENUINE_GOTRUE_ES256_CHROMIUM","BROWSER_9_OF_9_PASS_LOCAL_TEST_ONLY")
finally:
    try:os.remove(private_path)
    except OSError:pass
