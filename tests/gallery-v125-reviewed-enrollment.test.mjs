import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import manifest from '../static/ddv/core/gallery/v1.25/reviewed-tom-base-items-v125.json' with {type:'json'};
import {
  decodeReviewedBiomeV125,encodeReviewedBiomeV125,
  REVIEWED_BIOME_ALIASES_V125,reviewedV125AdditionalGallerySubjectCandidates,
  validateRoomPublicEnrollmentV125,TOM_V125_REVIEWED_AUDIT
} from '../src/lib/integration/gallery-reviewed-subjects-v125.ts';
import {
  reviewedV125GallerySubjectCandidates,reviewedAllV125GallerySubjectCandidates,
  validateGallerySubjectForEnrollment
} from '../src/lib/integration/gallery-subject-provenance.ts';
import {
  GALLERY_VERIFIED_SUBJECT_INTEGRATION_API_V1,
  bindVerifiedGallerySubjectLookupV1,galleryPublishAvailabilityV1
} from '../src/lib/integration/gallery-public-consumer-contract.ts';

const old=reviewedV125GallerySubjectCandidates();
const added=reviewedV125AdditionalGallerySubjectCandidates();
const f=added.filter(s=>s.subjectType==='tom_furniture');
const c=added.filter(s=>s.subjectType==='tom_clothing');
const biome=added.filter(s=>s.subjectType==='biome');

