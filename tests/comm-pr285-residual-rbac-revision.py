#!/usr/bin/env python3
"""R1/R2 only. Real GoTrue-issued JWT -> Edge -> PostgREST on a disposable local FULL153 stack.
Never use Stage, remote keys, mocked JWT GUC as E2E proof, approved policy, or Provider bytes.
No token, password, account ID, storage key, email or response body in stdout/artifacts.
"""
import base64
import contextlib
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid

import psycopg

assert os.getenv("DDVRE_E1_LOCAL_DISPOSABLE") == "APPROVED"
assert not os.getenv("DATABASE_URL") and not os.getenv("SUPABASE_ACCESS_TOKEN")
assert not os.getenv("SUPABASE_PROJECT_ID")
RANDOM = uuid.uuid4
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

def marker(case, outcome, status=None):
    print(json.dumps({"case":case,"outcome":outcome,**({"http":status} if status is not None else {})}),flush=True)

def status_env():
    raw=subprocess.check_output(["supabase","status","-o","env"],text=True,stderr=subprocess.DEVNULL)
    parsed={}
    for line in raw.splitlines():
        if "=" in line:
            k,v=line.split("=",1)
            parsed[k.strip()]=v.strip().strip("'\"")
    assert "ANON_KEY" in parsed and "SERVICE_ROLE_KEY" in parsed, "LOCAL_SUPABASE_KEYS_UNAVAILABLE"
    # The script deliberately does not print parsed values.
    return parsed

s=status_env()
API="http://127.0.0.1:54321"
anon=s["ANON_KEY"]
admin=s["SERVICE_ROLE_KEY"]
def http(path, method="POST", body=None, token=None, key=None):
    headers={"apikey":key or anon, "Accept":"application/json"}
    if token:headers["Authorization"]="Bearer "+token
    if body is not None:headers["Content-Type"]="application/json"
    request=urllib.request.Request(API+path, data=json.dumps(body).encode() if body is not None else None,
        headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=30) as response:
            blob=response.read(70000)
            return response.status,dict(response.headers),json.loads(blob or b"null")
    except urllib.error.HTTPError as exc:
        data=exc.read(70000)
        try:v=json.loads(data)
        except Exception:v={}
        return exc.code,dict(exc.headers),v

def safe_private(h):
    return {k.lower():v for k,v in h.items()}.get("cache-control","").find("no-store")>=0 and {k.lower():v for k,v in h.items()}.get("cdn-cache-control","").lower()=="no-store"

def jwt_json_chunk(tok, index):
    chunks=tok.split(".")
    assert len(chunks)==3,"ISSUER_JWT_FORMAT"
    return json.loads(base64.urlsafe_b64decode(chunks[index]+"="*(-len(chunks[index])%4)))

def jwt_payload(tok):
    return jwt_json_chunk(tok,1)

def safe_edge_headers(h):
    vary={s.strip().lower() for s in {k.lower():v for k,v in h.items()}.get("vary","").split(",")}
    return (safe_private(h)
        and {k.lower():v for k,v in h.items()}.get("surrogate-control","").lower()=="no-store"
        and {"authorization","origin"}.issubset(vary))

status,_,jwks=http("/auth/v1/.well-known/jwks.json",method="GET")
assert status==200 and isinstance(jwks.get("keys"),list),"LOCAL_GOTRUE_JWKS_ENDPOINT_NOT_READY"
public_keys=jwks["keys"]
assert public_keys and all("d" not in k for k in public_keys),"JWKS_PUBLIC_KEY_ONLY_GUARD"
marker("RESIDUAL_JWKS","LOCAL_GOTRUE_PUBLIC_JWKS_AVAILABLE",status)

