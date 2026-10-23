import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  reviewedV125GallerySubjectCandidates,
  validateGallerySubjectForEnrollment,
  GALLERY_SUBJECT_TARGET_V125
} from '../src/lib/integration/gallery-subject-provenance.ts';
import {
  GALLERY_DEPENDENCY_CONSUMER_V1,
  DEPENDENCY_KINDS,
  PUBLIC_PROJECTION_SURFACES,
  planGalleryRetirement
} from '../src/lib/integration/gallery-public-retirement.ts';

const source=reviewedV125GallerySubjectCandidates();
const verified=source[0];
const base={
  galleryWorkId:'w-gallery',ownerAccountId:'owner-a',mode:'delete',
  revisionPin:{
    galleryWorkId:'w-gallery',ownerAccountId:'owner-a',
    currentPublishedRevisionId:'revision-a'
  },
  dependencies:[],
  coverage:Object.fromEntries(DEPENDENCY_KINDS.map(k=>[k,'complete']))
};
const evidence={verifiedForWorkId:'w-gallery',verifiedRevisionId:'revision-a',alreadyIssuedUrlsRevoked:true};

test('authoritative v1.25 Gallery registry candidate comes from exact Core semantic island identity, not UI/screenshot',()=>{
  assert.equal(source.length,13);
  assert.equal(verified.subjectType,'floating_island');
  assert.equal(verified.canonicalTargetId,'1540000147');
  assert.equal(verified.baseItemId,null);
  assert.equal(verified.platform,'switch');
  assert.equal(verified.buildId,GALLERY_SUBJECT_TARGET_V125.buildId);
  assert.equal(validateGallerySubjectForEnrollment(verified).ok,true);
  assert.equal(verified.evidenceClass,'CONFIRMED_V125_SEMANTIC_LOCATION_ROUTE_PARITY');
  const audit=JSON.parse(fs.readFileSync(
    new URL('../tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json',import.meta.url),'utf8'));
  assert.equal(audit.summary.floatingIslandCount,13);
  for(const [index,row] of audit.floatingIslands.entries()){
    assert.equal(source[index].canonicalTargetId,String(row.sceneItemId));
    assert.equal(source[index].evidenceRef,
      'tests/fixtures/ddv-world/outdoor-location-routing-audit-v125.json#/floatingIslands/'+index+'/sceneItemId');
    assert.equal(validateGallerySubjectForEnrollment(source[index]).ok,true);
  }
});

