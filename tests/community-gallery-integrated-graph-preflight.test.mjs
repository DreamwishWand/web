import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const upstream=read('supabase/migrations/20261025002000_gallery_dependency_coverage_readonly_v1.sql');
const projection=read('supabase/migrations/20261025002100_gallery_owner_preflight_dependency_coverage_projection_v1.sql');
const current=read('src/lib/community/gallery-retirement-contract.ts');
const integration=read('supabase/staging/acceptance/gallery-integrated-dependency-cloud-owner-v1.sql');

test('09 INT upstream coverage migration precedes owner-only projection and retains original RPC',()=>{
 assert.match(upstream,/create or replace function private\.gallery_photo_dependency_snapshot_v1\(p_gallery_work_id uuid\)/);
 assert.match(upstream,/'coverageContract','ddv\.gallery-cross-product-coverage@1'/);
 assert.match(upstream,/'graphComplete',false/);
 assert.match(upstream,/'retirementAuthorized',false/);
 assert.match(upstream,/'snapshotNotAnAtomicMutationFence',true/);
 assert.match(upstream,/'native_listing','REGISTRY_MISSING'/);
 assert.match(projection,/CREATE OR REPLACE FUNCTION public\.community_gallery_retirement_preflight_v1/);
 assert.match(projection,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(projection,/w\.owner_account_id=v_account/);
 assert.match(projection,/private\.gallery_photo_dependency_snapshot_v1\(p_gallery_work_id\)/);
 assert.match(projection,/private\.gallery_cloud_preservation_snapshot_v1\(v_work\.work_id\)/);
 assert.match(projection,/revoke all on function public\.community_gallery_retirement_preflight_v1\(uuid,uuid\)[\s\S]*from public,anon,authenticated/);
 assert.match(projection,/grant execute on function public\.community_gallery_retirement_preflight_v1\(uuid,uuid\)[\s\S]*to service_role/);
});

test('owner preflight propagates source graph coverage and fingerprint only as non-atomic read-only diagnostics',()=>{
 const fields=['dependencyCoverageContract','dependencyCoverageClassification',
 'dependencyRelationCoverage','dependencyMissingSources','dependencyBlockedReasons',
 'dependencyGraphFingerprintSha256','dependencySnapshotNotAtomicMutationFence',
 'dependencySnapshotRowVersion','dependencySourceVersionState',
 'dependencyOwnerMismatchEdgeCount','dependencyCreatorMismatchEdgeCount'];
 for(const field of fields){
  assert.match(projection,new RegExp("'"+field+"'"));
  assert.match(current,new RegExp(field+":"));
 }
 assert.match(projection,/'dependencySnapshotNotAtomicMutationFence',true/);
 assert.match(projection,/graphFingerprintSha256'\) ~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(projection,/'cloudPreservation',v_preservation/);
 assert.match(projection,/'operationAuthorized',false/);
 assert.match(projection,/'deleteAuthorized',false/);
 assert.match(projection,/'unpublishKeepPrivateAuthorized',false/);
 assert.match(projection,/'cloudEntitlementVerified',false/);
 assert.match(projection,/'previousSignedUrlsRevoked',false/);
 assert.doesNotMatch(projection,/\b(update|delete|insert)\s+(?:public\.)?community_works\b/i);
});

test('integrated Staging fixture checks owner, immutable history, fingerprint, missing registry and unsafe refusal',()=>{
 assert.match(integration,/begin;[\s\S]*rollback;\s*$/i);
 assert.match(integration,/GALLERY_INTEGRATED_09INT_OWNER_CLOUD_READONLY_ROLLBACK_PASS/);
 assert.match(integration,/OWNER_GRAPH_PROJECTION_BAD_OR_UNSAFE/);
 assert.match(integration,/OWNER_GRAPH_IMMUTABLE_HISTORY_FINGERPRINT_DID_NOT_CHANGE/);
 assert.match(integration,/CLOUD_PREFLIGHT_NONOWNER_LEAK/);
 assert.match(integration,/INVALID_HISTORICAL_MEDIA_NOT_FAIL_CLOSED/);
 assert.match(integration,/NATIVE_IN_GAME_LISTING_REGISTRY_NOT_DEPLOYED/);
 assert.match(integration,/REGISTRY_MISSING/);
 assert.match(integration,/structuralIntegrityObserved/);
});
