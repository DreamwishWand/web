import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const BEFORE='d5ffe6fc3bd60e085414926bca7aa52c2ed9324e';
const OWNER='b907a86d67887bf841179f23824e5b26085520c3';
const COMM='5ddf4d23689643340c8d547e47b58f211e03291e';
const EDGE='supabase/functions/community-public-query/index.ts';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const sqlPath='supabase/migrations/';
const PRIVATE='private, no-store';
const CACHE='public, max-age=30';
const UUID='33333333-3333-4333-8333-333333333333';

test('exact owner before/after: one changed executable Edge path; old independent RED preserved',()=>{
  assert.equal(git('merge-base',BEFORE,OWNER),BEFORE);
  assert.equal(git('merge-base',COMM,OWNER),COMM);
  const changed=git('diff','--name-only',BEFORE,OWNER,'--','supabase');
  assert.equal(changed,EDGE,'unexpected DB/other Edge mutation');
  assert.equal(git('diff','--name-only',BEFORE,OWNER,'--',sqlPath),'');
  assert.equal(git('rev-parse',OWNER+':'+EDGE),
    'c0d34aae0ab2db87f10ec32c74c3d1f11da371c1');
  assert.equal(git('rev-parse',BEFORE+':'+EDGE),
    '232c71ec6b7b275a1f2652ffacd3de976f178810');
  assert.equal(git('hash-object',EDGE),
    'c0d34aae0ab2db87f10ec32c74c3d1f11da371c1');
  const prior=git('show',BEFORE+':'+EDGE), now=readFileSync(EDGE,'utf8');
  const members=(text)=>text.slice(text.indexOf('const noStore ='),text.indexOf(';',text.indexOf('const noStore ='))+1);
  assert.equal(members(prior),members(now),'Sensitive RPC allowlist changed');
  assert(prior.indexOf('if (params === null)')<prior.indexOf('const noStore ='));
  assert(now.indexOf('const noStore =')<now.indexOf('const params ='));
  assert(now.indexOf('const params =')<now.indexOf('if (params === null)'));
  assert(now.includes("reply({ error: 'Invalid public query parameters' }, 400, noStore)"));
  console.log(JSON.stringify({marker:'QR_POST235_EXACT_OWNER_EDGE_DELTA_PIN_PASS',owner:OWNER,edgeBlob:git('hash-object',EDGE)}));
});

test('Source141-146 and typed route bytes still identical to pre-fix integrated owner',()=>{
 const m=JSON.parse(readFileSync('docs/integration/web-source146-community-typed-owner-manifest-20261028.json','utf8'));
 for(const item of m.communityAuthority.source141To146) {
   assert.equal(git('hash-object',item.path),item.blob,item.path);
   assert.equal(git('rev-parse',BEFORE+':'+item.path),item.blob,'pre-fix SQL drift');
   assert.equal(git('rev-parse',OWNER+':'+item.path),item.blob,'post-fix SQL drift');
 }
 for(const path of [
   'src/lib/community/typed-work-route.js','src/routes/creator/+page.svelte',
   'src/routes/qa/+page.svelte','src/routes/gallery/my/+page.svelte',
   'src/routes/dreamsnaps/community/+page.svelte',
   'src/lib/community/browser-client.ts'
 ]) {
   const a=git('rev-parse',BEFORE+':'+path);
   const b=git('rev-parse',OWNER+':'+path);
   assert.equal(a,b,'Typed route source changed unexpectedly '+path);
 }
 console.log(JSON.stringify({marker:'QR_POST235_MIGRATIONS_AND_TYPED_CONSUMERS_UNCHANGED',count:m.communityAuthority.source141To146.length}));
});