test('v1.25 raw lossless-source audit: native OR exact exhaustive 40+35 with 0 one-flag-only',()=>{
  assert.equal(manifest.source.sha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
  assert.equal(manifest.source.queryIndexSha256,'f3472e53bfcd55f13249cc79ddeae83ea71168fcb356c7038a0c0935eca2d06e');
  assert.deepEqual([TOM_V125_REVIEWED_AUDIT.concreteFurnitureDefinitions,TOM_V125_REVIEWED_AUDIT.concreteClothingDefinitions],[4949,1900]);
  assert.deepEqual([TOM_V125_REVIEWED_AUDIT.furnitureBothTrue,TOM_V125_REVIEWED_AUDIT.furnitureOneFlagTrue,TOM_V125_REVIEWED_AUDIT.clothingBothTrue,TOM_V125_REVIEWED_AUDIT.clothingOneFlagTrue],[40,0,35,0]);
  assert.equal(manifest.records.length,75);
  assert.equal(new Set(manifest.records.map(r=>r.itemId)).size,75);
  assert.equal(new Set(manifest.records.map(r=>r.rawPayloadSha256)).size,75);
  assert.equal(f.length,40);assert.equal(c.length,35);assert.equal(biome.length,4);
  for(const r of manifest.records){
    assert.ok(r.concreteType==='FurnitureItemData'||r.concreteType==='ClothingItemData');
    assert.ok(r.canAddDecals===true||r.canChangeColor===true);
    assert.equal(Math.trunc(r.itemId/1e7),r.concreteType==='FurnitureItemData'?4:5);
    assert.match(r.rawPayloadSha256,/^[a-f0-9]{64}$/);
  }
  for(const n of [40800010,40800011,40800012,40800026]){
    assert.equal(manifest.records.some(r=>r.itemId===n),false);
  }
});
test('existing 13 Floating Island sources and evidence remain identical in additive source',()=>{
  assert.equal(old.length,13);
  assert.equal(old[0].canonicalTargetId,'1540000147');
  assert.equal(old[12].canonicalTargetId,'1540000246');
  assert.equal(reviewedAllV125GallerySubjectCandidates().length,92);
  for(const row of old)assert.equal(validateGallerySubjectForEnrollment(row).ok,true);
});
test('all 79 new enrollment candidates have reviewed version, source pointers and strict base identity',()=>{
  assert.equal(added.length,79);
  for(const row of added){
    assert.equal(validateGallerySubjectForEnrollment(row).ok,true,JSON.stringify(row));
    assert.equal(row.buildId,'52BD625D9B4E0053');
    assert.equal(row.profileSchema,624);
    assert.equal(row.platform,'switch');
  }
  for(const row of [...f,...c]){
    assert.equal(row.canonicalTargetId,String(row.baseItemId));
    assert.ok(row.evidenceRef.includes('/items/'));
    assert.equal(row.evidenceSourceSha256,manifest.source.sha256);
    assert.match(row.rawPayloadSha256,/^[a-f0-9]{64}$/);
    assert.ok(row.canAddDecals || row.canChangeColor);
    assert.equal(row.concreteItemDataType,row.subjectType==='tom_furniture'?'FurnitureItemData':'ClothingItemData');
  }
});
test('Biome composite codec exact 4 pairs, canonical roundtrip and rejected collisions',()=>{
  assert.deepEqual(REVIEWED_BIOME_ALIASES_V125.map(r=>r.villageAreaType),[1,4,5,7]);
  for(const area of [1,4,5,7]){
    const encoded=encodeReviewedBiomeV125(1540000000,area);
    assert.deepEqual(decodeReviewedBiomeV125(encoded),{sceneItemId:1540000000,villageAreaType:area});
  }
  for(const value of ['1540000000','1540000000:0','1540000000:01','1540000000:44','01540000000:1','1540000000:4:1','1540000147:1','1540000000:-1']){
    assert.throws(()=>decodeReviewedBiomeV125(value));
  }
  assert.throws(()=>encodeReviewedBiomeV125(1540000147,1));
  assert.throws(()=>encodeReviewedBiomeV125(1540000000,8));
  assert.equal(new Set(biome.map(r=>r.canonicalTargetId)).size,4);
});
test('reject corrupt source, build, typed flags, wrong base, wrong concrete type and Motif/native Design alias',()=>{
  for(const s of [f[0],c[0],biome[0]]){
    for(const mutation of [{platform:'steam'},{gameVersion:'1.25.3'},{profileSchema:626},{buildId:'9A239D3DB569756D'},{evidenceSourceSha256:'0'.repeat(64)},{evidenceRef:'screen.jpg'}]){
      assert.equal(validateGallerySubjectForEnrollment({...s,...mutation}).ok,false);
    }
  }
  for(const mutation of [{baseItemId:50000211},{canonicalTargetId:'50000211'},{rawPayloadSha256:'0'.repeat(64)},{concreteItemDataType:'FurnitureAncientMachineItemData'},{subjectType:'tom_clothing',galleryKind:'tom_clothing'},{canonicalTargetId:'12345'},{evidenceClass:'SCREENSHOT_INFERENCE'}]){
    assert.equal(validateGallerySubjectForEnrollment({...f[0],...mutation}).ok,false);
  }
  assert.equal(validateGallerySubjectForEnrollment({...f[0],baseItemId:0}).code,'GALLERY_SUBJECT_BASE_ITEM_UNVERIFIED');
  assert.equal(validateGallerySubjectForEnrollment({...biome[0],canonicalTargetId:'1540000000:0'}).ok,false);
});
test('Room global seed is refused; save-local room IDs are not public identities',()=>{
  assert.equal(added.some(s=>s.subjectType==='room'),false);
  for(const row of [{houseItemID:40000000,floorIndex:0,roomSlot:0},{saveId:'private',houseItemID:40000000,floorIndex:0,roomSlot:1},null])
    assert.equal(validateRoomPublicEnrollmentV125(row).code,'GALLERY_ROOM_OWNER_PROFILE_SCOPE_UNPROVEN');
});
test('SQL seed is additive, conflict-checked, idempotent and contains exactly 79 reviewed subjects',()=>{
  const seed=fs.readFileSync(new URL('../supabase/seeds/gallery-verified-subjects-v125-four-kinds-20261024.sql',import.meta.url),'utf8');
  assert.equal((seed.match(/\('tom_furniture','tom_furniture'/g)||[]).length,40);
  assert.equal((seed.match(/\('tom_clothing','tom_clothing'/g)||[]).length,35);
  assert.equal((seed.match(/\('outdoor','biome'/g)||[]).length,4);
  assert.match(seed,/GALLERY_SUBJECT_EXISTING_EVIDENCE_CONFLICT/);
  assert.match(seed,/base_item_id is distinct from rec.base_item_id/);
  assert.match(seed,/for update/);
  assert.doesNotMatch(seed,/1540000147/);
  assert.doesNotMatch(seed,/40800010/);
  assert.doesNotMatch(seed,/\('indoor','room'/);
  assert.doesNotMatch(seed,/create or replace function public.community_publish_gallery_photo_v1/);
  for(const row of added){assert.ok(seed.includes(row.evidenceRef),row.canonicalTargetId);}
});
test('PR118 public-query contract is sole reader; unreviewed public subjects never become publishable',()=>{
  assert.equal(GALLERY_VERIFIED_SUBJECT_INTEGRATION_API_V1.verifiedSubjectCatalogRead,'community_list_verified_gallery_subjects_v1');
  assert.equal(GALLERY_VERIFIED_SUBJECT_INTEGRATION_API_V1.linkedRetirement,'NOT_AUTHORIZED');
  assert.equal(GALLERY_VERIFIED_SUBJECT_INTEGRATION_API_V1.keepPrivateCloud,'NOT_AUTHORIZED');
  assert.equal(GALLERY_VERIFIED_SUBJECT_INTEGRATION_API_V1.issuedMediaUrlImmediateRevocation,'NOT_PROVEN');
  const subject={...f[0],subjectId:'11111111-2222-3333-4444-555555555555',displayName:null,displayIdentity:f[0].canonicalTargetId,verificationState:'verified'};
  assert.equal(galleryPublishAvailabilityV1(subject).status,'READY');
  assert.equal(galleryPublishAvailabilityV1({...subject,subjectId:'native-design-id'}).status,'BLOCKED');
  assert.equal(galleryPublishAvailabilityV1({...subject,canonicalTargetId:'50000211'}).status,'BLOCKED');
  const p={contract:'ddv.gallery-verified-subject-public-lookup@1',subjects:[subject],catalogStatus:'partial_verified_only',displayNamesVerified:false};
  assert.equal(bindVerifiedGallerySubjectLookupV1(p).status,'READY');
  assert.equal(bindVerifiedGallerySubjectLookupV1({...p,subjects:[{...subject,subjectType:'room'}]}).status,'BLOCKED');
  assert.equal(bindVerifiedGallerySubjectLookupV1({...p,displayNamesVerified:true}).status,'BLOCKED');
});
