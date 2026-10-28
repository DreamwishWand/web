import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const original=[
 ['supabase/migrations/202609300001_community_core_v0.sql','4be2e65544110035f1846d91ecd8fa3c1c5f5fc7'],
 ['supabase/migrations/20260930114310_community_core_v0_public_search.sql','70ab98552244ddad7501237a83b836a8308514a1'],
 ['supabase/migrations/20261003044600_community_dreamsnaps_native_revision_fix_v1.sql','e9489cfad4d85d4ef654ac6010c5a2dc955c34fb'],
 ['supabase/migrations/20261027000010_f08_f09_dreamsnap_public_work_liveness.sql','64fe31ac0424b0032553c51a9aca7f10d79f6d36'],
 ['supabase/migrations/20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql','b1fc4990a057f810aeb4b1a12a602a68c9b0330f'],
];
const migration='supabase/migrations/20261027000030_generic_public_search_work_liveness_source146.sql';
const sql=readFileSync(migration,'utf8');
test('Source146 adds exactly one forward-only migration; protected predecessor bytes unchanged',()=>{
 assert.equal(readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).length,149);
  assert.ok(readdirSync('supabase/migrations').includes('20261028000000_x05_shared_dreamsnap_metadata_staged_v1.sql'));
  assert.ok(readdirSync('supabase/migrations').includes('20261028000020_x05_nonpublic_consent_phase_revoke_controls.sql'));
 for(const [p,sha] of original)assert.equal(execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim(),sha,p);
});
test('actual Work.type dispatch; non-DreamSnap path exactly delegates prior discoverability',()=>{
 assert.match(sql,/from public\.community_works w[\s\S]*where w\.work_id = p_work_id/);
 assert.match(sql,/when w\.work_type = 'dreamsnap'[\s\S]*private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/);
 assert.match(sql,/else coalesce\(private\.is_discoverable_work\(w\.work_id\), false\)/);
 assert.doesNotMatch(sql,/official_result_account_consent|dreamsnap_public_official_result/);
});
test('exact existing SearchDocument SELECT policy replacement not additive OR permissive policy',()=>{
 assert.match(sql,/drop policy if exists search_documents_public_read on public\.search_documents/);
 assert.match(sql,/create policy search_documents_public_read[\s\S]*for select to anon, authenticated[\s\S]*using \(coalesce\(private\.generic_public_search_work_accessible_r21\(work_id\), false\)\)/);
 assert.equal((sql.match(/create policy /g)||[]).length,1);
 assert.doesNotMatch(sql,/create or replace function public\.community_search_public|community_search_gallery_dreamsnaps_public_v1|community_get_gallery_dreamsnap_public_v1/);
});
test('SECURITY DEFINER RLS boolean bridge avoids granting Source144 r20 direct anon privilege',()=>{
 assert.match(sql,/security definer[\s\S]*set search_path = pg_catalog, public, private/);
 assert.match(sql,/revoke all on function private\.generic_public_search_work_accessible_r21\(uuid\)[\s\S]*from public, anon, authenticated, service_role/);
 assert.match(sql,/grant execute on function private\.generic_public_search_work_accessible_r21\(uuid\)[\s\S]*to anon, authenticated/);
 const s144=readFileSync(original[3][0],'utf8');
 assert.match(s144,/revoke all on function private\.dreamsnap_public_work_accessible_r20\(uuid\)[\s\S]*from public,anon,authenticated,service_role/);
});
