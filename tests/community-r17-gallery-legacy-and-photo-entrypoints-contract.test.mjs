import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const v1=r('supabase/migrations/20261025002920_r17_legacy_gallery_comments_v1_closed.sql');
const v2=r('supabase/migrations/20261025002930_r17_legacy_gallery_comments_v2_dreamsnaps_preserved.sql');
const photo=r('supabase/migrations/20261025002940_r17_gallery_photo_direct_history_guard.sql');
const workflow=r('.github/workflows/comm-clean-bootstrap-acceptance.yml');
const edge=r('supabase/functions/community-command/index.ts');
const testSql=r('tests/comm-r17-photo-legacy-comments-two-session.py');
test('legacy direct v1 Gallery always terminal-denied and v2 Gallery not delegated, DreamSnaps managed rules preserved',()=>{
 assert.match(v1,/create or replace function public\.community_set_gallery_comments_enabled_v1\(/);
 assert.match(v1,/R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED/);
 assert.doesNotMatch(v1,/insert into public\.gallery_work_settings|update public\.search_documents|insert into public\.audit_events/);
 assert.match(v2,/create or replace function public\.community_set_gallery_comments_enabled_v2\(/);
 const g=v2.indexOf("if v_type='gallery' then");
 const d=v2.indexOf("select e.managed_under13");
 assert.ok(g>=0&&d>g);
 assert.match(v2.slice(g,d),/R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED/);
 assert.doesNotMatch(v2.slice(g,d),/community_set_gallery_comments_enabled_v1/);
 assert.match(v2,/if v_managed and p_enabled then/);
 assert.match(v2,/p_enabled:=case when v_managed then false else p_enabled end/);
 assert.match(v2,/update public\.dreamsnap_gallery_publications/);
 assert.match(edge,/setGalleryCommentsEnabled: 'community_set_gallery_comments_enabled_v2'/);
 assert.match(edge,/R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED/);
 assert.match(edge,/R17_PHOTO_DEPENDENCY_NOT_ENROLLED/);
 assert.match(edge,/UNENROLLED_GRAPH_WRITER/);
 assert.match(edge,/setGalleryCommentsAtomicR16: 'community_set_gallery_comments_enabled_atomic_r16'/);
});
test('Photo actual writer locks Account then Gallery before advisory, denies direct+historic before any revision insert',()=>{
 const account=photo.indexOf('from public.wand_accounts');
 const lock=photo.indexOf('for update nowait');
 const direct=photo.indexOf('associated_gallery_work_id=p_work_id');
 const history=photo.indexOf('from public.gallery_revision_presets gp');
 const advisory=photo.indexOf('pg_advisory_xact_lock');
 const mutate=photo.indexOf('insert into public.community_work_revisions(');
 assert.ok(account>=0&&lock>account&&direct>lock&&history>direct&&advisory>history&&mutate>advisory);
 assert.match(photo,/R17_PHOTO_DEPENDENCY_NOT_ENROLLED/);
 assert.match(photo,/creator_profile_id=p_creator_profile_id/);
 assert.match(photo,/private\.resolve_active_account/);
 assert.match(photo,/associated_gallery_work_id=v_work_id/);
 assert.match(photo,/where cr.work_id=v_work_id/);
 assert.match(photo,/community_publish_gallery_v4/);
 assert.doesNotMatch(photo,/delete from public/);
});
test('R17 actual two-session negatives and DreamSnaps under13 are wired into 135 migration isolated bootstrap',()=>{
 assert.match(workflow,/assert len\(fs\)==135/);
 assert.match(workflow,/MIGRATION_LEDGER_NOT_135/);
 assert.match(workflow,/comm-r17-photo-legacy-comments-two-session\.py/);
 for(const marker of ['R17_PHOTO_','R17_LEGACY_GALLERY_COMMENTS_',
 'R17_DREAMSNAPS_UNDER13_V2_UNCHANGED','R17_PHOTO_DEPENDENCY_NOT_ENROLLED',
 'R17_LEGACY_GALLERY_COMMENTS_PIN_REQUIRED'])assert.ok(testSql.includes(marker),marker);
 assert.match(testSql,/03COMM_R17_ACTUAL_SOURCE_LEGACY_COMMENTS_AND_PHOTO_TWO_BACKEND_PASS/);
});
