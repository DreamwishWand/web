import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const exact = [
 ['supabase/migrations/20260930114310_community_core_v0_public_search.sql','70ab98552244ddad7501237a83b836a8308514a1'],
 ['supabase/migrations/202609300001_community_core_v0.sql','4be2e65544110035f1846d91ecd8fa3c1c5f5fc7'],
 ['supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql','e9489cfad4d85d4ef654ac6010c5a2dc955c34fb'],
 ['supabase/migrations/20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql','b1fc4990a057f810aeb4b1a12a602a68c9b0330f'],
];
test('pinned four immutable Source provenance blobs and exact 145 files',()=>{
 for(const [p,sha] of exact) {
  assert.equal(execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim(),sha,p);
 }
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,145);
});
test('X06 actual generic search is SECURITY INVOKER, anon RLS, source only',()=>{
 const search=readFileSync(exact[0][0],'utf8');
 const base=readFileSync(exact[1][0],'utf8');
 const fix=readFileSync(exact[3][0],'utf8');
 assert.match(search,/security invoker/i);
 assert.match(search,/to anon,authenticated/i);
 assert.match(base,/create policy search_documents_public_read[\s\S]*?private\.is_discoverable_work\(work_id\)/i);
 assert.match(fix,/private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/);
});
test('real SQL fixture creates SearchDocument ONLY by canonical Gallery publisher',()=>{
 const p=readFileSync('tests/qr-x06-generic-public-search-anon-two-pg.py','utf8');
 assert.match(p,/community_dreamsnap_publish_gallery_v1/);
 assert.match(p,/set local role anon/);
 assert.match(p,/select public\.community_search_public/);
 assert.match(p,/pg_backend_pid/);
 assert.doesNotMatch(p,/insert into public\.search_documents/i);
 assert.match(p,/CONFIRMED LOCAL RED/);
 assert.match(p,/NOT_REPRODUCED/);
 assert.match(p,/DDVRE_PRIVACY_ISOLATED_LOCAL/);
 assert.match(p,/not os\.getenv\("DATABASE_URL"\)/);
});