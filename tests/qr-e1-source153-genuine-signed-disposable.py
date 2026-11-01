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
    return h.get("Cache-Control","").find("no-store")>=0 and h.get("CDN-Cache-Control","").lower()=="no-store"

def jwt_payload(tok):
    chunks=tok.split(".")
    assert len(chunks)==3,"ISSUER_JWT_FORMAT"
    return json.loads(base64.urlsafe_b64decode(chunks[1]+"="*(-len(chunks[1])%4)))

prefix="wand-e1-"+secrets.token_hex(6)
users={}
for who in "ABM":
    email=prefix+"-"+who.lower()+"@example.invalid"
    password=secrets.token_urlsafe(32)+"_A1"
    payload={"email":email,"password":password,"email_confirm":True}
    if who=="M":
        payload["app_metadata"]={"e1_test_scope":"moderation_read_only"}
    status,_,j=http("/auth/v1/admin/users",body=payload,token=admin,key=admin)
    assert status in (200,201) and isinstance(j.get("id"),str),("ADMIN_CREATE_FAILED",status)
    uid=uuid.UUID(j["id"])
    status,_,login=http("/auth/v1/token?grant_type=password",body={"email":email,"password":password})
    assert status==200 and "access_token" in login,("GENUINE_PASSWORD_LOGIN_FAILED",status)
    token=login["access_token"]
    claims=jwt_payload(token)
    assert claims["sub"]==str(uid) and claims["role"]=="authenticated" and claims.get("session_id")
    assert claims.get("iss") and claims.get("aud") and claims.get("iat") and claims.get("exp")
    status,_,profile=http("/auth/v1/user",method="GET",token=token)
    assert status==200 and profile.get("id")==str(uid),("GOTRUE_TOKEN_AUTHENTICITY_FAILED",status)
    users[who]={"id":uid,"token":token}
