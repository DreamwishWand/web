#!/usr/bin/env python3
import json,os,uuid
import psycopg

assert os.getenv('DDVRE_PRIVACY_ISOLATED_LOCAL')=='CONFIRMED' and not os.getenv('DATABASE_URL')
dsn='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
u=uuid.uuid4
owner,actor,creator=u(),u(),u()
def one(conn,query,args=()):return conn.execute(query,args).fetchone()[0]
def denial(conn,query,args,needle):
 conn.execute('savepoint r19_denial')
 try:one(conn,query,args)
 except psycopg.Error as ex:
  conn.execute('rollback to savepoint r19_denial')
  assert needle in str(ex),(needle,str(ex))
  return
 conn.execute('rollback to savepoint r19_denial')
 raise AssertionError('R19_UNEXPECTED_ACCESS:'+needle)
def count(c,table,where="",args=()):
 return one(c,'select count(*) from '+table+' '+where,args)

with psycopg.connect(dsn,autocommit=True) as a,psycopg.connect(dsn,autocommit=True) as b:
 assert one(a,'select pg_backend_pid()')!=one(b,'select pg_backend_pid()')
 assert one(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 with a.transaction():
  a.execute('insert into public.wand_accounts(account_id) values(%s)',(owner,))
  a.execute("""insert into public.auth_identities(account_id,provider,provider_subject,last_verified_at,identity_state)
   values(%s,'supabase',%s,now(),'active')""",(owner,str(actor)))
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'creator_profile')",(creator,))
  a.execute("""insert into public.creator_profiles(creator_profile_id,owner_account_id,handle,display_name)
   values(%s,%s,%s,'R19 local quarantine')""",(creator,owner,'r19_'+u().hex[:17]))
 reserve=lambda key,stage,hash:one(a,"""select public.community_preset_storage_reserve_r18(%s,%s,%s,%s,%s,100,%s,1,'scene')""",
   (actor,creator,stage,key,'a'*64,hash))
 res=reserve('r19-'+u().hex,f'staging/{owner}/{u()}.json','b'*64)
 rid=uuid.UUID(res['reservationId'])
 lease=one(a,'select public.community_preset_storage_claim_promotion_r18(%s,%s,1)',(actor,rid))
 token=uuid.UUID(lease['leaseToken'])
 with a.transaction():
  a.execute("""update private.preset_storage_release_gate_r18
    set enabled=true,provider_precondition_accepted=true,operator_evidence_ref='R19_DISPOSABLE_LOCAL_ONLY_NOT_REAL_PROVIDER'
    where gate_key='verified_preset_publication'""")
  a.execute("""update private.preset_storage_reservations_r18
    set reservation_state='VERIFIED_PUBLISHED_OBJECT',
     verification_evidence_state='PROVIDER_ATTESTED',
     readback_at=clock_timestamp(),readback_byte_size=100,readback_sha256=%s where reservation_id=%s""",('b'*64,rid))
  v=one(a,"""select private.preset_storage_commit_candidate_r18(
    %s,%s,2,%s,1,'R19 local preset',null,'public','{}'::jsonb)""",(actor,rid,token))
  preset=uuid.UUID(v['presetArtifactId']);rev=uuid.UUID(v['presetRevisionId']);work=uuid.UUID(v['workId'])
  gallery=u();galrev=u()
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(gallery,))
  a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility)
   values(%s,%s,%s,'gallery','public')""",(gallery,owner,creator))
  a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(gallery,))
  a.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
    values(%s,%s,1,%s)""",(galrev,gallery,owner))
  a.execute("""insert into public.gallery_work_revisions(revision_id,title,description)
   values(%s,'R19 gallery','R19 prior preset')""",(galrev,))
  a.execute("insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id) values(%s,%s)",(galrev,rev))
  direct_gallery=u(); unrelated_gallery=u()
  for extra,kind in [(direct_gallery,'direct'),(unrelated_gallery,'unrelated')]:
   a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'community_work')",(extra,))
   a.execute("""insert into public.community_works(work_id,owner_account_id,creator_profile_id,work_type,visibility)
    values(%s,%s,%s,'gallery','public')""",(extra,owner,creator))
   a.execute("insert into public.gallery_works(work_id,gallery_kind) values(%s,'outdoor')",(extra,))
   er=u()
   a.execute("""insert into public.community_work_revisions(revision_id,work_id,revision_number,created_by_account_id)
    values(%s,%s,1,%s)""",(er,extra,owner))
   a.execute("insert into public.gallery_work_revisions(revision_id,title,description) values(%s,%s,'Reader graph')",(er,'R19 '+kind))
   a.execute("""update public.community_works set lifecycle_state='published',
    current_published_revision_id=%s,published_at=now() where work_id=%s""",(er,extra))
   a.execute("""insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at)
    values(%s,%s,'gallery',%s,%s,now())""",(extra,extra,creator,'R19 '+kind))
  # Synthetic legacy direct-only association: create the edge BEFORE its first
  # revision, without disabling the immutable PresetArtifact identity trigger.
  # The shared local Blob intentionally models a historical reference graph,
  # NOT a valid Provider attestation or positive Writer API.
  direct_artifact=u()
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'preset_artifact')",(direct_artifact,))
  a.execute("""insert into public.preset_artifacts(preset_artifact_id,owner_account_id,
    creator_profile_id,associated_gallery_work_id,preset_type)
    values(%s,%s,%s,%s,'scene')""",(direct_artifact,owner,creator,direct_gallery))
  a.execute("""insert into public.preset_revisions(preset_artifact_id,revision_number,
    artifact_blob_id,created_by_account_id) values(%s,1,
    (select committed_blob_id from private.preset_storage_reservations_r18 where reservation_id=%s),%s)""",
    (direct_artifact,rid,owner))
  for target in [work,gallery,direct_gallery,unrelated_gallery,preset]:
   a.execute("insert into public.saved_items(account_id,target_entity_id) values(%s,%s)",(owner,target))
  media=u()
  a.execute("insert into public.community_entities(entity_id,entity_type) values(%s,'media_asset')",(media,))
  a.execute("""insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,checksum_sha256,processing_state)
    values(%s,%s,%s,'image/png',100,%s,'ready')""",(media,owner,f'{actor}/{u()}.png','e'*64))
  a.execute("""insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
    values(%s,%s,0,'gallery')""",(galrev,media))
  a.execute("""update public.community_works set
    lifecycle_state='published',current_published_revision_id=%s,published_at=now()
    where work_id=%s""",(galrev,gallery))
  a.execute("""insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at)
    values(%s,%s,'gallery',%s,'R19 gallery public',now())""",(gallery,gallery,creator))
  a.execute("""update private.preset_storage_release_gate_r18
    set enabled=false,provider_precondition_accepted=false,operator_evidence_ref=null
    where gate_key='verified_preset_publication'""")
 assert one(b,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 assert one(b,'select count(*) from public.search_documents where work_id in (%s,%s)',(work,gallery))==2
 assert not one(b,'select private.preset_storage_work_quarantined_r19(%s)',(work,))
 assert not one(b,'select private.preset_storage_work_quarantined_r19(%s)',(gallery,))
 assert one(b,'select public.community_preset_storage_assert_media_not_quarantined_r19(%s)',(media,)) is True
 assert one(b,'select public.community_get_preset(%s,%s)',(actor,preset))['presetArtifactId']==str(preset)
 assert one(b,'select public.wep_get_accessible_preset_blob(%s,%s,null)',(actor,preset))['presetArtifactId']==str(preset)
 assert one(b,'select public.community_get_gallery_public_v1(%s)',(gallery,))['workId']==str(gallery)
 assert one(b,'select public.community_get_work(%s,%s)',(actor,direct_gallery))['workId']==str(direct_gallery)
 assert len(one(b,'select public.community_get_saved(%s,50)',(actor,)))==5
 assert len(one(b,'select public.community_get_my_gallery_v1(%s,50)',(actor,))['myWorks'])==3
 assert one(b,'select public.community_gallery_media_gateway_v1(%s)',(media,))['galleryManaged'] is False
 # Database snapshot visibility across 2 real backends: reporter writes under lock,
 # the reader after report must deny even if Work, Gallery and Blob remain committed.
 report="""select public.community_preset_storage_report_integrity_r18(%s,%s,3,1,
   'PUBLISHED_MISSING_POST_COMMIT','provider-generation-missing',null,null)"""
 b.execute('begin')
 incident=one(b,report,(actor,rid))
 assert incident['publicationAuthorized'] is False
 a.execute('begin')
 a.execute("set local lock_timeout='150ms'")
 try:
  one(a,'select reservation_id from private.preset_storage_reservations_r18 where reservation_id=%s for update',(rid,))
  raise AssertionError('R19_NO_RESERVATION_SERIALIZATION')
 except psycopg.Error as ex:assert ex.sqlstate=='55P03'
 a.execute('rollback')
 b.execute('commit')
 assert count(a,'private.preset_storage_work_read_suppressions_r19','where reservation_id=%s',(rid,))==3
 assert count(a,'public.search_documents','where work_id in (%s,%s,%s)',(work,gallery,direct_gallery))==0
 # Real anon Data API database role cannot see quarantined metadata/revision/media,
 # even though a privileged service-role direct table query bypasses RLS.
 a.execute('begin')
 a.execute('set local role anon')
 for t,cond,arg in [
  ('public.community_works','where work_id in (%s,%s)',(work,gallery)),
  ('public.search_documents','where work_id in (%s,%s)',(work,gallery)),
  ('public.preset_artifacts','where preset_artifact_id=%s',(preset,)),
  ('public.gallery_revision_presets','where gallery_revision_id=%s',(galrev,)),
  ('public.work_revision_media','where work_revision_id=%s',(galrev,)),
  ('public.media_assets','where media_id=%s',(media,))
 ]:
  a.execute('savepoint r19_anon_read')
  try:
   assert count(a,t,cond,arg)==0,(t,cond)
  except psycopg.errors.InsufficientPrivilege as e:
   # The Source may also deny the table SELECT grant entirely; do not
   # re-grant visibility merely to exercise restrictive RLS.
   a.execute('rollback to savepoint r19_anon_read')
   assert e.sqlstate=='42501'
  else:
   a.execute('release savepoint r19_anon_read')
 a.execute('rollback')
 assert one(a,'select private.preset_storage_work_quarantined_r19(%s)',(work,))
 assert one(a,'select private.preset_storage_work_quarantined_r19(%s)',(gallery,))
 assert one(a,'select private.preset_storage_media_quarantined_r19(%s)',(media,))
 assert one(a,'select private.preset_storage_work_quarantined_r19(%s)',(direct_gallery,))
 assert not one(a,'select private.preset_storage_work_quarantined_r19(%s)',(unrelated_gallery,))
 assert one(a,'select public.community_get_work(%s,%s)',(actor,unrelated_gallery))['workId']==str(unrelated_gallery)
 assert [x['targetEntityId'] for x in one(a,'select public.community_get_saved(%s,50)',(actor,))]==[str(unrelated_gallery)]
 owner_listing=one(a,'select public.community_get_my_gallery_v1(%s,50)',(actor,))
 assert [x['workId'] for x in owner_listing['myWorks']]==[str(unrelated_gallery)]
 assert [x['targetEntityId'] for x in owner_listing['saved']]==[str(unrelated_gallery)]
 assert one(a,"select private.preset_storage_blob_quarantined_r19(committed_blob_id) from private.preset_storage_reservations_r18 where reservation_id=%s",(rid,))
 a.execute('begin')
 for query,args in [
  ('select public.community_get_preset(%s,%s)',(actor,preset)),
  ('select public.wep_get_accessible_preset_blob(%s,%s,null)',(actor,preset)),
  ('select public.wep_get_accessible_preset_blob(%s,null,%s)',(actor,rev)),
  ('select public.community_get_gallery_public_v1(%s)',(gallery,)),
  ('select public.community_get_gallery_v1(%s,%s)',(actor,gallery)),
  ('select public.community_get_work(%s,%s)',(actor,work)),
  ('select public.community_get_work(%s,%s)',(actor,gallery)),
  ('select public.community_get_work(%s,%s)',(actor,direct_gallery)),
  ('select public.community_get_gallery_public_v1(%s)',(direct_gallery,))
 ]:denial(a,query,args,'R19_PRESET_PROVIDER_INTEGRITY_READ_SUPPRESSED')
 denial(a,'select public.community_gallery_media_gateway_v1(%s)',(media,),
   'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
 denial(a,'select public.community_preset_storage_assert_media_not_quarantined_r19(%s)',
   (media,),'R19_PRESET_PROVIDER_GALLERY_MEDIA_READ_SUPPRESSED')
 denial(a,"""insert into public.search_documents(entity_id,work_id,work_type,creator_profile_id,title,published_at)
  values(%s,%s,'gallery',%s,'forbidden',now()) returning entity_id""",(gallery,gallery,creator),
  'R19_PRESET_PROVIDER_INTEGRITY_SEARCH_SUPPRESSED')
 snapshot=one(a,'select public.community_preset_storage_resolution_readiness_r19(%s,%s,3,1)',(actor,rid))
 assert snapshot['unresolvedIncidentCount']==1 and snapshot['versionFencedResolutionAuthorized'] is False
 assert snapshot['independentProviderVersionAndBytesRequired'] is True
 denial(a,'select public.community_preset_storage_resolution_readiness_r19(%s,%s,2,1)',
    (actor,rid),'R19_PRESET_RESOLUTION_STALE_VERSION_OR_FENCE')
 inventory=one(a,'select public.community_preset_storage_cleanup_inventory_r19(%s,%s)',
    (actor,res['publishedStorageKey']))
 assert inventory['historicalPresetReferenceCount']>=1
 assert inventory['historicalGalleryReferenceCount']>=1
 assert inventory['physicalDeleteAuthorized'] is False and inventory['cleanupClaimAuthorized'] is False
 assert inventory['allCurrentHistoricalAndCloudReferencesProven'] is False
 denial(a,'delete from private.preset_storage_work_read_suppressions_r19 where reservation_id=%s returning work_id',
   (rid,),'R19_PRESET_READ_SUPPRESSION_AUDIT_IMMUTABLE')
 a.execute('commit')
 for role in ['anon','authenticated']:
  assert not one(b,"select has_function_privilege(%s,'public.community_preset_storage_resolution_readiness_r19(uuid,uuid,bigint,bigint)','EXECUTE')",(role,))
  assert not one(b,"select has_function_privilege(%s,'public.community_preset_storage_cleanup_inventory_r19(uuid,text)','EXECUTE')",(role,))
 assert count(a,'public.artifact_blobs','where blob_id=(select committed_blob_id from private.preset_storage_reservations_r18 where reservation_id=%s)',(rid,))==1
 assert count(a,'public.community_works','where work_id in (%s,%s)',(work,gallery))==2
 assert one(a,"select enabled from private.preset_storage_release_gate_r18 where gate_key='verified_preset_publication'") is False
 print(json.dumps({'case':'R19_POSTCOMMIT_READ_SUPPRESSION_2PG_LOCAL_SYNTHETIC_ONLY',
  'twoRealPostgresBackends':True,'preIncidentReadAccepted':True,
  'afterIncidentPresetBlobGalleryReadsDenied':True,'searchRevokedAndReinsertionDenied':True,
  'priorGalleryRevisionProtected':True,'directGalleryLinkSuppressed':True,
  'authenticatedListsFiltered':True,'gatewaySqlDenies':True,
  'unrelatedGalleryPreserved':True,'incidentHistoryPreserved':True,
  'cleanupClaimAndPhysicalDeleteOff':True,'operatorResolutionOff':True,
  'realProviderUsed':False,'signedJwtUsed':False,'disposableSyntheticDatabaseOnly':True}))
