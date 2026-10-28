import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const code=read('supabase/migrations/20261028000020_x05_nonpublic_consent_phase_revoke_controls.sql');
test('Source149 is exactly additive after frozen Source147/148',()=>{
  const names=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(names.length,149);
  assert.equal(names.at(-1),'20261028000020_x05_nonpublic_consent_phase_revoke_controls.sql');
});
test('private only - no new positive/public/Edge grants or signers',()=>{
  assert.match(code,/create table private\.dreamsnap_x05_work_control_v1/);
  assert.match(code,/create table private\.dreamsnap_x05_consent_events_v1/);
  assert.match(code,/create table private\.dreamsnap_x05_purge_tracking_v1/);
  assert.match(code,/public_activation_allowed=false/);
  assert.match(code,/as \$\$ select false \$\$/);
  assert.doesNotMatch(code,/grant execute /i);
  assert.doesNotMatch(code,/create or replace function public\./i);
  assert.doesNotMatch(read('supabase/functions/community-public-query/index.ts'),/dreamsnap_x05_/);
});
test('typed Work IDs and original frozen image are independent of concept',()=>{
  assert.match(code,/'OriginalCompetition','PostEventCreation'/);
  assert.match(code,/e\.entry_revision_id=p_photo_revision_id/);
  assert.match(code,/s\.immutable_photo_revision_id=p_photo_revision_id/);
  assert.match(code,/s\.publication_state='staged'/);
  assert.match(code,/p_concept_revision_id=v_ctl\.frozen_photo_revision_id/);
  assert.match(code,/set concept_revision_id=p_concept_revision_id/);
});
test('rights consent uses fixed narrow scopes and versioned CAS',()=>{
  assert.match(code,/array\['cdn','display','store','thumbnail'\]/);
  assert.match(code,/grant_policy_version text/);
  assert.match(code,/creator_self_capture_declared boolean/);
  assert.match(code,/X05_GRANT_CAS_OR_IMMUTABLE_MISMATCH/);
  assert.match(code,/X05_ROW_VERSION_CONFLICT/);
  assert.match(code,/create table private\.dreamsnap_x05_consent_events_v1/);
});
test('official weekly schedule is deterministic but never real Challenge authority',()=>{
  assert.match(code,/at time zone 'UTC'/);
  assert.match(code,/extract\(isodow from v_start\)<>3/);
  assert.match(code,/extract\(hour from v_start\)<>13/);
  assert.match(code,/interval '168 hours'/);
  assert.match(code,/interval '336 hours'/);
  assert.match(code,/OFFICIAL_WEEKLY_SCHEDULE_ONLY/);
  assert.match(code,/'officialServerPhaseVerified',false/);
  assert.match(code,/'verifiedChallengeId',false/);
});
test('withdrawal changes existing public Work authority, outbox, purge request',()=>{
  assert.match(code,/set visibility='private'/);
  assert.match(code,/authorization_epoch=authorization_epoch\+1/);
  assert.match(code,/dreamsnap\.x05_nonpublic_/);
  assert.match(code,/insert into private\.dreamsnap_x05_purge_tracking_v1/);
  assert.match(code,/request_state in \('requested','provider_pending','provider_reported','verified'\)/);
  assert.doesNotMatch(code,/set request_state='verified'/);
});
