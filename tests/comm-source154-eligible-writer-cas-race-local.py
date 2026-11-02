#!/usr/bin/env python3
"""Source154 eligible-current-CAS Writer vs genuine A4 session revocation.

Use PR310 two-PG signed fixture *only as setup*. New test builds a true
in-flight Source150 Owner preflight Writer and verifies PostgreSQL wait graph,
commit ordering, next-current-CAS revoked refusal, sibling positive control.
No public publish, Provider, Stage116, Native Write, or raw private output.
"""
import os,sys
from pathlib import Path
assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source154-signed-session-concurrency-local.py")
runner=p.read_text()
needle='try:\n    exec(compile(src,str(p),"exec"),{"__name__":"__main__"})'
assert runner.count(needle)==1,"FROZEN_PR310_FIXTURE_CHANGED"
newcases=r'''
    # Test AFTER R01-R10 and C01-C07, with valid A3 and an untouched
    # post Work control. This is NOT a reacceptance of the inherited cases.
    with db.transaction():
      db.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
    race_token,_=a_login()
    assert jwt_payload(race_token)["session_id"] not in (
      jwt_payload(a1)["session_id"],jwt_payload(a2)["session_id"],jwt_payload(a3)["session_id"])
    state_before=db.execute("select row_version,authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,)).fetchone()
    assert state_before and state_before[0]>=1 and state_before[1]>=1,"WRITER_BASELINE_NOT_ENROLLED"
    expected_version,expected_epoch=state_before
    action_args={"p_work_id":str(post),"p_expected_row_version":expected_version,
      "p_expected_authorization_epoch":expected_epoch,"p_action":"preflight"}
    assert auth_read(race_token)==200 and auth_read(a3)==200
    marker("W01-ELIGIBLE-PRE-RACE","REAL_A4_A3_VALID_CURRENT_CAS_OBSERVED",200)

    # The Writer obtains the AuthIdentity FOR SHARE authorization in its
    # own PostgREST transaction BEFORE blocking on community_works FOR UPDATE.
    # Signed Local revoke needs SAME identity FOR UPDATE, so must serialize
    # after that in-flight Writer, never cross its commit boundary.
    events={}
    def run_writer():
      try: events["writer"]=http("/rest/v1/rpc/community_dreamsnap_x05_owner_action_v1",
        body=action_args,token=race_token)
      except BaseException as e:events["writer_error"]=type(e).__name__
    def run_revoke():
      try:events["revoke"]=e2_http(race_token,{"operation":"session-revoke","scope":"local"})
      except BaseException as e:events["revoke_error"]=type(e).__name__

    hold=psycopg.connect(DSN,autocommit=False)
    try:
      hold.execute("select work_id from public.community_works where work_id=%s for update",(post,)).fetchone()
      holdpid=hold.info.backend_pid
      writer_thread=threading.Thread(target=run_writer,daemon=True)
      writer_thread.start()
      writerpid=None
      with psycopg.connect(DSN,autocommit=True) as witness:
        for _ in range(100):
          pids=[r[0] for r in witness.execute(
            "select pid from pg_stat_activity where %s=any(pg_blocking_pids(pid)) and pid<>%s",
             (holdpid,holdpid)).fetchall()]
          if pids:writerpid=pids[0];break
          time.sleep(0.08)
        assert writerpid is not None and "writer" not in events,"ELIGIBLE_WRITER_NOT_WAITING_ON_WORK_ROW"
        marker("W02-WRITER-BLOCK","ACTUAL_PG_WRITER_WAITING_ON_WORK_ROW")
        revoke_thread=threading.Thread(target=run_revoke,daemon=True)
        revoke_thread.start()
        revoke_wait=False
        for _ in range(100):
          revoke_wait=bool(witness.execute(
            "select exists(select 1 from pg_stat_activity a where %s=any(pg_blocking_pids(a.pid)) and a.pid<>%s)",
            (writerpid,writerpid)).fetchone()[0])
          if revoke_wait:break
          time.sleep(0.08)
        assert revoke_wait and "revoke" not in events,"REVOKER_NOT_WAITING_ON_ELIGIBLE_WRITER_IDENTITY_LOCK"
        marker("W03-REVOKE-BLOCK","ACTUAL_REVOKER_WAITING_ON_WRITER_IDENTITY_SHARE")
    finally:
      hold.commit()
      hold.close()
    writer_thread.join(20)
    revoke_thread.join(20)
    assert not writer_thread.is_alive() and not revoke_thread.is_alive(),"SQL_CONCURRENCY_THREADS_STILL_RUNNING"
    assert not any(k.endswith("_error") for k in events),"SIGNED_HTTP_THREAD_ERRORED"
    wst,_,wbody=events["writer"]
    rst,rbody=events["revoke"]
    assert wst==200 and isinstance(wbody,dict) and wbody.get("publicActivationAllowed") is False,"CURRENT_CAS_WRITER_NOT_ELIGIBLE"
    assert rst==200 and rbody.get("state")=="revoked","LOCAL_REVOCATION_NOT_COMMITTED"
    after=db.execute("select row_version,authorization_epoch,updated_at from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,)).fetchone()
    tomb=scalar("select revoked_at from private.wand_verified_session_revocations_v1 where provider_subject=%s and session_id=%s",
      (users["A"]["id"],uuid.UUID(jwt_payload(race_token)["session_id"])))
    assert after[0]==expected_version+1 and after[1]==expected_epoch+1 and tomb is not None
    assert after[2]<=tomb,"REVOCATION_TERMINAL_PRECEDED_AUTHORITATIVE_WRITER_UPDATE"
    marker("W04-SERIALIZED-COMMIT","ELIGIBLE_WRITER_COMMITTED_BEFORE_TERMINAL_REVOKE",wst)

    # Same next CURRENT CAS and same withdraw operation; revoked A4 must
    # fail without mutation; live independent A3 must succeed on exact inputs.
    next_args={"p_work_id":str(post),"p_expected_row_version":after[0],
      "p_expected_authorization_epoch":after[1],"p_action":"withdraw"}
    before_fail=scalar("select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(post,))
    denied,_,err=http("/rest/v1/rpc/community_dreamsnap_x05_owner_action_v1",
       body=next_args,token=race_token)
    denied_state=db.execute("select row_version,authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,)).fetchone()
    assert denied in (400,401,403) and denied_state==(after[0],after[1]),"REVOKED_WRITER_CHANGED_CURRENT_CAS"
    assert before_fail==scalar("select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(post,))
    approved,_,ok=http("/rest/v1/rpc/community_dreamsnap_x05_owner_action_v1",
       body=next_args,token=a3)
    final=db.execute("select row_version,authorization_epoch,control_state from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,)).fetchone()
    assert approved==200 and final==(after[0]+1,after[1]+1,"withdrawn"),"CURRENT_CAS_SIBLING_POSITIVE_CONTROL_FAILED"
    marker("W05-SAME-CAS-CAUSE-ISOLATION",
       "REVOKED_A4_DENIED_WITHOUT_MUTATION_LIVE_A3_WRITER_COMMITTED",denied)
    marker("SOURCE154_ELIGIBLE_WRITER_CAS_RACE_TEST_ONLY_PASS",
       "REAL_SIGNED_POSTGREST_WORKER_AND_EDGE_REVOCATION_SERIALIZED_NOT_ALL_WRITERS")
'''
inject='src=src.replace(\'    marker("SOURCE154_REAL_SIGNED_CONCURRENCY_TEST_ONLY_PASS",\',newcases+\'\\n    marker("SOURCE154_REAL_SIGNED_CONCURRENCY_TEST_ONLY_PASS",\',1)\n'
runner=runner.replace(needle,inject+needle,1)
try:
    exec(compile(runner,str(p),"exec"),{"__name__":"__main__","newcases":newcases})
except BaseException as e:
    print("SOURCE154_ELIGIBLE_CAS_RACE_FAILURE "+type(e).__name__,flush=True)
    sys.exit(1)
