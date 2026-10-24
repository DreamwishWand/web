import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261025001000_gallery_cloud_preservation_readiness_v1.sql');
const acceptance=read('supabase/staging/acceptance/gallery-cloud-preservation-readiness-v1.sql');
const contract=read('src/lib/community/gallery-retirement-contract.ts');
const query=read('supabase/functions/community-query/index.ts');

test('Cloud readiness is owner-scoped existing SQL manifest, never fabricated entitlement',()=>{
  assert.match(migration,/private\.gallery_cloud_preservation_snapshot_v1\(v_work\.work_id\)/);
  assert.match(migration,/private\.resolve_active_account\(p_auth_subject\)/);
  assert.match(migration,/GALLERY_RETIREMENT_NOT_OWNER/);
  assert.match(migration,/'entitlement',jsonb_build_object\(/);
  assert.match(migration,/'source','not_configured'/);
  assert.match(migration,/'verified',false,'active',false/);
  assert.match(migration,/'privateSaveAuthorized',false/);
  assert.match(migration,/'restoreAuthorized',false/);
  assert.match(migration,/'republishAuthorized',false/);
  assert.match(migration,/'dependencyGraphCoverageVerified',false/);
  assert.match(migration,/'signedUrlAndCacheRevocationProven',false/);
  assert.match(migration,/revoke all on function private\.gallery_cloud_preservation_snapshot_v1\(uuid\)\s+from public,anon,authenticated/);
  assert.match(migration,/revoke all on function public\.community_gallery_retirement_preflight_v1\(uuid,uuid\)\s+from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.community_gallery_retirement_preflight_v1\(uuid,uuid\)\s+to service_role/);
  assert.match(query,/galleryRetirementPreflight: 'community_gallery_retirement_preflight_v1'/);
  assert.match(contract,/cloudPreservation:GalleryCloudPreservationReadinessV1/);
  assert.match(contract,/cloudEntitlementSourceConfigured:false/);
});

test('Cloud manifest audits all historical immutable Media and Cover references',()=>{
  assert.match(migration,/community_work_revisions r/);
  assert.match(migration,/r\.sealed_at is not null/);
  assert.match(migration,/gallery_photo_revision_fields f/);
  assert.match(migration,/work_revision_media rm/);
  assert.match(migration,/m\.owner_account_id is distinct from v_work\.owner_account_id/);
  assert.match(migration,/m\.processing_state<>'ready'/);
  assert.match(migration,/m\.moderation_state<>'clear'/);
  assert.match(migration,/m\.purged_at is not null/);
  assert.match(migration,/'coverWithoutCompositionCount',v_cover_unbound/);
  assert.match(migration,/'invalidOrNonOwnedMediaCount',v_invalid_media/);
  assert.match(migration,/'cloudBackupAndRestoreVerified',false/);
  assert.match(acceptance,/GALLERY_CLOUD_PRESERVATION_OWNER_READONLY_SQL_ROLLBACK_PASS/);
  assert.match(acceptance,/CLOUD_PREFLIGHT_NONOWNER_LEAK/);
  assert.match(acceptance,/revisionRowCount/);
  assert.match(acceptance,/historicalRevisionRowCount/);
  assert.match(acceptance,/rollback;\s*$/);
});

test('Cloud readiness never invokes a visibility mutation or Storage origin deletion',()=>{
  assert.doesNotMatch(migration,/\bupdate\s+public\.community_works\s+set\b/i);
  assert.doesNotMatch(migration,/\bdelete\s+from\s+public\./i);
  assert.doesNotMatch(migration,/\bcreate\s+table\b/i);
  assert.doesNotMatch(migration,/\.remove\(/);
  assert.match(contract,/noPersistentPrivateFreeWork:true/);
  assert.match(contract,/disabledOperations:\['unpublishKeepPrivate','delete','restorePrivate','republishPrivate'\]/);
});
