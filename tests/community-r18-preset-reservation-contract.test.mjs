import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=r('supabase/migrations/20261025002980_r18_preset_storage_reservation_failclosed.sql');
const edge=r('supabase/functions/wep-preset-artifact/index.ts');
const workflow=r('.github/workflows/comm-clean-bootstrap-acceptance.yml');
const py=r('tests/comm-r18-preset-reservation-two-session.py');
test('R18-work reservation table is private and has canonical unique owner/key/idempotency',()=>{
 for(const s of ['private.preset_storage_reservations_r18','unique(owner_account_id,idempotency_key)',
  'published_storage_key text not null unique','source_staging_key','checksum_sha256','content_type',
  'state_version bigint not null','copy_attempts','retry_after','committed_blob_id',
  'FAILED_RECOVERABLE','COPIED_UNVERIFIED','PROMOTION_IN_PROGRESS',
  'VERIFIED_PUBLISHED_OBJECT','COMMITTED_PRESET_PUBLICATION','enable row level security']) assert.ok(sql.includes(s),s);
 assert.match(sql,/revoke all on private\.preset_storage_reservations_r18 from public,anon,authenticated,service_role/);
 assert.match(sql,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(sql,/for share/);
 assert.match(sql,/on conflict\(owner_account_id,idempotency_key\) do nothing/);
 assert.match(sql,/for update/);
 assert.match(sql,/R18_PRESET_RESERVATION_IDEMPOTENCY_CONFLICT/);
 assert.match(sql,/R18_PRESET_RESERVATION_STALE/);
});
test('legacy SQL preset publication and published-key unreserved registration terminal deny',()=>{
 assert.match(sql,/create or replace function public\.community_publish_preset_envelope\(/);
 assert.match(sql,/R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED/);
 assert.match(sql,/R18_PUBLISHED_OBJECT_REGISTRATION_NOT_ENROLLED/);
 assert.match(sql,/create trigger preset_published_blob_reservation_guard_r18/);
 assert.match(sql,/before insert or update of storage_key on public\.artifact_blobs/);
 for(const key of ['cleanupAuthorized\x27,false','physicalDeleteAuthorized\x27,false','publicationCommitAuthorized\x27,false'])assert.match(sql,new RegExp(key));
});
test('Edge does not invoke copy/remove or new positive publication/discard while reservation unavailable',()=>{
 assert.match(edge,/action === 'reservePublication'/);
 assert.match(edge,/community_preset_storage_reserve_r18/);
 assert.match(edge,/validatedStoredArtifact\(ctx, accountId, storageKey, 'staging'\)/);
 assert.match(edge,/published\/\$\{accountId\}\//);
 assert.match(edge,/action === 'recoverPublication'/);
 assert.match(edge,/community_preset_storage_recovery_r18/);
 assert.match(edge,/action === 'publish'[\s\S]{0,220}R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED/);
 assert.match(edge,/action === 'discard'/);
 assert.match(edge,/community_preset_storage_cleanup_preflight_r18/);
 assert.doesNotMatch(edge,/\.copy\(|\.remove\(/);
});
test('135 source migrations and real two-backend concurrency fixture wired in bootstrap',()=>{
 assert.match(workflow,/assert len\(fs\)==135/);
 assert.match(workflow,/IF v<>135 THEN/);
 assert.match(workflow,/TWENTY_THREE_ADDITIVE_SOURCE_MIGRATIONS/);
 assert.match(workflow,/tests\/comm-r18-preset-reservation-two-session\.py/);
 for(const s of ['R18_SAME_KEY_TWO_BACKEND_SERIALIZED_REPLAY','R18_REGISTRATION_AND_LEGACY_ENVELOPE_DENIED',
 'R18_PUBLISHED_AND_STAGING_CLEANUP_DENIED','R18_FAILED_PUBLISH_RECOVERY_STALE_REJECTION',
 'R18_PRIVACY_BARRIER_INDEPENDENT']) assert.ok(py.includes(s),s);
});

test('Physical Preset Retention worker independently fails closed while Phase1 remains available',()=>{
  const worker=r('supabase/functions/wep-preset-retention/index.ts');
  assert.match(worker,/community_verify_worker_token/);
  assert.match(worker,/R18_PRESET_PHYSICAL_RETENTION_CLEANUP_NOT_ENROLLED/);
  assert.match(worker,/privacySuppressionIndependent:true/);
  assert.doesNotMatch(worker,/\.remove\(/);
  assert.doesNotMatch(worker,/community_finalize_artifact_blob_purge/);
  const accountPrivacy=r('supabase/migrations/20261025002600_account_privacy_suppression_barrier_v1.sql');
  assert.match(accountPrivacy,/community_request_privacy_suppression_v1/);
});