const raw=readFileSync(EDGE,'utf8');
const withoutImports=raw.replace(/^import\s+\{[^\n]+\}\s+from\s+['"][^'"]+['"];?\s*$/gm,'');
assert(!/^import\s/m.test(withoutImports),'unexpected Edge imports');
const transpiled=ts.transpileModule(withoutImports,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const shim=`
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
const withSupabase=(_opts,callback)=>req=>callback(req,{
 supabaseAdmin:{rpc:(name,params)=>globalThis.__qrPost235Rpc(name,params)}
});
`;
const runtime=await import('data:text/javascript;base64,'+Buffer.from(shim+transpiled).toString('base64'));
const endpoint='https://qr-post235-isolated.invalid/community-public-query';
function http(rpc,payload,options={}){
 const body=options.body??JSON.stringify({rpc,payload});
 return runtime.default.fetch(new Request(endpoint,{method:options.method??'POST',body:options.method==='GET'?undefined:body}));
}

test('independent 12 pre-dispatch sensitive invalid params: exact HTTP 400 private/no-store; no DB RPC and safe fixed body',async()=>{
 const cases=[
  ['community_get_dreamsnap_results_public_v1',{p_challenge_id:'invalid'}],
  ['community_get_dreamsnap_results_public_v1',{p_challenge_id:123}],
  ['community_get_gallery_dreamsnap_public_v1',{p_work_id:'not-a-uuid'}],
  ['community_get_gallery_dreamsnap_public_v1',{p_work_id:null}],
  ['community_get_gallery_photo_public_v1',{p_work_id:'bad'}],
  ['community_get_gallery_photo_public_v1',{p_work_id:[]}] ,
  ['community_search_gallery_dreamsnaps_public_v1',{p_query:'a'.repeat(101)}],
  ['community_search_gallery_dreamsnaps_public_v1',{p_limit:'string'}],
  ['community_list_dreamsnap_result_rounds_public_v1',{p_limit:1.5}],
  ['community_list_dreamsnap_result_rounds_public_v1',{p_limit:'x'}],
  ['community_list_verified_gallery_subjects_v1',{p_gallery_kind:'hidden'}],
  ['community_list_verified_gallery_subjects_v1',{p_limit:101}]
 ];
 let executed=0;
 globalThis.__qrPost235Rpc=async()=>{executed++;throw Error('POST235_DENIED_MUST_NOT_DISPATCH')};
 const proof=[];
 for(const [rpc,payload] of cases){
   const response=await http(rpc,payload);
   assert.equal(response.status,400,rpc);
   assert.equal(response.headers.get('Cache-Control'),PRIVATE,rpc);
   const text=await response.text();
   assert.deepEqual(JSON.parse(text),{error:'Invalid public query parameters'});
   assert(!/account|workid|creator|media|signature|secret|sql/i.test(text));
   proof.push({rpc,status:response.status,cache:response.headers.get('Cache-Control'),body:text});
 }
 assert.equal(executed,0,'invalid requests reached RPC');
 console.log(JSON.stringify({marker:'QR_POST235_INDEPENDENT_SENSITIVE_PREDISPATCH_400_PASS',
   classification:'INDEPENDENT_POST_OWNER_PASS',cases:proof.length,dispatches:executed,proof}));
});

test('limited positive/denial differential: 6 sensitive readers each successful 200; selected post-RPC 404 and 400 unchanged',async()=>{
 const normal=[
  ['community_get_dreamsnap_results_public_v1',{p_challenge_id:UUID}],
  ['community_list_dreamsnap_result_rounds_public_v1',{p_limit:2}],
  ['community_get_gallery_dreamsnap_public_v1',{p_work_id:UUID}],
  ['community_search_gallery_dreamsnaps_public_v1',{p_query:'a',p_limit:2}],
  ['community_get_gallery_photo_public_v1',{p_work_id:UUID}],
  ['community_list_verified_gallery_subjects_v1',{p_gallery_kind:'indoor',p_limit:2}]
 ];
 const samples=[];
 for(const [rpc,payload] of normal){
   globalThis.__qrPost235Rpc=async(r,p)=>{
     assert.equal(r,rpc);assert.deepEqual(p,payload);
     return {data:{display:'SYNTHETIC_PUBLIC_ONLY'},error:null};
   };
   const response=await http(rpc,payload);
   assert.equal(response.status,200,rpc);
   assert.equal(response.headers.get('Cache-Control'),PRIVATE,rpc);
   assert.deepEqual(await response.json(),{display:'SYNTHETIC_PUBLIC_ONLY'});
   samples.push(rpc);
 }
 for(const mode of ['denied','internal-error']){
   globalThis.__qrPost235Rpc=async()=>({data:null,error:{
      message:mode==='denied'?'not accessible':'SENSITIVE_SQL_INTERNAL_SHOULD_NOT_EXPOSE'}});
   const response=await http('community_get_gallery_dreamsnap_public_v1',{p_work_id:UUID});
   assert.equal(response.status,mode==='denied'?404:400);
   assert.equal(response.headers.get('Cache-Control'),PRIVATE);
   const body=await response.json();
   assert.deepEqual(body,{error:mode==='denied'?'NOT_FOUND':'PUBLIC_QUERY_FAILED'});
 }
 console.log(JSON.stringify({marker:'QR_POST235_POST_RPC_200_400_404_LIMITED_REGRESSION_PASS',normal200:samples.length,negative:2}));
});

test('unsupported RPC, invalid JSON, non-sensitive Tip, Scene 503, GET/OPTIONS preserved',async()=>{
 let calls=0;
 globalThis.__qrPost235Rpc=async()=>{calls++;return {data:{value:'public'},error:null}};
 const badJSON=await http('ignored',null,{body:'{malformed'});
 assert.equal(badJSON.status,400);assert.equal(badJSON.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await badJSON.json(),{error:'Invalid JSON body'});
 const unsupported=await http('community_search_public',{p_query:'x'});
 assert.equal(unsupported.status,400);assert.equal(unsupported.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await unsupported.json(),{error:'Unsupported public query'});
 const scene=await http('community_get_scene_preset_public_v1',{p_work_id:UUID});
 assert.equal(scene.status,503);assert.equal(scene.headers.get('Cache-Control'),PRIVATE);
 assert.deepEqual(await scene.json(),{error:'SCENE_PUBLIC_READER_COMPATIBILITY_UNVERIFIED'});
 const tip=await http('community_get_tip_public_v1',{p_tip_id:UUID});
 assert.equal(tip.status,200);assert.equal(tip.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await tip.json(),{value:'public'});
 const invalidTip=await http('community_get_tip_public_v1',{p_tip_id:'not-uuid'});
 assert.equal(invalidTip.status,400);assert.equal(invalidTip.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await invalidTip.json(),{error:'Invalid public query parameters'});
 const get=await http('community_get_tip_public_v1',null,{method:'GET'});
 assert.equal(get.status,405);assert.deepEqual(await get.json(),{error:'POST required'});
 const options=await runtime.default.fetch(new Request(endpoint,{method:'OPTIONS'}));
 assert.equal(options.status,200);assert.equal(await options.text(),'ok');
 assert.equal(calls,1);
 console.log(JSON.stringify({marker:'QR_POST235_EDGE_GENERIC_NON_SENSITIVE_AND_SCENE_PARITY_PASS',calls}));
});
