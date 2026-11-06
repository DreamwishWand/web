#!/usr/bin/env python3
"""04 QR-S independent Source168 unfollowCreator scoped negative acceptance.
Disposable localhost GoTrue ES256 + two distinct PostgreSQL backends only.
Never print tokens, fixture IDs, local keys or private content.
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
SIGNATURE = "public.community_unfollow_creator(uuid,uuid)"
keys = {}
for line in subprocess.check_output(["supabase", "status", "-o", "env"],
                                    text=True, stderr=subprocess.DEVNULL).splitlines():
    if "=" in line:
        key, val = line.split("=", 1)
        keys[key.strip()] = val.strip().strip("'\"")
assert keys.get("ANON_KEY") and keys.get("SERVICE_ROLE_KEY")

def request(path, body=None, jwt=None, service=False, method="POST"):
    api_key = keys["SERVICE_ROLE_KEY"] if service else keys["ANON_KEY"]
    headers = {"apikey": api_key, "Accept": "application/json"}
    if jwt or service:
        headers["Authorization"] = "Bearer " + (api_key if service else jwt)
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        API + path, method=method, headers=headers,
        data=None if body is None else json.dumps(body).encode(),
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as res:
            return res.status, json.loads(res.read(140000) or b"null")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read(140000) or b"{}")
        except (UnicodeError, ValueError):
            return err.code, {}

def jwt_part(jwt, i=1):
    value = jwt.split(".")[i]
    return json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))

def one(conn, sql, args=()):
    return conn.execute(sql, args).fetchone()[0]

def marker(key):
    print("QR168_" + key + "_PASS", flush=True)

def me(jwt):
    return request("/functions/v1/community-query", {"query": "me", "payload": {}}, jwt=jwt)[0]

def edge_unfollow(jwt, target):
    return request("/functions/v1/community-command", {
        "command": "unfollowCreator", "payload": {"creatorProfileId": str(target)}
    }, jwt=jwt)

created = []
try:
    def create_actor(label):
        email = "qr168-" + label + "-" + secrets.token_hex(8) + "@example.invalid"
        password = secrets.token_urlsafe(24) + "A1!"
        status, identity = request("/auth/v1/admin/users", {
            "email": email, "password": password, "email_confirm": True,
        }, service=True)
        assert status in (200, 201) and identity.get("id"), "QR168_USER_CREATE_FAILED"
        actor = uuid.UUID(identity["id"])
        created.append(actor)
        def sign_in():
            s, data = request("/auth/v1/token?grant_type=password", {
                "email": email, "password": password
            })
            assert s == 200 and data.get("access_token") and data.get("refresh_token")
            token = data["access_token"]
            head, claims = jwt_part(token, 0), jwt_part(token)
            assert head.get("alg") == "ES256"
            assert claims.get("sub") == str(actor) and claims.get("session_id")
            return token, data["refresh_token"], (
                actor, int(claims["iat"]), uuid.UUID(claims["session_id"])
            )
        return actor, sign_in

    actor, login = create_actor("a")
    old_a1, refresh1, session1 = login()
    active_a2, _, session2 = login()
    assert session1[2] != session2[2], "QR168_SAME_SESSION"
    status, account_data = request("/functions/v1/community-command", {
        "command": "ensureAccountCreator",
        "payload": {"handle": "qr168_" + secrets.token_hex(7),
                    "displayName": "Local 168 independent account"},
    }, jwt=old_a1)
    assert status == 200 and account_data.get("ok"), ("QR168_ACCOUNT_CREATE", status)
    account_id = uuid.UUID(account_data["data"]["accountId"])
    origin_creator = uuid.UUID(account_data["data"]["creatorProfileId"])

    targets = []
    for ix in (1, 2):
        _, sign_in = create_actor("b" + str(ix))
        jwt, _, _ = sign_in()
        status, profile = request("/functions/v1/community-command", {
            "command": "ensureAccountCreator",
            "payload": {"handle": "qr168_" + secrets.token_hex(7),
                        "displayName": "Local 168 independent target"},
        }, jwt=jwt)
        assert status == 200 and profile.get("ok"), ("QR168_TARGET_CREATOR", status)
        targets.append(uuid.UUID(profile["data"]["creatorProfileId"]))
    assert len(set(targets)) == 2 and origin_creator not in targets

    with closing(psycopg.connect(DSN, autocommit=True)) as observer, \
         closing(psycopg.connect(DSN, autocommit=True)) as executor:
        assert one(observer, "select pg_backend_pid()") != one(executor, "select pg_backend_pid()")
        assert one(observer, "select count(*) from supabase_migrations.schema_migrations") == 168
        assert one(observer, "select to_regprocedure(%s) is not null", (SIGNATURE,))
        for role in ("anon", "authenticated", "service_role"):
            assert one(observer,
                "select has_function_privilege(%s,%s,'EXECUTE')",
                (role, SIGNATURE)) is False, ("QR168_ROLE_UNFOLLOW_OPEN", role)
        public_acl = one(observer, """
            select exists(
                select 1 from pg_proc p,
                    lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                where p.oid=%s::regprocedure and a.grantee=0
                  and a.privilege_type='EXECUTE'
            )""", (SIGNATURE,))
        assert public_acl is False, "QR168_PUBLIC_DEFAULT_EXECUTE_OPEN"
        for signature in (
            "public.community_add_reaction(uuid,uuid,text)",
            "public.community_save_entity(uuid,uuid)",
            "public.community_unsave_entity(uuid,uuid)",
            "public.community_remove_reaction(uuid,uuid,text)",
            "public.community_add_answer_v1(uuid,uuid,uuid,text,text)",
        ):
            assert one(observer,
                "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)) is False, "QR168_ANCESTOR_REGRANT"
        for signature in (
            "public.community_follow_creator(uuid,uuid)",
            "public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)",
            "public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)",
            "public.community_get_ddv_profile_workspaces_v1(uuid)",
        ):
            assert one(observer,
                "select has_function_privilege('service_role',%s,'EXECUTE')",
                (signature,)), "QR168_POSITIVE_GRANT_LOST"
        marker("PUBLIC_THREE_ROLE_ACL_OFF_SIGNED_AND_FOLLOW_POSITIVE_RETAINED")

        # PostgreSQL owner alone creates two already-existing synthetic Follow rows.
        # Earlier public writers are not reopened. Different target is used after revoke.
        for target in targets:
            seed = one(observer,
                "select public.community_follow_creator(%s,%s)", (actor, target))
            assert isinstance(seed, dict) and seed.get("creatorProfileId") == str(target)
        def snapshot():
            return observer.execute("""
                select
                  (select count(*) from public.follows
                    where follower_account_id=%s and creator_profile_id=any(%s::uuid[])),
                  (select count(*) from public.outbox_events
                    where aggregate_id=any(%s::uuid[])),
                  (select count(*) from public.idempotency_keys
                    where account_id=%s)
                """, (account_id, targets, targets, account_id)).fetchone()
        def deny_sql(role, target):
            try:
                with executor.transaction():
                    executor.execute("set local role " + role)
                    one(executor, "select public.community_unfollow_creator(%s,%s)",
                        (actor, target))
            except psycopg.Error as exc:
                assert exc.sqlstate == "42501", ("QR168_UNEXPECTED_SQLSTATE", role, exc.sqlstate)
                return
            raise AssertionError("QR168_PRIVILEGED_UNFOLLOW_SQL_COMMITTED_" + role)

        initial = snapshot()
        assert initial[0] == 2, "QR168_PREEXISTING_FOLLOW_ROWS_MISSING"
        one(observer, "select public.community_authorize_signed_session_v2(%s,%s,%s)", session2)
        assert me(active_a2) == 200, "QR168_A2_ME_NOT_200"
        code, response = edge_unfollow(active_a2, targets[0])
        assert code == 409 and response.get("error") == "SOURCE168_UNFOLLOW_CREATOR_WRITER_NOT_ENROLLED", (
            "QR168_ELIGIBLE_UNFOLLOW_BAD_STATUS", code, response.get("error"))
        for role in ("anon", "authenticated", "service_role"):
            deny_sql(role, targets[0])
        assert snapshot() == initial, "QR168_VALID_A2_FOLLOW_OUTBOX_MUTATED"
        marker("VALID_A2_409_THREE_SQL42501_FOLLOW_OUTBOX_NO_DIFF")

        one(observer, "select public.community_authorize_signed_session_v2(%s,%s,%s)", session1)
        one(observer, "select public.community_revoke_signed_session_v1(%s,%s,%s,'local')", session1)
        assert me(old_a1) == 401, "QR168_A1_ORIGINAL_NOT_401"
        status, refreshed = request("/auth/v1/token?grant_type=refresh_token",
            {"refresh_token": refresh1})
        assert status == 200 and refreshed.get("access_token"), "QR168_GOTRUE_REFRESH_NOT_200"
        new_a1 = refreshed["access_token"]
        assert jwt_part(new_a1).get("session_id") == str(session1[2])
        assert me(new_a1) == 401, "QR168_TRUE_REFRESHED_SESSION_NOT_REVOKED"
        assert me(active_a2) == 200, "QR168_SIBLING_A2_NOT_200"
        for token in (old_a1, new_a1):
            assert edge_unfollow(token, targets[1])[0] == 401, "QR168_REVOKED_EDGE_NOT_401"
        for _ in range(5):
            deny_sql("service_role", targets[1])
        assert snapshot() == initial, "QR168_POSTREVOKE_FOLLOW_OUTBOX_MUTATED"
        marker("REVOKED_A1_REAL_REFRESH401_SIBLING200_FIVE_SQL_REPLAYS_NO_DIFF")

        observer.execute("begin")
        try:
            observer.execute("grant execute on function " + SIGNATURE + " to service_role")
            assert one(observer,
                "select has_function_privilege('service_role',%s,'EXECUTE')",
                (SIGNATURE,))
            assert not one(executor,
                "select has_function_privilege('service_role',%s,'EXECUTE')",
                (SIGNATURE,))
        finally:
            observer.execute("rollback")
        for pg in (observer, executor):
            assert not one(pg,
                "select has_function_privilege('service_role',%s,'EXECUTE')",
                (SIGNATURE,))
        deny_sql("service_role", targets[1])
        assert snapshot() == initial, "QR168_ROLLBACK_MUTATED_FOLLOWS"
        marker("TWO_PG_UNCOMMITTED_GRANT_INVISIBLE_ROLLBACK_DENIED")
        marker("INDEPENDENT_SIGNED_ES256_SOURCE168_UNFOLLOW_ONLY_SCOPED")
finally:
    for user_id in reversed(created):
        try:
            request("/auth/v1/admin/users/" + str(user_id),
                service=True, method="DELETE")
        except Exception:
            pass
