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
