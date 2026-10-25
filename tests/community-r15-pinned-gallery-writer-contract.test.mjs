import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=[
 'supabase/migrations/20261025002840_gallery_caller_pinned_graph_r15.sql',
 'supabase/migrations/20261025002850_gallery_r15_signed_preflight.sql',
 'supabase/migrations/20261025002860_gallery_r15_actual_pinned_writer.sql',
 'supabase/migrations/20261025002870_gallery_r15_legacy_v4_guard.sql',
 'supabase/migrations/20261025002880_gallery_r15_rpc_acl.sql'
].map(read).join('\n');
const edge=read('supabase/functions/community-command/index.ts');
const workflow=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');
const race=read('tests/comm-r15-pinned-gallery-two-session.py');
test('R15 authoritative graph schema is versioned and digest is computed on server',()=>{
 assert.match(sql,/gallery-scene-scoped@r15/);
 assert.match(sql,/schemaVersion',1/);
 assert.match(sql,/private\.gallery_r15_canonical_snapshot/);
 assert.match(sql,/digest\(convert_to\(v_snapshot::text,'UTF8'\),'sha256'/);
 for(const key of ['expectedWorkStates','expectedArtifactIds','expectedPresetWorkIds','expectedGalleryWorkIds','historicalPresetLinks','mediaReferences','coverReferences'])assert.ok(sql.includes(key),key);
});
test('R15 actual Writer checks pinned caller graph under R14 graph lock and before mutation',()=>{
 const i=sql.indexOf('create or replace function public.community_publish_gallery_pinned_r15');
 const j=sql.indexOf('-- Fail closed legacy Scene bypass',i);
 assert.ok(i>=0&&j>i);
 const writer=sql.slice(i,j);
 const lock=writer.indexOf('perform private.gallery_v4_atomic_lock_scoped_r14(');
 const pin=writer.indexOf('R15_STALE_GRAPH_TERMINAL');
 const newRevision=writer.indexOf('insert into public.community_work_revisions(');
 assert.ok(lock>=0&&pin>lock&&newRevision>pin);
 assert.match(writer,/p_expected_graph_sha256 text default null/);
 assert.match(writer,/R15_IDEMPOTENCY_REQUEST_CONFLICT/);
 assert.ok(writer.indexOf('R15_IDEMPOTENCY_REQUEST_CONFLICT')<lock,'old committed request replay before new graph check');
 assert.match(writer,/pg_advisory_xact_lock/);
 assert.match(sql,/R15_PINNED_GRAPH_REQUIRED/);
 assert.doesNotMatch(sql,/graphComplete',true|retirementAuthorized',true/);
});
test('R15 preflight and pinned Writer remain service-role-only, Edge never refreshes pin',()=>{
 assert.match(sql,/revoke all on function public\.community_gallery_graph_preflight_r15/);
 assert.match(sql,/revoke all on function public\.community_publish_gallery_pinned_r15/);
 assert.match(edge,/preflightGalleryGraph: 'community_gallery_graph_preflight_r15'/);
 assert.match(edge,/publishGallery: 'community_publish_gallery_pinned_r15'/);
 assert.match(edge,/params\.p_expected_graph_sha256 = pin.expectedGraphSha256/);
 assert.match(edge,/error: staleGraph \? 'STALE_GRAPH'/);
 assert.match(edge,/\['40P01','55P03','40001'\]/);
});
test('R15 real two-connection negative, fresh, replay, historical lock are gated in bootstrap',()=>{
 assert.match(workflow,/len\(fs\)==130/);
 assert.match(workflow,/MIGRATION_LEDGER_NOT_130/);
 assert.match(workflow,/comm-r15-pinned-gallery-two-session\.py/);
 assert.match(race,/R15_STALE_CALLER_GRAPH_ACCEPTED/);
 assert.match(race,/R15_HISTORICAL_GALLERY_WORK_LOCK_BYPASSED/);
 assert.match(race,/R15_IDEMPOTENCY_MIXED_PIN_ACCEPTED/);
 assert.match(race,/03COMM_R15_PINNED_GALLERY_TWO_BACKEND_SOURCE_PASS/);
});