prefix="wand-e1-"+secrets.token_hex(6)
users={}
for who in "ABM":
    email=prefix+"-"+who.lower()+"@example.invalid"
    password=secrets.token_urlsafe(32)+"_A1"
    payload={"email":email,"password":password,"email_confirm":True}
    status,_,j=http("/auth/v1/admin/users",body=payload,token=admin,key=admin)
    assert status in (200,201) and isinstance(j.get("id"),str),("ADMIN_CREATE_FAILED",status)
    uid=uuid.UUID(j["id"])
    status,_,login=http("/auth/v1/token?grant_type=password",body={"email":email,"password":password})
    assert status==200 and "access_token" in login,("GENUINE_PASSWORD_LOGIN_FAILED",status)
    token=login["access_token"]
    claims=jwt_payload(token)
    header=jwt_json_chunk(token,0)
    assert header.get("alg")=="ES256" and isinstance(header.get("kid"),str),"GOTRUE_NOT_ES256_SIGNED"
    assert any(k.get("kid")==header["kid"] and k.get("kty")=="EC" and k.get("crv")=="P-256" for k in public_keys),"ES256_KID_NOT_DISCOVERABLE"
    assert claims["sub"]==str(uid) and claims["role"]=="authenticated" and claims.get("session_id")
    assert claims.get("iss") and claims.get("aud") and claims.get("iat") and claims.get("exp")
    assert claims["exp"]>time.time() and claims["iat"]<=time.time()+60,"TOKEN_LIFETIME_INVALID"
    status,_,profile=http("/auth/v1/user",method="GET",token=token)
    assert status==200 and profile.get("id")==str(uid),("GOTRUE_TOKEN_AUTHENTICITY_FAILED",status)
    users[who]={"id":uid,"token":token}
marker("RESIDUAL_ACTOR","REAL_GOTRUE_ISSUED_AND_VALIDATED_A_B_M")

status,headers,diagnosis=http("/functions/v1/e1-jwks-env-probe",
    body={"expectedKid":jwt_json_chunk(users["A"]["token"],0)["kid"]},token=users["A"]["token"])
assert status==200 and diagnosis.get("ok") is True and diagnosis.get("edgeIsolate") is True,("EDGE_ISOLATE_PROBE_NOT_REACHABLE",status)
header_ok=safe_edge_headers(headers)
allowed=("inlinePresent","inlineJsonValid","inlineJwksShapeValid","publicKeyOnly",
         "publicKeyCount","matchingKidCount","jwksUrlPresent","jwksUrlKind",
         "publicUrlKind","internalUrlKind")
assert all(type(diagnosis.get(k)) in (bool,int,str) for k in allowed),"DIAGNOSTIC_UNEXPECTED_SHAPE"
marker("E1_EDGE_EFFECTIVE_ENV",json.dumps({k:diagnosis[k] for k in allowed},sort_keys=True),status)
marker("E1_EDGE_DIAGNOSTIC_HEADERS","PRIVATE_CACHE_PASS" if header_ok else "PRIVATE_CACHE_NOT_CONFIRMED",status)
if os.getenv("DDVRE_E1_EFFECTIVE_ENV_ONLY")=="1":
    marker("E1_DIAGNOSTIC_ONLY","NO_PRIVATE_FIXTURE_NO_OWNER_E2E_PROMOTION")
    raise SystemExit(0)

assert diagnosis["inlinePresent"] and diagnosis["inlineJsonValid"],"EFFECTIVE_EDGE_INLINE_JWKS_MISSING"
assert diagnosis["inlineJwksShapeValid"] and diagnosis["publicKeyCount"]>=1,"EFFECTIVE_EDGE_JWKS_INVALID"
assert diagnosis["publicKeyOnly"] and diagnosis["matchingKidCount"]>=1,"EFFECTIVE_EDGE_SIGNER_KID_MISMATCH"
assert header_ok,"EDGE_DIAGNOSTIC_PRIVATE_CACHE_HEADERS_MISSING"
marker("E1_EDGE_EFFECTIVE_JWKS_GATE","PUBLIC_ES256_KID_MATCHED_BEFORE_E2E")


