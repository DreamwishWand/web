// 04 QR #130: no-credentials integrated source acceptance, not real signed E2E.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {BACKEND_SHA} from '../scripts/community-gallery-signed-acceptance.mjs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const dir=new URL('../supabase/migrations/',import.meta.url);
const migration=(timestamp,part)=>'supabase/migrations/'+timestamp+'_'+part+'.sql';

test('merged QR migration set has one migration per version and ordered 020–024',()=>{
 const files=readdirSync(dir).filter(p=>/^\d{14}_.+\.sql$/.test(p));
 const versions=files.map(p=>p.slice(0,14));
 assert.equal(new Set(versions).size,versions.length,'duplicate migration version would stop fresh bootstrap');
 assert.ok(versions.includes('20261025002000'));
 assert.ok(versions.includes('20261025002100'));
 assert.ok(versions.includes('20261025002200'));
 assert.ok(versions.includes('20261025002300'));
 assert.ok(versions.includes('20261025002400'));
 assert.equal(files.filter(p=>p.startsWith('20261025002200_')).length,1);
 assert.match(read(migration('20261025002200','gallery_abort_cover_only_reference_guard_v1')),/gallery_photo_revision_fields/);
 assert.match(read(migration('20261025002300','gallery_capacity_effective_cleanup_diagnostics_v1')),/effectivePhysicalCleanupPerHour/);
 assert.match(read(migration('20261025002400','gallery_known_reference_writer_fence_v1')),/gallery_known_reference_writer_fence_v1/);
});
test('known reference writer fence participates in three scoped writers but does NOT unlock retirement',()=>{
 const m=read(migration('20261025002400','gallery_known_reference_writer_fence_v1'));
 for(const name of ['gallery_revision_presets','preset_artifacts','preset_revision_publications']){
  assert.match(m,new RegExp('on public\\.'+name));
 }
 assert.match(m,/for update/i);
 assert.match(m,/distinct.+order by/i);
 assert.match(m,/GALLERY_REFERENCE_FENCE_/);
 assert.match(m,/DOES NOT fence public preset Work visibility/);
 assert.doesNotMatch(m,/create\s+or\s+replace\s+function\s+public\.community_delete_gallery_photo_v1/i);
});
test('cover-only referenced image cannot be logically aborted, physical cleanup stays OFF',()=>{
 const m=read(migration('20261025002200','gallery_abort_cover_only_reference_guard_v1'));
 assert.match(m,/gallery_photo_revision_fields where cover_media_id=v_media\.media_id/);
 assert.match(m,/GALLERY_MEDIA_ALREADY_BOUND/);
 assert.match(m,/account_retention_holds/);
 assert.match(m,/state='aborted'/);
 assert.doesNotMatch(m,/storage\.from\(.+\)\.remove\(/);
 const gate=read(migration('20261025000400','gallery_physical_delete_failclosed_v1'));
 assert.match(gate,/physical_orphan_cleanup_accepted/i);
 assert.match(gate,/false/i);
});
test('capacity reports real effective cleanup zero, not nominal 20/h as actual throughput',()=>{
 const m=read(migration('20261025002300','gallery_capacity_effective_cleanup_diagnostics_v1'));
 for(const item of [
   "'physicalCleanupCurrentlyAuthorized',false",
   "'effectivePhysicalCleanupPerHour',0",
   "'nominalWorkerClaimCapacityPerHour',20",
   "'finalized72hExpiryActive',false",
   "'providerStorageThroughputBenchmarked',false",
   "'safeCapacityCeilingsProven',false"
 ])assert.ok(m.includes(item),item);
 assert.match(m,/revok(e|ed) all on function public\.community_gallery_media_capacity_ops_v1\(\) from public,anon,authenticated/i);
});
test('owner dependency and Cloud preflight remain read-only and fail-closed',()=>{
 const projection=read(migration('20261025002100','gallery_owner_preflight_dependency_coverage_projection_v1'));
 const cloud=read(migration('20261025001000','gallery_cloud_preservation_readiness_v1'));
 const query=read('supabase/functions/community-query/index.ts');
 assert.match(projection,/dependency/i);
 assert.match(cloud,/cloudEntitlementVerified/);
 assert.match(cloud,/operationAuthorized/);
 assert.match(query,/galleryRetirementPreflight: 'community_gallery_retirement_preflight_v1'/);
 assert.match(query,/community_authorize_session/);
 assert.match(read('supabase/functions/community-command/index.ts'),/publishGalleryPhoto: 'community_publish_gallery_photo_v1'/);
});
test('Edge contract matches runner: owner JWT binary, public checksum and signed upload',()=>{
 const media=read('supabase/functions/community-media/index.ts');
 const publicMedia=read('supabase/functions/community-public-media/index.ts');
 for(const op of ['galleryPrepare','galleryFinalize','galleryStatus','galleryReadBytes','galleryAbort'])
  assert.ok(media.includes(op),op);
 assert.match(media,/community_authorize_session/);
 assert.match(media,/GALLERY_OWNER_MEDIA_CHECKSUM_MISMATCH/);
 assert.match(publicMedia,/GALLERY_MEDIA_STORAGE_CHECKSUM_MISMATCH/);
 assert.match(publicMedia,/rawStorageSignedUrlIssued:false/);
 assert.match(publicMedia,/CDN-Cache-Control/);
 assert.match(publicMedia,/no-store/);
});
test('real runner source-pinning was updated to the inspected synchronized backend',()=>{
 assert.equal(BACKEND_SHA,'02750fcbcfd3f94fc12b39c8adf5757fa24a5646');
 const workflow=read('.github/workflows/community-public-browser-acceptance.yml');
 assert.match(workflow,/signed_gallery/);
 assert.match(workflow,/environment: staging-gallery-signed-acceptance/);
 assert.match(workflow,/workflow_dispatch/);
 const source=read('scripts/community-gallery-signed-acceptance.mjs');
 assert.match(source,/DB_MIGRATION_ATTESTATION_REQUIRED/);
 assert.match(source,/EDGE_VERSIONS_ATTESTATION_REQUIRED/);
 assert.match(source,/DISPOSABLE_SCOPE_NOT_APPROVED/);
 assert.doesNotMatch(source,/service_role['"]|\.storage\.from\(.+\)\.remove\(/);
});


test('latest 03 COMM origin integrity classification is typed and fail-closed; worker emits 503 on UNKNOWN',async()=>{
 const {classifyGalleryOriginIntegrity: classify}=await import('../supabase/functions/_shared/gallery-origin-integrity.mjs');
 const normal={contract:'ddv.gallery-storage-reconciliation@1',bucketChecked:true,safeToAutoDelete:false,
  originObjectCount:2,originJournaledObjectCount:0,originRegisteredObjectCount:2,originUntrackedObjectCount:0,
  originMetadataRecordedBytes:135,originMetadataSizeUnknownCount:0,untrackedOriginBytes:0,
  journaledUnregisteredObjectCount:0,registeredWithoutGalleryIntentCount:2,
  registeredOriginSizeMismatchCount:0,finalizedReadyMissingOriginCount:0,abortedOriginWaitingRemovalCount:0};
 assert.equal(classify(normal),'normal');
 assert.equal(classify({...normal,originUntrackedObjectCount:1}),'critical');
 assert.equal(classify({...normal,originMetadataSizeUnknownCount:1}),'unknown');
 assert.equal(classify({...normal,originObjectCount:null}),'unknown');
 assert.equal(classify({...normal,registeredOriginSizeMismatchCount:'0'}),'unknown');
 assert.equal(classify({...normal,contract:'old'}),'unknown');
 const worker=read('supabase/functions/community-retention/index.ts');
 assert.match(worker,/classifyGalleryOriginIntegrity\(/);
 assert.match(worker,/galleryOrphans\.workerFailure='GALLERY_ORIGIN_RECONCILIATION_INVALID'/);
 assert.match(worker,/galleryOriginIntegrity==='unknown' \? null : galleryOriginReconciliation/);
 assert.match(worker,/galleryOrphans\.workerFailure \? 503 : 200/);
 assert.doesNotMatch(worker,/Number\(galleryOriginReconciliation\.originUntrackedObjectCount \?\? 0\)/);
});
test('latest physical multi-proof cleanup gate requires every independent proof before leasing or Storage remove',async()=>{
 const {classifyGalleryPhysicalCleanupGate: classify}=await import('../supabase/functions/_shared/gallery-physical-cleanup-gate.mjs');
 const disabled={physicalDeleteAuthorized:false,conditional72hEnabled:false,
  signedActorPhysicalAbsenceProven:false,externalStorageRaceCertified:false,cloudDependencyGraphComplete:false};
 assert.equal(classify(disabled),'disabled');
 assert.equal(classify({...disabled,physicalDeleteAuthorized:true}),'invalid');
 assert.equal(classify({...disabled,physicalDeleteAuthorized:true,signedActorPhysicalAbsenceProven:true,
  externalStorageRaceCertified:true,cloudDependencyGraphComplete:false}),'invalid');
 assert.equal(classify({...disabled,physicalDeleteAuthorized:'true'}),'invalid');
 assert.equal(classify({...disabled,physicalDeleteAuthorized:true,signedActorPhysicalAbsenceProven:true,
  externalStorageRaceCertified:true,cloudDependencyGraphComplete:true}),'authorized');
 const worker=read('supabase/functions/community-retention/index.ts');
 const classification=worker.indexOf('classifyGalleryPhysicalCleanupGate(cleanupGate)');
 const invalid=worker.indexOf("if(galleryPhysicalCleanupGateState==='invalid')",classification);
 const disallowed=worker.indexOf("else if(galleryPhysicalCleanupGateState!=='authorized')",invalid);
 const claim=worker.indexOf("'community_claim_gallery_media_orphans_v1'",disallowed);
 const remove=worker.indexOf('.remove([key])',claim);
 assert.ok(classification>0 && invalid>classification && disallowed>invalid && claim>disallowed && remove>claim);
 assert.match(worker,/GALLERY_PHYSICAL_STORAGE_DELETE_E2E_NOT_ACCEPTED/);
 assert.match(worker,/GALLERY_PHYSICAL_CLEANUP_GATE_INVALID/);
});
test('signed runner remains isolated from Retention worker and authenticates normally on latest backend',()=>{
 const runner=read('scripts/community-gallery-signed-acceptance.mjs');
 assert.match(runner,/grantType|grant_type=password/);
 assert.match(runner,/galleryPrepare/);
 assert.match(runner,/galleryFinalize/);
 assert.match(runner,/galleryReadBytes/);
 assert.match(runner,/galleryRetirementPreflight/);
 assert.doesNotMatch(runner,/['"]community-retention['"]|['"]x-community-worker-token['"]|physicalDeleteAuthorized\s*:\s*true|['"]service_role['"]/i);
 assert.equal(BACKEND_SHA,'02750fcbcfd3f94fc12b39c8adf5757fa24a5646');
});
