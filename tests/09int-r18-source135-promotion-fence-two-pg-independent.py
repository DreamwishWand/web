#!/usr/bin/env python3
import json
import os
import uuid
import psycopg
assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL")
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
u = uuid.uuid4
owner,actor,creator=u(),u(),u()
other_owner,other_actor,other_creator=u(),u(),u()
staging=f"staging/{owner}/{u()}.json"
idem="int135-"+u().hex[:22]

def scalar(c,sql,args=()):
    return c.execute(sql,args).fetchone()[0]

def reject(c,fn,needle):
    try: fn()
    except psycopg.Error as e:
        assert needle in str(e),(needle,e.sqlstate,str(e))
        return e.sqlstate
    raise AssertionError("Expected terminal rejection: "+needle)

def seed(c,a,s,cr):
    c.execute("insert into public.wand_accounts(account_id) values(%s)",(a,))
    c.execute("""insert into public.auth_identities(
      account_id,provider,provider_subject,last_verified_at,identity_state)
      values(%s,'supabase',%s,clock_timestamp(),'active')""",(a,str(s)))
    c.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(cr,))
    c.execute("""insert into public.creator_profiles(
      creator_profile_id,owner_account_id,handle,display_name)
      values(%s,%s,%s,'INT135')""",(cr,a,"int135_"+u().hex[:16]))

def reserve(c):
    return scalar(c,"""select public.community_preset_storage_reserve_r18(
      %s,%s,%s,%s,%s,%s,%s,1,'scene')""",
      (actor,creator,staging,idem,"b"*64,233,"a"*64))

def claim(c,version):
    return scalar(c,"""select public.community_preset_storage_claim_promotion_r18(%s,%s,%s)""",
      (actor,reservation_id,version))

def readback(c,fence,version,size=233,sha="a"*64):
    return scalar(c,"""select public.community_preset_storage_report_readback_r18(
      %s,%s,%s,%s,%s,%s,%s)""",
      (actor,reservation_id,version,fence["leaseToken"],fence["leaseFence"],size,sha))

with psycopg.connect(DSN,autocommit=True) as setup:
    with setup.transaction():
        seed(setup,owner,actor,creator)
        seed(setup,other_owner,other_actor,other_creator)
    assert scalar(setup,"""select enabled from private.preset_storage_release_gate_r18
      where gate_key='verified_preset_publication'""") is False
    assert scalar(setup,"select count(*) from private.preset_storage_commit_scope_r18")==0
    for func in [
      "public.community_preset_storage_claim_promotion_r18(uuid,uuid,bigint)",
      "public.community_preset_storage_report_readback_r18(uuid,uuid,bigint,uuid,bigint,bigint,text)"
    ]:
        assert scalar(setup,"select has_function_privilege('anon',%s,'EXECUTE')",(func,)) is False
        assert scalar(setup,"select has_function_privilege('authenticated',%s,'EXECUTE')",(func,)) is False
        assert scalar(setup,"select has_function_privilege('service_role',%s,'EXECUTE')",(func,)) is True
    private_commit="private.preset_storage_commit_candidate_r18(uuid,uuid,bigint,uuid,bigint,text,text,text,jsonb)"
    for role in ("anon","authenticated","service_role"):
        assert scalar(setup,"select has_function_privilege(%s,%s,'EXECUTE')",(role,private_commit)) is False
    print(json.dumps({"case":"09INT_R18_SOURCE135_ACTUAL_PG_RELEASE_GATE_AND_RPC_ACL_DENY"}))

