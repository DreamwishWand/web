#!/usr/bin/env python3
"""NEW-ONLY signed Chromium browser negatives on disposable FULL153.
Reuse the immutable accepted E2 positive bootstrap, NOT its historical negative
suite. Never print tokens, credentials, IDs, SQL bodies or raw DOM.
"""
import os
from pathlib import Path

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert not any(os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
accepted=Path("tests/comm-e2-source153-signed-positive.py").read_text()
anchor='users[who]={"id":uid,"token":token}'
cut='    # Required negative cases are new post-Grant tests (no historic E1 replay).'
assert accepted.count(anchor)==1 and accepted.count(cut)==1, "ACCEPTED_E2_BOOTSTRAP_DRIFT"
source=accepted.replace(anchor,
    'users[who]={"id":uid,"token":token,"email":email,"password":password}').split(cut,1)[0]
assert 'marker("E2-P05"' in source and 'marker("E2-P04"' in source

source+='''
    import subprocess
    import urllib.request

    # All account, Media, credentials and browser state exist only on this runner.
    env=os.environ.copy()
    env["VITE_DDVRE_E2_OWNER_READONLY"]="LOCAL_DISPOSABLE_ONLY"
    env["VITE_DDVRE_E2_LOCAL_ANON_KEY"]=anon
    env["E2_ORIGINAL_WORK_ID"]=str(original)
    env["E2_POST_WORK_ID"]=str(post)
    env["E2_OWNER_ACCOUNT_ID"]=str(account["A"])
    env["E2_ORIGINAL_MEDIA_ID"]=str(mo)
    env["E2_ORIGINAL_PHOTO_ID"]=str(po)
    env["E2_OWNER_STORAGE_KEY"]="e1/disposable/"+str(mo)
    for who,key in (("A","OWNER"),("B","B"),("M","M")):
        env["E2_"+key+"_EMAIL"]=users[who]["email"]
        env["E2_"+key+"_PASSWORD"]=users[who]["password"]

    child=subprocess.Popen(
        ["npm","run","dev","--","--config","scripts/vite-source153-e2.config.mjs",
         "--host","127.0.0.1","--port","4175"],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env)
    counts=[]
    def run_case(label,mutate=None):
        assert label in ("DOM_A11Y","IDENTITY","ACCOUNT","CREATOR","PRIVACY",
            "CAS","WITHDRAWN","POLICY","RACE_WORK","RACE_SESSION","RACE_HISTORY")
        env["E2_NEGATIVE_CASE"]=label
        command=["node","scripts/web-source153-signed-owner-negative-chrome.mjs"]
        if mutate is None:
            completed=subprocess.run(command,env=env,capture_output=True,text=True,timeout=120)
            assert completed.returncode==0,("BROWSER_CASE_FAILED",label,completed.returncode)
            assert "WEB_NEGATIVE_SIGNED_BROWSER_"+label+"_PASS_LOCAL_ONLY" in completed.stdout, ("MISSING_BROWSER_MARKER",label)
        else:
            proc=subprocess.Popen(command,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,text=True,bufsize=1)
            try:
                ready=proc.stdout.readline().strip()
                assert ready=="WEB_NEG_CAS_READY",("CAS_HANDSHAKE_FAILED",label)
                mutate()
                proc.stdin.write("GO\\\\n")
                proc.stdin.flush()
                out,err=proc.communicate(timeout=120)
                assert proc.returncode==0,("BROWSER_CASE_FAILED",label,proc.returncode)
                assert "WEB_NEGATIVE_SIGNED_BROWSER_"+label+"_PASS_LOCAL_ONLY" in out, ("MISSING_BROWSER_MARKER",label)
            finally:
                if proc.poll() is None:
                    proc.kill()
                    proc.communicate()
        counts.append(label)
        marker("WEB_E2_NEG_"+label,"GENUINE_SIGNED_LOCAL_BROWSER_TARGETED_PASS")

    try:
        for _ in range(80):
            if child.poll() is not None: raise AssertionError("LOCAL_WAND_SERVER_EXITED")
            try:
                with urllib.request.urlopen("http://127.0.0.1:4175/dreamsnaps/my/manage/source153-e2/",timeout=2) as response:
                    if response.status==200:break
            except Exception:time.sleep(1)
        else:raise AssertionError("LOCAL_WAND_SERVER_TIMEOUT")

        run_case("DOM_A11Y") # live populated projection, actual signed HTTP and DOM audit

        def actor_change(label,sql,args,undo,undo_args):
            with db.transaction():db.execute(sql,args)
            try:run_case(label)
            finally:
                with db.transaction():db.execute(undo,undo_args)
        actor_change("IDENTITY",
            "update public.auth_identities set identity_state='retired' where account_id=%s",
            (account["A"],),
            "update public.auth_identities set identity_state='active',retired_at=null where account_id=%s",
            (account["A"],))
        actor_change("ACCOUNT",
            "update public.wand_accounts set status='restricted' where account_id=%s",
            (account["A"],),
            "update public.wand_accounts set status='active' where account_id=%s",
            (account["A"],))
        actor_change("CREATOR",
            "update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",
            (creator,),
            "update public.creator_profiles set moderation_state='clear' where creator_profile_id=%s",
            (creator,))

        def withdraw_after_browser_positive():
            st,h,r=owner("A","action",original,action="withdraw",
               expectedRowVersion=1,expectedAuthorizationEpoch=1)
            assert st==200 and safe_edge_headers(h) and r.get("ok") is True, ("SIGNED_LOCAL_WITHDRAW_DENIED",st)
            assert scalar("select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
            assert scalar("select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
        run_case("CAS",withdraw_after_browser_positive)
        run_case("WITHDRAWN") # actual HTTP200 after signed withdrawal
        with db.transaction():
            db.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=false where policy_version='v1'")
        run_case("POLICY") # actual HTTP200, source scopeStatus UNVERIFIED
        for variant in ("RACE_WORK","RACE_SESSION","RACE_HISTORY"):
            run_case(variant)

        # Privacy suppression requires a DISTINCT state mutation. A full DELETE
        # tombstone also retires AuthIdentity, and is NOT a valid privacy-only test.
        # Keep browser privacy case PARTIAL until an isolated reversible fixture
        # can be proven; do not fabricate privacy acceptance from actor revocation.
        marker("WEB_E2_NEG_PRIVACY","PARTIAL_NOT_RUN_NO_ISOLATED_REVERSIBLE_STATE_FIXTURE")
        assert len(counts)==10 and "PRIVACY" not in counts
        marker("WEB_E2_NEGATIVE_SIGNED_CHROME","TEN_TARGETED_CASES_PASS_PRIVACY_PARTIAL_NO_PRODUCTION_ACTIVATION")
    finally:
        child.terminate()
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:child.kill()
'''
exec(compile(source,"accepted-e2-setup-negative-browser-memory.py","exec"),
    {"__name__":"__main__"})
