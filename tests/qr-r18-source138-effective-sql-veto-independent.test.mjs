import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261025003020_r18_preset_integrity_incident_commit_veto.sql', import.meta.url),'utf8');
const previous = readFileSync(new URL('../supabase/migrations/20261025003010_r18_preset_provider_integrity_quarantine.sql', import.meta.url),'utf8');

function effective(name) {
  const target = 'create or replace function ' + name + '(';
  const start = sql.toLowerCase().lastIndexOf(target.toLowerCase());
  assert.ok(start >= 0, name);
  const finish = sql.indexOf('end;$r18$;', start);
  assert.ok(finish > start, name);
  return sql.slice(start, finish + 'end;$r18$;'.length);
}
function definitions(name) {
 return [...sql.toLowerCase().matchAll(/create or replace function ([a-z0-9_.]+)\s*\(/g)]
  .filter(x=>x[1]===name.toLowerCase()).length;
}
function hasVetoAfterLock(functionName) {
 const f=effective(functionName);
 const lock=f.indexOf('for update;');
 const veto=f.indexOf('perform private.preset_storage_assert_no_integrity_incident_r18(');
 assert.ok(lock>=0 && veto>lock, functionName+':no locked veto in final definition');
}

test('QR Source138 exact EFFECTIVE SQL functions are uniquely defined, not shadowed by late unsafe duplicate',()=>{
 const names=[
 'private.preset_storage_commit_candidate_r18',
 'public.community_preset_storage_claim_promotion_r18',
 'public.community_preset_storage_report_readback_r18',
 'public.community_preset_storage_recovery_r18',
 'public.community_preset_storage_reserve_r18'
 ];
 for(const n of names){assert.equal(definitions(n),1,'late CREATE OR REPLACE shadowed '+n);hasVetoAfterLock(n);}
});

test('QR Source138 last effective COMMIT veto precedes completed replay and every positive/Outbox mutation',()=>{
 const f=effective('private.preset_storage_commit_candidate_r18');
 const veto=f.indexOf('perform private.preset_storage_assert_no_integrity_incident_r18(');
 assert.ok(veto>f.indexOf('for update;'));
 for(const target of ["if v_res.reservation_state='COMMITTED_PRESET_PUBLICATION'",
 'insert into private.preset_storage_commit_scope_r18',
 'insert into public.artifact_blobs',
 'insert into public.community_works',
 'insert into public.preset_revisions',
 'insert into public.outbox_events',
 'insert into public.idempotency_keys']){
   assert.ok(f.indexOf(target)>veto, target+' must occur after veto');
 }
 assert.match(f,/private\.is_account_privacy_suppressed\(v_owner\)/);
});

test('QR Source138 incident from ANY prior lease fence blocks and permanent quarantine cannot be client cleared',()=>{
 const helper=effective('private.preset_storage_assert_no_integrity_incident_r18');
 assert.match(helper,/i\.reservation_id=p_reservation_id/);
 assert.match(helper,/incident_state='QUARANTINED_PENDING_OPERATOR'/);
 assert.doesNotMatch(helper,/observed_lease_fence\s*=/);
 assert.match(helper,/R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL/);
 const trigger=effective('private.preset_storage_integrity_incident_immutable_r18');
 assert.match(trigger,/R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED/);
 assert.match(sql,/before update or delete on private\.preset_storage_integrity_incidents_r18/);
 assert.match(previous,/evidence_class='EDGE_OBSERVATION_UNATTESTED'/);
});

test('QR Source138 cleanup/read-authority remains deny-only while unresolved and no positive Provider path enrolled',()=>{
 const snapshot=effective('private.preset_storage_reservation_snapshot_r18');
 const cleanup=effective('public.community_preset_storage_cleanup_preflight_r18');
 assert.match(snapshot,/unresolvedIncidentCount/);
 assert.match(snapshot,/TERMINAL_OPERATOR_AND_INDEPENDENT_PROVIDER_EVIDENCE_REQUIRED/);
 assert.match(cleanup,/unresolvedIncidentCount/);
 assert.match(cleanup,/'cleanupAuthorized',false/);
 assert.match(cleanup,/'physicalDeleteAuthorized',false/);
 assert.doesNotMatch(sql,/\.storage\.from\(|\.copy\s*\(|\.remove\s*\(/);
 assert.match(sql,/R18_PRESET_SOURCE138_UNEXPECTED_RELEASE_GATE_ENABLED/);
 assert.match(sql,/revoke all on function private\.preset_storage_commit_candidate_r18/);
});
