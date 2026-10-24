import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => fs.readFileSync(root + path, 'utf8');
const sql = read('supabase/migrations/20261025002600_account_privacy_suppression_barrier_v1.sql');
const accountEdge = read('supabase/functions/community-account/index.ts');
const workflow = read('.github/workflows/comm-clean-bootstrap-acceptance.yml');

test('account privacy suppression is durable and not a Gallery deletion or physical erasure', () => {
  assert.match(sql,/create table if not exists private\.account_privacy_suppressions/i);
  assert.match(sql,/account_id uuid primary key/i);
  assert.match(sql,/suppressed_cleanup_pending/);
  assert.match(sql,/cleanup_review_required/);
  assert.match(sql,/fullDeletionComplete','false'|fullDeletionComplete',false/);
  assert.match(sql,/previousBearerUrlsRevoked',false/);
  assert.match(sql,/insert into private\.account_privacy_suppressions/i);
  assert.match(sql,/on conflict\(account_id\) do nothing/i);
  assert.match(sql,/delete from public\.search_documents/i);
  assert.doesNotMatch(sql,/update public\.community_works\s+set lifecycle_state='deleted'/i);
  assert.doesNotMatch(sql,/storage\.objects\s+delete|storage\.remove|physicalDeleteAuthorized',true|finalized72hExpiryActive',true/i);
});

test('privacy requests preserve signed source identity and Supabase recent session', () => {
  assert.match(accountEdge,/withSupabase\(\{ auth: 'user' \}/);
  assert.match(accountEdge,/ctx\.userClaims\?\.id/);
  assert.match(accountEdge,/ctx\.jwtClaims\?\.session_id/);
  assert.match(accountEdge,/community_request_privacy_suppression_v1/);
  assert.match(accountEdge,/p_auth_subject: subject/);
  assert.match(accountEdge,/p_session_id: sessionId/);
  assert.match(accountEdge,/confirmation !== 'DELETE'/);
  assert.match(sql,/from auth\.sessions s/i);
  assert.match(sql,/s\.id=p_session_id and s\.user_id=p_auth_subject/i);
  assert.match(sql,/sessions_valid_after/i);
  assert.match(sql,/Recent authentication required/i);
  assert.match(sql,/pg_advisory_xact_lock/i);
  assert.match(sql,/for update/i);
});

test('read-time denial is independent of eventual Gallery Cloud cleanup', () => {
  assert.match(sql,/create or replace function private\.is_discoverable_work/i);
  assert.match(sql,/not private\.is_account_privacy_suppressed\(w\.owner_account_id\)/);
  assert.match(sql,/create or replace function private\.can_access_work/i);
  assert.match(sql,/create or replace function public\.community_get_creator_public_v1/i);
  assert.match(sql,/and private\.is_discoverable_work\(d\.work_id\)/);
  assert.match(sql,/create trigger community_works_privacy_positive_guard_v1/i);
  assert.match(sql,/new\.moderation_state='clear'/);
  assert.match(sql,/private\.resolve_active_account/i);
  assert.doesNotMatch(sql,/grant execute on function public\.community_request_privacy_suppression_v1[\s\S]{0,80}to authenticated/i);
});

test('source-only runner covers exact new ledger and local rollback evidence', () => {
  assert.match(workflow,/assert len\(fs\)==114/);
  assert.match(workflow,/MIGRATION_LEDGER_NOT_114/);
  assert.match(workflow,/local-clean-bootstrap-account-privacy-suppression-v1\.sql/);
  assert.match(workflow,/supabase\/migrations\/20261025002600_account_privacy_suppression_barrier_v1\.sql/);
});
