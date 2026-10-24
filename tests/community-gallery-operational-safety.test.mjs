import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const abort=read('supabase/migrations/20261025002200_gallery_abort_cover_only_reference_guard_v1.sql');
const capacity=read('supabase/migrations/20261025002300_gallery_capacity_effective_cleanup_diagnostics_v1.sql');
const abortFixture=read('supabase/staging/acceptance/gallery-abort-cover-only-safety-v1.sql');
const capacityFixture=read('supabase/staging/acceptance/gallery-capacity-effective-throughput-v1.sql');
const worker=read('supabase/functions/community-retention/index.ts');
const physical=read('supabase/migrations/20261025000400_gallery_physical_delete_failclosed_v1.sql');
const cloud=read('src/lib/community/gallery-retirement-contract.ts');

test('existing owner Abort protects immutable Gallery cover even without WorkRevisionMedia membership',()=>{
 assert.ok(abort.includes('CREATE OR REPLACE FUNCTION public.community_gallery_media_intent_cancel_v1'));
 assert.ok(abort.includes('private.resolve_active_account(p_auth_subject)'));
 assert.ok(abort.includes("where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject"));
 const references=abort.indexOf('exists(select 1 from public.work_revision_media');
 const covers=abort.indexOf('exists(select 1 from public.gallery_photo_revision_fields',references);
 const avatars=abort.indexOf('exists(select 1 from public.creator_profiles',covers);
 const failure=abort.indexOf("raise exception 'GALLERY_MEDIA_ALREADY_BOUND'",avatars);
 const quarantine=abort.indexOf("set processing_state='quarantined'",failure);
 assert.ok(references>0&&covers>references&&avatars>covers&&failure>avatars&&quarantine>failure);
 assert.ok(abort.includes('private.account_retention_holds'));
 assert.ok(abort.includes("if v_intent.state='aborted' then"));
 assert.ok(abort.includes('revoke all on function public.community_gallery_media_intent_cancel_v1(uuid,text) from public,anon,authenticated'));
 assert.ok(abort.includes('grant execute on function public.community_gallery_media_intent_cancel_v1(uuid,text) to service_role'));
 assert.ok(!abort.includes('storage.remove'));
});

test('SQL negative fixtures retain owner, nonowner, cover-only, idempotent Abort and physical deletion OFF',()=>{
 assert.match(abortFixture,/^--[\s\S]*\bbegin;[\s\S]*rollback;\s*$/i);
 for(const code of ['COVER_ONLY_OWNER_ABORT_PERMITTED','COVER_ONLY_ABORT_MUTATED_MEDIA_OR_JOURNAL',
   'COVER_ONLY_NONOWNER_ABORT_AUTHORIZED','UNBOUND_PENDING_ABORT_NOT_IDEMPOTENT',
   'GALLERY_PHYSICAL_GATE_BYPASS','COVER_ABORT_PUBLIC_EXECUTE']){
   assert.ok(abortFixture.includes(code),code);
 }
 assert.ok(abortFixture.includes('GALLERY_OWNER_ABORT_COVER_ONLY_IMMUTABLE_AND_IDEMPOTENT_PASS'));
});

test('capacity Ops distinguish nominal Worker claim budget and currently disabled physical throughput',()=>{
 assert.ok(capacity.includes("effectivePhysicalCleanupPerHour',0"));
 assert.ok(capacity.includes("nominalWorkerClaimCapacityPerHour',20"));
 for(const key of ['providerStorageThroughputBenchmarked','externalStorageRetryBehaviorAccepted',
 'safeCapacityCeilingsProven','finalized72hExpiryActive']){
  assert.ok(capacity.includes("'"+key+"',false"),key);
 }
 assert.ok(capacity.includes('cleanupDueLowerBoundAtNominalCapacityHours'));
 assert.ok(capacity.includes('revoke all on function public.community_gallery_media_capacity_ops_v1() from public,anon,authenticated'));
 assert.ok(capacity.includes('grant execute on function public.community_gallery_media_capacity_ops_v1() to service_role'));
 assert.match(capacityFixture,/^--[\s\S]*\bbegin;[\s\S]*rollback;\s*$/i);
 assert.ok(capacityFixture.includes('GALLERY_CAPACITY_EFFECTIVE_ZERO_CLEANUP_ROLLBACK_PASS'));
 assert.ok(capacityFixture.includes('GLOBAL_21ST_ADMISSION_ACCEPTED'));
 assert.ok(capacityFixture.includes('STALE_QUEUE_DID_NOT_REPORT_ZERO_EFFECTIVE_THROUGHPUT'));
});

test('Retention physical removal still impossible while gate closed, no real Cloud entitlement fiction',()=>{
 const gate=worker.indexOf("'community_gallery_physical_cleanup_gate_v1'");
 const deny=worker.indexOf("else if(galleryPhysicalCleanupGateState!=='authorized')",gate);
 const removal=worker.indexOf('.remove([key])',deny);
 assert.ok(gate>=0&&deny>gate&&removal>deny);
 assert.ok(physical.includes("'physicalDeleteAuthorized',false"));
 assert.ok(physical.includes('check(physical_orphan_cleanup_accepted=false)'));
 assert.ok(cloud.includes('cloudEntitlementSourceConfigured:false'));
 assert.ok(cloud.includes('noPersistentPrivateFreeWork:true'));
 assert.ok(cloud.includes('incompleteCrossProductGraphFailsClosed:true'));
 assert.ok(cloud.includes('deleteAuthorized:false'));
 assert.ok(cloud.includes('restorePrivateAuthorized:false'));
});
