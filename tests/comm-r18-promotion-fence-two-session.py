#!/usr/bin/env python3
import os,json,uuid,psycopg
assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
owner,actor,creator=u(),u(),u()
stage=f'staging/{owner}/{u()}.json'
def one(c,q,args=()):return c.execute(q,args).fetchone()[0]
def fail(c,fn,reason):
    try:fn()
    except psycopg.Error as e:
        assert reason in str(e),(reason,str(e))
        return e.sqlstate
    raise AssertionError('UNEXPECTED_ACCEPTED:'+reason)
with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
    assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
    with a.transaction():
        a.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
        a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
          values(%s,'supabase',%s,now(),'active')""",(owner,str(actor)))
        a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
        a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
          values(%s,%s,%s,'R18 fenced owner')""",(creator,owner,'lease_'+u().hex[:16]))
    r=one(a,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",
       (actor,creator,stage,'fenced-'+u().hex[:20],'a'*64,'b'*64))
    rid=uuid.UUID(r['reservationId'])
    claim=one(a,"select public.community_preset_storage_claim_promotion_r18(%s,%s,%s)",(actor,rid,1))
    assert claim['leaseFence']==1 and claim['stateVersion']==2
    assert claim['providerCopyAuthorized'] is False and claim['publicationCommitAuthorized'] is False
    token=uuid.UUID(claim['leaseToken'])
    fail(b,lambda:one(b,"select public.community_preset_storage_claim_promotion_r18(%s,%s,1)",(actor,rid)),'R18_PRESET_RESERVATION_STALE')
    fail(b,lambda:one(b,"select public.community_preset_storage_report_readback_r18(%s,%s,2,%s,1,100,%s)",
       (actor,rid,u(),'b'*64)),'R18_PRESET_STALE_FENCE_OR_LEASE')
    fail(b,lambda:one(b,"select public.community_preset_storage_report_readback_r18(%s,%s,2,%s,2,100,%s)",
       (actor,rid,token,'b'*64)),'R18_PRESET_STALE_FENCE_OR_LEASE')
    a.execute('begin')
    a.execute("select reservation_id from private.preset_storage_reservations_r18 where reservation_id=%s for update",(rid,))
    b.execute('begin')
    b.execute("set local lock_timeout='150ms'")
    try:
        one(b,"select public.community_preset_storage_report_readback_r18(%s,%s,2,%s,1,100,%s)",
           (actor,rid,token,'b'*64))
        raise AssertionError('COMPETING_READBACK_DID_NOT_LOCK')
    except psycopg.Error as e:assert e.sqlstate=='55P03',e.sqlstate
    b.execute('rollback');a.execute('commit')
    mismatch=one(a,"select public.community_preset_storage_report_readback_r18(%s,%s,2,%s,1,100,%s)",
      (actor,rid,token,'c'*64))
    assert mismatch['readbackMatches'] is False and mismatch['state']=='FAILED_RECOVERABLE'
    assert mismatch['publicationCommitAuthorized'] is False
    fail(a,lambda:one(a,"select public.community_preset_storage_report_readback_r18(%s,%s,2,%s,1,100,%s)",
      (actor,rid,token,'b'*64)),'R18_PRESET_STALE_FENCE_OR_LEASE')
    a.execute("update private.preset_storage_reservations_r18 set retry_after=null where reservation_id=%s",(rid,))
    retry=one(a,"select public.community_preset_storage_claim_promotion_r18(%s,%s,3)",(actor,rid))
    assert retry['leaseFence']==2 and retry['stateVersion']==4
    token2=uuid.UUID(retry['leaseToken'])
    fail(b,lambda:one(b,"select public.community_preset_storage_report_readback_r18(%s,%s,4,%s,1,100,%s)",
      (actor,rid,token,'b'*64)),'R18_PRESET_STALE_FENCE_OR_LEASE')
    good=one(a,"select public.community_preset_storage_report_readback_r18(%s,%s,4,%s,2,100,%s)",
      (actor,rid,token2,'b'*64))
    assert good['readbackMatches'] is True and good['state']=='VERIFICATION_REQUIRED'
    assert good['verifiedPublishedObject'] is False and good['publicationCommitAuthorized'] is False
    fail(b,lambda:one(b,"select private.preset_storage_commit_candidate_r18(%s,%s,5,%s,2,'fenced','description','public','{}'::jsonb)",
      (actor,rid,token2)),'R18_PRESET_PUBLICATION_RELEASE_GATE_CLOSED')
    assert one(a,"select count(*) from public.artifact_blobs where storage_key=%s",(r['publishedStorageKey'],))==0
    assert one(a,"select count(*) from public.idempotency_keys where idempotency_key=%s",('fenced-'+str(rid),))==0
    with a.transaction():
        a.execute("""update private.preset_storage_release_gate_r18 set
          enabled=true,provider_precondition_accepted=true,
          operator_evidence_ref='ISOLATED_LOCAL_SYNTHETIC_NOT_PROVIDER' where gate_key='verified_preset_publication'""")
        a.execute("""update private.preset_storage_reservations_r18 set
          reservation_state='VERIFIED_PUBLISHED_OBJECT',
          verification_evidence_state='PROVIDER_ATTESTATION_REQUIRED'
          where reservation_id=%s""",(rid,))
        before=one(a,"select count(*) from public.community_works where owner_account_id=%s",(owner,))
        try:
            result=one(a,"select private.preset_storage_commit_candidate_r18(%s,%s,5,%s,2,'fenced','test','public','{}'::jsonb)",
              (actor,rid,token2))
            assert result['presetArtifactId'] and result['workId'] and result['presetRevisionId']
            assert one(a,"select count(*) from public.community_works where owner_account_id=%s",(owner,))==before+1
            assert one(a,"select reservation_state from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))=='COMMITTED_PRESET_PUBLICATION'
            print(json.dumps({'case':'R18_LOCAL_ONLY_SYNTHETIC_ATOMIC_PRESET_SQL_CANDIDATE_ROLLBACK','transactionalShape':True,'realProviderVerified':False}))
        finally:
            a.execute('rollback')
    assert one(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
    assert one(b,"select count(*) from public.artifact_blobs where storage_key=%s",(r['publishedStorageKey'],))==0
    assert one(b,"select reservation_state from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))=='VERIFICATION_REQUIRED'
    assert one(b,"select count(*) from private.preset_storage_commit_scope_r18")==0
    print(json.dumps({'case':'R18_TWO_BACKEND_LEASE_FENCING_AND_READBACK','staleRejected':True,'mismatchDenied':True,'noPartialCommit':True}))
print(json.dumps({'result':'03COMM_R18_SOURCE_ONLY_FENCING_AND_GATED_COMMIT_CANDIDATE_PASS',
 'providerCopyExecuted':False,'realProviderVerified':False,'positiveWriterEnabled':False,
 'physicalCleanupAuthorized':False}))
