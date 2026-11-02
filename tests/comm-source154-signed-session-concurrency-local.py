#!/usr/bin/env python3
"""Isolated real GoTrue ES256 + two independent PostgreSQL connection interleavings.

This test modifies ONLY the in-memory execution of the immutable PR308 signed
test fixture, never the Source154 product/migrations/GoTrue signer. All tokens
and private IDs are confined to RAM; print only non-sensitive markers.
"""
import os,sys
from pathlib import Path
assert os.environ.get("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(k) for k in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source153-server-session-signed-e2.py")
src=p.read_text()
local='    st,r=e2_http(a1,{"operation":"session-revoke","scope":"local"})'
glob='    st,r=e2_http(a2,{"operation":"session-revoke","scope":"global"})'
assert src.count(local)==2 and src.count(glob)==2
shared=r'''
    import threading
    # Real two-DB-connection lock interleaving, not fake TEMP model.
    # A verified A JWT is sent to the real local Source153 HTTP revoker
    # while a DIFFERENT PostgreSQL backend holds the same AuthIdentity row
    # FOR SHARE. Revoker's FOR UPDATE MUST block until transaction commits.
    def locked_revoke(token,scope):
      hold=psycopg.connect(DSN,autocommit=False)
      blocked=False
      result={}
      pid=None
      def send():
        try: result["reply"]=e2_http(token,{"operation":"session-revoke","scope":scope})
        except BaseException as e: result["error"]=type(e).__name__
      try:
        hold.execute("select auth_identity_id from public.auth_identities where provider='supabase' and provider_subject=%s for share",
          (str(users["A"]["id"]),)).fetchone()
        pid=hold.info.backend_pid
        t=threading.Thread(target=send,daemon=True)
        t.start()
        # Check actual PostgreSQL wait graph; avoid timer-only race claims.
        with psycopg.connect(DSN,autocommit=True) as witness:
          for attempt in range(65):
            blocked=bool(witness.execute(
              "select exists(select 1 from pg_stat_activity a where %s = any(pg_blocking_pids(a.pid)) and a.pid<>%s)",
              (pid,pid)).fetchone()[0])
            if blocked:break
            time.sleep(0.08)
        assert blocked,"REVOKER_DID_NOT_WAIT_FOR_HELD_IDENTITY_LOCK"
        assert "reply" not in result,"REVOKER_RETURNED_BEFORE_IDENTITY_SHARE_RELEASE"
      finally:
        hold.commit()
        hold.close()
      t.join(15)
      assert not t.is_alive() and "error" not in result and "reply" in result,"REVOKE_NOT_COMPLETED_AFTER_LOCK_RELEASE"
      status,body=result["reply"]
      assert status==200 and body.get("state")=="revoked","REVOKE_BAD_AFTER_LOCK_RELEASE"
      return status
'''
src=src.replace(local,shared+'''
    # Earlier signed A1 Owner read completed before revocation linearization:
    # it may be used as evidence only of historical authorization, not of
    # durable authority for later data release/Writer commit.
    assert auth_read(a1)==200 and auth_read(a2)==200
    marker("C01-BEFORE-LOCAL","SIGNED_OWNER_A1_A2_READ200_PRE_REVOKE",200)
    st=locked_revoke(a1,"local")
    r={"ok":True,"state":"revoked"}
''',1)
src=src.replace(glob,'''
    assert auth_read(a2)==200
    marker("C04-BEFORE-GLOBAL","SIGNED_A2_STILL_ACTIVE_WHILE_A1_REVOKED",200)
    st=locked_revoke(a2,"global")
    r={"ok":True,"state":"revoked"}
''',1)
after='    marker("R02B-DIRECT-RPC-GUARD","REVOKED_A1_DENIED_A2_ALLOWED_BOTH_SQL_READ_PATHS")'
assert src.count(after)==1
src=src.replace(after,after+'''
    # Direct privileged SQL Writer uses existing Source150 private verifier.
    # We intentionally supply old CAS to avoid ANY new Work mutation, and
    # check no revision changes. Only revoked A1 => deny is proven;
    # this is NOT proof of all Writer success/linearizability.
    rev_before=scalar("select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,))
    wst,_,wbody=http("/rest/v1/rpc/community_dreamsnap_x05_owner_action_v1",
      body={"p_work_id":str(post),"p_expected_row_version":1,
       "p_expected_authorization_epoch":1,"p_action":"withdraw"},token=a1)
    assert wst in (400,401,403) and str(post) not in json.dumps(wbody),"REVOKED_DIRECT_WRITER_ACCEPTED"
    assert scalar("select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(post,))==rev_before,"REVOKED_WRITER_MUTATED_WORK"
    marker("C02-PRIVILEGED-WRITER","REVOKED_A1_DIRECT_WRITER_DENIED_NO_COMMIT",wst)
    assert auth_read(a1)==401 and auth_read(a2)==200
    marker("C03-AFTER-LOCAL","SIGNED_A1_401_A2_200_AFTER_COMMITTED_TERMINAL",401)
''',1)
after2='    marker("R06B-GLOBAL-DIRECT-RPC","A1_A2_POSTGREST_DENIED_NO_BYPASS")'
assert src.count(after2)==1
src=src.replace(after2,after2+'''
    for old_token in (a1,a2):
      state,_,payload=http("/rest/v1/rpc/community_dreamsnap_x05_owner_action_v1",
        body={"p_work_id":str(post),"p_expected_row_version":1,
         "p_expected_authorization_epoch":1,"p_action":"withdraw"},token=old_token)
      assert state in (400,401,403) and str(post) not in json.dumps(payload),"POSTGLOBAL_PRIVILEGED_WRITER_BYPASS"
    assert auth_read(a1)==401 and auth_read(a2)==401
    marker("C05-AFTER-GLOBAL","SIGNED_A1_A2_401_AND_SQL_WRITER_DENIED",401)
''',1)
end='    marker("SOURCE153_SERVER_ENFORCED_SIGNED_SESSION_PASS",'
assert src.count(end)==1
src=src.replace(end,'''
    # GoTrue registration schema current contract and rollback compatibility.
    # Pin concrete columns and their types on this disposable CLI release.
    for column in ("id","user_id"):
      row=scalar("select count(*) from information_schema.columns where table_schema='auth' and table_name='sessions' and column_name=%s and udt_name='uuid'",(column,))
      assert row==1,"GOTRUE_REGISTRY_COLUMN_MISSING_OR_NOT_UUID"
    assert scalar("select count(*) from information_schema.table_constraints where table_schema='auth' and table_name='sessions' and constraint_type='PRIMARY KEY'")>=1
    assert not scalar("select has_table_privilege('authenticated','auth.sessions','INSERT')")
    marker("C06-GOTRUE-SCHEMA","PINNED_LOCAL_GOTRUE_ID_USER_ID_UUID_PRIVILEGE_GUARD")

    # Rollback of a speculative DDL change, not rollback of full Source154.
    # Confirm current verified A3 remains unaffected after SQL rollback.
    rollback=psycopg.connect(DSN,autocommit=False)
    try:
      rollback.execute("alter table private.wand_verified_session_revocations_v1 add column probe_temporary_rollback boolean")
      assert rollback.execute("select count(*) from information_schema.columns where table_schema='private' and table_name='wand_verified_session_revocations_v1' and column_name='probe_temporary_rollback'").fetchone()[0]==1
      rollback.rollback()
    finally:rollback.close()
    assert scalar("select count(*) from information_schema.columns where table_schema='private' and table_name='wand_verified_session_revocations_v1' and column_name='probe_temporary_rollback'")==0
    assert auth_read(a3)==200
    marker("C07-PG-DDL-ROLLBACK","LOCAL_TRANSACTIONAL_ROLLBACK_AND_A3_READ200_NOT_FULL_MIGRATION_DOWN",200)
    marker("SOURCE154_REAL_SIGNED_CONCURRENCY_TEST_ONLY_PASS",
      "ACTUAL_TWO_PG_LOCK_GRAPH_AND_DIRECT_WRITER_DENIAL_NOT_ALL_WRITERS")
'''+end,1)
try:
    exec(compile(src,str(p),"exec"),{"__name__":"__main__"})
except BaseException as e:
    print("SOURCE154_CONCURRENCY_TEST_FAILURE "+type(e).__name__,flush=True)
    sys.exit(1)