test('all five classifications exist; unreviewed biome/room/ToM Base Item IDs are rejected, never guessed',()=>{
  for(const [subjectType,galleryKind] of [
    ['biome','outdoor'],['floating_island','outdoor'],
    ['room','indoor'],['tom_furniture','tom_furniture'],
    ['tom_clothing','tom_clothing']
  ]){
    const result=validateGallerySubjectForEnrollment({
      ...verified,subjectType,galleryKind,canonicalTargetId:'999',
      baseItemId:subjectType.startsWith('tom_')?40000049:null
    });
    assert.equal(result.ok,false,subjectType);
    assert.equal(result.code,'GALLERY_SUBJECT_NOT_IN_REVIEWED_AUTHORITY');
  }
  const badBase=validateGallerySubjectForEnrollment({...verified,subjectType:'tom_furniture',galleryKind:'tom_furniture',baseItemId:0});
  assert.equal(badBase.code,'GALLERY_SUBJECT_BASE_ITEM_UNVERIFIED');
});
test('wrong platform/build/schema, fabricated evidence, wrong subject/type are blocked',()=>{
  for(const mutation of [
    {platform:'steam'}, {gameVersion:'1.25.3'},
    {buildId:'9A239D3DB569756D'}, {profileSchema:626}
  ]){
    assert.equal(validateGallerySubjectForEnrollment({...verified,...mutation}).code,
      'GALLERY_SUBJECT_VERSION_PLATFORM_UNPROVEN');
  }
  assert.equal(validateGallerySubjectForEnrollment({...verified,evidenceSourceSha256:'1'.repeat(64)}).ok,false);
  assert.equal(validateGallerySubjectForEnrollment({...verified,galleryKind:'indoor'}).code,'GALLERY_SUBJECT_KIND_MISMATCH');
});
test('missing typed listings are UNKNOWN, not zero dependents',()=>{
  const p=planGalleryRetirement({...base,coverage:{scene:'partial'}});
  assert.equal(p.retirementAuthorized,false);
  assert.equal(p.code,'GALLERY_DEPENDENCY_COVERAGE_UNKNOWN');
  assert.ok(p.missing.includes('native_listing'));
  assert.ok(p.missing.includes('tom_clothing'));
});
test('active public linked preset blocks retirement even with otherwise complete graph/URL proof',()=>{
  const p=planGalleryRetirement({...base,issuedMediaRevocation:evidence,dependencies:[{
    kind:'scene',galleryWorkId:'w-gallery',dependentId:'pa-1',
    ownerAccountId:'owner-a',state:'public_active'
  }]});
  assert.equal(p.code,'GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED');
  assert.deepEqual(p.dependentKinds,['scene']);
});
test('ownership mismatch in registered graph fails closed',()=>{
  const p=planGalleryRetirement({...base,issuedMediaRevocation:evidence,dependencies:[{
    kind:'native_listing',galleryWorkId:'w-gallery',dependentId:'listing-1',
    ownerAccountId:'different',state:'historical_reference'
  }]});
  assert.equal(p.code,'GALLERY_DEPENDENCY_EDGE_UNVERIFIED');
});
test('Free local backup is not Wand Cloud private durability or restore proof',()=>{
  const p=planGalleryRetirement({
    ...base,mode:'unpublish_keep_private',issuedMediaRevocation:evidence,
    cloudPreservation:{provider:'local_pc',durablyStored:true,aclVerified:true,restoreVerified:true,
      ownerAccountId:'owner-a',galleryWorkId:'w-gallery'}
  });
  assert.equal(p.code,'GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED');
});
test('previously issued signed URL revocation must be proven; issuance revocation alone fails closed',()=>{
  const p=planGalleryRetirement({...base,issuedMediaRevocation:{newIssuanceDenied:true}});
  assert.equal(p.code,'GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN');
  assert.equal(p.retirementAuthorized,false);
});
test('even with all hypothetical prerequisites, pure planner never grants a DB publication transition',()=>{
  const p=planGalleryRetirement({...base,issuedMediaRevocation:evidence});
  assert.equal(p.code,'GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED');
  assert.equal(p.retirementAuthorized,false);
  assert.deepEqual(p.requiredSurfaces,PUBLIC_PROJECTION_SURFACES);
});
test('SQL extends PR #108 only via service read model and trigger, with no replacement Gallery public API',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20261024201000_gallery_retirement_negative_gate_v1.sql',import.meta.url),'utf8');
  assert.match(sql,/private.gallery_photo_dependency_snapshot_v1/);
  assert.match(sql,/GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN/);
  assert.match(sql,/gallery_revision_presets/);
  assert.match(sql,/associated_gallery_work_id/);
  assert.match(sql,/native_listing/);
  assert.match(sql,/grant execute on function private.gallery_photo_dependency_snapshot_v1\(uuid\)\s+to service_role/);
  assert.doesNotMatch(sql,/create or replace function public.community_publish_gallery_photo_v1/);
  assert.doesNotMatch(sql,/create or replace function public.community_delete_gallery_photo_v1/);
  assert.equal(GALLERY_DEPENDENCY_CONSUMER_V1.issuedUrlRevocationProven,false);
  assert.equal(GALLERY_DEPENDENCY_CONSUMER_V1.linkedRetirementCommand,null);
  assert.equal(GALLERY_DEPENDENCY_CONSUMER_V1.cloudKeepPrivateCommand,null);
});
test('reviewed seed contains exactly 13 Core-proven island IDs; no invented ToM/room/biome values',()=>{
  const sql=fs.readFileSync(new URL('../supabase/seeds/gallery-verified-subjects-v125-reviewed-20261024.sql',import.meta.url),'utf8');
  assert.match(sql,/1540000147/);
  assert.match(sql,/outdoor-location-routing-audit-v125.json/);
  assert.equal((sql.match(/sceneItemId'\)/g)||[]).length,13);
  assert.match(sql,/GALLERY_SUBJECT_EXISTING_EVIDENCE_CONFLICT/);
  assert.doesNotMatch(sql,/'tom_furniture'|'tom_clothing'|'room'|'biome'/);
});
