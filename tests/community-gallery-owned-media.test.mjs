import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 assertGalleryPhotoMediaV1,validateGalleryOwnerUploadFileV1,
 uploadGalleryOwnerMediaV1,GALLERY_OWNER_MEDIA_FLOW_V1
} from '../src/lib/community/gallery-owner-media-contract.ts';

const sample={mediaId:'m-1',storageKey:'u/f.png',state:'ready',
 moderationState:'clear',mimeType:'image/png',byteSize:127,
 width:8,height:8,checksumSha256:'a'.repeat(64),replayed:false};

test('gallery owner media contract reuses existing Community Media and canonical publisher',()=>{
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.mediaEdge,'community-media');
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.publishCommand,'publishGalleryPhoto');
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.maxImages,10);
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.maxBytesEach,20971520);
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.signedUploadLifetimeSeconds,7200);
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.cleanupIsAutomatic,true);
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.cleanupUsesExistingRetentionCron,true);
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.cleanupOwnerCallQueuesOnly,true);
 assert.equal(GALLERY_OWNER_MEDIA_FLOW_V1.deleteAuthorized,false);
 assert.deepEqual(assertGalleryPhotoMediaV1([sample],sample.mediaId),['m-1']);
});
test('invalid and duplicated media / invalid cover / non READY blocked locally',()=>{
 const bad=[
  [[], 'm-1'], [[sample],'m-2'], [[sample,sample],'m-1'],
  [[{...sample,state:'quarantined'}],'m-1'],
  [[{...sample,moderationState:'pending'}],'m-1'],
  [[{...sample,byteSize:20971521}],'m-1'],
  [[{...sample,checksumSha256:'bad'}],'m-1'],
 ];
 for(const [files,cover] of bad)assert.throws(()=>assertGalleryPhotoMediaV1(files,cover));
 for(const mimeType of ['image/gif','image/svg+xml','text/html']){
  assert.throws(()=>validateGalleryOwnerUploadFileV1({mimeType,byteSize:128}));
 }
 assert.throws(()=>validateGalleryOwnerUploadFileV1({mimeType:'image/png',byteSize:0}));
});
test('owner upload correctly returns server READY and compensates errors with abort',async()=>{
 const actions=[];
 const transport={
  prepare:async()=>{actions.push('prepare');return {ok:true,action:'galleryPrepare',storageKey:'signed/k.png',maxBytes:20971520,signedUpload:{token:'x'}};},
  upload:async()=>{actions.push('upload');},
  finalize:async()=>{actions.push('finalize');return {...sample,storageKey:'signed/k.png'};},
  abort:async()=>{actions.push('abort');return {aborted:true,alreadyAborted:false,cleanupEligibleAt:'after-token-expiry'};},
  cleanup:async()=>({queued:true,alreadyClaimed:false}),
  publish:async()=>{throw new Error('should not publish in upload');}
 };
 const answer=await uploadGalleryOwnerMediaV1(transport,{mimeType:'image/png',byteSize:127},new Uint8Array(127));
 assert.equal(answer.ready.mediaId,'m-1');
 assert.deepEqual(actions,['prepare','upload','finalize']);
 actions.length=0;
 await assert.rejects(uploadGalleryOwnerMediaV1({...transport,upload:async()=>{actions.push('upload');throw new Error('offline');}},
  {mimeType:'image/png',byteSize:127},new Uint8Array(127)),/offline/);
 assert.deepEqual(actions,['prepare','upload','abort']);
});
test('abort failure is an explicit recovery obligation',async()=>{
 const transport={
 prepare:async()=>({storageKey:'s/k',signedUpload:{}}),
 upload:async()=>{throw Error('failed-upload')},
 finalize:async()=>{throw Error('not called')},
 abort:async()=>{throw Error('failed-abort')}
 };
 await assert.rejects(uploadGalleryOwnerMediaV1(transport,{mimeType:'image/png',byteSize:127},new Uint8Array(127)),
   /GALLERY_UPLOAD_ABORT_REQUIRES_RETRY/);
});
test('storage existence preflight is enforced inside canonical community-command before SQL publish',()=>{
 const src=fs.readFileSync(new URL('../supabase/functions/community-command/index.ts',import.meta.url),'utf8');
 assert.match(src,/community_gallery_photo_owned_media_manifest_v1/);
 assert.match(src,/\.info\(String\(item.storageKey\)\)/);
 assert.match(src,/GALLERY_MEDIA_STORAGE_OBJECT_UNAVAILABLE/);
 assert.match(src,/if \(command === 'publishGalleryPhoto'\)/);
 const media=fs.readFileSync(new URL('../supabase/functions/community-media/index.ts',import.meta.url),'utf8');
 for(const action of ['galleryPrepare','galleryFinalize','galleryAbort','galleryCleanup']){
   assert.ok(media.includes(action));
 }
 assert.match(media,/community_gallery_media_intent_complete_v1/);
 assert.match(media,/community_gallery_media_intent_enqueue_cleanup_v1/);
 assert.doesNotMatch(media,/community_gallery_media_intent_cleanup_finish_v1/);
});
test('database abort/cleanup and immutable Gallery publish security share the original models',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261024234000_community_gallery_owner_upload_intent_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/community_media_reject_aborted_gallery_upload/);
 assert.match(sql,/community_media_lock_ready_gallery_link/);
 assert.match(sql,/for share/);
 assert.match(sql,/expires_at\+interval '5 minutes'/);
 assert.match(sql,/community_gallery_photo_owned_media_manifest_v1/);
 assert.match(sql,/revoke all on public.community_media_upload_intents from public,anon,authenticated/);
 const receipt=fs.readFileSync(new URL('../supabase/staging/acceptance/gallery-owner-media-public-v1.sql',import.meta.url),'utf8');
 assert.match(receipt,/PUBLIC_CREATE_WRONG_CANONICAL_SUBJECT/);
 assert.match(receipt,/IMMUTABLE_UPDATE_INVALID/);
 assert.match(receipt,/STALE_UPDATE_ACCEPTED/);
 assert.match(receipt,/rollback;\s*$/);
});

