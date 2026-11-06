#!/usr/bin/env python3
"""04 QR-S independently observe derived-scratch Source169 cumulative SQL authority.
Actual disposable localhost PostgreSQL only; NOT signed GoTrue or managed Staging.
"""
import os
import uuid
from contextlib import closing
import psycopg

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert all(not os.getenv(k) for k in
    ("DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID",
     "SUPABASE_DB_PASSWORD"))
DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
RPCS=(
    "public.community_add_reaction(uuid,uuid,text)",
    "public.community_save_entity(uuid,uuid)",
    "public.community_unsave_entity(uuid,uuid)",
    "public.community_remove_reaction(uuid,uuid,text)",
    "public.community_unfollow_creator(uuid,uuid)",
    "public.community_follow_creator(uuid,uuid)",
)
SIGNED_POSITIVE=(
    "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
    "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
    "public.community_get_ddv_profile_workspaces_v1(uuid)",
)
ROLES=("anon", "authenticated", "service_role")

def one(db,sql,args=()):
    return db.execute(sql,args).fetchone()[0]

def marker(name):
    print("QR676_"+name+"_PASS",flush=True)

a=uuid.uuid4()
b=uuid.uuid4()

with closing(psycopg.connect(DSN,autocommit=True)) as observer, \
     closing(psycopg.connect(DSN,autocommit=True)) as executor:
    assert one(observer,"select pg_backend_pid()") != one(executor,"select pg_backend_pid()")
    assert one(observer,"select count(*) from supabase_migrations.schema_migrations")==169
    for version in ("20260930025132", "20261105010000", "20261105020000",
                    "20261105030000","20261105040000","20261106010000",
                    "20261106020000"):
        assert one(observer,
            "select count(*) from supabase_migrations.schema_migrations where version=%s",
            (version,)) == 1, ("QR676_DERIVED_HISTORY_VERSION_MISSING",version)
    marker("REAL_DERIVED169_LOCAL_LEDGER_SIX_ORDERED_SQL_VERSIONS")

    for sig in RPCS:
        assert one(observer,"select to_regprocedure(%s) is not null",(sig,)), "RPC_MISSING"
        assert one(observer,"""
            select not exists (
              select 1 from pg_proc p
                cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
              where p.oid=%s::regprocedure
                and acl.grantee=0 and acl.privilege_type='EXECUTE')
        """,(sig,)), ("QR676_PUBLIC_DEFAULT_OR_EXPLICIT_EXECUTE_GRANTED",sig)
        for role in ROLES:
            assert not one(observer,"select has_function_privilege(%s,%s,'EXECUTE')",
                (role,sig)), ("QR676_LEGACY_ROLE_EXECUTE_OPEN",role,sig)
    for sig in SIGNED_POSITIVE:
        assert one(observer,"select has_function_privilege('service_role',%s,'EXECUTE')",
            (sig,)),("QR676_SIGNED_POSITIVE_MISSING",sig)
    marker("PUBLIC_THREE_ROLE_SIX_EXECUTE_DENIED_R16_WORKSPACE_POSITIVE")

    def snapshot():
        return tuple(one(observer,"select count(*) from "+table) for table in (
            "public.reactions","public.saved_items","public.follows",
            "public.outbox_events","public.idempotency_keys"))
    before=snapshot()

    def deny_as(role,sig):
        args=(a,b,"like") if sig.count(",")==2 else (a,b)
        placeholders=",".join(["%s"]*len(args))
        try:
            with executor.transaction():
                executor.execute("set local role "+role)
                one(executor,"select "+sig.split("(")[0]+"("+placeholders+")",args)
        except psycopg.Error as err:
            assert err.sqlstate=="42501",("QR676_BAD_SQLSTATE",role,sig,err.sqlstate)
            return
        raise AssertionError("QR676_LEGACY_PRIVILEGED_SQL_EXECUTED_"+role)

    for sig in RPCS:
        for role in ROLES:
            deny_as(role,sig)
    assert snapshot()==before, "QR676_DIRECT_SQL_ATTEMPTS_MUTATED_ROWS"
    marker("EIGHTEEN_ROLE_RPC_SQL42501_NO_MUTATION")

    for _ in range(5):
        for sig in RPCS:
            deny_as("service_role",sig)
    assert snapshot()==before, "QR676_FIVE_REPLAY_LOOPS_MUTATED_ROWS"
    marker("THIRTY_SERVICE_REPLAYS_SQL42501_NO_MUTATION")

    target=RPCS[-1]
    observer.execute("begin")
    try:
        observer.execute("grant execute on function "+target+" to service_role")
        assert one(observer,
            "select has_function_privilege('service_role',%s,'EXECUTE')",(target,))
        assert not one(executor,
            "select has_function_privilege('service_role',%s,'EXECUTE')",(target,))
        deny_as("service_role",target)
    finally:
        observer.execute("rollback")
    for pg in (observer,executor):
        for sig in RPCS:
            assert not one(pg,
                "select has_function_privilege('service_role',%s,'EXECUTE')",(sig,)),sig
    assert snapshot()==before, "QR676_TEMP_GRANT_ROLLBACK_MUTATED_ROWS"
    marker("TWO_POSTGRES_BACKENDS_TEMP_GRANT_INVISIBLE_ROLLBACK_DENIED")
    marker("INDEPENDENT_DERIVED_LOCAL169_NEW_SIX_SQL_ONLY_NOT_SIGNED_NOT_MANAGED")
