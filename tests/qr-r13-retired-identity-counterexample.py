#!/usr/bin/env python3
"""QA-only synthetic local R13 resolver counterexample; no remote database."""
import os, json
import psycopg
assert os.getenv("DDVRE_QR_R13_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL")
dsn="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
with psycopg.connect(dsn,autocommit=True,connect_timeout=3) as db:
  owner,subject=db.execute("""
    select i.account_id,i.provider_subject::uuid from public.auth_identities i
    join public.wand_accounts a on a.account_id=i.account_id
    where i.provider='supabase' and i.identity_state='active'
    and a.status='active'
    and not private.is_account_privacy_suppressed(i.account_id)
    limit 1""").fetchone()
  actual=db.execute("select private.resolve_active_account(%s)",(subject,)).fetchone()[0]
  assert actual==owner
  db.execute("begin")
  db.execute("update public.auth_identities set identity_state='retired' where account_id=%s and provider='supabase'",(owner,))
  accepted=False
  try:
    accepted=db.execute("select private.resolve_active_account(%s)",(subject,)).fetchone()[0]==owner
  except psycopg.Error:
    pass
  db.execute("rollback")
  print(json.dumps({"independentSource114LocalPg":True,
   "activeIdentity":"PASS","retiredIdentity":"FAIL_REPRODUCED" if accepted else "PASS_REJECTED",
   "realSignedJwt":False,"productionAuthorized":False}))
