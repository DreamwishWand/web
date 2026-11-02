import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const s155=read('supabase/migrations/20261102010000_community_source155_verified_first_account_bootstrap.sql');
const s156=read('supabase/migrations/20261103010000_community_source156_signed_gallery_r16_atomic_writer.sql');
const edge=read('supabase/functions/community-command/index.ts');
const media=read('supabase/functions/community-media/index.ts');
const preset=read('supabase/functions/wep-preset-artifact/index.ts');
const query=read('supabase/functions/community-query/index.ts');
const workflow=read('.github/workflows/comm-source156-cumulative-genuine-signed.yml');
const legacy=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');

test('source155 remains actual first signed Account bootstrap, source156 only adds atomic R16',()=>{
 const fs=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(p=>p.endsWith('.sql')).sort();
 assert.equal(fs.length,156);
 assert.equal(fs.at(-2),'20261102010000_community_source155_verified_first_account_bootstrap.sql');
 assert.equal(fs.at(-1),'20261103010000_community_source156_signed_gallery_r16_atomic_writer.sql');
 assert.match(s155,/create or replace function public\.community_ensure_account_creator_signed_v1/);
 assert.match(s155,/pg_advisory_xact_lock/);
 assert.match(s155,/from auth\.sessions s/);
 assert.match(s155,/profile_visibility='private'/);
 assert.match(s156,/create or replace function private\.community_legacy_signed_writer_guard_v1/);
 assert.match(s156,/for share/);
 assert.match(s156,/public\.community_authorize_signed_session_v2/);
 assert.match(s156,/public\.community_set_gallery_comments_enabled_atomic_r16/);
 assert.match(s156,/revoke all on function public\.community_set_gallery_comments_enabled_atomic_r16/);
 assert.match(s156,/grant execute on function public\.community_set_gallery_comments_enabled_atomic_signed_v1/);
 assert.doesNotMatch(s156,/create table |insert into public\.wand_accounts|update public\.auth_identities/i);
});

test('only signed verified R16 command remapped; source155 special A0 not lost',()=>{
 assert.match(edge,/ensureAccountCreator: 'community_ensure_account_creator_signed_v1'/);
 assert.match(edge,/if \(command !== 'ensureAccountCreator'\)/);
 assert.match(edge,/setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_signed_v1'/);
 assert.match(edge,/params\.p_session_id = sessionId/);
 assert.match(edge,/params\.p_issued_at_epoch = issuedAt/);
 assert.match(edge,/params\.p_expected_current_revision_id = payload.expectedCurrentRevisionId/);
 assert.match(edge,/params\.p_expected_version = payload.expectedVersion/);
 assert.match(edge,/publishGallery: 'community_publish_gallery_pinned_r15'/);
 assert.match(edge,/R16_STALE_WORK_TERMINAL/);
 assert.match(edge,/source154|source155|Source154|Source155/);
});

test('all owner paths preserve four signed private headers; no Media/Preset public URL enabling',()=>{
 for(const src of [edge,media,preset,query]) {
  for(const part of ["'Cache-Control'", "'CDN-Cache-Control'", "'Surrogate-Control'", "'Vary'"])
    assert.ok(src.includes(part),part);
  assert.match(src,/Authorization, Origin/);
 }
 assert.match(media,/rawStorageSignedUrlIssued:false/);
 assert.match(preset,/revisionReadiness/);
 assert.match(preset,/community_scene_revision_readiness_v1/);
});

test('composite CI proves clean install, no-seed reset and genuine signed both writer orders',()=>{
 assert.match(workflow,/supabase start/);
 assert.match(workflow,/supabase db reset --no-seed/);
 assert.match(workflow,/comm-source156-cumulative-gotrue-local\.py/);
 assert.match(workflow,/comm-source156-eligible-atomic-real-signed-local\.py/);
 assert.match(workflow,/COMPOSED_SOURCE156_TWO_POSTGRES_LOCK_ORDER_GLOBAL_PASS/);
 assert.match(legacy,/assert len\(fs\)==148/);
 assert.match(legacy,/MIGRATION_LEDGER_NOT_148/);
 assert.match(legacy,/MIGRATION_LEDGER_NOT_156/);
 assert.match(legacy,/SOURCE156_POST_LEGACY_REPLAY_UNBOUND_R16_CLOSED/);
});
