#!/usr/bin/env python3
import json, os, uuid
import psycopg

assert os.getenv("DDVRE_PRIVACY_ISOLATED_LOCAL") == "CONFIRMED"
assert not os.getenv("DATABASE_URL")
dsn = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
fresh=uuid.uuid4
def one(c,q,p=()):
 return c.execute(q,p).fetchone()[0]
def denial(c,q,p,expected):
 c.execute("savepoint isolated_legacy_read")
 try:
  one(c,q,p)
 except psycopg.Error as ex:
  c.execute("rollback to savepoint isolated_legacy_read")
  assert expected in str(ex),(expected,ex.sqlstate,str(ex))
 else:
  c.execute("rollback to savepoint isolated_legacy_read")
  raise AssertionError("Unexpected accepted Legacy Media key: "+expected)

with psycopg.connect(dsn,autocommit=True) as reads, psycopg.connect(dsn,autocommit=True) as reporter:
 assert one(reads,"select pg_backend_pid()")!=one(reporter,"select pg_backend_pid()")
 owner,actor,outsider,outsider_subject,creator=[fresh() for _ in range(5)]
 with reads.transaction():
  for account,subject in ((owner,actor),(outsider,outsider_subject)):
   reads.execute("insert into public.wand_accounts(account_id) values(%s)",(account,))
   reads.execute("insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state) values(%s,'supabase',%s,now(),'active')",(account,str(subject)))
  reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  reads.execute("insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name) values(%s,%s,%s,'INT142 Narrow Legacy Fallback')",(creator,owner,"n142_"+fresh().hex[:17]))
 reservation=one(reads,"select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')",
   (actor,creator,f"staging/{owner}/{fresh()}.json","int142-"+fresh().hex,"a"*64,"b"*64))
 rid=uuid.UUID(reservation["reservationId"])
 promotion=one(reads,"select public.community_preset_storage_claim_promotion_r18(%s,%s,1)",(actor,rid))
 lease=uuid.UUID(promotion["leaseToken"])
 affected,unrelated,affected_media,good_media=[fresh() for _ in range(4)]
 def storage(mid):return f"{actor}/{mid}.png"
 with reads.transaction():
  reads.execute("update private.preset_storage_release_gate_r18 set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='INT142_LOCAL_SYNTHETIC_NOT_PROVIDER' where gate_key='verified_preset_publication'")
  reads.execute("update private.preset_storage_reservations_r18 set reservation_state='VERIFIED_PUBLISHED_OBJECT',verification_evidence_state='PROVIDER_ATTESTED',readback_at=now(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s",("b"*64,rid))
  result=one(reads,"select private.preset_storage_commit_candidate_r18(%s,%s,2,%s,1,'Legacy Fallback Test',null,'public','{}'::jsonb)",(actor,rid,lease))
  for work,mid in ((affected,affected_media),(unrelated,good_media)):
   reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(work,))
   reads.execute("insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility) values(%s,%s,%s,'gallery','public')",(work,owner,creator))
   reads.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(work,))
   reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(mid,))
   reads.execute("insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state) values(%s,%s,%s,'image/png',100,20,20,%s,'ready','clear')",(mid,owner,storage(mid),"e"*64))
   rev=fresh()
   reads.execute("insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id) values(%s,%s,1,%s)",(rev,work,owner))
   reads.execute("insert into public.gallery_work_revisions(revision_id,title) values(%s,'INT142 synthetic current gallery')",(rev,))
   reads.execute("insert into public.work_revision_media(work_revision_id,media_id,ordinal,role) values(%s,%s,0,'gallery')",(rev,mid))
   reads.execute("update public.community_works set lifecycle_state='published',current_published_revision_id=%s,published_at=now() where work_id=%s",(rev,work))
  legacy=fresh()
  reads.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')",(legacy,))
  reads.execute("insert into public.preset_artifacts(preset_artifact_id,owner_account_id,creator_profile_id,associated_gallery_work_id,preset_type) values(%s,%s,%s,%s,'scene')",(legacy,owner,creator,affected))
  reads.execute("insert into public.preset_revisions(preset_artifact_id,revision_number,artifact_blob_id,created_by_account_id) values(%s,1,(select committed_blob_id from private.preset_storage_reservations_r18 where reservation_id=%s),%s)",(legacy,rid,owner))
  reads.execute("update private.preset_storage_release_gate_r18 set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null where gate_key='verified_preset_publication'")
 assert one(reads,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 fn="public.community_get_media_storage_key(uuid,uuid)"
 for role,allow in (("service_role",True),("anon",False),("authenticated",False)):
  assert one(reads,"select has_function_privilege(%s,%s,'EXECUTE')",(role,fn)) is allow
 # Verify effective SQL, not only migration source or an Edge Guard.
 body=one(reads,"select pg_get_functiondef(%s::regprocedure)",(fn,))
 assert body.index("private.can_access_entity")<body.index("community_preset_storage_assert_media_not_quarantined_r19")<body.index("storageKey")
 def get(actor_id,mid):
  return one(reads,"select public.community_get_media_storage_key(%s,%s)",(actor_id,mid))
 # Two actual connections, authenticated owner and nonowner; only Owner is valid.
 reads.execute("set role service_role")
 assert get(actor,affected_media)["storageKey"]==storage(affected_media)
 assert get(actor,good_media)["storageKey"]==storage(good_media)
 reads.execute("begin")
 denial(reads,"select public.community_get_media_storage_key(%s,%s)",(outsider_subject,affected_media),"Media is not accessible")
 reads.execute("commit")
 reporter.execute("begin")
 report=one(reporter,"select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,'PUBLISHED_MISSING_POST_COMMIT','legacy-signer-missing',null,null)",(actor,rid))
 assert report["publicationAuthorized"] is False
 assert get(actor,affected_media)["storageKey"]==storage(affected_media)
 reporter.execute("commit")
 assert one(reads,"select private.preset_storage_media_quarantined_r19(%s)",(affected_media,)) is True
 assert one(reads,"select private.preset_storage_media_quarantined_r19(%s)",(good_media,)) is False
 reads.execute("begin")
 denial(reads,"select public.community_get_media_storage_key(%s,%s)",(actor,affected_media),"R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED")
 denial(reads,"select public.community_get_media_storage_key(%s,%s)",(outsider_subject,affected_media),"Media is not accessible")
 reads.execute("commit")
 assert get(actor,good_media)["storageKey"]==storage(good_media)
 reads.execute("reset role")
 assert one(reads,"select count(*) from private.preset_storage_integrity_incidents_r18 where reservation_id=%s",(rid,))==1
 assert one(reads,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 print(json.dumps(dict(marker="09INT_SOURCE142_LEGACY_SIGNER_2PG_NEW_ONLY",distinct_connections=True,
 effective_source142_sql_guard=True,service_role_direct_denied_after_commit=True,
 owner_preincident_key=True,nonowner_denied=True,unrelated_owner_media_available=True,
 before_reporter_commit_read_committed_old_state=True,anon_authenticated_exec_false=True,
 provider_real=False,normal_signed_jwt=False,cdn=False,stage_mutation=False)))
