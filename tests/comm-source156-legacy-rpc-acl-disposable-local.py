#!/usr/bin/env python3
"""Disposable FULL157 non-R16 effective EXECUTE / direct SQL reachability inventory.

SOURCE_ONLY audit becomes LOCAL_DB_ACL evidence only when the dedicated
workflow succeeds on the pinned FULL156 schema. No managed/remote DB, real user,
Stage116, Storage, Provider, publisher, or product writer is accessed.
"""
import json
import os
import re
import uuid
from pathlib import Path

import psycopg

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert not any(os.getenv(k) for k in
               ("DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"))
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
source = Path("supabase/functions/community-command/index.ts").read_text()
map_match = re.search(r"const commandToRpc = \{([\s\S]*?)\} as const;", source)
assert map_match, "COMMAND_TO_RPC_SOURCE_CONTRACT_CHANGED"
commands = dict(re.findall(r"^\s*([A-Za-z0-9_]+):\s*'([^']+)'",
                           map_match.group(1), re.M))
assert "setGalleryCommentsEnabled" in commands
assert commands["setGalleryCommentsEnabled"] == "community_set_gallery_comments_enabled_v2"
assert commands["setGalleryCommentsAtomicR16"] == "community_set_gallery_comments_enabled_atomic_signed_v1"