test('existing hourly Vault-authenticated retention worker owns Gallery orphan Storage deletion',()=>{
 const retention=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
 assert.match(retention,/community_verify_worker_token/);
 assert.match(retention,/community_claim_gallery_media_orphans_v1/);
 assert.match(retention,/community_complete_gallery_media_orphan_v1/);
 assert.match(retention,/community_fail_gallery_media_orphan_v1/);
 assert.match(retention,/GALLERY_ORPHAN_STORAGE_REMOVAL_NOT_CONFIRMED/);
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261024235000_community_gallery_orphan_retention_worker_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/for update skip locked limit p_limit/);
 assert.match(sql,/cleanup_lease_token/);
 assert.match(sql,/community_gallery_media_intent_enqueue_cleanup_v1/);
 assert.match(sql,/GALLERY_CLEANUP_WORKER_ONLY/);
 assert.match(sql,/gallery_media_orphan_cleaned/);
 const acceptance=fs.readFileSync(new URL('../supabase/staging/acceptance/gallery-orphan-retention-worker-v1.sql',import.meta.url),'utf8');
 assert.match(acceptance,/REFERENCED_MEDIA_CLAIMED_FOR_DELETION/);
 assert.match(acceptance,/ACTIVE_LEASE_DOUBLE_CLAIMED/);
 assert.match(acceptance,/FAILED_RETRY_NOT_RECORDED/);
 assert.match(acceptance,/rollback;\s*$/);
});

