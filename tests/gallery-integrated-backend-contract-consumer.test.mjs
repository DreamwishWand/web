import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseGalleryRetirementPreflight} from '../src/lib/community/gallery-preflight.js';
import {galleryStage1Catalogs} from '../src/lib/i18n/messages/community/gallery-stage1.js';

// Source pinned to backend #129 7ed57b73368a8ae5cfb4d3e7cb576c647577dfd8,
// migration 20261025002100_gallery_owner_preflight_dependency_coverage_projection_v1.sql.
// This fixture is a SYNTHETIC projection, not real signed staging owner approval.
const workId='66666666-6666-4666-8666-666666666666',rev='55555555-5555-4555-8555-555555555555';
const sha='a'.repeat(64);
const kinds=['scene','biome','floating_island','tom_furniture','tom_clothing','native_listing'];
const base={
 contract:'ddv.gallery-public-retirement-preflight@1',workId,rowVersion:9,revisionId:rev,
 ownerEligible:true,graphComplete:false,dependencyCoverage:{scene:'partial',native_listing:'unknown_not_deployed'},
 blockedReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],
 cloudEntitlementVerified:false,cloudPrivateStorageVerified:false,cloudOwnerRestoreVerified:false,
 previousSignedUrlsRevoked:false,cdnAndBrowserPurgeProven:false,
 dependencyCoverageContract:'ddv.gallery-cross-product-coverage@1',
 dependencyCoverageClassification:Object.fromEntries(kinds.map(k=>[k,k==='native_listing'?'REGISTRY_MISSING':'SEMANTICS_UNKNOWN'])),
 dependencyRelationCoverage:{gallery_work_revisions:'VERIFIED',gallery_revision_presets:'VERIFIED_EMPTY',
  preset_artifacts_associated_gallery_work_id:'REGISTRY_MISSING',creator_owner:'VERIFIED',
  media_and_cover:'03_COMM_CLOUD_PRESERVATION_PREFLIGHT'},
 dependencyMissingSources:['NATIVE_IN_GAME_LISTING_REGISTRY_NOT_DEPLOYED'],
 dependencyBlockedReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],
 dependencyGraphFingerprintSha256:sha,
 dependencySnapshotNotAtomicMutationFence:true,dependencySnapshotRowVersion:9,
 dependencySourceVersionState:'VERIFIED',
 dependencyOwnerMismatchEdgeCount:0,dependencyCreatorMismatchEdgeCount:0
};
const fixture=()=>structuredClone(base);
test('integrated #123 -> #126 -> #129 projection is read-only and source-aligned',()=>{
 const data=parseGalleryRetirementPreflight(fixture(),workId),dep=data.dependencyProjection;
 assert.equal(dep.coverageContract,'ddv.gallery-cross-product-coverage@1');
 assert.equal(dep.graphFingerprintSha256,sha);
 assert.equal(dep.sourceVersionState,'VERIFIED');
 assert.equal(dep.snapshotRowVersion,data.rowVersion);
 assert.equal(dep.classification.native_listing,'REGISTRY_MISSING');
 assert.equal(dep.relationCoverage.media_and_cover,'03_COMM_CLOUD_PRESERVATION_PREFLIGHT');
 assert.deepEqual(dep.missingSources,['NATIVE_IN_GAME_LISTING_REGISTRY_NOT_DEPLOYED']);
 assert.equal(dep.atomicMutationFence,false);
 assert.equal(dep.retirementAuthorized,false);
 assert.equal(dep.coverageVerified,false);
 for(const key of ['deleteEnabled','keepPrivateEnabled','restoreEnabled','republishEnabled'])
  assert.equal(data[key],false,key);
});
test('explicit mismatch / coverage blocks never promote fingerprint to authorization',()=>{
 for(const update of [
  x=>x.dependencyOwnerMismatchEdgeCount=1,
  x=>x.dependencyCreatorMismatchEdgeCount=2,
  x=>x.dependencyGraphFingerprintSha256='b'.repeat(64),
  x=>{x.dependencyMissingSources=[];x.dependencyBlockedReasons=[];
    for(const k of kinds)x.dependencyCoverageClassification[k]='VERIFIED_EMPTY'}
 ]){
  const item=fixture();update(item);
  const dep=parseGalleryRetirementPreflight(item,workId).dependencyProjection;
  assert.equal(dep.retirementAuthorized,false);
  assert.equal(dep.atomicMutationFence,false);
 }
});
test('malformed dependency fields, graph version/row mismatch and unknown contract fail-closed',()=>{
 const mutators=[
  x=>delete x.dependencyCoverageContract,
  x=>delete x.dependencyRelationCoverage,
  x=>x.dependencyCoverageContract='ddv.gallery-cross-product-coverage@2',
  x=>delete x.dependencyCoverageClassification.native_listing,
  x=>x.dependencyCoverageClassification.scene='COMPLETE',
  x=>x.dependencyRelationCoverage.media_and_cover={storage:'secret'},
  x=>x.dependencyMissingSources='none',
  x=>x.dependencyBlockedReasons=[23],
  x=>x.dependencyGraphFingerprintSha256='bad',
  x=>x.dependencyGraphFingerprintSha256='B'.repeat(64),
  x=>x.dependencySnapshotRowVersion=8,
  x=>x.dependencySnapshotNotAtomicMutationFence=false,
  x=>x.dependencyOwnerMismatchEdgeCount=-1,
  x=>x.dependencyCreatorMismatchEdgeCount='0',
  x=>x.dependencySourceVersionState='MADE_UP',
  x=>x.ownerEligible=false,
  x=>x.workId=rev,
  x=>x.rowVersion=10
 ];
 for(const mutate of mutators){
  const p=fixture();mutate(p);
  assert.throws(()=>parseGalleryRetirementPreflight(p,workId),{message:'GALLERY_PREFLIGHT_INVALID'});
 }
});
test('true legacy response omitting ALL projection keys remains UNKNOWN, no invented coverage',()=>{
 const p=fixture();
 for(const key of Object.keys(p).filter(x=>x.startsWith('dependency')&&x!=='dependencyCoverage'))
  delete p[key];
 const res=parseGalleryRetirementPreflight(p,workId);
 assert.equal(res.dependencyProjection,null);
 assert.equal(res.deleteEnabled,false);
});
test('source-pinned backend names and frontend model do not assert completeness',()=>{
 const view=fs.readFileSync(new URL('../src/routes/gallery/my/+page.svelte',import.meta.url),'utf8');
 const parser=fs.readFileSync(new URL('../src/lib/community/gallery-preflight.js',import.meta.url),'utf8');
 for(const label of ['depTitle','depDiagnosticOnly','depMissingSources','depOwnerMismatch','depCreatorMismatch','depFingerprint','depNative'])
  assert.match(view,new RegExp('galleryv1\\.'+label));
 for(const field of ['dependencyCoverageContract','dependencyCoverageClassification','dependencyRelationCoverage',
  'dependencyMissingSources','dependencyBlockedReasons','dependencyGraphFingerprintSha256',
  'dependencySnapshotRowVersion','dependencyOwnerMismatchEdgeCount','dependencyCreatorMismatchEdgeCount'])
  assert.ok(parser.includes(field),'missing backend SQL projection '+field);
 assert.doesNotMatch(view,/\{dep\.graphFingerprintSha256\}|\{dep\.missingSources\}|\{dep\.blockedReasons\}/);
 assert.doesNotMatch(view,/client\.command\('(?:deleteGalleryPhoto|unpublishKeepPrivate|galleryRestorePrivate)'/);
 for(const key of ['publishUpdate','unpublish','deleteWork'])
  assert.ok(view.includes('disabled aria-disabled="true">{t(\'galleryv1.'+key+'\''));
});
test('8 locales complete diagnostic copy and safeguards of prior Gallery transports',()=>{
 const keys=['depTitle','depDiagnosticOnly','depScene','depBiome','depIsland','depToMFurniture',
  'depToMClothing','depNative','depVerified','depVerifiedEmpty','depRegistryMissing',
  'depUnsupported','depUnknown','depSourceVersion','depRelationCoverage','depRelationsObserved',
  'depMissingSources','depBlockedReasons','depOwnerMismatch','depCreatorMismatch','depNoMismatch',
  'depMismatchFound','depFingerprint','depFingerprintObserved','depMissingDisclaimer','depLegacyUnknown'];
 for(const [lang,dic] of Object.entries(galleryStage1Catalogs)){
  assert.equal(keys.every(key=>Boolean(dic['galleryv1.'+key])),true,lang+' missing translation');
 }
 const owner=fs.readFileSync(new URL('../src/lib/gallery/OwnerGalleryMediaPreview.svelte',import.meta.url),'utf8');
 const publicBrowse=fs.readFileSync(new URL('../src/lib/gallery/GalleryStage1Browse.svelte',import.meta.url),'utf8');
 const publicDetail=fs.readFileSync(new URL('../src/lib/community/GalleryDetail.svelte',import.meta.url),'utf8');
 assert.match(owner,/readGalleryOwnerMedia/);
 assert.match(owner,/lease\.destroy/);
 assert.match(publicBrowse,/getGalleryPublicMedia/);
 assert.match(publicDetail,/getGalleryPublicMedia/);
});