with psycopg.connect(DSN,autocommit=True) as a,psycopg.connect(DSN,autocommit=True) as b:
    assert scalar(a,"select pg_backend_pid()") != scalar(b,"select pg_backend_pid()")
    r=reserve(a)
    reservation_id=r["reservationId"]
    assert r["publicationCommitAuthorized"] is False
    initial_version=r["stateVersion"]
    a.execute("begin")
    a.execute("select 1 from private.preset_storage_reservations_r18 where reservation_id=%s for update",(reservation_id,))
    b.execute("begin")
    b.execute("set local lock_timeout='200ms'")
    try:
        claim(b,initial_version)
        raise AssertionError("Unfenced promotion claim bypassed held reservation lock")
    except psycopg.Error as e:
        assert e.sqlstate == "55P03",(e.sqlstate,str(e))
    b.execute("rollback")
    a.execute("commit")
    fence=claim(b,initial_version)
    assert fence["leaseFence"]==1 and fence["stateVersion"]==initial_version+1
    assert fence["providerCopyAuthorized"] is False
    assert fence["publicationCommitAuthorized"] is False
    reject(b,lambda:claim(b,initial_version),"R18_PRESET_RESERVATION_STALE")
    reject(b,lambda:scalar(b,"""select public.community_preset_storage_claim_promotion_r18(%s,%s,%s)""",
            (other_actor,reservation_id,fence["stateVersion"])),"R18_PRESET_RESERVATION_FORBIDDEN")
    print(json.dumps({"case":"09INT_R18_SOURCE135_ACTUAL_2PG_CLAIM_FENCE_VERSION_LOCK_55P03"}))
    mismatch=readback(b,fence,fence["stateVersion"],size=234)
    assert mismatch["readbackMatches"] is False
    assert mismatch["publicationCommitAuthorized"] is False
    assert mismatch["stateVersion"]==fence["stateVersion"]+1
    assert scalar(b,"select reservation_state from private.preset_storage_reservations_r18 where reservation_id=%s",(reservation_id,))=="FAILED_RECOVERABLE"
    reject(b,lambda:readback(b,fence,fence["stateVersion"]),"R18_PRESET_STALE_FENCE_OR_LEASE")
    # Recovery retry delay is an intentional gate. Clearing it here is isolated SQL fixture setup, not product API.
    b.execute("update private.preset_storage_reservations_r18 set retry_after=null where reservation_id=%s",(reservation_id,))
    second=claim(a,mismatch["stateVersion"])
    assert second["leaseFence"]==fence["leaseFence"]+1
    assert second["leaseToken"]!=fence["leaseToken"]
    reject(a,lambda:readback(a,fence,second["stateVersion"]),"R18_PRESET_STALE_FENCE_OR_LEASE")
    print(json.dumps({"case":"09INT_R18_SOURCE135_ACTUAL_PG_READBACK_MISMATCH_AND_RECLAIM_FENCE"}))
    success=readback(a,second,second["stateVersion"])
    assert success["readbackMatches"] is True
    assert success["verifiedPublishedObject"] is False
    assert success["publicationCommitAuthorized"] is False
    assert success["state"]=="VERIFICATION_REQUIRED"
    state=scalar(a,"""select verification_evidence_state from private.preset_storage_reservations_r18
      where reservation_id=%s""",(reservation_id,))
    assert state=="EDGE_READBACK_UNATTESTED"
    reject(a,lambda:scalar(a,"""select private.preset_storage_commit_candidate_r18(
      %s,%s,%s,%s,%s,'Test',null,'public','{}'::jsonb)""",
      (actor,reservation_id,success["stateVersion"],second["leaseToken"],second["leaseFence"])),
      "R18_PRESET_PUBLICATION_RELEASE_GATE_CLOSED")
    assert scalar(a,"select count(*) from public.artifact_blobs where storage_key=%s",(r["publishedStorageKey"],))==0
    assert scalar(a,"select count(*) from public.community_works where owner_account_id=%s",(owner,))==0
    print(json.dumps({"case":"09INT_R18_SOURCE135_ACTUAL_PG_CORRECT_UNATTESTED_READBACK_CANNOT_COMMIT"}))
    a.execute("""update private.preset_storage_reservations_r18 set
      lease_expires_at=clock_timestamp()-interval '2 seconds'
      where reservation_id=%s""",(reservation_id,))
    reject(a,lambda:readback(a,second,success["stateVersion"]),"R18_PRESET_STALE_FENCE_OR_LEASE")
    pre=scalar(a,"select public.community_preset_storage_cleanup_preflight_r18(%s,%s)",
      (actor,r["publishedStorageKey"]))
    assert pre["cleanupAuthorized"] is False and pre["physicalDeleteAuthorized"] is False
    print(json.dumps({"case":"09INT_R18_SOURCE135_ACTUAL_PG_EXPIRED_LEASE_AND_CLEANUP_DENY"}))
print(json.dumps({"result":"09INT_R18_SOURCE135_ACTUAL_2PG_FENCE_FAIL_CLOSED_ACCEPTED",
 "realPostgreSQL":True,"actualProviderStorage":False,
 "providerReadbackBytesVerified":False,"positivePublisherEnabled":False}))
