#!/usr/bin/env python3
"""Independent 04 QR-S: Source167 removeReaction legacy SQL OFF.
Genuine disposable localhost GoTrue ES256 and two independent PG backends.
All records synthetic; never log JWTs, credentials, account IDs or private content.
"""
import base64
import json
import os
import secrets
import subprocess
import urllib.error
import urllib.request
import uuid
from contextlib import closing

import psycopg

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
assert all(not os.getenv(k) for k in ("DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"))
API = "http://127.0.0.1:54321"
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OLD = "public.community_remove_reaction(uuid,uuid,text)"
keys = {}
for line in subprocess.check_output(["supabase", "status", "-o", "env"], text=True, stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        keys[k.strip()] = v.strip().strip("'\"")
assert keys.get("ANON_KEY") and keys.get("SERVICE_ROLE_KEY")

def req(path, payload=None, token=None, service=False, method="POST"):
    key = keys["SERVICE_ROLE_KEY"] if service else keys["ANON_KEY"]
    headers = {"apikey": key, "Accept": "application/json"}
    if token or service:
        headers["Authorization"] = "Bearer " + (key if service else token)
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(API + path, headers=headers, method=method,
        data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, json.loads(response.read(140000) or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read(140000) or b"{}")
        except (ValueError, UnicodeError):
            return e.code, {}

def jwt_part(jwt, index=1):
    segment = jwt.split(".")[index]
    return json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))

def one(pg, sql, params=()):
    return pg.execute(sql, params).fetchone()[0]

def mark(suffix):
    print("QR167_" + suffix + "_PASS", flush=True)

def query_me(jwt):
    return req("/functions/v1/community-query", {"query": "me", "payload": {}}, token=jwt)[0]

def remove(jwt, target):
    return req("/functions/v1/community-command", {"command": "removeReaction",
        "payload": {"targetEntityId": str(target), "reactionKind": "like"}}, token=jwt)

