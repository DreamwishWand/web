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

assert os.getenv("DDVRE_E2_LOCAL_DISPOSABLE") == "APPROVED"
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
marker("E2-JWKS","LOCAL_GOTRUE_PUBLIC_JWKS_AVAILABLE",status)

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
    header=jwt_json_chunk(token,0)
    assert header.get("alg")=="ES256" and isinstance(header.get("kid"),str),"GOTRUE_NOT_ES256_SIGNED"
    assert any(k.get("kid")==header["kid"] and k.get("kty")=="EC" and k.get("crv")=="P-256" for k in public_keys),"ES256_KID_NOT_DISCOVERABLE"
    assert claims["sub"]==str(uid) and claims["role"]=="authenticated" and claims.get("session_id")
    assert claims.get("iss") and claims.get("aud") and claims.get("iat") and claims.get("exp")
    assert claims["exp"]>time.time() and claims["iat"]<=time.time()+60,"TOKEN_LIFETIME_INVALID"
    status,_,profile=http("/auth/v1/user",method="GET",token=token)
    assert status==200 and profile.get("id")==str(uid),("GOTRUE_TOKEN_AUTHENTICITY_FAILED",status)
    users[who]={"id":uid,"token":token}
marker("E2-GOTRUE","REAL_ES256_A_B_M_ISSUER_VALIDATED")

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
    # E2 uses the already accepted E1 local DB object fixture but never copies E1 results.
    # Only the synthetic disposable database receives any Policy/Grant writes.
    import hashlib
    from pathlib import Path
    candidate=Path("docs/community/policy/dreamsnap-image-grant-v1.candidate.txt").read_bytes()
    expected="2c4e78e46345a3d230a304d74086aa49b66700396acca91bf6280cd6f938d0cb"
    assert len(candidate)==2344 and hashlib.sha256(candidate).hexdigest()==expected
    assert candidate.endswith(b"\n") and not candidate.startswith(b"\xef\xbb\xbf") and b"\r" not in candidate
    policy=candidate.decode("utf-8")
    manifest=json.loads(Path("docs/community/policy/dreamsnap-image-grant-v1.candidate.json").read_text())
    assert manifest["approved"] is False and manifest["activateRegistry"] is False
    assert manifest["sha256"]==expected and manifest["policyVersionText"]=="v1"
    marker("E2-P01-CANDIDATE","TEST_ONLY_EXACT_JAPANESE_V1_NOT_OWNER_APPROVED")

    with db.transaction():
        db.execute("insert into public.account_roles(account_id,role) values(%s,'moderator')",(account["M"],))
    assert scalar("select count(*) from public.account_roles where account_id=%s and role='moderator'",(account["M"],))==1
    assert scalar("select count(*) from private.dreamsnap_x05_consent_events_v1")==0
    assert scalar("select count(*) from private.dreamsnap_x05_work_control_v1")==0
    path="/functions/v1/community-dreamsnap-owner"
    def owner(who,operation,work,**kw):
        body={"operation":operation,"workId":str(work),**kw}
        return http(path,body=body,token=users[who]["token"] if who else None)
    for work,kind in ((original,"OriginalCompetition"),(post,"PostEventCreation")):
        st,h,r=owner("A","pregrant",work)
        assert st==200 and safe_edge_headers(h) and r.get("ok") is True,(kind,"INITIAL_PREGRANT",st)
        d=r["data"]
        assert d["state"]=="NEED_POLICY_ARTIFACT" and d["grantAvailable"] is False
        assert d["kind"]==kind and d["expectedRowVersion"]==0 and d["expectedAuthorizationEpoch"]==0
        assert d["grantRecorded"] is False and d["publicActivationAllowed"] is False

    # No Owner Policy approval: receipt evidence is an isolated test literal only.
    # Inactive Registry must PRECEDE immutable Receipt (FK), then guarded activation.
    with db.transaction():
        db.execute("""insert into private.dreamsnap_x05_owner_policy_v1
          (policy_version,policy_digest,is_active)
          values('v1',%s,false)""",(expected,))
        db.execute("""insert into private.dreamsnap_x05_policy_receipt_v1
          (policy_version,canonical_text,purpose_id,approval_reference,approved_at)
          values('v1',%s,'wand.dreamsnaps.creator-photo-grant@1',
          'SYNTHETIC_E2_LOCAL_DISPOSABLE_NOT_OWNER_APPROVAL',now())""",(policy,))
        db.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=true where policy_version='v1'")
    assert scalar("""select encode(pg_catalog.sha256(convert_to(rec.canonical_text,'UTF8')),'hex')
      from private.dreamsnap_x05_owner_policy_v1 reg
      join private.dreamsnap_x05_policy_receipt_v1 rec using(policy_version)
      where reg.is_active and rec.purpose_id='wand.dreamsnaps.creator-photo-grant@1'""")==expected
    marker("E2-P01","LOCAL_SYNTHETIC_IMMUTABLE_RECEIPT_AND_POLICY_ACTIVATED")
    works=[(original,po,mo,"OriginalCompetition"),(post,pp,mp,"PostEventCreation")]
    for work,photo,media,kind in works:
        st,h,pre=owner("A","pregrant",work)
        assert st==200 and safe_edge_headers(h) and pre.get("ok") is True,(kind,"PREGRANT_READY_FAILED",st)
        d=pre["data"]
        assert d["state"]=="PREGRANT_READY" and d["grantAvailable"] is True
        assert d["policyReceipt"]["policyDigest"]==expected and d["policyReceipt"]["canonicalText"]==policy
        assert d["photoRevisionId"]==str(photo) and d["photoMediaId"]==str(media)
        assert d["expectedRowVersion"]==0 and d["expectedAuthorizationEpoch"]==0 and d["grantRecorded"] is False
        if kind=="OriginalCompetition":
            assert d["entryId"]==str(entry) and d["frozenEntryRevisionId"]==str(photo)
        else:
            assert "entryId" not in d and "frozenEntryRevisionId" not in d
    marker("E2-P02","REAL_SIGNED_A_ORIGINAL_AND_POSTEVENT_PREGRANT_READY_PRIVATE")
    assert scalar("select count(*) from private.dreamsnap_x05_consent_events_v1")==0

    # Owner approval and *user* explicit per-Work consent are different,
    # even though both are locally synthetic for this E2 technical test.
    def grant(who,work,photo,media,version=0,epoch=0,dig=expected):
        return owner(who,"action",work,action="grant",
          expectedRowVersion=version,expectedAuthorizationEpoch=epoch,
          photoRevisionId=str(photo),photoMediaId=str(media),
          policyVersionText="v1",policyDigest=dig,
          selfCaptureDeclared=True,explicitGrantAccepted=True)
    for work,photo,media,kind in works:
        st,h,r=grant("A",work,photo,media)
        assert st==200 and safe_edge_headers(h) and r.get("ok") is True,(kind,"GRANT_FAILED",st,r.get("error"))
        d=r["data"]
        assert d["rowVersion"]==1 and d["publicActivationAllowed"] is False
        assert scalar("select row_version from private.dreamsnap_x05_work_control_v1 where work_id=%s",(work,))==1
        assert scalar("select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(work,))==1
        assert scalar("""select count(*) from private.dreamsnap_x05_consent_events_v1
          where work_id=%s and account_id=%s and event_version=1 and action='grant'
          and policy_version='v1' and policy_digest=%s""",(work,account["A"],expected))==1
    marker("E2-P03","REAL_ES256_OWNER_A_ATOMIC_GRANT_CONTROL_ROW1_EPOCH1_EVENT1")

    node=r"""
import fs from 'node:fs';
import {classifySource153OwnerHttpFixture as classify,
        decodeSource153OwnerConsumerV2 as decode,
        SOURCE153_OWNER_V2_LIVE_ENABLED as live}
  from './src/lib/dreamsnaps/source153-owner-consumer-v2.js';
const v=JSON.parse(fs.readFileSync(0,'utf8'));
const c={workId:v.workId,requestGeneration:9,latestGeneration:9,expectedRowVersion:1,expectedAuthorizationEpoch:1};
const r=classify({status:200,headers:v.headers,body:v.envelope},c);
if(live!==false||r.status!=='SOURCE153_SCHEMA_CANDIDATE_ONLY'||
   !r.projectionCandidate||r.snapshot!==null||r.ownerReadVerified!==false||
   r.actionsEnabled!==false||r.liveBackendEnabled!==false||
   r.projectionCandidate.workId!==v.workId||
   r.projectionCandidate.mediaId!==v.mediaId||
   r.projectionCandidate.publicUsageAuthorized!==false||
   r.projectionCandidate.policyReceiptSourceClaim!=='APPROVED_CANONICAL_RECEIPT')
   throw Error('WEB267_POSITIVE_DTO_OR_LIVE_GATE_FAILED');
const bad=structuredClone(v.envelope);
bad.data.grant.mediaId=v.otherMediaId;
if(decode(bad,c).status!=='SOURCE_CONTRACT_REJECTED')throw Error('WEB267_MEDIA_MISMATCH_PROMOTED');
const late=classify({status:200,headers:v.headers,body:v.envelope},{...c,latestGeneration:10});
if(late.status!=='STALE_RESPONSE')throw Error('WEB267_STALE_RESPONSE_ACCEPTED');
const staleCas=decode(v.envelope,{...c,expectedAuthorizationEpoch:2});
if(staleCas.status!=='REFRESH_REQUIRED'||staleCas.autoRetry!==false)throw Error('WEB267_CAS_RETRY');
if(classify({status:200,headers:{},body:v.envelope},c).status!=='UNSAFE_CACHE_POLICY')
 throw Error('WEB267_PUBLIC_CACHE_ACCEPTED');
if(classify({status:403,headers:v.headers,body:{}},c).status!=='BACKEND_UNAVAILABLE')
 throw Error('WEB267_BAD_DENY_CLASSIFIER');
console.log('E2_WEB267_REAL_HTTP_DTO_SOURCE_ONLY_PRIVATE_NO_LIVE_PASS');
"""
    def run_decoder(envelope,h,work,media,other_media):
        input_payload={"envelope":envelope,"headers":h,"workId":str(work),
                       "mediaId":str(media),"otherMediaId":str(other_media)}
        p=subprocess.run(["node","--input-type=module","-e",node],input=json.dumps(input_payload),
                         capture_output=True,text=True,timeout=30)
        # Avoid echoing the private DTO or IDs if a test fails.
        assert p.returncode==0,"WEB267_EXISTING_DECODER_CONTRACT_FAILED"
        assert "E2_WEB267_REAL_HTTP_DTO_SOURCE_ONLY_PRIVATE_NO_LIVE_PASS" in p.stdout
    authority={}
    for work,photo,media,kind in works:
        st,h,r=owner("A","authority",work,expectedRowVersion=1,expectedAuthorizationEpoch=1)
        assert st==200 and safe_edge_headers(h) and r.get("ok") is True,(kind,"OWNER_AUTHORITY_FAILED",st)
        assert r["operation"]=="authority" and r["contractVersion"]=="wand.dreamsnaps.owner-authority-projection@1"
        data=r["data"]
        assert data["consumerTarget"]=="wand.dreamsnaps.private-owner-consumer@2"
        assert data["work"]["kind"]==kind and data["work"]["workId"]==str(work)
        assert data["work"]["photoRevisionId"]==str(photo) and data["work"]["photoMediaId"]==str(media)
        assert data["work"]["currentWorkRevisionId"]==str(photo)
        if kind=="OriginalCompetition":
            assert data["work"]["entryId"]==str(entry) and data["work"]["frozenEntryRevisionId"]==str(photo)
        else:
            assert "entryId" not in data["work"] and "frozenEntryRevisionId" not in data["work"]
        a=data["authority"]
        assert a["ownerAuthorized"] and a["authenticatedAccountBound"] and a["activeIdentityVerified"]
        assert a["creatorOwnerVerified"] and a["workPhotoBindingVerified"] and a["mediaOwnershipVerified"]
        assert a["mediaReady"] and a["rowVersion"]==1 and a["authorizationEpoch"]==1
        assert a["controlState"]=="consented"
        g=data["grant"]
        assert g["mediaId"]==str(media) and g["photoRevisionId"]==str(photo)
        assert g["creatorSelfCaptureDeclared"] and g["explicitGrantAccepted"] and g["consentRecorded"]
        assert g["lastGrantConsentRevision"]==1 and g["policyVersionText"]=="v1" and g["policyDigest"]==expected
        assert g["state"]=="recorded" and g["policyReceiptVerified"] is True
        assert g["scopeStatus"]=="APPROVED_CANONICAL_RECEIPT"
        assert g["scopeId"]=="wand.dreamsnaps.creator-photo-grant@1"
        assert g["approvedPurposeIds"]==[g["scopeId"]] and g["publicUsageAuthorized"] is False
        assert all(v is False for v in data["externalEvidence"].values())
        assert all(v is False for v in data["capabilities"].values())
        assert data["deletion"]["globalPurgeScopeComplete"] is False
        assert data["deletion"]["cloudCdnIssuedBearerStatus"]=="UNKNOWN"
        authority[kind]=(r,h,work,media)
        run_decoder(r,h,work,media,mp if work==original else mo)
    marker("E2-P04","REAL_SIGNED_OWNER_AUTHORITY_POSITIVE_BOTH_WORK_KINDS")
    marker("E2-P05","WEB267_UNCHANGED_STRICT_DECODER_ACTUAL_HTTP_SOURCE_ONLY_PASS")

    # Required negative cases are new post-Grant tests (no historic E1 replay).
    for who in ("B","M"):
        st,h,r=owner(who,"authority",original,expectedRowVersion=1,expectedAuthorizationEpoch=1)
        assert st in (401,403,404) and safe_edge_headers(h),(who,"FOREIGN_OWNER_AUTHORITY_NOT_DENIED",st)
        assert str(original) not in json.dumps(r) and str(mo) not in json.dumps(r)
        st,h,r=grant(who,post,pp,mp)
        assert st in (401,403,404,409) and safe_edge_headers(h),(who,"FOREIGN_GRANT_NOT_DENIED",st)
    marker("E2-N01","NONOWNER_B_AND_REGISTERED_MODERATOR_M_DENY_OWNER_AUTHORITY_AND_GRANT")

    st,h,r=owner(None,"authority",original,expectedRowVersion=1,expectedAuthorizationEpoch=1)
    assert st==401 and safe_edge_headers(h) and str(original) not in json.dumps(r)
    invalid=users["A"]["token"][:-8]+"invalid8"
    st,h,r=http(path,body={"operation":"authority","workId":str(original)},token=invalid)
    assert st in (401,403) and str(original) not in json.dumps(r)
    marker("E2-N02","SDK_EARLY401_ANON_AND_INVALID_JWT_DENY")

    def change_denies(sql,args,restore,restore_args,label):
        with db.transaction(): db.execute(sql,args)
        try:
            st,h,r=owner("A","authority",post,expectedRowVersion=1,expectedAuthorizationEpoch=1)
            assert st in (401,403,404,409) and str(post) not in json.dumps(r),(label,"NOT_DENIED",st)
            marker("E2-N03-"+label,"POSTGRANT_REVOKED_ACTOR_DENIED",st)
        finally:
            with db.transaction(): db.execute(restore,restore_args)
    change_denies("update public.auth_identities set identity_state='retired' where account_id=%s",
        (account["A"],),"update public.auth_identities set identity_state='active',retired_at=null where account_id=%s",
        (account["A"],),"IDENTITY")
    change_denies("update public.wand_accounts set status='restricted' where account_id=%s",
        (account["A"],),"update public.wand_accounts set status='active' where account_id=%s",
        (account["A"],),"ACCOUNT")
    change_denies("update public.creator_profiles set moderation_state='restricted' where creator_profile_id=%s",
        (creator,),"update public.creator_profiles set moderation_state='clear' where creator_profile_id=%s",
        (creator,),"CREATOR")
    marker("E2-N04","INHERITED_DB_WRITER_CONSTRAINT_NO_INVALID_CROSSWORK_READER_FIXTURE")

    st,h,r=owner("A","authority",post,expectedRowVersion=99,expectedAuthorizationEpoch=1)
    assert st in (403,409) and safe_edge_headers(h) and r.get("ok") is False
    marker("E2-N05","STALE_CAS_DENIED_NO_409_ASSUMPTION",st)
    st,h,r=grant("A",post,pp,mp)
    assert st in (403,409) and safe_edge_headers(h)
    assert scalar("select count(*) from private.dreamsnap_x05_consent_events_v1 where work_id=%s",(post,))==1
    marker("E2-N05-REPLAY","DUPLICATE_GRANT_CAS0_REJECTED_NO_SECOND_CONSENT",st)

    st,h,r=owner("A","action",original,action="withdraw",
       expectedRowVersion=1,expectedAuthorizationEpoch=1)
    assert st==200 and safe_edge_headers(h) and r.get("ok") is True,("E2_WITHDRAW_FAILED",st)
    assert scalar("select authorization_epoch from private.dreamsnap_x05_work_control_v1 where work_id=%s",(original,))==2
    st,h,r=owner("A","authority",original,expectedRowVersion=2,expectedAuthorizationEpoch=2)
    assert st==200 and safe_edge_headers(h) and r.get("ok") is True,("E2_WITHDRAW_OWNER_READ_UNAVAILABLE",st)
    assert r["data"]["grant"]["state"]=="withdrawn"
    assert r["data"]["grant"]["lastGrantConsentRevision"]==1
    assert r["data"]["authority"]["controlState"]=="withdrawn"
    assert r["data"]["deletion"]["publicDisabled"] is True
    assert r["data"]["grant"]["publicUsageAuthorized"] is False
    marker("E2-N06","WITHDRAWN_OWNER_READ_ONLY_ALLOWED_LAST_GRANT1_PUBLIC_OFF",st)

    with db.transaction():
        db.execute("update private.dreamsnap_x05_owner_policy_v1 set is_active=false where policy_version='v1'")
    st,h,r=owner("A","authority",post,expectedRowVersion=1,expectedAuthorizationEpoch=1)
    assert st==200 and safe_edge_headers(h) and r.get("ok") is True,("E2_UNVERIFIED_OWNER_READ",st)
    assert r["data"]["grant"]["scopeStatus"]=="UNVERIFIED" and r["data"]["grant"]["policyReceiptVerified"] is False
    assert "scopeId" not in r["data"]["grant"] and "approvedPurposeIds" not in r["data"]["grant"]
    assert r["data"]["grant"]["publicUsageAuthorized"] is False
    marker("E2-N07","INACTIVE_POLICY_READ200_UNVERIFIED_NO_PUBLIC_SCOPE",st)
    marker("E2-N08","WEB267_REJECTS_CROSSMEDIA_STALE_GENERATION_CAS_AND_UNSAFE_CACHE")
    assert all(v is False for v in authority["PostEventCreation"][0]["data"]["externalEvidence"].values())
    marker("E2-N09","NO_PROVIDER_BYTES_NO_PUBLIC_SIGNER_OR_GLOBAL_PURGE_EVIDENCE")
    assert scalar("select count(*) from private.dreamsnap_x05_work_control_v1")==2
    assert scalar("select count(*) from private.dreamsnap_x05_consent_events_v1")==3
    marker("E2_TARGETED_SIGNED_SOURCE153_TO_WEB267_PASS","LOCAL_TEST_ONLY_NOT_REAL_POLICY_CONSENT_OR_PROVIDER")

# Cleanup is best-effort; the disposable runner is destroyed by CI.
for who in "ABM":
    try:
        http("/auth/v1/admin/users/"+str(users[who]["id"]),method="DELETE",token=admin,key=admin)
    except Exception:
        pass
marker("E2_GOTRUE_SYNTHETIC_USERS_DELETE_ATTEMPTED","DISPOSABLE_NO_EXTERNAL_ACTOR")
