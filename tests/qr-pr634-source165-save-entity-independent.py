#!/usr/bin/env python3
"""Independent 04 QR-S Source165 saveEntity legacy SQL-off scope.
Only disposable localhost FULL165 ES256 GoTrue with two separate PostgreSQL sessions.
Do not log tokens, private data, or identifiers.
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
DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SAVE = "public.community_save_entity(uuid,uuid)"
credentials = {}
for line in subprocess.check_output(["supabase", "status", "-o", "env"], text=True, stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        key, val = line.split("=", 1)
        credentials[key.strip()] = val.strip().strip("'\"")
assert credentials.get("ANON_KEY") and credentials.get("SERVICE_ROLE_KEY")

def request(path, payload=None, token=None, admin=False, method="POST"):
    key = credentials["SERVICE_ROLE_KEY"] if admin else credentials["ANON_KEY"]
    headers = {"apikey": key, "Accept": "application/json"}
    if admin or token:
        headers["Authorization"] = "Bearer " + (key if admin else token)
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, method=method, headers=headers,
        data=None if payload is None else json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return response.status, json.loads(response.read(140000) or b"null")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read(140000) or b"{}")
        except (UnicodeError, ValueError):
            return error.code, {}

def part(token, i=1):
    value = token.split(".")[i]
    return json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))

def scalar(pg, sql, parameters=()):
    return pg.execute(sql, parameters).fetchone()[0]

def mark(name):
    print("QR165_" + name + "_PASS", flush=True)

def edge_save(token, target):
    return request("/functions/v1/community-command", {
        "command": "saveEntity", "payload": {"targetEntityId": str(target)}
    }, token=token)

def me(token):
    return request("/functions/v1/community-query", {
        "query": "me", "payload": {}
    }, token=token)[0]

actor = None
try:
    email = "qr165-" + secrets.token_hex(7) + "@example.invalid"
    password = secrets.token_urlsafe(24) + "A1!"
    code, identity = request("/auth/v1/admin/users", {
        "email": email, "password": password, "email_confirm": True,
    }, admin=True)
    assert code in (200, 201) and identity.get("id"), "QR165_CREATE_IDENTITY_FAILED"
    actor = uuid.UUID(identity["id"])

    def login():
        status, body = request("/auth/v1/token?grant_type=password", {
            "email": email, "password": password,
        })
        assert status == 200 and body.get("access_token") and body.get("refresh_token")
        token = body["access_token"]
        header, claims = part(token, 0), part(token)
        assert header.get("alg") == "ES256" and claims.get("sub") == str(actor)
        assert claims.get("session_id")
        return token, body["refresh_token"], (actor, int(claims["iat"]), uuid.UUID(claims["session_id"]))

    old_a1, refresh_a1, s1 = login()
    active_a2, _, s2 = login()
    assert s1[2] != s2[2], "QR165_SESSIONS_NOT_DISTINCT"
    http, bootstrap = request("/functions/v1/community-command", {
        "command": "ensureAccountCreator", "payload": {
            "handle": "qa165_" + secrets.token_hex(7),
            "displayName": "Independent Save165 fixture",
        }
    }, token=old_a1)
    assert http == 200 and bootstrap.get("ok"), ("QR165_ACCOUNT_BOOTSTRAP_FAILED", http)
    account = uuid.UUID(bootstrap["data"]["accountId"])
    creator = uuid.UUID(bootstrap["data"]["creatorProfileId"])

    with closing(psycopg.connect(DB, autocommit=True)) as pg1, \
         closing(psycopg.connect(DB, autocommit=True)) as pg2:
        assert scalar(pg1, "select pg_backend_pid()") != scalar(pg2, "select pg_backend_pid()")
        assert scalar(pg1, "select count(*) from supabase_migrations.schema_migrations") == 165
        assert scalar(pg1, "select to_regprocedure(%s) is not null", (SAVE,))
        for role in ("anon", "authenticated", "service_role"):
            allowed = scalar(pg1, "select has_function_privilege(%s,%s,'EXECUTE')",
                (role, SAVE))
            assert allowed is False, ("QR165_LEGACY_EXECUTE_ALLOWED", role)
        public_acl = scalar(pg1, """
            select exists (
              select 1 from pg_proc p,
                lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
              where p.oid=%s::regprocedure
                and a.grantee=0 and a.privilege_type='EXECUTE'
            )""", (SAVE,))
        assert public_acl is False, "QR165_PUBLIC_DEFAULT_EXECUTE_ALLOWED"

        # Only check relevant accepted ancestor functions; never retest their E2E.
        for signature in (
            "public.community_add_reaction(uuid,uuid,text)",
            "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
            "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
        ):
            assert not scalar(pg1, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)), "QR165_ANCESTOR_UNEXPECTED_REGRANT"
        for signature in (
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert scalar(pg1, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)), "QR165_ACCEPTED_SIGNED_GRANT_MISSING"
        mark("THREE_ROLE_PUBLIC_ACL_DENIED_ANCESTOR_SIGNED_INTACT")

        # Local DB owner creates an existing published synthetic Question; retired
        # Question writer stays OFF for all external actors.
        result = scalar(pg1, """
            select public.community_ask_question_v1(
                %s,%s,'Independent save test Question','local-only fixture',
                %s::text[],'switch','1.25.0',%s)""",
            (actor, creator, ["qa_fixture"], "qr165-" + secrets.token_hex(8)))
        assert isinstance(result, dict) and result.get("questionId"), "QR165_LOCAL_TARGET_INVALID"
        target = uuid.UUID(result["questionId"])
        assert scalar(pg1, "select private.can_access_entity(%s,%s)", (target, account))

        def snapshot():
            return pg1.execute("""
                select
                  (select count(*) from public.saved_items
                    where account_id=%s and target_entity_id=%s),
                  (select count(*) from public.outbox_events
                    where aggregate_id=%s),
                  (select count(*) from public.idempotency_keys
                    where account_id=%s and command_name='saveEntity')
            """, (account, target, target, account)).fetchone()

        def sql_denied(role):
            try:
                with pg2.transaction():
                    pg2.execute("set local role " + role)
                    scalar(pg2, "select public.community_save_entity(%s,%s)",
                        (actor, target))
            except psycopg.Error as error:
                assert error.sqlstate == "42501", ("QR165_UNEXPECTED_SQLSTATE", role, error.sqlstate)
                return
            raise AssertionError("QR165_LEGACY_SAVE_SQL_COMMITTED_" + role)

        baseline = snapshot()
        scalar(pg1, "select public.community_authorize_signed_session_v2(%s,%s,%s)", s2)
        assert me(active_a2) == 200, "QR165_A2_NOT_ACTIVE"
        code, body = edge_save(active_a2, target)
        assert code == 409 and body.get("error") == "SOURCE165_SAVE_ENTITY_WRITER_NOT_ENROLLED", (
            "QR165_VALID_SAVE_NOT_DENIED", code, body.get("error"))
        for role in ("anon", "authenticated", "service_role"):
            sql_denied(role)
        assert snapshot() == baseline, "QR165_A2_VALID_CAUSED_SAVE_OUTBOX_DIFF"
        mark("VALID_A2_409_THREE_ROLE_SQL42501_SAVED_OUTBOX_NO_DIFF")

        scalar(pg1, "select public.community_authorize_signed_session_v2(%s,%s,%s)", s1)
        scalar(pg1, "select public.community_revoke_signed_session_v1(%s,%s,%s,'local')", s1)
        assert me(old_a1) == 401, "QR165_ORIGINAL_A1_NOT_REVOKED"
        status, refreshed = request("/auth/v1/token?grant_type=refresh_token", {
            "refresh_token": refresh_a1,
        })
        assert status == 200 and refreshed.get("access_token"), "QR165_TRUE_GOTRUE_REFRESH_FAILED"
        new_a1 = refreshed["access_token"]
        assert part(new_a1).get("session_id") == str(s1[2]), "QR165_REFRESH_WRONG_SESSION"
        assert me(new_a1) == 401, "QR165_REAL_REFRESH_NOT_REVOKED"
        assert me(active_a2) == 200, "QR165_HEALTHY_A2_AFFECTED"
        for token in (old_a1, new_a1):
            assert edge_save(token, target)[0] == 401, "QR165_REVOKED_EDGE_NOT_401"
        for _ in range(5):
            sql_denied("service_role")
        assert snapshot() == baseline, "QR165_REVOKED_SAVE_OUTBOX_IDEM_DIFF"
        mark("REVOKED_A1_ORIGINAL_REFRESH401_A2_200_FIVE_REPLAY_NO_DIFF")

        pg1.execute("begin")
        try:
            pg1.execute("grant execute on function " + SAVE + " to service_role")
            assert scalar(pg1,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (SAVE,))
            assert not scalar(pg2,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (SAVE,))
        finally:
            pg1.execute("rollback")
        for pg in (pg1, pg2):
            assert not scalar(pg,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (SAVE,))
        sql_denied("service_role")
        assert snapshot() == baseline, "QR165_ROLLBACK_MUTATED_DB"
        mark("TWO_POSTGRES_BACKENDS_TEMP_GRANT_INVISIBLE_ROLLBACK_DENIED")
        mark("INDEPENDENT_SIGNED_LOCAL_SOURCE165_SAVE_ONLY_SCOPED")
finally:
    if actor is not None:
        try:
            request("/auth/v1/admin/users/" + str(actor), admin=True, method="DELETE")
        except Exception:
            pass
