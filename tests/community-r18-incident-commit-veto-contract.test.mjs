import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/20261025003020_r18_preset_integrity_incident_commit_veto.sql',import.meta.url),'utf8');
const original=readFileSync(new URL('../supabase/migrations/20261025002990_r18_preset_promotion_fencing_candidate.sql',import.meta.url),'utf8');
function body(name){
 const i=migration.indexOf('create or replace function '+name+'(');
 assert.ok(i>=0,name);
 const tail=migration.slice(i);
 const pl=tail.indexOf('end;$r18$;');
 const sql=tail.indexOf(');$r18$;');
 const ends=[{at:pl,size:11},{at:sql,size:9}].filter(x=>x.at>=0).sort((a,b)=>a.at-b.at);
 assert.ok(ends.length>0);
 return tail.slice(0,ends[0].at+ends[0].size);
}
test('Source138 all-fence incident helper checks entire reservation and blocks terminal, never resolves',()=>{
 const f=body('private.preset_storage_assert_no_integrity_incident_r18');
 assert.match(f,/i\.reservation_id=p_reservation_id/);
 assert.match(f,/incident_state='QUARANTINED_PENDING_OPERATOR'/);
 assert.doesNotMatch(f,/observed_lease_fence=/);
 assert.match(f,/R18_PRESET_UNRESOLVED_INTEGRITY_INCIDENT_TERMINAL/);
 const trigger=body('private.preset_storage_integrity_incident_immutable_r18');
 assert.match(trigger,/R18_PRESET_INTEGRITY_INCIDENT_IMMUTABLE_OPERATOR_ATTESTATION_REQUIRED/);
 assert.match(migration,/before update or delete on private\.preset_storage_integrity_incidents_r18/);
 assert.doesNotMatch(migration,/delete from private\.preset_storage_integrity_incidents_r18/);
});
test('Source138 fenced private Commit checks incident AFTER reservation row lock but BEFORE committed replay, and before mutations',()=>{
 const s=body('private.preset_storage_commit_candidate_r18');
 const rowlock=s.indexOf('for update;');
 const guard=s.indexOf('perform private.preset_storage_assert_no_integrity_incident_r18(v_res.reservation_id)');
 const replay=s.indexOf("if v_res.reservation_state='COMMITTED_PRESET_PUBLICATION'");
 const mutation=s.indexOf('insert into private.preset_storage_commit_scope_r18');
 assert.ok(rowlock>0 && guard>rowlock && replay>guard && mutation>replay);
 assert.match(s,/private\.is_account_privacy_suppressed\(v_owner\)/);
 assert.match(s,/c\.moderation_state='clear'/);
 assert.match(s,/private\.resolve_active_account\(p_auth_subject\)/);
 assert.match(migration,/revoke all on function private\.preset_storage_commit_candidate_r18/);
});
test('Source138 all read/reserve/recovery/promotion state entrypoints are incident aware',()=>{
 for(const name of ['public.community_preset_storage_claim_promotion_r18',
  'public.community_preset_storage_report_readback_r18',
  'public.community_preset_storage_recovery_r18','public.community_preset_storage_reserve_r18']){
  const s=body(name);
  assert.match(s,/perform private\.preset_storage_assert_no_integrity_incident_r18/);
  assert.ok(s.indexOf('for update;')<s.indexOf('perform private.preset_storage_assert_no_integrity_incident_r18'),name);
 }
 const snapshot=body('private.preset_storage_reservation_snapshot_r18');
 assert.match(snapshot,/unresolvedIncidentCount/);
 assert.match(snapshot,/TERMINAL_OPERATOR_AND_INDEPENDENT_PROVIDER_EVIDENCE_REQUIRED/);
 const cleanup=body('public.community_preset_storage_cleanup_preflight_r18');
 assert.match(cleanup,/unresolvedIncidentCount/);
 assert.match(cleanup,/'cleanupAuthorized',false/);
 assert.match(cleanup,/'physicalDeleteAuthorized',false/);
});
test('Source138 retains gated private synthetic commit and no remote physical publish/cleanup changes',()=>{
 const commit=body('private.preset_storage_commit_candidate_r18');
 assert.match(commit,/R18_PRESET_PUBLICATION_RELEASE_GATE_CLOSED/);
 for(const op of ['.copy(','.remove(','PROVIDER_REAL_ATTESTED','create policy']){
  assert.equal(migration.includes(op),false,op);
 }
 assert.ok(original.includes('R18_PRESET_PUBLISHED_BYTES_NOT_INDEPENDENTLY_VERIFIED'));
 assert.match(migration,/R18_PRESET_SOURCE138_UNEXPECTED_RELEASE_GATE_ENABLED/);
});