actor = None
try:
    email = "qr167-" + secrets.token_hex(7) + "@example.invalid"
    password = secrets.token_urlsafe(24) + "A1!"
    code, user = req("/auth/v1/admin/users",
        {"email": email, "password": password, "email_confirm": True}, service=True)
    assert code in (200, 201) and user.get("id"), "QR167_CREATE_LOCAL_A0_FAILED"
    actor = uuid.UUID(user["id"])

    def login():
        status, data = req("/auth/v1/token?grant_type=password",
            {"email": email, "password": password})
        assert status == 200 and data.get("access_token") and data.get("refresh_token")
        token = data["access_token"]
        header, claims = jwt_part(token, 0), jwt_part(token)
        assert header.get("alg") == "ES256"
        assert claims.get("sub") == str(actor) and claims.get("session_id")
        return token, data["refresh_token"], (actor, int(claims["iat"]), uuid.UUID(claims["session_id"]))

    old_a1, refresh1, session1 = login()
    active_a2, _, session2 = login()
    assert session1[2] != session2[2], "QR167_IDENTICAL_SESSIONS"
    status, identity = req("/functions/v1/community-command", {
        "command": "ensureAccountCreator",
        "payload": {"handle": "qr167_" + secrets.token_hex(7), "displayName": "QA167 local-only fixture"},
    }, token=old_a1)
    assert status == 200 and identity.get("ok"), ("QR167_ACCOUNT_BOOTSTRAP_FAILED", status)
    account = uuid.UUID(identity["data"]["accountId"])
    creator = uuid.UUID(identity["data"]["creatorProfileId"])

    with closing(psycopg.connect(DSN, autocommit=True)) as owner, \
         closing(psycopg.connect(DSN, autocommit=True)) as outsider:
        assert one(owner, "select pg_backend_pid()") != one(outsider, "select pg_backend_pid()")
        assert one(owner, "select count(*) from supabase_migrations.schema_migrations") == 167
        assert one(owner, "select to_regprocedure(%s) is not null", (OLD,))

        for role in ("anon", "authenticated", "service_role"):
            assert one(owner, "select has_function_privilege(%s,%s,'EXECUTE')",
                (role, OLD)) is False, ("QR167_LEGACY_EXECUTE_ALLOWED", role)
        assert one(owner, """
            select exists(
                select 1 from pg_proc p,
                  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                where p.oid=%s::regprocedure
                  and a.grantee=0 and a.privilege_type='EXECUTE'
            )""", (OLD,)) is False, "QR167_PUBLIC_DEFAULT_EXECUTE_ALLOWED"
        # The accepted ancestors are regression-checked for ACL only, not re-QA'd.
        for signature in (
            "public.community_add_reaction(uuid,uuid,text)",
            "public.community_save_entity(uuid,uuid)",
            "public.community_unsave_entity(uuid,uuid)",
            "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
        ):
            assert one(owner, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)) is False, "QR167_ANCESTOR_LEGACY_REGRANT"
        for signature in (
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert one(owner, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)), "QR167_ACCEPTED_SIGNED_GRANT_MISSING"
        mark("PUBLIC_THREE_ROLE_ACL_DENIED_ANCESTOR_SIGNED_INTACT")

        # DB owner alone seeds synthetic pre-existing Question and Reaction.
        # Retired Question/addReaction public writers are NOT reopened.
        question = one(owner, """
            select public.community_ask_question_v1(
               %s,%s,'QR167 synthetic Question','local only',
               %s::text[],'switch','1.25.0',%s)""",
            (actor, creator, ["qr_fixture"], "qr167-" + secrets.token_hex(8)))
        assert isinstance(question, dict) and question.get("questionId")
        target = uuid.UUID(question["questionId"])
        assert one(owner, "select private.can_access_entity(%s,%s)", (target, account))
        assert one(owner, "select has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')") is False
        seed = one(owner, "select public.community_add_reaction(%s,%s,%s)",
            (actor, target, "like"))
        assert isinstance(seed, dict), "QR167_LOCAL_REACTION_SEED_FAILED"

        def snapshot():
            return owner.execute("""
                select
                    (select count(*) from public.reactions
                      where account_id=%s and target_entity_id=%s and reaction_kind='like'),
                    (select count(*) from public.outbox_events where aggregate_id=%s),
                    (select count(*) from public.idempotency_keys where account_id=%s)
            """, (account, target, target, account)).fetchone()

        def direct_deny(role):
            try:
                with outsider.transaction():
                    outsider.execute("set local role " + role)
                    one(outsider, "select public.community_remove_reaction(%s,%s,%s)",
                        (actor, target, "like"))
            except psycopg.Error as e:
                assert e.sqlstate == "42501", ("QR167_UNEXPECTED_SQLSTATE", role, e.sqlstate)
                return
            raise AssertionError("QR167_OLD_REMOVE_SQL_COMMITTED_" + role)

        initial = snapshot()
        assert initial[0] == 1, "QR167_PREEXISTING_REACTION_NOT_SEEDED"
        one(owner, "select public.community_authorize_signed_session_v2(%s,%s,%s)", session2)
        assert query_me(active_a2) == 200, "QR167_HEALTHY_A2_ME_FAILED"
        code, response = remove(active_a2, target)
        assert code == 409 and response.get("error") == "SOURCE167_REMOVE_REACTION_WRITER_NOT_ENROLLED", (
            "QR167_VALID_REMOVE_BAD_STATUS", code, response.get("error"))
        for role in ("anon", "authenticated", "service_role"):
            direct_deny(role)
        assert snapshot() == initial, "QR167_ELIGIBLE_A2_REACTION_OUTBOX_CHANGED"
        mark("ELIGIBLE_A2_409_DIRECT_SQL42501_REACTION_OUTBOX_NO_DIFF")

        one(owner, "select public.community_authorize_signed_session_v2(%s,%s,%s)", session1)
        one(owner, "select public.community_revoke_signed_session_v1(%s,%s,%s,'local')", session1)
        assert query_me(old_a1) == 401, "QR167_ORIGINAL_A1_NOT_REVOKED"
        status, refreshed = req("/auth/v1/token?grant_type=refresh_token",
            {"refresh_token": refresh1})
        assert status == 200 and refreshed.get("access_token"), "QR167_TRUE_REFRESH_FAILED"
        new_a1 = refreshed["access_token"]
        assert jwt_part(new_a1).get("session_id") == str(session1[2]), "QR167_REFRESH_WRONG_SESSION"
        assert query_me(new_a1) == 401, "QR167_REFRESHED_A1_NOT_REVOKED"
        assert query_me(active_a2) == 200, "QR167_SIBLING_A2_NOT_HEALTHY"
        for token in (old_a1, new_a1):
            assert remove(token, target)[0] == 401, "QR167_REVOKED_REMOVE_NOT_401"
        for _ in range(5):
            direct_deny("service_role")
        assert snapshot() == initial, "QR167_REVOKED_REACTION_OUTBOX_IDEMPOTENCY_CHANGED"
        mark("REVOKED_A1_ORIGINAL_REFRESHED401_SIBLING200_FIVE_REPLAY_NO_DIFF")

        owner.execute("begin")
        try:
            owner.execute("grant execute on function " + OLD + " to service_role")
            assert one(owner, "select has_function_privilege('service_role',%s,'EXECUTE')", (OLD,))
            assert not one(outsider, "select has_function_privilege('service_role',%s,'EXECUTE')", (OLD,))
        finally:
            owner.execute("rollback")
        for pg in (owner, outsider):
            assert not one(pg, "select has_function_privilege('service_role',%s,'EXECUTE')", (OLD,))
        direct_deny("service_role")
        assert snapshot() == initial, "QR167_ROLLBACK_MUTATED_REACTIONS"
        mark("TWO_POSTGRES_BACKENDS_TEMP_GRANT_INVISIBLE_ROLLBACK_DENIED")
        mark("INDEPENDENT_LOCAL_ES256_SOURCE167_REMOVE_ONLY_SCOPED")
finally:
    if actor is not None:
        try:
            req("/auth/v1/admin/users/" + str(actor), service=True, method="DELETE")
        except Exception:
            pass
