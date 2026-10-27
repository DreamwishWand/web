import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=[
  'supabase/migrations/20261025002800_gallery_v4_actual_scoped_atomic_enrollment_r14.sql',
  'supabase/migrations/20261025002810_gallery_v4_scoped_atomic_lock_r14.sql',
  'supabase/migrations/20261025002820_gallery_v4_actual_writer_enrollment_r14.sql',
  'supabase/migrations/20261025002830_gallery_v4_private_helper_acl_r14.sql'
].map(read).join('\n');
const command=read('supabase/functions/community-command/index.ts');
const workflow=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');
test('actual public community_publish_gallery_v4 is redefined by additive source, not test-only outer wrapper',()=>{
  assert.match(sql,/create or replace function public\.community_publish_gallery_v4\(/i);
  const i=sql.indexOf('create or replace function public.community_publish_gallery_v4(');
  const v4=sql.slice(i);
  assert.match(v4,/private\.resolve_active_account\(p_auth_subject\)/);
  assert.match(v4,/perform private\.gallery_v4_atomic_lock_scoped_r14\(/);
  assert.ok(v4.indexOf('gallery_v4_atomic_lock_scoped_r14')<v4.indexOf('pg_advisory_xact_lock'),'account/artifact roots BEFORE idempotency');
  assert.ok(v4.indexOf('gallery_v4_atomic_lock_scoped_r14')<v4.indexOf('from public.community_works where work_id=p_work_id for update'),'lock roots before target Gallery');
  assert.match(v4,/insert into public\.idempotency_keys/);
  assert.match(v4,/insert into public\.search_documents/);
  assert.match(v4,/insert into public\.outbox_events/);
  assert.match(v4,/insert into public\.gallery_revision_presets/);
  assert.match(v4,/update public\.community_works[\s\S]*lifecycle_state='published'/);
  assert.doesNotMatch(v4,/graphComplete',true|retirementAuthorized',true/);
});
test('scoped R14 graph revalidation orders actual locks and fences unsupported kinds',()=>{
  const helper=sql.slice(sql.indexOf('create or replace function private.gallery_v4_atomic_lock_scoped_r14('),
    sql.indexOf('-- Existing REAL PUBLIC RPC body'));
  assert.match(helper,/from public\.wand_accounts[\s\S]*for share/i);
  assert.match(helper,/from public\.preset_artifacts[\s\S]*for update nowait/i);
  assert.match(helper,/from public\.community_works[\s\S]*for update nowait/i);
  assert.match(helper,/v_after:=private\.gallery_v4_scoped_graph_r14\(/);
  assert.match(helper,/v_after is distinct from v_snapshot/);
  assert.match(helper,/R14_GRAPH_CHANGED_RETRY_WHOLE_TRANSACTION/);
  assert.match(helper,/R14_MULTI_ARTIFACT_GRAPH_NOT_ENROLLED/);
  assert.match(helper,/pa\.preset_type<>'scene'/);
  assert.match(helper,/R14_PRESET_KIND_OR_OWNER_NOT_ENROLLED/);
  assert.match(helper,/private\.resolve_active_account\(p_auth_subject\)/);
  assert.match(sql,/workRevisions/);
  assert.match(sql,/historicalPresetLinks/);
  assert.match(sql,/mediaReferences/);
  assert.match(sql,/coverReferences/);
});
test('Edge only retries actual Gallery publish with fresh auth and fresh SQL transaction',()=>{
  assert.match(command,/const maxAttempts = \(command === 'publishGallery' \|\| command === 'setGalleryCommentsAtomicR16'\) \? 3 : 1/);
  assert.match(command,/community_authorize_session',authorizationParams/);
  assert.match(command,/\['40P01','55P03','40001'\]/);
  assert.match(command,/R14_GRAPH_CHANGED_RETRY_WHOLE_TRANSACTION/);
  assert.match(command,/1700/);
  assert.doesNotMatch(command,/savepoint.*publishGallery/i);
});
test('local isolated actual-Writer race is executed at 116 unique migrations',()=>{
  assert.match(workflow,/assert len\(fs\)==145/);
  assert.match(workflow,/MIGRATION_LEDGER_NOT_145/);
  assert.match(workflow,/comm-r14-actual-gallery-v4-two-session\.py/);
  assert.match(workflow,/supabase\/migrations\/20261025002800_gallery_v4_actual_scoped_atomic_enrollment_r14\.sql/);
  const real=read('tests/comm-r14-actual-gallery-v4-two-session.py');
  assert.match(real,/select public\.community_publish_gallery_pinned_r15\(/);
  assert.match(real,/ACTUAL_GALLERY_V4_BYPASSED/);
  assert.match(real,/03COMM_R14_ACTUAL_GALLERY_V4_TWO_BACKEND_SOURCE_PASS/);
  assert.match(real,/callerGraphFingerprintChecked":True/);
});
