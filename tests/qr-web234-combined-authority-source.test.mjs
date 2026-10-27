import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolveTypedWorkRoute,parseTypedWorkQuery} from '../src/lib/community/typed-work-route.js';

const OWNER='d5ffe6fc3bd60e085414926bca7aa52c2ed9324e';
const COMM='5ddf4d23689643340c8d547e47b58f211e03291e';
const WEB='99ed88fc717cf18bb4127695f16d6949e7609463';
const blob=p=>execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=p=>readFileSync(p,'utf8');
const manifest=JSON.parse(source('docs/integration/web-source146-community-typed-owner-manifest-20261028.json'));

test('new-only composite ancestor + actual effective Edge/Migration bytes, no silent old WEB Edge',()=>{
 assert.equal(git('merge-base',COMM,OWNER),COMM);
 assert.equal(manifest.baseline.communityHead,COMM);
 assert.equal(manifest.baseline.webHead,WEB);
 const oldWebEdge='9d15f6a45c86ae6ec137955ef952f1f96b402d4b';
 const realEdge='supabase/functions/community-public-query/index.ts';
 assert.equal(blob(realEdge),'232c71ec6b7b275a1f2652ffacd3de976f178810');
 assert.notEqual(blob(realEdge),oldWebEdge);
 assert.equal(git('diff','--name-only',COMM,'HEAD','--','supabase/migrations','supabase/functions'),'');
 assert.equal(blob('supabase/migrations/20261027000030_generic_public_search_work_liveness_source146.sql'),
   '278bb69e990fc62956d28ee9563c9ecbc53b9f03');
 for(const f of manifest.communityAuthority.source141To146) {
   assert.equal(blob(f.path),f.blob,'final integrated migration regression '+f.path);
   assert.equal(git('rev-parse',COMM+':'+f.path),f.blob,'Owner baseline migration mismatch '+f.path);
 }
 const combined=new Set(manifest.overlay.files.map(f=>f.path));
 assert.equal(combined.size,39);
 for(const item of manifest.overlay.files) {
   assert.equal(blob(item.path),item.blob,'integrated accepted WEB UI differs '+item.path);
   assert.equal(git('rev-parse',WEB+':'+item.path),item.blob,'WEB source provenance mismatch '+item.path);
 }
});

test('merged anonymous RLS uses canonical type dispatch; restrictive R19 not lost',()=>{
 const r21=source('supabase/migrations/20261027000030_generic_public_search_work_liveness_source146.sql');
 assert.match(r21,/when w\.work_type = 'dreamsnap'[\s\S]*private\.dreamsnap_public_work_accessible_r20\(w\.work_id\)/);
 assert.match(r21,/else coalesce\(private\.is_discoverable_work\(w\.work_id\), false\)/);
 assert.match(r21,/drop policy if exists search_documents_public_read[\s\S]*create policy search_documents_public_read/);
 assert.equal((r21.match(/create policy search_documents_public_read/g)||[]).length,1);
 const r19=git('grep','-l','preset_storage_search_incident_read_barrier_r19','--','supabase/migrations').split('\n');
 assert(r19.some(x=>x.includes('supabase/migrations/')),'inherited R19 restrictive barrier missing');
 const sql=source('supabase/migrations/20261027000010_f08_f09_dreamsnap_public_work_liveness.sql');
 assert.match(sql,/private\.dreamsnap_public_work_accessible_r20/);
 const r145=source('supabase/migrations/20261027000020_legacy_dreamsnap_gallery_public_reader_liveness.sql');
 assert.match(r145,/private\.dreamsnap_public_work_accessible_r20/);
});

test('typed routes are safe against cross-domain ID/type confusion in exact combined tree',()=>{
 const id='33333333-3333-4333-8333-333333333333';
 const types={gallery:'/gallery/?work=',question:'/qa/?question=',tip:'/qa/?tip=',dreamsnap:'/dreamsnaps/'};
 for(const [type,prefix] of Object.entries(types)){
   const result=resolveTypedWorkRoute('',type,id);
   assert.equal(result.href,type==='dreamsnap'?prefix:prefix+id);
   assert.equal(result.status,type==='dreamsnap'?'gated':'ready');
 }
 for(const state of [{accountState:'restricted'},{visibility:'private'},
    {privacySuppressed:true},{retired:true},{moderationState:'held'},{deleted:true}])
   assert.equal(resolveTypedWorkRoute('','dreamsnap',id,state).href,null);
 for(const hostile of ['?tip='+id+'&tip='+id,'?tip='+id+'&question='+id,
   '?tip='+id+'&x=1','?tip=bad','?question='+id,'?tip=00000000-0000-0000-0000-000000000000'])
   assert.equal(parseTypedWorkQuery(hostile,'tip').status,'invalid');
 const qa=source('src/routes/qa/+page.svelte');
 assert(qa.includes('afterNavigate('));
 for(const fence of ['++routeGeneration','++searchGeneration','++detailGeneration',
   'expectedRoute === routeGeneration','selectedKind = null','rows = []'])
   assert(qa.includes(fence),'stale QA fence '+fence);
 const saved=source('src/routes/gallery/my/+page.svelte');
 assert(saved.includes('saved?.accessible !== true'));
 assert(saved.includes('resolveTypedWorkRoute'));
 assert(!source('src/routes/dreamsnaps/community/+page.svelte').includes('community_get_gallery_dreamsnap_public_v1'),
  'unaccepted positive DreamSnap Detail introduced');
});