# Exact command table plus critical non-Command route surfaces. Report every
# overload rather than assuming argument signatures from a registry string.
legacy = {
    "community_publish_gallery_v4", "community_publish_gallery_pinned_r15",
    "community_gallery_media_intent_complete_v1",
    "community_gallery_media_intent_cancel_v1",
    "community_preset_storage_reserve_r18",
    "community_preset_storage_recovery_r18",
    "community_set_gallery_comments_enabled_v1",
    "community_set_gallery_comments_enabled_v2",
    "community_set_gallery_comments_enabled_atomic_r16",
    "community_set_gallery_comments_enabled_atomic_signed_v1",
    "community_ensure_account_creator_signed_v1",
    "community_request_privacy_suppression_v1",
    "community_authorize_signed_session_v2",
}
names = sorted(set(commands.values()) | legacy)
audited = []
with psycopg.connect(DSN, autocommit=True) as db:
    count = db.execute(
        "select count(*) from supabase_migrations.schema_migrations"
    ).fetchone()[0]
    assert count == 165, "NOT_DISPOSABLE_EXACT_FULL165"

    for name in names:
        functions = db.execute("""
            select p.oid::text, p.oid::regprocedure::text,
                   p.prosecdef, p.proacl::text, p.prosrc
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname=%s
            order by p.oid::regprocedure::text
        """, (name,)).fetchall()
        if not functions:
            audited.append(dict(name=name, existence="MISSING", evidence="CATALOG"))
            continue
        for oid, signature, definer, acl, body in functions:
            privileges = {
                role: db.execute(
                    "select has_function_privilege(%s,%s::oid,'EXECUTE')",
                    (role, oid),
                ).fetchone()[0]
                for role in ("anon", "authenticated", "service_role")
            }
            signed = "community_authorize_signed_session_v2" in body
            lock = bool(re.search(r"for\s+(?:share|update)", body, re.I))
            record = {
                "name": name, "signature": signature, "security_definer": definer,
                "execute": privileges, "contains_signed_v2": signed,
                "identity_or_work_lock_source": lock,
                "explicit_acl": acl is not None,
                "risk": ("DIRECT_UNTRUSTED_EXECUTE_SECURITY_DEFINER"
                         if definer and (privileges["anon"] or privileges["authenticated"])
                         else ("SIGNED_ATOMIC_SOURCE" if signed else "NEEDS_OPERATION_QA")),
            }
            audited.append(record)
            print(json.dumps({"case": "LEGACY_RPC_CATALOG", **record},
                             sort_keys=True), flush=True)

    # Accepted R16 / A0 boundaries are NOT widened. Missing expected RPC is
    # a real failure; no assertion about unverified legacy routes is promoted.
    def one(name):
        rs = [r for r in audited if r["name"] == name
              and r.get("existence") != "MISSING"]
        assert len(rs) == 1, "FUNCTION_OVERLOAD_OR_MISSING:" + name
        return rs[0]
    r16_old = one("community_set_gallery_comments_enabled_atomic_r16")
    r16_new = one("community_set_gallery_comments_enabled_atomic_signed_v1")
    assert not any(r16_old["execute"].values()), "R16_OLD_DIRECT_GRANT_REGRESSION"
    assert r16_new["execute"] == {
        "anon": False, "authenticated": False, "service_role": True
    }, "R16_SIGNED_WRAPPER_ACL_REGRESSION"
    assert one("community_ensure_account_creator_signed_v1")["execute"][
        "authenticated"] is False, "A0_BOOTSTRAP_GRANT_REGRESSION"

    v2 = one("community_set_gallery_comments_enabled_v2")
    assert v2["security_definer"], "V2_WRITER_CONTRACT_CHANGED"
    assert not v2["contains_signed_v2"], "V2_RISK_DISAPPEARED_RECHECK_QA"
    assert v2["execute"] == {
        "anon": False, "authenticated": False, "service_role": False
    }, "SOURCE157_LEGACY_V2_DIRECT_EXECUTE_STILL_ENABLED"
    direct = {}
    # A randomized unregistered subject/work cannot yield a successful
    # business mutation. It distinguishes SQL permission denial from reaching
    # the SECURITY DEFINER body. All calls run inside rollback-only scope.
    for actor in ("anon", "authenticated", "service_role"):
        try:
            with db.transaction():
                db.execute("set local role " + actor)
                db.execute(
                    "select public.community_set_gallery_comments_enabled_v2(%s,%s,false)",
                    (uuid.uuid4(), uuid.uuid4()),
                ).fetchone()
            direct[actor] = "UNEXPECTED_SUCCESS"
        except psycopg.Error as exc:
            direct[actor] = str(exc.sqlstate or "UNKNOWN")
    assert all(x == "42501" for x in direct.values()), "LEGACY_V2_SQL_NOT_ACL_DENIED"
    # Reversibility is proved in a disposable uncommitted PostgreSQL
    # transaction only; production must NEVER auto-GRANT the retired RPC.
    db.execute("begin")
    try:
        db.execute("grant execute on function public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean) to service_role")
        assert db.execute(
            "select has_function_privilege('service_role',"
            "'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)',"
            "'EXECUTE')"
        ).fetchone()[0], "ROLLBACK_DRY_RUN_GRANT_MISSING"
    finally:
        db.execute("rollback")
    assert not db.execute(
        "select has_function_privilege('service_role',"
        "'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)',"
        "'EXECUTE')"
    ).fetchone()[0], "ROLLBACK_DRY_RUN_LEAKED_GRANT"
    print(json.dumps({"case": "SOURCE157_ROLLBACK_DRY_RUN",
                      "temporary_grant_in_rolled_back_transaction": True,
                      "effective_service_role_execute_after_rollback": False},
                     sort_keys=True), flush=True)
    print(json.dumps({
        "case": "LEGACY_V2_DIRECT_SQL_RANDOM_NONEXISTENT_ACTOR",
        "sqlstate_by_role": direct, "unauthorized_persisted_mutation": "NOT_TESTED",
    }, sort_keys=True), flush=True)
    print(json.dumps({
        "case": "FULL157_LEGACY_ACL_INVENTORY_COMPLETE",
        "catalog_rpcs": len(audited), "command_mappings": len(commands),
        "legacy_v2": v2["execute"],
        "legacy_v2_definer": v2["security_definer"],
        "direct_sql_probe": direct,
        "classification": "SOURCE157_LOCAL_DB_ACL_ONLY_NOT_SIGNED_SESSION_RACE",
        "product_writer_enabled": False,
    }, sort_keys=True), flush=True)
