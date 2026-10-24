import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 GALLERY_REGISTRY_AUDIT_V125,
 GALLERY_PUBLIC_REFERENCE_PATH_AUDIT_V125,
 RETIREMENT_SHARED_FENCE_REQUIRED_V1,
 assessGalleryAtomicRetirementPreconditionsV1
} from '../src/lib/integration/gallery-atomic-retirement-preconditions-v125.ts';

const basic={
  gamePlatform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',
  profileSchema:624,allReferenceWritersSerializingOnOneGalleryFence:false,
  allProductRegistriesClosed:false,immutabilityAndCurrentPublicationValidated:false,
  staleReadRecheckedUnderDbLocks:false,ownerAndVisibilityRevalidatedUnderDbLocks:false,
  issuedUrlsAndCdnPrivacyAccepted:false,cloudPrivateDurabilityAccepted:false,
  serverOwnedAtomicDelistImplemented:false
};
test('shared publisher/Work Search/saved links are not complete Gallery reverse-reference registry',()=>{
  assert.deepEqual(GALLERY_REGISTRY_AUDIT_V125.map(v=>v.kind),[
    'scene','biome','floating_island','tom_furniture','tom_clothing','native_listing']);
  for(const entry of GALLERY_REGISTRY_AUDIT_V125){
    assert.equal(entry.sourceBackedCompleteGalleryReverseReferences,false);
    assert.ok(entry.reason);
    assert.equal(entry.coverage,entry.kind==='native_listing'?'REGISTRY_MISSING':'SEMANTICS_UNKNOWN');
    if(entry.kind!=='native_listing'){
      assert.equal(entry.sharedPresetPublisherDeployed,true);
      assert.equal(entry.sharedPublicationMappingDeployed,true);
    }
  }
  assert.equal(GALLERY_PUBLIC_REFERENCE_PATH_AUDIT_V125.savedItemDoesNotConferOwnership,true);
  assert.equal(GALLERY_PUBLIC_REFERENCE_PATH_AUDIT_V125.nativeLocalBackupIsNotServerPublicListing,true);
  assert.ok(GALLERY_PUBLIC_REFERENCE_PATH_AUDIT_V125.galleryRevisionPreset.includes('gallery_revision_presets'));
});
test('no known dependency and missing registry refuse positive retirement',()=>{
 const r=assessGalleryAtomicRetirementPreconditionsV1(basic);
 assert.equal(r.readOnly,true);assert.equal(r.operationAuthorized,false);
 assert.equal(r.graphComplete,false);assert.equal(r.missingKinds.length,6);
 assert.ok(r.blockedReasons.includes('GALLERY_DEPENDENCY_PUBLIC_REGISTRY_NAMESPACE_INCOMPLETE'));
 assert.ok(r.blockedReasons.includes('GALLERY_DEPENDENCY_SNAPSHOT_UNAVAILABLE'));
});
test('wrong Switch version/Steam and incomplete lock/fingerprint are rejected independently',()=>{
 for(const patch of [{gamePlatform:'steam'},{gameVersion:'1.25.3'},
    {buildId:'9A239D3DB569756D'},{profileSchema:626}]){
   const r=assessGalleryAtomicRetirementPreconditionsV1({...basic,...patch});
   assert.ok(r.blockedReasons.includes('GALLERY_DEPENDENCY_GAME_VERSION_UNSUPPORTED'));
 }
 for(const reason of [
 'GALLERY_DEPENDENCY_SHARED_WRITER_FENCE_UNPROVEN',
 'GALLERY_DEPENDENCY_FINGERPRINT_NOT_ATOMIC_LOCK',
 'GALLERY_DEPENDENCY_REVISION_PUBLICATION_SEMANTICS_UNPROVEN',
 'GALLERY_DEPENDENCY_OWNER_VISIBILITY_LOCK_UNPROVEN',
 'GALLERY_PREVIOUS_SIGNED_URL_REPLAY_UNPROVEN',
 'GALLERY_CLOUD_PRIVATE_DURABILITY_UNVERIFIED']){
    assert.ok(assessGalleryAtomicRetirementPreconditionsV1(basic).blockedReasons.includes(reason));
 }
 assert.ok(RETIREMENT_SHARED_FENCE_REQUIRED_V1.some(x=>x.includes('associated_gallery_work_id')));
 assert.ok(RETIREMENT_SHARED_FENCE_REQUIRED_V1.some(x=>x.includes('gallery_revision_presets')));
});
test('even caller-forged all-green flags never yield positive retirement',()=>{
 const yes={
   ...basic,allReferenceWritersSerializingOnOneGalleryFence:true,
   allProductRegistriesClosed:true,immutabilityAndCurrentPublicationValidated:true,
   staleReadRecheckedUnderDbLocks:true,ownerAndVisibilityRevalidatedUnderDbLocks:true,
   issuedUrlsAndCdnPrivacyAccepted:true,cloudPrivateDurabilityAccepted:true,
   serverOwnedAtomicDelistImplemented:true
 };
 const r=assessGalleryAtomicRetirementPreconditionsV1(yes);
 assert.equal(r.operationAuthorized,false);
 assert.equal(r.graphComplete,false);
 assert.ok(r.blockedReasons.includes('GALLERY_POSITIVE_RETIREMENT_NOT_IMPLEMENTED'));
 assert.ok(r.blockedReasons.includes('GALLERY_DEPENDENCY_PUBLIC_REGISTRY_NAMESPACE_INCOMPLETE'));
});
test('read-only transaction acceptance never creates mutation authority',()=>{
 const sql=fs.readFileSync(new URL('../supabase/staging/acceptance/gallery-atomic-retirement-preconditions-negative-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/begin\s*;/i);
 assert.match(sql,/rollback\s*;/i);
 assert.match(sql,/for update/i);
 assert.match(sql,/gallery_photo_dependency_snapshot_v1/);
 assert.match(sql,/GALLERY_ATOMIC_RETIREMENT_NOT_AUTHORIZED/);
 assert.match(sql,/community_publish_preset_envelope/);
 assert.match(sql,/gallery_revision_presets/);
 assert.match(sql,/preset_revision_publications/);
 assert.doesNotMatch(sql,/create\s+or\s+replace\s+function/i);
 assert.doesNotMatch(sql,/delete\s+from\s+public\./i);
 assert.doesNotMatch(sql,/update\s+public\./i);
});