marker("R1-00","REAL_GOTRUE_ISSUED_AND_VALIDATED_A_B_M")

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
    marker("FIXTURE","FULL153_PRIVATE_TWO_WORKS_NO_POLICY_NO_PROVIDER")
    path="/functions/v1/community-dreamsnap-owner"
    def pregrant(who,work):
        return http(path,body={"operation":"pregrant","workId":str(work)},
            token=users[who]["token"] if who else None)
    for work,kind,revision,media in ((original,"OriginalCompetition",po,mo),(post,"PostEventCreation",pp,mp)):
        status,headers,result=pregrant("A",work)
        if status!=200:
            direct_status,_,direct=http("/rest/v1/rpc/community_dreamsnap_x05_pregrant_read_v1",
                body={"p_work_id":str(work)},token=users["A"]["token"])
            # No raw SQL message, JWT or object ids are written to logs.
            marker("R1-EDGE-DIAG","EDGE_OWNER_PREGRANT_NOT_ACCEPTED",status)
            marker("R1-POSTGREST-DIAG","SIGNED_OWNER_DIRECT_PREGRANT_HTTP",direct_status)
            edge_code=result.get("error","") if isinstance(result,dict) else ""
            if isinstance(edge_code,str) and edge_code.replace("_","").isalnum() and len(edge_code)<=50:
                marker("R1-EDGE-ERROR","SANITIZED_CODE_"+edge_code)
            raise AssertionError(("SIGNED_OWNER_EDGE_PREGRANT_FAILED",status,direct_status))
        assert safe_private(headers),("MISSING_EDGE_NO_STORE",status)
        assert result.get("ok") is True and result.get("operation")=="pregrant"
        v=result["data"]
        assert v["contractVersion"]=="wand.dreamsnaps.pregrant-service@1"
        assert v["state"]=="NEED_POLICY_ARTIFACT" and v["grantAvailable"] is False
        assert v["ownerAuthorized"] and v["authenticatedAccountBound"]
        assert v["mediaOwnershipVerified"] and v["workPhotoBindingVerified"]
        assert v["kind"]==kind and v["photoRevisionId"]==str(revision) and v["photoMediaId"]==str(media)
        assert v["expectedRowVersion"]==0 and v["expectedAuthorizationEpoch"]==0
        assert v["grantRecorded"] is False and v["publicActivationAllowed"] is False
        if kind=="PostEventCreation":
            assert "entryId" not in v and "frozenEntryRevisionId" not in v
        else:
            assert v["entryId"]==str(entry) and v["frozenEntryRevisionId"]==str(po)
        assert "storageKey" not in json.dumps(result) and "signedUrl" not in json.dumps(result)
        marker("R1-01" if kind=="OriginalCompetition" else "R1-02","SIGNED_OWNER_PREGRANT_NEED_POLICY_PASS",status)
    for who in ("B","M",None):
        for work in (original,post):
            status,_,r=pregrant(who,work)
            assert status in (401,403,404),("FOREIGN_READ_UNEXPECTED",who,status)
            assert "storageKey" not in json.dumps(r) and str(mo) not in json.dumps(r) and str(mp) not in json.dumps(r)
        marker("R1-03" if who=="B" else "R1-04" if who=="M" else "R1-05",
               "PRIVATE_WORK_DENIED",status)
    forged=users["A"]["token"][:-4]+"xxxx"
    status,_,_=http(path,body={"operation":"pregrant","workId":str(original)},token=forged)
    assert status in (401,403),("FORGED_JWT_ACCEPTED",status)
    marker("R1-00-FORGED","DENIED",status)
    status,_,r=http("/rest/v1/rpc/community_dreamsnap_x05_pregrant_read_v1",
        body={"p_work_id":str(original)},token=users["B"]["token"])
    assert status in (400,401,403,404),("FOREIGN_DIRECT_POSTGREST",status)
    marker("R1-03-REST","SIGNED_FOREIGN_DIRECT_RLS_DENIED",status)
    for who in "ABM":
        status,_,r=http(path,body={"operation":"authority","workId":str(original)},token=users[who]["token"])
        assert status in (401,403,404),("UNGRANTED_AUTHORITY_ACCEPTED",who,status)
    marker("R1-06","AUTHORITY_DENIED_NO_REGISTERED_POLICY_OR_GRANT")
    # IMPORTANT: HTTP uses independent DB connections. Commit each synthetic
    # negative BEFORE the signed request. An uncommitted row lock would either
    # be invisible or block auth's FOR SHARE lookup, falsely mimicking denial.
    def negative(case, sql, args, restore, restore_args, work=post):
        try:
            with db.transaction():
                db.execute(sql,args)
        except psycopg.Error:
            marker(case,"FIXTURE_REJECTED_NOT_A_READER_PASS")
            return
        try:
            status,_,r=pregrant("A",work)
            assert status in (401,403,404),("NEGATIVE_READER_UNEXPECTED_ALLOW",case,status)
            assert "storageKey" not in json.dumps(r)
            marker(case,"GENUINE_SIGNED_PRIVATE_READ_DENIED",status)
        finally:
            with db.transaction():
                db.execute(restore,restore_args)
    negative("R2-01",
        "update public.wand_accounts set status='restricted' where account_id=%s",(account["A"],),
        "update public.wand_accounts set status='active' where account_id=%s",(account["A"],))
    negative("R2-02",
        "update public.auth_identities set identity_state='retired' where account_id=%s",(account["A"],),
        "update public.auth_identities set identity_state='active',retired_at=null where account_id=%s",(account["A"],))
    negative("R2-02-IAT",
        "update public.auth_identities set sessions_valid_after=now()+interval '5 minutes' where account_id=%s",(account["A"],),
        "update public.auth_identities set sessions_valid_after='epoch'::timestamptz where account_id=%s",(account["A"],))
    negative("R2-03",
        "insert into private.account_privacy_suppressions(account_id,next_cleanup_at) values(%s,now())",(account["A"],),
        "delete from private.account_privacy_suppressions where account_id=%s",(account["A"],))
    negative("R2-04",
        "update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",(creator,),
        "update public.creator_profiles set moderation_state='clear' where creator_profile_id=%s",(creator,))
    negative("R2-06",
        "update public.work_revision_media set media_id=%s where work_revision_id=%s",(mo,pp),
        "update public.work_revision_media set media_id=%s where work_revision_id=%s",(mp,pp))
    negative("R2-07",
        "update public.community_works set current_published_revision_id=%s where work_id=%s",(po,post),
        "update public.community_works set current_published_revision_id=%s where work_id=%s",(pp,post))
    # Deletion can be terminal under the source contract; run it LAST and
    # mark a rejected fixture as untested rather than calling it reader PASS.
    negative("R2-05",
        "update public.community_works set lifecycle_state='deleted' where work_id=%s",(post,),
        "update public.community_works set lifecycle_state='published' where work_id=%s",(post,))
    assert scalar("select count(*) from private.dreamsnap_x05_owner_policy_v1")==0
    assert scalar("select count(*) from private.dreamsnap_x05_work_control_v1")==0
    assert scalar("select count(*) from private.dreamsnap_x05_consent_events_v1")==0
    status,_,j=pregrant("A",post)
    assert status==200 and j["data"]["state"]=="NEED_POLICY_ARTIFACT"
    marker("E1-CLEANUP","DISPOSABLE_FIXTURE_NO_POLICY_NO_CONSENT_RESTORED")
for who in "ABM":
    # Best effort local Auth user cleanup. Entire runner and local Docker volumes
    # are destroyed by the job teardown regardless.
    with contextlib.suppress(Exception):
        http("/auth/v1/admin/users/"+str(users[who]["id"]),method="DELETE",token=admin,key=admin)
marker("E1_SOURCE153_GENUINE_SIGNED_R1_R2","TARGETED_REAL_ISSUER_HTTP_PASS_WITH_CASE_QUALIFIERS")