test('Product #128 conditional 72h retention is server-authoritative, immutable and PHYSICAL TTL OFF',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261024235900_community_gallery_immutable_finalize_capacity_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/new\.finalized_at:=clock_timestamp\(\)/);
 assert.match(sql,/GALLERY_FINALIZATION_IDENTITY_IMMUTABLE/);
 assert.match(sql,/physical_expiry_deletion_accepted boolean not null default false/);
 assert.match(sql,/check\(physical_expiry_deletion_accepted=false\)/);
 assert.match(sql,/expiry_enabled boolean not null default false/);
 assert.match(sql,/new\.reuse_expires_at:=new\.finalized_at\+interval '72 hours'/);
 assert.match(sql,/new\.reuse_expires_at:=null/);
 assert.match(sql,/community_gallery_media_owner_status_v1/);
 assert.match(sql,/'ttlActive',false/);
 assert.match(sql,/'reuseExpiresAt',null/);
 const worker=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
 assert.match(worker,/community_gallery_media_capacity_ops_v1/);
 assert.doesNotMatch(worker,/community_claim_expired_finalized_gallery_media_v1/);
});
test('Gallery prepare serializes quota 10 intents / 200 MiB and protects existing legal holds',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261024235900_community_gallery_immutable_finalize_capacity_v1.sql',import.meta.url),'utf8');
 const hold=fs.readFileSync(new URL('../supabase/migrations/20261025000100_community_gallery_account_hold_cleanup_guard_v1.sql',import.meta.url),'utf8');
 const media=fs.readFileSync(new URL('../supabase/functions/community-media/index.ts',import.meta.url),'utf8');
 const fixture=fs.readFileSync(new URL('../supabase/staging/acceptance/gallery-finalized-retention-capacity-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/max_active_unbound integer not null default 10/);
 assert.match(sql,/max_reserved_bytes bigint not null default 209715200/);
 assert.match(sql,/from public\.wand_accounts where account_id=v_account for update/);
 assert.match(sql,/GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED/);
 assert.match(sql,/GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED/);
 assert.match(sql,/sum\(expected_bytes\) filter\(where not durable\)/);
 assert.match(sql,/where i\.owner_account_id=p_account/);
 assert.match(hold,/private\.account_retention_holds/);
 assert.match(hold,/GALLERY_UPLOAD_RETENTION_HOLD/);
 assert.match(hold,/ACCOUNT_RETENTION_HOLD/);
 assert.match(media,/action === 'galleryStatus'/);
 assert.match(media,/action === 'galleryCapacity'/);
 assert.match(media,/OUTSTANDING_COUNT_EXCEEDED/);
 assert.match(fixture,/FINALIZE_REPLAY_RESET_CLOCK/);
 assert.match(fixture,/ABORTED_BYTES_QUOTA_BYPASS/);
 assert.match(fixture,/DURABLE_REVISION_QUOTA_RELEASE_FAILED/);
 assert.match(fixture,/LEGAL_HOLD_ABORT_ACCEPTED/);
 assert.match(fixture,/HELD_ORPHAN_CLAIMED/);
 assert.match(fixture,/rollback;\s*$/);
});

test('global Gallery backpressure serializes all owner Prepare and suppresses stalled queues',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261025000300_gallery_global_backpressure_v1.sql',import.meta.url),'utf8');
 const fixture=fs.readFileSync(new URL('../supabase/staging/acceptance/gallery-global-backpressure-v1.sql',import.meta.url),'utf8');
 const edge=fs.readFileSync(new URL('../supabase/functions/community-media/index.ts',import.meta.url),'utf8');
 assert.match(sql,/global_unbound_intent_ceiling integer/);
 assert.match(sql,/global_reserved_byte_ceiling bigint/);
 assert.match(sql,/global_oldest_due_max_hours integer/);
 assert.match(sql,/from private\.gallery_media_capacity_policy_v1[\s\S]*?for update/);
 assert.match(sql,/from public\.wand_accounts where account_id=v_account for update/);
 assert.match(sql,/GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED/);
 assert.match(sql,/GALLERY_GLOBAL_RESERVED_BYTES_EXCEEDED/);
 assert.match(sql,/GALLERY_GLOBAL_CLEANUP_STALLED/);
 assert.match(sql,/community_gallery_global_capacity_alert_v1/);
 assert.match(edge,/GALLERY_GLOBAL_/);
 assert.match(fixture,/GLOBAL_21ST_ADMISSION_ACCEPTED/);
 assert.match(fixture,/OLD_GLOBAL_CLEANUP_BYPASSED/);
 assert.match(fixture,/CAPACITY_RECOVERY_STUCK/);
});
test('unsanctioned physical Gallery object removal cannot be launched by hourly Cron',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261025000400_gallery_physical_delete_failclosed_v1.sql',import.meta.url),'utf8');
 const worker=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
 assert.match(sql,/physical_orphan_cleanup_accepted=false/);
 assert.match(sql,/physicalDeleteAuthorized',false/);
 assert.match(worker,/community_gallery_physical_cleanup_gate_v1/);
 assert.match(worker,/if\(cleanupGate\?\.physicalDeleteAuthorized!==true\)/);
 assert.match(worker,/community_gallery_global_capacity_alert_v1/);
 assert.match(worker,/cleanupBlocked/);
 assert.match(worker,/GALLERY_GLOBAL_ALERT_UNAVAILABLE/);
});

test('hourly operator reconciles Storage origin bytes with MediaAsset and Intent journal without deleting',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261025000700_gallery_storage_origin_reconciliation_v1.sql',import.meta.url),'utf8');
 const worker=fs.readFileSync(new URL('../supabase/functions/community-retention/index.ts',import.meta.url),'utf8');
 const fixture=fs.readFileSync(new URL('../supabase/staging/acceptance/gallery-origin-reconciliation-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/left join public\.media_assets m on m\.storage_key=o\.name/);
 assert.match(sql,/left join public\.community_media_upload_intents i on i\.storage_key=o\.name/);
 assert.match(sql,/originUntrackedObjectCount/);
 assert.match(sql,/finalizedReadyMissingOriginCount/);
 assert.match(sql,/registeredOriginSizeMismatchCount/);
 assert.match(sql,/physicalRemovalAccepted',false/);
 assert.match(sql,/safeToAutoDelete',false/);
 assert.match(sql,/revoke all on function public\.community_gallery_storage_reconciliation_v1/);
 assert.match(worker,/community_gallery_storage_reconciliation_v1/);
 assert.match(worker,/galleryOriginIntegrity/);
 assert.match(worker,/GALLERY_ORIGIN_RECONCILIATION_UNAVAILABLE/);
 assert.match(fixture,/MISSING_ORIGIN_NOT_DETECTED/);
 assert.match(fixture,/RECONCILIATION_ACL_UNSAFE/);
 assert.match(fixture,/rollback;\s*$/);
});
