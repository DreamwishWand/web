import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=r('supabase/migrations/20261025002990_r18_preset_promotion_fencing_candidate.sql');
const edge=r('supabase/functions/wep-preset-artifact/index.ts');
const workflow=r('.github/workflows/comm-clean-bootstrap-acceptance.yml');
const pg=r('tests/comm-r18-promotion-fence-two-session.py');
test('R18 positive publication candidate cannot be reached by service role or public roles',()=>{
 assert.match(sql,/private\.preset_storage_release_gate_r18/);
 assert.match(sql,/provider_precondition_accepted boolean not null default false/);
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/create or replace function private\.preset_storage_commit_candidate_r18\(/);
 assert.match(sql,/R18_PRESET_PUBLICATION_RELEASE_GATE_CLOSED/);
 assert.match(sql,/revoke all on function private\.preset_storage_commit_candidate_r18\([\s\S]*?from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/grant execute on function private\.preset_storage_commit_candidate_r18/);
 assert.match(sql,/private\.preset_storage_commit_scope_r18/);
 assert.match(sql,/txid_current\(\)/);
 assert.match(sql,/R18_PUBLISHED_OBJECT_REGISTRATION_NOT_ENROLLED/);
 assert.match(sql,/R18_PRESET_PUBLISHED_BYTES_NOT_INDEPENDENTLY_VERIFIED/);
 assert.match(sql,/R18_PRESET_STALE_FENCE_OR_LEASE/);
});
test('R18 lease fencing is account and creator scoped, CAS guarded and pre-copy untrusted',()=>{
 for(const s of [
  'community_preset_storage_claim_promotion_r18',
  'community_preset_storage_report_readback_r18',
  'private.resolve_active_account(p_auth_subject)',
  'for share','for update',
  'lease_token=v_token','lease_fence=lease_fence+1',
  'v_res.state_version<>p_expected_version',
  'v_res.lease_token is distinct from p_lease_token',
  'v_res.lease_fence<>p_lease_fence',
  'v_res.lease_expires_at<=clock_timestamp()',
  "verification_evidence_state='EDGE_READBACK_UNATTESTED'",
  'providerCopyAuthorized',
  'publicationCommitAuthorized'
 ]) assert.ok(sql.includes(s),s);
 assert.match(sql,/readback_byte_size=p_downloaded_byte_size/);
 assert.match(sql,/readback_sha256=p_downloaded_sha256/);
 assert.match(sql,/PROVIDER_READBACK_MISMATCH/);
});
test('WEP actual Edge may download and hash Staging and Published but cannot copy or remove or invoke SQL candidate commit',()=>{
 assert.match(edge,/action === 'inspectPublishedObject'/);
 assert.match(edge,/community_preset_storage_claim_promotion_r18/);
 assert.match(edge,/validatedStoredArtifact\(ctx,accountId,sourceKey,'staging'\)/);
 assert.match(edge,/validatedStoredArtifact\(ctx,accountId,publishedKey,'published'\)/);
 assert.match(edge,/community_preset_storage_report_readback_r18/);
 assert.match(edge,/publishedBytes\.checksumSha256/);
 assert.match(edge,/sourceBytes\.checksumSha256/);
 assert.match(edge,/publicationAuthorized:false/);
 assert.match(edge,/realProviderAccepted:false,verificationAttested:false/);
 assert.doesNotMatch(edge,/\.copy\(|\.remove\(/);
 assert.doesNotMatch(edge,/preset_storage_commit_candidate_r18/);
});
test('Source135 two-backend fencing and rollback-only SQL candidate are wired',()=>{
 assert.match(workflow,/assert len\(fs\)==139/);
 assert.match(workflow,/IF v<>139 THEN/);
 assert.match(workflow,/TWENTY_EIGHT_ADDITIVE_SOURCE_MIGRATIONS/);
 assert.match(workflow,/comm-r18-promotion-fence-two-session\.py/);
 assert.match(workflow,/R18_PRESET_POSITIVE_COMMIT_UNEXPECTEDLY_ENABLED/);
 for(const s of ['R18_TWO_BACKEND_LEASE_FENCING_AND_READBACK',
  'R18_LOCAL_ONLY_SYNTHETIC_ATOMIC_PRESET_SQL_CANDIDATE_ROLLBACK',
  '03COMM_R18_SOURCE_ONLY_FENCING_AND_GATED_COMMIT_CANDIDATE_PASS',
  'COMPETING_READBACK_DID_NOT_LOCK']) assert.ok(pg.includes(s),s);
});
