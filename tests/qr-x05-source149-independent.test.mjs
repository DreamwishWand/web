import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const rel='supabase/migrations/20261028000020_x05_nonpublic_consent_phase_revoke_controls.sql';
const sql=fs.readFileSync(rel,'utf8');
const blob=(x)=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
const functions=[
 'dreamsnap_x05_schedule_preflight_v1','dreamsnap_x05_control_live_v1',
 'dreamsnap_x05_record_creator_grant_v1','dreamsnap_x05_owner_transition_v1',
 'dreamsnap_x05_public_activation_v1'
];
const tables=['dreamsnap_x05_work_control_v1','dreamsnap_x05_consent_events_v1','dreamsnap_x05_purge_tracking_v1'];
test('independent exact Source149 single-additive migration pin',()=>{
 assert.equal(blob(sql),'0d0c4e85a1fc1d0e2e3ba06aade8d55f305e1fd0');
 const migrations=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort();
 assert.equal(migrations.length,149);
 assert.equal(migrations.at(-1),'20261028000020_x05_nonpublic_consent_phase_revoke_controls.sql');
 assert.equal(new Set(migrations.map(x=>x.slice(0,14))).size,149);
});
test('private ACL is closed to role escalation even by service_role',()=>{
 for(const t of tables)assert.ok(sql.includes('create table private.'+t),t);
 for(const f of functions){
  assert.ok(sql.includes('create or replace function private.'+f),f);
  assert.ok(sql.includes('revoke all on function private.'+f),f);
 }
 assert.match(sql,/from public,anon,authenticated,service_role;/);
 assert.doesNotMatch(sql,/grant (execute|all|select|insert|update|delete) on (function|table) .* to (public|anon|authenticated|service_role)/i);
});
test('frozen original entry, staged post-event and immutable photo + media scope',()=>{
 for(const evidence of [
  "v_kind:='OriginalCompetition'","v_kind:='PostEventCreation'",
  'e.entry_revision_id=p_photo_revision_id',
  "s.official_voting_authority='unknown'",
  "s.wand_voting_authority='unknown'",
  "s.rights_provenance='unknown'",
  'wrm.media_id=p_media_id','wrm.ordinal=0',
  'v_old.frozen_media_id<>p_media_id',
  'v_old.frozen_photo_revision_id<>p_photo_revision_id',
  "array['cdn','display','store','thumbnail']"
 ]) assert.ok(sql.includes(evidence),evidence);
});
test('no fake official phase/public activation, fixed Wednesday 13 UTC',()=>{
 for(const needle of ["extract(isodow from v_start)<>3","extract(hour from v_start)<>13",
  "interval '168 hours'","interval '336 hours'",
  "'positivePublicAllowed',false","'officialServerPhaseVerified',false",
  'public_activation_allowed=false','as $$ select false $$'])
  assert.ok(sql.includes(needle),needle);
});
test('row/version and auth epochs are CAS protected and terminal revocations never writer successes',()=>{
 for(const needle of ['for update','p_expected_version<>v_old.row_version',
  'p_expected_version is distinct from v_ctl.row_version',
  "v_old.control_state in ('withdrawn','delete_requested')",
  "v_ctl.control_state in ('withdrawn','delete_requested')",
  'authorization_epoch=authorization_epoch+1',"visibility='private'"])
  assert.ok(sql.includes(needle),needle);
});
test('delete request/outbox is not provider purge; no old public Edge signer routes modified',()=>{
 assert.match(sql,/request_state text not null default 'requested'/);
 assert.match(sql,/provider_receipt_digest text/);
 assert.match(sql,/insert into public\.outbox_events\(/);
 assert.match(sql,/on conflict\(work_id\) do nothing/);
 assert.doesNotMatch(sql,/\bdelete from public\.media_assets\b/i);
 assert.doesNotMatch(sql,/\bupdate public\.media_assets set purged_at\b/i);
 assert.doesNotMatch(sql,/\bgrant execute\b/i);
});
