#!/usr/bin/env python3
"""04 QR-S independent Source164 addReaction effective denial.
Disposable localhost GoTrue ES256 + two PostgreSQL sessions only.
Never print JWT, API keys, private fixture IDs or user content.
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
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SIGNATURE = "public.community_add_reaction(uuid,uuid,text)"
env = {}
for line in subprocess.check_output(["supabase", "status", "-o", "env"], text=True, stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip("'\"")
assert env.get("ANON_KEY") and env.get("SERVICE_ROLE_KEY")

def api(path, body=None, token=None, admin=False, method="POST"):
    key = env["SERVICE_ROLE_KEY"] if admin else env["ANON_KEY"]
    headers = {"apikey": key, "Accept": "application/json"}
    if admin or token:
        headers["Authorization"] = "Bearer " + (key if admin else token)
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        API + path,
        data=None if body is None else json.dumps(body).encode(),
        method=method, headers=headers,
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, json.loads(response.read(140000) or b"null")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read(140000) or b"{}")
        except (ValueError, UnicodeError):
            return error.code, {}

def jwt_part(jwt, index=1):
    part = jwt.split(".")[index]
    return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))

def scalar(pg, statement, params=()):
    return pg.execute(statement, params).fetchone()[0]

def mark(value):
    print("QR164_" + value + "_PASS", flush=True)

def signed_session(pg, triple):
    scalar(pg, "select public.community_authorize_signed_session_v2(%s,%s,%s)", triple)

def status_me(token):
    return api("/functions/v1/community-query", {"query": "me", "payload": {}}, token=token)[0]

def reaction(token, target):
    return api("/functions/v1/community-command", {
        "command": "addReaction",
        "payload": {"targetEntityId": str(target), "reactionKind": "like"}
    }, token=token)

actor = None
try:
    email = "qa164-" + secrets.token_hex(8) + "@example.invalid"
    password = secrets.token_urlsafe(24) + "A1!"
    code, person = api("/auth/v1/admin/users",
        {"email": email, "password": password, "email_confirm": True}, admin=True)
    assert code in (200, 201) and person.get("id"), "QA164_AUTH_CREATE_FAILED"
    actor = uuid.UUID(person["id"])

    def login():
        status, data = api("/auth/v1/token?grant_type=password",
            {"email": email, "password": password})
        assert status == 200 and data.get("access_token") and data.get("refresh_token")
        token = data["access_token"]
        head, payload = jwt_part(token, 0), jwt_part(token, 1)
        assert head.get("alg") == "ES256"
        assert payload["sub"] == str(actor) and payload.get("session_id")
        return token, data["refresh_token"], (actor, int(payload["iat"]), uuid.UUID(payload["session_id"]))

    a1, a1_refresh, s1 = login()
    a2, _, s2 = login()
    assert s1[2] != s2[2], "QR164_SAME_GOTRUE_SESSION"

    status, identity = api("/functions/v1/community-command", {
        "command": "ensureAccountCreator",
        "payload": {"handle": "qa164_" + secrets.token_hex(8), "displayName": "Synthetic QA164"}
    }, token=a1)
    assert status == 200 and identity.get("ok"), ("QA164_FIRST_ACCOUNT", status)
    account = uuid.UUID(identity["data"]["accountId"])
    creator = uuid.UUID(identity["data"]["creatorProfileId"])

    with closing(psycopg.connect(DSN, autocommit=True)) as observer, \
         closing(psycopg.connect(DSN, autocommit=True)) as second_pg:
        assert scalar(observer, "select pg_backend_pid()") != scalar(second_pg, "select pg_backend_pid()")
        assert scalar(observer, "select count(*) from supabase_migrations.schema_migrations") == 164
        assert scalar(observer, "select to_regprocedure(%s) is not null", (SIGNATURE,))
        for role in ("anon", "authenticated", "service_role"):
            allowed = scalar(observer,
                "select has_function_privilege(%s,%s,'EXECUTE')", (role, SIGNATURE))
            assert allowed is False, ("QA164_ROLE_WRITER_OPEN", role)
        public_acl = scalar(observer, """
            select exists(
                select 1 from pg_proc p
                cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) rights
                where p.oid=%s::regprocedure and rights.grantee=0 and rights.privilege_type='EXECUTE'
            )""", (SIGNATURE,))
        assert public_acl is False, "QA164_PUBLIC_DEFAULT_EXECUTE_OPEN"
        for sig in (
            "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
            "public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)",
            "public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)",
        ):
            assert not scalar(observer,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (sig,))
        for sig in (
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert scalar(observer,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (sig,))
        mark("164_MIGRATION_THREE_ROLE_AND_PUBLIC_ACL_OFF_R16_UNCHANGED")

        # Superuser-created synthetic Question stands in for an existing published target.
        # It does not exercise, reopen, or authorize the retired Question public Writer.
        question = scalar(observer, """
            select public.community_ask_question_v1(
                %s,%s,'QR164 disposable Question','local fixture',
                %s::text[],'switch','1.25.0',%s)""",
            (actor, creator, ["qa_local"], "qr164-" + secrets.token_hex(8)))
        assert isinstance(question, dict) and question.get("questionId")
        target = uuid.UUID(question["questionId"])
        assert scalar(observer, "select private.can_access_entity(%s,%s)", (target, account))
        
        def snapshot():
            return observer.execute("""
                select
                    (select count(*) from public.reactions where target_entity_id=%s and account_id=%s),
                    (select count(*) from public.outbox_events where aggregate_id=%s
                        and event_type='reaction.added' and payload->>'actorAccountId'=%s)
            """, (target, account, target, str(account))).fetchone()

        def must_deny(role):
            try:
                with second_pg.transaction():
                    second_pg.execute("set local role " + role)
                    scalar(second_pg,
                        "select public.community_add_reaction(%s,%s,%s)",
                        (actor, target, "qa164_" + secrets.token_hex(8)))
            except psycopg.Error as error:
                assert error.sqlstate == "42501", ("QA164_SQL_BAD_ERROR", role, error.sqlstate)
                return
            raise AssertionError("QA164_SQL_COMMITTED_FOR_" + role)

        baseline = snapshot()
        signed_session(observer, s2)
        assert status_me(a2) == 200, "QA164_ELIGIBLE_A2_NOT_HEALTHY"
        response_code, response = reaction(a2, target)
        assert response_code == 409 and response.get("error") == "SOURCE164_REACTION_ADD_WRITER_NOT_ENROLLED", (
            "QA164_ELIGIBLE_WRITER_BAD_STATUS", response_code, response.get("error"))
        for role in ("anon", "authenticated", "service_role"):
            must_deny(role)
        assert snapshot() == baseline, "QA164_ELIGIBLE_A2_MUTATED"
        mark("A2_ELIGIBLE_409_AND_DIRECT_SQL42501_NO_REACTION_OUTBOX_DIFF")

        signed_session(observer, s1)
        scalar(observer, "select public.community_revoke_signed_session_v1(%s,%s,%s,'local')", s1)
        assert status_me(a1) == 401, "QA164_ORIGINAL_A1_REVOKE_FAILED"
        status, refreshed = api("/auth/v1/token?grant_type=refresh_token",
            {"refresh_token": a1_refresh})
        assert status == 200 and refreshed.get("access_token"), "QA164_TRUE_REFRESH_FAILED"
        new_a1 = refreshed["access_token"]
        assert jwt_part(new_a1)["session_id"] == str(s1[2]), "QA164_WRONG_REFRESH_SESSION"
        assert status_me(new_a1) == 401, "QA164_REFRESHED_A1_REVOKE_FAILED"
        assert status_me(a2) == 200, "QA164_HEALTHY_SIBLING_LOST"
        for token in (a1, new_a1):
            assert reaction(token, target)[0] == 401, "QA164_REVOKED_EDGE_NOT_401"
        for _ in range(5):
            must_deny("service_role")
        assert snapshot() == baseline, "QA164_REVOKED_SQL_MUTATED_REACTION_OUTBOX"
        mark("A1_ORIGINAL_REFRESHED_401_SIBLING_200_FIVE_SQL_REPLAYS_NO_DIFF")

        observer.execute("begin")
        try:
            observer.execute("grant execute on function " + SIGNATURE + " to service_role")
            assert scalar(observer,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (SIGNATURE,))
            assert not scalar(second_pg,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (SIGNATURE,))
        finally:
            observer.execute("rollback")
        for pg in (observer, second_pg):
            assert not scalar(pg,
                "select has_function_privilege('service_role',%s,'EXECUTE')", (SIGNATURE,))
        must_deny("service_role")
        assert snapshot() == baseline, "QA164_POST_ROLLBACK_MUTATED"
        mark("TWO_POSTGRES_BACKENDS_TEMP_GRANT_ROLLBACK_42501")

        mark("INDEPENDENT_LOCAL_ES256_SOURCE164_ADD_ONLY_SCOPED")
finally:
    if actor:
        try:
            api("/auth/v1/admin/users/" + str(actor), admin=True, method="DELETE")
        except Exception:
            pass
