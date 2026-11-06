#!/usr/bin/env python3
"""04 QR-S independent Source169 followCreator denial and safe self-reapply.
Disposable real GoTrue ES256 FULL169 with two separate PostgreSQL connections.
Synthetic accounts only. Never print keys, JWTs, account IDs or private content.
"""
import base64
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.error
import urllib.request
import uuid
from contextlib import closing

import psycopg

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert all(not os.getenv(k) for k in ("DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"))
URL = "http://127.0.0.1:54321"
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
FOLLOW = "public.community_follow_creator(uuid,uuid)"
UNFOLLOW = "public.community_unfollow_creator(uuid,uuid)"
keys = {}
for line in subprocess.check_output(["supabase", "status", "-o", "env"],
                                    text=True, stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        keys[k.strip()] = v.strip().strip("'\"")
assert keys.get("ANON_KEY") and keys.get("SERVICE_ROLE_KEY")

def http(path, payload=None, token=None, admin=False, method="POST"):
    key = keys["SERVICE_ROLE_KEY"] if admin else keys["ANON_KEY"]
    headers = {"apikey": key, "Accept": "application/json"}
    if admin or token:
        headers["Authorization"] = "Bearer " + (key if admin else token)
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(URL + path, headers=headers, method=method,
        data=None if payload is None else json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return response.status, json.loads(response.read(140000) or b"null")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read(140000) or b"{}")
        except (ValueError, UnicodeError):
            return err.code, {}

def jwt_info(jwt, i=1):
    s = jwt.split(".")[i]
    return json.loads(base64.urlsafe_b64decode(s + "=" * (-len(s) % 4)))

def scalar(pg, sql, params=()):
    return pg.execute(sql, params).fetchone()[0]

def mark(s):
    print("QR169_" + s + "_PASS", flush=True)

def me(jwt):
    return http("/functions/v1/community-query", {"query": "me", "payload": {}}, token=jwt)[0]

def follow(jwt, target):
    return http("/functions/v1/community-command", {
        "command": "followCreator", "payload": {"creatorProfileId": str(target)}
    }, token=jwt)

created = []
try:
    def make_account(name):
        email = "qr169-" + name + "-" + secrets.token_hex(7) + "@example.invalid"
        password = secrets.token_urlsafe(25) + "A1!"
        status, user = http("/auth/v1/admin/users",
            {"email": email, "password": password, "email_confirm": True}, admin=True)
        assert status in (200, 201) and user.get("id"), "QR169_CREATE_IDENTITY"
        subject = uuid.UUID(user["id"])
        created.append(subject)
        def login():
            code, data = http("/auth/v1/token?grant_type=password",
                {"email": email, "password": password})
            assert code == 200 and data.get("access_token") and data.get("refresh_token")
            jwt = data["access_token"]
            h, c = jwt_info(jwt, 0), jwt_info(jwt)
            assert h.get("alg") == "ES256" and c.get("sub") == str(subject) and c.get("session_id")
            return jwt, data["refresh_token"], (subject, int(c["iat"]), uuid.UUID(c["session_id"]))
        return subject, login

    actor, login = make_account("a")
    old_a1, refresh_a1, s1 = login()
    active_a2, _, s2 = login()
    assert s1[2] != s2[2], "QR169_DUPLICATE_SESSION"
    status, identity = http("/functions/v1/community-command", {
        "command": "ensureAccountCreator",
        "payload": {"handle": "qr169_" + secrets.token_hex(7),
                    "displayName": "Independent local QR169"},
    }, token=old_a1)
    assert status == 200 and identity.get("ok"), ("QR169_FIRST_ACCOUNT", status)
    account = uuid.UUID(identity["data"]["accountId"])
    origin = uuid.UUID(identity["data"]["creatorProfileId"])
    targets = []
    for index in (1, 2):
        _, target_login = make_account("b" + str(index))
        target_token, _, _ = target_login()
        status, profile = http("/functions/v1/community-command", {
            "command": "ensureAccountCreator",
            "payload": {"handle": "qr169_" + secrets.token_hex(7),
                        "displayName": "Local QR169 synthetic target"},
        }, token=target_token)
        assert status == 200 and profile.get("ok"), ("QR169_CREATOR_TARGET", status)
        targets.append(uuid.UUID(profile["data"]["creatorProfileId"]))
    assert len(set(targets)) == 2 and origin not in targets

    with closing(psycopg.connect(DSN, autocommit=True)) as owner, \
         closing(psycopg.connect(DSN, autocommit=True)) as other_pg:
        assert scalar(owner, "select pg_backend_pid()") != scalar(other_pg, "select pg_backend_pid()")
        assert scalar(owner, "select count(*) from supabase_migrations.schema_migrations") == 169
        assert scalar(owner, "select to_regprocedure(%s) is not null", (FOLLOW,))
        for sig in (FOLLOW, UNFOLLOW):
            for role in ("anon", "authenticated", "service_role"):
                assert scalar(owner, "select has_function_privilege(%s,%s,'EXECUTE')",
                    (role, sig)) is False, ("QR169_LEGACY_EXECUTE_OPEN", role)
            assert scalar(owner, """
                select exists(
                    select 1 from pg_proc p,
                      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                    where p.oid=%s::regprocedure and a.grantee=0
                      and a.privilege_type='EXECUTE'
                )""", (sig,)) is False, "QR169_PUBLIC_DEFAULT_EXECUTE"
        for sig in (
            "public.community_add_reaction(uuid,uuid,text)",
            "public.community_save_entity(uuid,uuid)",
            "public.community_unsave_entity(uuid,uuid)",
            "public.community_remove_reaction(uuid,uuid,text)",
            "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
        ):
            assert scalar(owner, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (sig,)) is False, "QR169_ANCESTOR_WRITER_REGRANT"
        for sig in (
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert scalar(owner, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (sig,)), "QR169_SIGNED_R16_WORKSPACE_LOST"
        mark("PUBLIC_AND_THREE_ROLE_FOLLOW_UNFOLLOW_OFF_SIGNED_R16_ON")

        # Owner alone seeds a synthetic existing Follow+Outbox row.
        # The old external followCreator writer must remain non-executable.
        row = scalar(owner, "select public.community_follow_creator(%s,%s)",
            (actor, targets[0]))
        assert isinstance(row, dict) and row.get("creatorProfileId") == str(targets[0])
        def snapshot():
            return owner.execute("""
                select
                  (select count(*) from public.follows
                    where follower_account_id=%s and creator_profile_id=any(%s::uuid[])),
                  (select count(*) from public.outbox_events
                    where event_type='creator.followed' and aggregate_id=any(%s::uuid[])),
                  (select count(*) from public.idempotency_keys
                    where account_id=%s)
            """, (account, targets, targets, account)).fetchone()
        def sql_deny(role, target):
            try:
                with other_pg.transaction():
                    other_pg.execute("set local role " + role)
                    scalar(other_pg, "select public.community_follow_creator(%s,%s)",
                        (actor, target))
            except psycopg.Error as err:
                assert err.sqlstate == "42501", ("QR169_BAD_SQLSTATE", role, err.sqlstate)
                return
            raise AssertionError("QR169_LEGACY_FOLLOW_SQL_COMMITTED_" + role)

        before = snapshot()
        assert before[:2] == (1, 1), "QR169_FOLLOW_OUTBOX_SEED_REQUIRED"
        scalar(owner, "select public.community_authorize_signed_session_v2(%s,%s,%s)", s2)
        assert me(active_a2) == 200, "QR169_ELIGIBLE_A2_NOT_HEALTHY"
        code, body = follow(active_a2, targets[1])
        assert code == 409 and body.get("error") == "SOURCE169_FOLLOW_CREATOR_WRITER_NOT_ENROLLED", (
            "QR169_ELIGIBLE_BAD_STATUS", code, body.get("error"))
        for role in ("anon", "authenticated", "service_role"):
            sql_deny(role, targets[1])
        assert snapshot() == before, "QR169_ELIGIBLE_DIFF"
        mark("ACTIVE_A2_409_THREE_SQL42501_FOLLOW_OUTBOX_IDEM_NO_DIFF")

        scalar(owner, "select public.community_authorize_signed_session_v2(%s,%s,%s)", s1)
        scalar(owner, "select public.community_revoke_signed_session_v1(%s,%s,%s,'local')", s1)
        assert me(old_a1) == 401, "QR169_ORIGINAL_A1_REVOKE_FAILED"
        code, refreshed = http("/auth/v1/token?grant_type=refresh_token",
            {"refresh_token": refresh_a1})
        assert code == 200 and refreshed.get("access_token"), "QR169_TRUE_REFRESH_FAILED"
        new_a1 = refreshed["access_token"]
        assert jwt_info(new_a1).get("session_id") == str(s1[2]), "QR169_REFRESH_CHANGED_SESSION"
        assert me(new_a1) == 401, "QR169_REFRESHED_A1_NOT_REVOKED"
        assert me(active_a2) == 200, "QR169_SIBLING_A2_BROKEN"
        for jwt in (old_a1, new_a1):
            assert follow(jwt, targets[1])[0] == 401, "QR169_REVOKED_EDGE_NOT_401"
        for _ in range(5):
            sql_deny("service_role", targets[1])
        assert snapshot() == before, "QR169_POSTREVOKE_FOLLOW_OUTBOX_IDEM_DIFF"
        mark("REVOKED_ORIGINAL_AND_REAL_REFRESHED_A1_401_A2_200_FIVE_SQL_REPLAYS_NO_DIFF")

        owner.execute("begin")
        try:
            owner.execute("grant execute on function " + FOLLOW + " to service_role")
            assert scalar(owner, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (FOLLOW,))
            assert not scalar(other_pg, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (FOLLOW,))
        finally:
            owner.execute("rollback")
        for pg in (owner, other_pg):
            assert not scalar(pg, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (FOLLOW,))
        sql_deny("service_role", targets[1])
        assert snapshot() == before, "QR169_ROLLBACK_MUTATED"
        mark("TWO_PG_UNCOMMITTED_GRANT_INVISIBLE_ROLLBACK_DENIED")

        # The source169 migration is explicitly safe on same-schema replay.
        # Do NOT rerun immutable Source168 after169: it correctly requires
        # the *previous* state with legacy Follow EXECUTE positive.
        source169 = Path(
            "supabase/migrations/20261106020000_community_source169_follow_creator_service_execute_off.sql"
        ).read_text(encoding="utf-8")
        assert "SOURCE169_FOLLOW_CREATOR_RPC_MISSING" in source169
        owner.execute(source169, prepare=False)
        for sig in (FOLLOW, UNFOLLOW):
            assert not scalar(owner,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (sig,))
        for sig in (
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert scalar(owner, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (sig,))
        assert snapshot() == before, "QR169_REPLAY_MUTATED_FOLLOW_OUTBOX"
        sql_deny("service_role", targets[1])
        mark("ONLY_SOURCE169_SAME_SCHEMA_REAPPLY_DENIALS_NO_REGRANT")

        mark("INDEPENDENT_SIGNED_LOCAL_SOURCE169_FOLLOW_ONLY_SCOPED")
finally:
    for actor_id in reversed(created):
        try:
            http("/auth/v1/admin/users/" + str(actor_id), admin=True, method="DELETE")
        except Exception:
            pass
