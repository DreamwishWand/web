import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const owner='5ddf4d23689643340c8d547e47b58f211e03291e';
const parent='f9e9a4d3dc6f92a16c8ecbc6be4cb73faf808d75';
const source146='supabase/migrations/20261027000030_generic_public_search_work_liveness_source146.sql';
const sql=readFileSync(source146,'utf8');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('actual Source146 blob, exact Owner ancestor and unchanged 141-145 full tree',()=>{
 assert.equal(git('hash-object',source146),'278bb69e990fc62956d28ee9563c9ecbc53b9f03');
 assert.equal(git('merge-base',owner,parent),parent);
 const now= readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql'));
 assert.equal(now.length,146);
 const old=git('ls-tree','-r','--name-only',parent,'supabase/migrations').split('\n').filter(x=>x.endsWith('.sql'));
 assert.equal(old.length,145);
 const additions=now.filter(x=>!old.includes('supabase/migrations/'+x));
 assert.deepEqual(additions,['20261027000030_generic_public_search_work_liveness_source146.sql']);
 const selected=['20261025003050','20261025003060','20261027000000','20261027000010','20261027000020'];
 for(const prefix of selected) {
   const matches=old.filter(x=>x.split('/').at(-1).startsWith(prefix+'_'));
   assert.equal(matches.length,1,'Source 141-145 migration missing: '+prefix);
   const file=matches[0];
   const parentBlob=git('rev-parse',parent+':'+file);
   assert.equal(git('hash-object',file),parentBlob,file);
 }
 assert.equal(git('hash-object','supabase/migrations/20261027000010_f08_f09_dreamsnap_public_work_liveness.sql'),'64fe31ac0424b0032553c51a9aca7f10d79f6d36');
 assert.equal(git('hash-object','supabase/migrations/20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql'),'b1fc4990a057f810aeb4b1a12a602a68c9b0330f');
});
test('Source146 replaces rather than adds an OR permissive RLS, retains non-DreamSnap baseline',()=>{
 assert.match(sql,/drop policy if exists search_documents_public_read on public\.search_documents/);
 assert.equal((sql.match(/create policy /g)||[]).length,1);
 assert.match(sql,/using \(coalesce\(private\.generic_public_search_work_accessible_r21\(work_id\), false\)\)/);
 assert.match(sql,/when w\.work_type = 'dreamsnap'[\s\S]*dreamsnap_public_work_accessible_r20\(w\.work_id\)/);
 assert.match(sql,/else coalesce\(private\.is_discoverable_work\(w\.work_id\), false\)/);
 assert.match(sql,/security definer[\s\S]*set search_path = pg_catalog, public, private/);
 assert.match(sql,/revoke all on function private\.generic_public_search_work_accessible_r21\(uuid\)[\s\S]*from public, anon, authenticated, service_role/);
 assert.match(sql,/grant execute on function private\.generic_public_search_work_accessible_r21\(uuid\)[\s\S]*to anon, authenticated/);
 assert.doesNotMatch(sql,/create or replace function public\.community_search_public/);
});
test('Independent two actual PG fixture uses only real canonical publishers, anon and policy catalogue',()=>{
 const py=readFileSync('tests/qr-source146-generic-search-independent-two-pg.py','utf8');
 assert.match(py,/select public\.community_dreamsnap_publish_gallery_v1/);
 assert.match(py,/select public\.community_ask_question_v1/);
 assert.match(py,/set local role anon/);
 assert.match(py,/pg_backend_pid/);
 assert.match(py,/from pg_policies/);
 assert.match(py,/from pg_proc/);
 assert.match(py,/INDEPENDENT_POST_OWNER_PASS/);
 assert.match(py,/ACCOUNT_RESTRICTED/);
 assert.match(py,/IDENTITY_RETIRED/);
 assert.match(py,/CREATOR_ENTITY_TOMBSTONE/);
 assert.match(py,/PRIVACY_SUPPRESSED/);
 assert.doesNotMatch(py,/insert into public\.search_documents\s*\(/i);
 assert.match(py,/not os\.getenv\("DATABASE_URL"\)/);
});
