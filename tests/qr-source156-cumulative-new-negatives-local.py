#!/usr/bin/env python3
"""04 QR NEW-only adversarial probes on EXACT PR327 FULL156 signed composite.
Reuses existing genuine GoTrue signed A0->R16 test only as disposable setup.
Adds scoped identity-body spoof/current CAS/SQL session/ACL negatives. No
production data, keys, JWTs or account IDs ever written to logs.
"""
import os,sys
from pathlib import Path
assert os.environ.get("DDVRE_E2_LOCAL_DISPOSABLE")=="APPROVED"
assert not any(os.getenv(x) for x in ("DATABASE_URL","SUPABASE_ACCESS_TOKEN","SUPABASE_PROJECT_ID"))
p=Path("tests/comm-source156-cumulative-gotrue-local.py")
source=p.read_text()
anchor='    marker("C03-C08-SAME-ACCOUNT-REVOCATION","A0_LOCAL_REVOKED_ALL_OLD_ROUTES_401_SIBLING_200_NO_UNAUTHORIZED_WORKSPACE",401)'
assert source.count(anchor)==1,"QR156_COMPOSITE_SETUP_DRIFT"
new=r'''
    # New QA probes run AFTER the previously genuine signed A0->R16->Local
    # revoke integration. Do NOT reinterpret inherited fixture as a new pass.
    snapshot=gallery_state()
    current=snapshot[-1]
    claims=jwt(d1,1)
    # The same-current-CAS Writer must fail for terminally revoked A0
    # independently of stale version or idempotency replay.
    fresh={
      "workId":str(gw),"expectedVersion":current,
      "expectedCurrentRevisionId":str(grev),"enabled":True,
      "idempotencyKey":"qr-s156-revoked-"+secrets.token_hex(6)
    }
    denied,headers,_=http("/functions/v1/community-command",
       body={"command":"setGalleryCommentsAtomicR16","payload":fresh},token=d0)
    assert denied==401 and private_headers(headers) and gallery_state()==snapshot,"QR156_REVOKED_CURRENT_CAS_WRITE"
    marker("QR156-Q01-REVOKED-CURRENT-CAS","OLD_A0_401_UNCHANGED_WITH_ACTUAL_NEXT_CAS",denied)

    # A genuine B bearer cannot steal D ownership by JSON-supplied claims.
    stolen=dict(fresh)
    stolen.update({"idempotencyKey":"qr-s156-forged-"+secrets.token_hex(6),
       "authSubject":str(D["id"]),"sessionId":claims["session_id"],
       "iat":int(claims["iat"])})
    forbidden,fh,_=http("/functions/v1/community-command",
       body={"command":"setGalleryCommentsAtomicR16","payload":stolen},
       token=actors["B"]["token"])
    assert forbidden!=200 and private_headers(fh) and gallery_state()==snapshot,"QR156_FORGED_OWNER_BODY_WRITE"
    marker("QR156-Q02-FOREIGN-CLAIMS","B_SIGNED_CANNOT_OVERRIDE_SUBJECT_BY_JSON_NO_DB_CHANGE",forbidden)

    # Current signed D1 (positive valid session) with STALE version and a
    # FRESH idempotency key must still fail closed with no partial updates.
    stale=dict(fresh)
    stale.update({"expectedVersion":pin,"idempotencyKey":"qr-s156-stale-"+secrets.token_hex(6)})
    stale_status,sh,_=http("/functions/v1/community-command",
       body={"command":"setGalleryCommentsAtomicR16","payload":stale},token=d1)
    assert stale_status!=200 and private_headers(sh) and gallery_state()==snapshot,"QR156_STALE_VALID_SESSION_COMMITTED"
    marker("QR156-Q03-STILL-CAS","D1_VALID_STALE_VERSION_DENIED_NO_DB_CHANGE",stale_status)

    # EXPLICIT SQL ACLs, not merely PGRST RPC routing, prohibit every
    # untrusted role from calling the service-only new writer or old bypass.
    signed_sig="public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)"
    old_sig="public.community_set_gallery_comments_enabled_atomic_r16(uuid,uuid,bigint,uuid,boolean,text)"
    for role in ("anon","authenticated"):
      assert not scalar("select has_function_privilege(%s,%s,'EXECUTE')",(role,signed_sig))
      assert not scalar("select has_function_privilege(%s,%s,'EXECUTE')",(role,old_sig))
    assert not scalar("select has_function_privilege('service_role',%s,'EXECUTE')",(old_sig,))
    assert not scalar("select has_function_privilege('service_role','private.community_legacy_signed_writer_guard_v1(uuid,bigint,uuid)','EXECUTE')")
    marker("QR156-Q04-DIRECT-ACL","OLD_R16_AND_SIGNED_R16_NOT_DIRECTLY_CALLABLE_BY_UNTRUSTED_ROLES")

    # Service-role SQL entry with fabricated session UUID (no JWT) MUST be
    # rejected internally even with an otherwise eligible Owner/current CAS.
    with psycopg.connect(DSN,autocommit=True) as isolated:
      try:
        isolated.execute(
          "select public.community_set_gallery_comments_enabled_atomic_signed_v1(%s,%s,%s,%s,%s,%s,%s,%s)",
          (D["id"],int(claims["iat"]),uuid.uuid4(),gw,current,grev,True,
           "qr-s156-unregistered-"+secrets.token_hex(6))
        ).fetchone()
        raise AssertionError("QR156_UNREGISTERED_SIGNED_WRITER_WAS_ACCEPTED")
      except psycopg.Error as e:
        assert any(x in str(e).upper() for x in ("SESSION","GOTRUE","IDENTITY")), "QR156_UNKNOWN_REASON_FOR_SIGNED_SESSION_REJECTION"
    assert gallery_state()==snapshot,"QR156_UNREGISTERED_SESSION_MUTATED"
    marker("QR156-Q05-UNREGISTERED-SESSION","REAL_DB_UNKNOWN_GOTRUE_UUID_REJECTED_NO_PARTIAL_CHANGE")
'''
source=source.replace(anchor,anchor+"\n"+new,1)
try:
    exec(compile(source,str(p),"exec"),{"__name__":"__main__"})
except BaseException as error:
    print("QR156_NEW_ONLY_ADVERSARIAL_FAILURE "+type(error).__name__,flush=True)
    sys.exit(1)
print("QR156_REAL_SIGNED_NEW_ONLY_NEGATIVES_PASS",flush=True)
