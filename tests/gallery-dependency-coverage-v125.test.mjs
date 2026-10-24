import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 classifyGalleryRetirementGraphV1,GALLERY_GRAPH_03_COMM_HANDOFF_V1,
 GALLERY_DEPENDENCY_COVERAGE_CONTRACT_V1
} from '../src/lib/integration/gallery-dependency-coverage-v125.ts';
import {GALLERY_DEPENDENCY_CONSUMER_V1} from '../src/lib/integration/gallery-public-retirement.ts';
const kinds=['scene','biome','floating_island','tom_furniture','tom_clothing','native_listing'];
const fingerprint='f'.repeat(64);
const revision='r-1';
const pin={galleryWorkId:'gallery',ownerAccountId:'a',currentPublishedRevisionId:revision,
 rowVersion:8,graphFingerprintSha256:fingerprint};
const snap={
 contract:'ddv.gallery-public-dependency-retirement@1',
 coverageContract:GALLERY_DEPENDENCY_COVERAGE_CONTRACT_V1,
 galleryWorkId:'gallery',galleryCurrentRevisionId:revision,
 galleryOwnerAccountId:'a',galleryCreatorProfileId:'c',
 galleryRowVersion:8,graphFingerprintSha256:fingerprint,
 snapshotNotAnAtomicMutationFence:true,
 sourceVersionState:'VERIFIED',
 workRevisions:[{workRevisionId:revision,revisionNumber:1,sealed:true,current:true}],
 workRevisionCount:1,currentRevisionExists:true,
 linkedPresetRevisionReferences:[],associatedPresetArtifacts:[],
 activeCurrentGalleryPresetRevisionLinks:0,ownerMismatchEdgeCount:0,creatorMismatchEdgeCount:0,
 relationCoverage:{gallery_revision_presets:'VERIFIED_EMPTY'},
 coverageClassification:Object.fromEntries(kinds.map(k=>[k,'SEMANTICS_UNKNOWN'])),
 missingDependencySources:['NATIVE_IN_GAME_LISTING_REGISTRY_NOT_DEPLOYED'],
 blockedRetirementReasons:['GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'],
 graphComplete:false,retirementAuthorized:false,issuedSignedUrlRevocationProven:false
};
const result=(s=snap,p=pin)=>classifyGalleryRetirementGraphV1(s,p);
test('no known dependency is not complete when registry is missing',()=>{
 const r=result();
 assert.equal(r.authorized,false);
 assert.equal(r.reason,'GALLERY_DEPENDENCY_COVERAGE_UNKNOWN');
 assert.equal(r.knownPublicDependents,0);
 assert.ok(r.missing.some(v=>v.startsWith('native_listing')));
});
test('strict snapshot/owner/current revision + concurrency fingerprint and version pin',()=>{
 for(const p of [
  {...pin,ownerAccountId:'other'},{...pin,graphFingerprintSha256:'0'.repeat(64)},
  {...pin,rowVersion:9},{...pin,currentPublishedRevisionId:'r-previous'}
 ])assert.equal(result(snap,p).reason,'GALLERY_DEPENDENCY_SNAPSHOT_CHANGED');
 assert.equal(result({...snap,graphFingerprintSha256:'bad'}).reason,'GALLERY_DEPENDENCY_SNAPSHOT_UNAVAILABLE');
 assert.equal(result({...snap,sourceVersionState:'VERSION_UNSUPPORTED'}).reason,'GALLERY_DEPENDENCY_VERSION_UNSUPPORTED');
 assert.equal(result({...snap,sourceVersionState:'SEMANTICS_UNKNOWN'}).reason,'GALLERY_DEPENDENCY_VERSION_UNSUPPORTED');
});
test('missing or unsealed current/historical WorkRevision fail closed',()=>{
 for(const mutation of [
  {currentRevisionExists:false},{galleryCurrentRevisionId:null},
  {workRevisions:[]},{workRevisions:[{...snap.workRevisions[0],sealed:false}]},
  {workRevisions:[...snap.workRevisions,{workRevisionId:'r-historic',revisionNumber:0,sealed:false,current:false}]}
 ])assert.equal(result({...snap,...mutation}).reason,
   mutation.galleryCurrentRevisionId===null?'GALLERY_DEPENDENCY_SNAPSHOT_CHANGED':'GALLERY_RETIREMENT_CURRENT_REVISION_UNVERIFIED');
});
test('cross-account ownership mismatch is never interpreted as authorization to retire',()=>{
 const s={...snap,ownerMismatchEdgeCount:1,creatorMismatchEdgeCount:1};
 assert.equal(result(s).reason,'GALLERY_DEPENDENCY_OWNER_MISMATCH');
});
test('current public Preset, historical Preset, ToM public and native listing absence',()=>{
 const linked={kind:'scene',galleryWorkId:'gallery',presetRevisionId:'pr-1',
  presetArtifactId:'pa',galleryRevisionId:revision,currentGalleryRevision:true,
  dependentCurrentPublished:true,presetWorkId:'preset-work',
  ownerAccountId:'a',creatorProfileId:'c',ownerMatchesGallery:true,
  creatorMatchesGallery:true,state:'public_active'};
 const p=result({...snap,linkedPresetRevisionReferences:[linked]});
 assert.equal(p.authorized,false);assert.equal(p.knownPublicDependents,1);
 const h=result({...snap,linkedPresetRevisionReferences:[{...linked,galleryRevisionId:'r0',
  currentGalleryRevision:false,state:'historical_reference',dependentCurrentPublished:false}]});
 assert.equal(h.knownPublicDependents,0);
 const tom=result({...snap,associatedPresetArtifacts:[{...linked,kind:'tom_furniture',state:'public_active'}]});
 assert.equal(tom.knownPublicDependents,1);
 assert.equal(tom.authorized,false);
 assert.equal(result({...snap,coverageClassification:{...snap.coverageClassification,native_listing:'REGISTRY_MISSING'}}).authorized,false);
});
test('even hypothetical complete dependency coverage cannot authorize mutation',()=>{
 const r=result({...snap,coverageClassification:Object.fromEntries(kinds.map(k=>[k,'VERIFIED_EMPTY'])),
  missingDependencySources:[]});
 assert.equal(r.reason,'GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED');
 assert.equal(r.authorized,false);
 assert.equal(GALLERY_GRAPH_03_COMM_HANDOFF_V1.deleteAuthorized,false);
});
test('additive SQL replaces ONLY service-owned private snapshot, never 03COMM publish/owner preflight',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261025002000_gallery_dependency_coverage_readonly_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/create or replace function private\.gallery_photo_dependency_snapshot_v1\(p_gallery_work_id uuid\)/);
 assert.match(sql,/gallery_revision_presets/);assert.match(sql,/preset_revision_publications/);
 assert.match(sql,/graphFingerprintSha256/);
 assert.match(sql,/sourceVersionState/);assert.match(sql,/REGISTRY_MISSING/);
 assert.match(sql,/SEMANTICS_UNKNOWN/);assert.match(sql,/VERIFIED_EMPTY/);
 assert.match(sql,/graphComplete',false/);
 assert.match(sql,/retirementAuthorized',false/);
 assert.match(sql,/issuedSignedUrlRevocationProven',false/);
 assert.match(sql,/grant execute on function private\.gallery_photo_dependency_snapshot_v1\(uuid\)\s+to service_role/);
 assert.doesNotMatch(sql,/create or replace function public\.community_publish_gallery_photo_v1/);
 assert.doesNotMatch(sql,/create or replace function public\.community_gallery_retirement_preflight_v1/);
 assert.doesNotMatch(sql,/update\s+public\.community_works/i);
 assert.doesNotMatch(sql,/delete\s+from\s+public\./i);
 assert.equal(GALLERY_DEPENDENCY_CONSUMER_V1.linkedRetirementCommand,null);
});
