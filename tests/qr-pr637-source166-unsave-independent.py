#!/usr/bin/env python3
"""Independent 04 QR-S Source166 unsaveEntity fail-closed acceptance.
Disposable localhost GoTrue ES256, two physical PostgreSQL backends, synthetic data.
No external keys, user media, private P1G, or managed projects.
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
assert not any(os.getenv(k) for k in ("DATABASE_URL", "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"))
API = "http://127.0.0.1:54321"
DATABASE = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
OLD = "public.community_unsave_entity(uuid,uuid)"
credentials = {}
for raw in subprocess.check_output(["supabase", "status", "-o", "env"], text=True, stderr=subprocess.DEVNULL).splitlines():
    if "=" in raw:
        k, v = raw.split("=", 1)
        credentials[k.strip()] = v.strip().strip("'\"")
assert credentials.get("ANON_KEY") and credentials.get("SERVICE_ROLE_KEY")

def http(path, body=None, token=None, admin=False, method="POST"):
    key = credentials["SERVICE_ROLE_KEY"] if admin else credentials["ANON_KEY"]
    headers = {"apikey": key, "Accept": "application/json"}
    if admin or token:
        headers["Authorization"] = "Bearer " + (key if admin else token)
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(API + path, headers=headers, method=method,
        data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, json.loads(response.read(140000) or b"null")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read(140000) or b"{}")
        except (UnicodeError, ValueError):
            return error.code, {}

def claims(jwt, part=1):
    fragment = jwt.split(".")[part]
    return json.loads(base64.urlsafe_b64decode(fragment + "=" * (-len(fragment) % 4)))

def one(pg, statement, params=()):
    return pg.execute(statement, params).fetchone()[0]

def mark(label):
    print("QR166_" + label + "_PASS", flush=True)

def me(jwt):
    return http("/functions/v1/community-query", {"query": "me", "payload": {}}, token=jwt)[0]

def unsave(jwt, target):
    return http("/functions/v1/community-command", {
        "command": "unsaveEntity", "payload": {"targetEntityId": str(target)}
    }, token=jwt)

actor = None
try:
    email = "qr166-" + secrets.token_hex(7) + "@example.invalid"
    password = secrets.token_urlsafe(24) + "A1!"
    status, result = http("/auth/v1/admin/users", {
        "email": email, "password": password, "email_confirm": True}, admin=True)
    assert status in (200, 201) and result.get("id"), "QA166_CREATE_USER_FAILED"
    actor = uuid.UUID(result["id"])

    def login():
        status, data = http("/auth/v1/token?grant_type=password",
            {"email": email, "password": password})
        assert status == 200 and data.get("access_token") and data.get("refresh_token")
        jwt = data["access_token"]
        header, payload = claims(jwt, 0), claims(jwt)
        assert header.get("alg") == "ES256"
        assert payload.get("sub") == str(actor) and payload.get("session_id")
        return jwt, data["refresh_token"], (actor, int(payload["iat"]), uuid.UUID(payload["session_id"]))

    old_a1, refresh1, session1 = login()
    active_a2, _, session2 = login()
    assert session1[2] != session2[2], "QA166_SESSIONS_NOT_DISTINCT"

    status, identity = http("/functions/v1/community-command", {
        "command": "ensureAccountCreator",
        "payload": {"handle": "qr166_" + secrets.token_hex(7), "displayName": "QA166 synthetic local"}
    }, token=old_a1)
    assert status == 200 and identity.get("ok"), ("QA166_BOOTSTRAP_FAILED", status)
    account = uuid.UUID(identity["data"]["accountId"])
    creator = uuid.UUID(identity["data"]["creatorProfileId"])

    with closing(psycopg.connect(DATABASE, autocommit=True)) as observer, \
         closing(psycopg.connect(DATABASE, autocommit=True)) as executor:
        assert one(observer, "select pg_backend_pid()") != one(executor, "select pg_backend_pid()")
        assert one(observer, "select count(*) from supabase_migrations.schema_migrations") == 166
        assert one(observer, "select to_regprocedure(%s) is not null", (OLD,))
        for role in ("anon", "authenticated", "service_role"):
            assert one(observer, "select has_function_privilege(%s,%s,'EXECUTE')",
                (role, OLD)) is False, ("QA166_UNSAVE_EXECUTE_ALLOWED", role)
        assert one(observer, """
            select exists(
              select 1 from pg_proc p,
                lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
              where p.oid=%s::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'
            )""", (OLD,)) is False, "QA166_PUBLIC_EXECUTE_ALLOWED"
        # Inherited, already accepted operations are only checked for regression.
        for signature in (
            "public.community_add_reaction(uuid,uuid,text)",
            "public.community_save_entity(uuid,uuid)",
            "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
        ):
            assert one(observer, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)) is False, "QA166_INHERITED_WRITER_REGRANTED"
        for signature in (
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert one(observer, "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)), "QA166_SIGNED_R16_WORKSPACE_MISSING"
        mark("THREE_ROLE_PUBLIC_ACL_OFF_PRIOR_SIGNED_GRANTS_INTACT")

        # DB owner only seeds a synthetic pre-existing published Question and saved Item.
        # No retired external Question or Save writer is reenabled.
        q = one(observer, """
          select public.community_ask_question_v1(
            %s,%s,'QR166 synthetic Question','local only',
            %s::text[],'switch','1.25.0',%s)""",
            (actor, creator, ["qa_fixture"], "qr166-" + secrets.token_hex(8)))
        assert isinstance(q, dict) and q.get("questionId")
        target = uuid.UUID(q["questionId"])
        assert one(observer, "select private.can_access_entity(%s,%s)", (target, account))
        assert one(observer, "select has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')") is False
        seeded = one(observer, "select public.community_save_entity(%s,%s)", (actor, target))
        assert isinstance(seeded, dict) and seeded.get("saved") is True, "QA166_OWNER_FIXTURE_NOT_SAVED"

        def snapshot():
            return observer.execute("""
              select
                (select count(*) from public.saved_items where account_id=%s and target_entity_id=%s),
                (select count(*) from public.outbox_events where aggregate_id=%s),
                (select count(*) from public.idempotency_keys where account_id=%s)
            """, (account, target, target, account)).fetchone()

        def deny_direct(role):
            try:
                with executor.transaction():
                    executor.execute("set local role " + role)
                    one(executor, "select public.community_unsave_entity(%s,%s)", (actor, target))
            except psycopg.Error as exc:
                assert exc.sqlstate == "42501", ("QA166_WRONG_SQLSTATE", role, exc.sqlstate)
                return
            raise AssertionError("QA166_PRIVILEGED_UNSAVE_COMMIT_" + role)

        baseline = snapshot()
        assert baseline[0] == 1, "QA166_PREEXISTING_ITEM_REQUIRED"
        one(observer, "select public.community_authorize_signed_session_v2(%s,%s,%s)", session2)
        assert me(active_a2) == 200, "QA166_A2_UNHEALTHY"
        status, response = unsave(active_a2, target)
        assert status == 409 and response.get("error") == "SOURCE166_UNSAVE_ENTITY_WRITER_NOT_ENROLLED", (
            "QA166_ELIGIBLE_UNSAVE_NOT_409", status, response.get("error"))
        for role in ("anon", "authenticated", "service_role"):
            deny_direct(role)
        assert snapshot() == baseline, "QA166_VALID_A2_DELETED_ITEM"
        mark("ELIGIBLE_A2_409_DIRECT_SQL42501_PRESERVED_SAVEDITEM_OUTBOX")

        one(observer, "select public.community_authorize_signed_session_v2(%s,%s,%s)", session1)
        one(observer, "select public.community_revoke_signed_session_v1(%s,%s,%s,'local')", session1)
        assert me(old_a1) == 401, "QA166_ORIGINAL_A1_NOT_REVOKED"
        status, refreshed = http("/auth/v1/token?grant_type=refresh_token", {
            "refresh_token": refresh1,
        })
        assert status == 200 and refreshed.get("access_token"), "QA166_REAL_REFRESH_NOT_RETURNED"
        new_a1 = refreshed["access_token"]
        assert claims(new_a1).get("session_id") == str(session1[2]), "QA166_REFRESHED_WRONG_SESSION"
        assert me(new_a1) == 401, "QA166_REFRESHED_A1_NOT_REVOKED"
        assert me(active_a2) == 200, "QA166_SIBLING_A2_BROKEN"
        for token in (old_a1, new_a1):
            assert unsave(token, target)[0] == 401, "QA166_REVOKED_EDGE_NOT_401"
        for _ in range(5):
            deny_direct("service_role")
        assert snapshot() == baseline, "QA166_POSTREVOKE_SAVEDITEM_OR_OUTBOX_CHANGED"
        mark("REVOKED_A1_OLD_REFRESHED401_SIBLING200_FIVE_SQL_REPLAY_NO_DIFF")

        observer.execute("begin")
        try:
            observer.execute("grant execute on function " + OLD + " to service_role")
            assert one(observer, "select has_function_privilege('service_role',%s,'EXECUTE')", (OLD,))
            assert not one(executor, "select has_function_privilege('service_role',%s,'EXECUTE')", (OLD,))
        finally:
            observer.execute("rollback")
        for pg in (observer, executor):
            assert not one(pg, "select has_function_privilege('service_role',%s,'EXECUTE')", (OLD,))
        deny_direct("service_role")
        assert snapshot() == baseline, "QA166_ROLLBACK_MODIFIED_SAVEDITEMS"
        mark("TEMP_GRANT_SECOND_PG_INVISIBLE_ROLLBACK_DENIED")
        mark("INDEPENDENT_LOCAL_ES256_SOURCE166_UNSAVE_ONLY_SCOPED")
finally:
    if actor is not None:
        try:
            http("/auth/v1/admin/users/" + str(actor), admin=True, method="DELETE")
        except Exception:
            pass
