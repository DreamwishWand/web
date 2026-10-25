import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');
const historical=read('supabase/migrations/20260930063000_community_core_v0_account_recovery.sql');
const privacy=read('supabase/migrations/20261025002600_account_privacy_suppression_barrier_v1.sql');
const guard=read('supabase/migrations/20261025002700_active_identity_regular_resolver_guard_v1.sql');
const workflow=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');
const session=read('supabase/migrations/20260930075500_community_core_v0_session_bound_recent_auth.sql');

test('R13 closes regression from subsequent Privacy resolver redefinition without rewriting historic migrations',()=>{
  assert.match(historical,/i\.identity_state='active'/i);
  const oldResolver=privacy.slice(privacy.indexOf('create or replace function private.resolve_active_account'),
    privacy.indexOf('$resolve_private$;',privacy.indexOf('create or replace function private.resolve_active_account')));
  assert.doesNotMatch(oldResolver,/i\.identity_state='active'/i);
  const newResolver=guard.slice(guard.indexOf('create or replace function private.resolve_active_account'));
  assert.match(newResolver,/i\.identity_state='active'/i);
  assert.match(newResolver,/i\.retired_at is null/i);
  assert.match(newResolver,/a\.deleted_at/i);
  assert.match(newResolver,/v_status <> 'active' or v_deleted_at is not null/i);
  assert.match(newResolver,/private\.is_account_privacy_suppressed\(v_account_id\)/);
  assert.match(newResolver,/Active AuthIdentity not found/);
  assert.doesNotMatch(newResolver,/identity_state\s*(?:<>|!=)\s*'retired'/i);
});

test('session-bound rules stay separate and remain fail closed for retired JWT-shaped identity',()=>{
  assert.match(session,/identity_state='active'/);
  assert.match(session,/sessions_valid_after/);
  assert.match(session,/from auth\.sessions s/);
  assert.match(guard,/revoke all on function private\.resolve_active_account\(uuid\)\s+from public,anon,authenticated/i);
  assert.doesNotMatch(guard,/grant execute on function private\.scene_save_revision_paired_candidate_v1/i);
  assert.doesNotMatch(guard,/insert into public\.community_work_revisions|update public\.community_works/i);
});

test('actual Source regressions run from a disposable isolated current 116-migration head only',()=>{
  const fixture=read('supabase/staging/acceptance/local-clean-bootstrap-r13-retired-identity-v1.sql');
  const twosession=read('tests/comm-r13-retired-identity-two-session.py');
  assert.match(workflow,/assert len\(fs\)==132/);
  assert.match(workflow,/MIGRATION_LEDGER_NOT_132/);
  assert.match(workflow,/local-clean-bootstrap-r13-retired-identity-v1\.sql/);
  assert.match(workflow,/comm-r13-retired-identity-two-session\.py/);
  assert.match(fixture,/rollback;/i);
  assert.match(fixture,/community_change_work_visibility/);
  assert.match(fixture,/community_gallery_owner_media_read_v1/);
  assert.match(fixture,/community_scene_revision_readiness_v1/);
  assert.match(fixture,/identity_state='retired'/);
  assert.match(twosession,/twoDistinctPostgresBackends/);
  assert.match(twosession,/signedJWTExecuted":False/);
});