with psycopg.connect(DSN,autocommit=True) as db:
    def scalar(q,args=()):
        return db.execute(q,args).fetchone()[0]
    assert scalar("select count(*) from supabase_migrations.schema_migrations")==153
    assert scalar("select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
    assert scalar("select count(*) from private.dreamsnap_x05_policy_receipt_v1")==0
    for role in ("anon","authenticated","service_role"):
        ok=scalar("select has_function_privilege(%s,'public.community_dreamsnap_x05_pregrant_read_v1(uuid)','EXECUTE')",(role,))
        assert bool(ok)==(role=="authenticated"),("BAD_PREGRANT_ACL",role)
    account={who:RANDOM() for who in "ABM"}
    creator=RANDOM()
    challenge=RANDOM()
    original,post=RANDOM(),RANDOM()
    po,pp=RANDOM(),RANDOM()
    mo,mp=RANDOM(),RANDOM()
    entry=RANDOM()
    with db.transaction():
        for who in "ABM":
            db.execute("insert into public.wand_accounts(account_id) values(%s)",(account[who],))
            db.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
             values(%s,'supabase',%s,now(),'active')""",(account[who],str(users[who]["id"])))
        db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        db.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'E1 isolated')",
          (creator,account["A"],"e1_"+secrets.token_hex(8)))
        db.execute("""insert into public.dreamsnap_challenges(challenge_id,challenge_key,title,lifecycle_state,
           submission_opens_at,submission_closes_at,judging_opens_at,judging_closes_at,results_at,closes_at,
           formal_vote_allowance,special_pick_allowance,minimum_real_eligible_entries,
           minimum_real_eligible_creators,is_synthetic)
           values(%s,%s,'E1 local only','results',now()-interval '8 days',now()-interval '7 days',
           now()-interval '6 days',now()-interval '5 days',now()-interval '4 days',now()+interval '1 day',
           2,1,1,1,false)""",(challenge,"e1_"+secrets.token_hex(8)))
        for work,rev,media in ((original,po,mo),(post,pp,mp)):
            db.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work'),(%s,'media_asset')",(work,media))
            db.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,lifecycle_state,visibility)
              values(%s,%s,%s,'dreamsnap','draft','private')""",(work,account["A"],creator))
            db.execute("insert into public.dreamsnap_works(work_id,challenge_id,workspace_relationship_kind,managed_under13) values(%s,%s,'self',false)",(work,challenge))
            db.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(rev,work,account["A"]))
            db.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
              no_external_edits_attested,integrity_state) values(%s,%s,true,true,'eligible')""",(rev,challenge))
            db.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
              values(%s,%s,%s,'image/png',1024,1280,720,%s,'ready','clear')""",
              (media,account["A"],"e1/disposable/"+str(media),"a"*64))
            db.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(rev,media))
            db.execute("update public.community_works set current_published_revision_id=%s,lifecycle_state='published',visibility='private',published_at=now() where work_id=%s",(rev,work))
        db.execute("""insert into public.dreamsnap_entries(entry_id,challenge_id,work_id,account_id,managed_under13,entry_revision_id,entry_state,eligibility_state,origin_kind)
            values(%s,%s,%s,%s,false,%s,'entered','eligible','user')""",(entry,challenge,original,account["A"],po))
        db.execute("insert into public.dreamsnap_entry_revision_history(entry_id,revision_id) values(%s,%s)",(entry,po))
        db.execute("""insert into private.dreamsnap_post_event_staged_v1(
           work_id,challenge_id,creator_profile_id,immutable_photo_revision_id,media_id,concept_revision_id)
           values(%s,%s,%s,%s,%s,%s)""",(post,challenge,creator,pp,mp,pp))
    marker("RESIDUAL_FIXTURE","FULL153_A_B_M_AND_PRIVATE_WORKS_NO_POLICY_NO_PROVIDER")

    # Trusted synthetic fixture enrollment, never user metadata or a client-side role.
    db.execute("insert into public.account_roles(account_id,role) values(%s,'moderator')",(account["M"],))
    assert scalar("select count(*) from public.account_roles where account_id=%s and role='moderator'",(account["M"],))==1
    assert scalar("select count(*) from public.account_roles where account_id in (%s,%s)",(account["A"],account["B"]))==0
    marker("MOD_ROLE","REGISTERED_DATABASE_MODERATOR_ONLY")

    # Prove real signed Owner isolation even when M has a registered staff role.
    def private_pregrant(who,work):
        return http("/rest/v1/rpc/community_dreamsnap_x05_pregrant_read_v1",
                    body={"p_work_id":str(work)},token=users[who]["token"])
    st,_,data=private_pregrant("A",post)
    assert st==200 and data.get("state")=="NEED_POLICY_ARTIFACT"
    st,_,data=private_pregrant("M",post)
    assert st in (400,401,403,404) and str(mp) not in json.dumps(data)
    marker("MOD_OWNER_BOUNDARY","REGISTERED_MODERATOR_CANNOT_PREGRANT_FOREIGN_WORK",st)

    # Create a sealed same-Work replacement revision without editing old
    # photograph/media/STAGED, and distinguish DB-accepted from Writer-denied.
    newrev=RANDOM()
    new_revision_committed=False
    try:
        with db.transaction():
            db.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,2,%s)",
                       (newrev,post,account["A"]))
            db.execute("""insert into public.dreamsnap_work_revisions(revision_id,challenge_id,game_screenshot_attested,
                no_external_edits_attested,integrity_state) values(%s,%s,true,true,'eligible')""",(newrev,challenge))
            db.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'dreamsnap')",(newrev,mp))
            db.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(newrev,post))
        new_revision_committed=True
    except psycopg.Error:
        marker("R2-07-STRUCTURAL","NEW_SAME_WORK_REVISION_DB_WRITER_REJECTED")
    if new_revision_committed:
        assert scalar("select sealed_at is not null from public.community_work_revisions where revision_id=%s",(newrev,))
        assert scalar("select immutable_photo_revision_id from private.dreamsnap_post_event_staged_v1 where work_id=%s",(post,))==pp
        st,headers,result=private_pregrant("A",post)
        assert st in (400,403,404),"STALE_REVISION_READER_ALLOWED"
        assert str(mp) not in json.dumps(result),"STALE_REVISION_MEDIA_LEAK"
        marker("R2-07-STRUCTURAL","DB_ACCEPTED_NEW_SAME_WORK_REVISION_STALE_STAGED_PHOTO",st)
        edge_st,edge_h,edge_r=http("/functions/v1/community-dreamsnap-owner",
                body={"operation":"pregrant","workId":str(post)},token=users["A"]["token"])
        assert edge_st in (401,403,404),"STALE_REVISION_EDGE_ALLOWED"
        assert safe_edge_headers(edge_h),"STALE_REVISION_EDGE_HEADERS"
        assert str(post) not in json.dumps(edge_r) and str(mp) not in json.dumps(edge_r),"STALE_REVISION_EDGE_DISCLOSURE"
        marker("R2-07-EDGE","DB_ACCEPTED_STALE_SAME_WORK_REVISION_REAL_ES256_READER_DENIED",edge_st)
        with db.transaction():
            db.execute("update public.community_works set current_published_revision_id=%s where work_id=%s",(pp,post))
        st,_,result=private_pregrant("A",post)
        assert st==200 and result.get("state")=="NEED_POLICY_ARTIFACT","POST_REVISION_RESTORE_FAILED"
        marker("R2-07-RESTORE","ORIGINAL_SEALED_PHOTO_PREGRANT_RESTORED",st)

    # Existing immutable sealed-media update and cross-Work current-pointer
    # substitution were independently rejected by Writer/constraint in PR285.
    # Do NOT relax those constraints or count them as reader evidence.
    marker("R2-06","DB_WRITER_CONSTRAINT_CLOSED_NO_VALID_READER_FIXTURE")

    # Real moderation case and report in the approved local synthetic database.
    case,report=RANDOM(),RANDOM()
    with db.transaction():
        db.execute("insert into public.reports(report_id,reporter_account_id,target_entity_id,reason_code,detail) values(%s,%s,%s,'other','synthetic-only')",(report,account["B"],original))
        db.execute("insert into public.moderation_cases(case_id,target_entity_id,status) values(%s,%s,'open')",(case,original))
        db.execute("insert into public.moderation_case_reports(case_id,report_id) values(%s,%s)",(case,report))
    def admincall(who,operation,payload=None):
        return http("/functions/v1/community-admin",
            body={"operation":operation,"payload":payload or {}},token=users[who]["token"])
    st,headers,result=admincall("M","listModerationCases",{"state":"open","limit":50})
    assert st==200 and result.get("ok") is True and isinstance(result.get("data"),list),("MOD_CASE_LIST_FAILED",st)
    assert any(e.get("caseId")==str(case) for e in result["data"]),"MOD_CASE_NOT_VISIBLE"
    assert "reporterAccountId" not in json.dumps(result) and str(account["B"]) not in json.dumps(result),"MOD_REPORTER_LEAK"
    assert "no-store" in {k.lower():v for k,v in headers.items()}.get("cache-control","").lower()
    marker("MOD_READ_POSITIVE","REGISTERED_MODERATOR_SIGNED_CASE_LIST_PASS",st)
    for who in "AB":
        st,_,r=admincall(who,"listModerationCases",{"state":"open","limit":50})
        assert st==403 and str(case) not in json.dumps(r),("NONSTAFF_MODERATION_LIST_ALLOWED",who,st)
        marker("MOD_READ_DENY_"+who,"UNREGISTERED_ACCOUNT_FORBIDDEN",st)
    st,_,r=admincall("M","getSecurityPolicy")
    assert st==403 and result is not None and str(case) not in json.dumps(r),"MOD_ADMIN_ONLY_ALLOWED"
    marker("MOD_ADMIN_BOUNDARY","MODERATOR_NOT_ADMIN",st)
    # Independently verify the registered M cannot act as Owner through Edge.
    st,h,r=http("/functions/v1/community-dreamsnap-owner",
                body={"operation":"pregrant","workId":str(post)},token=users["M"]["token"])
    assert st in (401,403,404) and safe_edge_headers(h)
    assert str(post) not in json.dumps(r) and str(mp) not in json.dumps(r)
    marker("MOD_EDGE_OWNER_DENY","REAL_REGISTERED_MODERATOR_CANNOT_ASSUME_OWNER",st)
    st,_,result=admincall("M","moderateCase",{"caseId":str(case),
                                              "action":"restrict",
                                              "reason":"Isolated legitimate staff restriction acceptance"})
    assert st==200 and result.get("ok") is True,("MOD_SIGNED_ACTION_FAILED",st)
    assert result["data"].get("moderationState")=="restricted","MOD_ACTION_STATE"
    assert scalar("select moderation_state from public.community_works where work_id=%s",(original,))=="restricted"
    assert scalar("select status from public.reports where report_id=%s",(report,))=="closed"
    assert scalar("select count(*) from public.moderation_actions where case_id=%s and actor_account_id=%s",(case,account["M"]))==1
    marker("MOD_WRITE_POSITIVE","REAL_ES256_REGISTERED_MODERATOR_900S_RECENT_AUTH_AUDITED_RESTRICT",st)
    assert scalar("select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
    assert scalar("select count(*) from private.dreamsnap_x05_work_control_v1")==0
    assert scalar("select count(*) from private.dreamsnap_x05_consent_events_v1")==0
    marker("RESIDUAL_FINISH","TARGETED_MODERATOR_RBAC_AND_STALE_REVISION_NO_GRANT_NO_PROVIDER")

for who in "ABM":
    with contextlib.suppress(Exception):
        http("/auth/v1/admin/users/"+str(users[who]["id"]),method="DELETE",token=admin,key=admin)
marker("RESIDUAL_CLEANUP","LOCAL_SYNTHETIC_TEST_USERS_DELETE_ATTEMPTED")
