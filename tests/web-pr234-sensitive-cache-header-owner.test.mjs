import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Execute the actual Edge fetch/reply/sanitizer body, with only its two Deno
// imports substituted by a local in-process fake. No Stage/PG/CDN or network.
const edge=readFileSync('supabase/functions/community-public-query/index.ts','utf8');
const source=edge.replace(/^import\s+\{[^\n]+\}\s+from\s+['"][^'"]+['"];?\s*$/gm,'');
assert(!/^import\s/m.test(source),'Unexpected imports: local Edge fixture must be reviewed');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const shim=`
const corsHeaders={'Access-Control-Allow-Origin':'*'};
const withSupabase=(_opts,handler)=>(req)=>handler(req,{
  supabaseAdmin:{rpc:(rpc,params)=>globalThis.__web234Rpc(rpc,params)}
});
`;
const edgeModule=await import('data:text/javascript;base64,'+Buffer.from(shim+js).toString('base64'));
const endpoint='https://synthetic.local.invalid/community-public-query';
const query=(rpc,payload)=>edgeModule.default.fetch(new Request(endpoint,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({rpc,payload})
}));
const PRIVATE='private, no-store',CACHE='public, max-age=30';
const UUID='33333333-3333-4333-8333-333333333333';
const invalid=[
 ['community_get_dreamsnap_results_public_v1',{p_challenge_id:'bad'}],
 ['community_get_dreamsnap_results_public_v1',{p_challenge_id:42}],
 ['community_get_gallery_dreamsnap_public_v1',{p_work_id:'bad'}],
 ['community_get_gallery_photo_public_v1',{p_work_id:null}],
 ['community_search_gallery_dreamsnaps_public_v1',{p_query:'x'.repeat(101)}],
 ['community_search_gallery_dreamsnaps_public_v1',{p_limit:'not-integer'}],
 ['community_list_dreamsnap_result_rounds_public_v1',{p_limit:'five'}],
 ['community_list_dreamsnap_result_rounds_public_v1',{p_limit:4.5}],
 ['community_list_verified_gallery_subjects_v1',{p_gallery_kind:'private'}],
 ['community_list_verified_gallery_subjects_v1',{p_limit:101}],
];

test('QR235 RED repair: 10 allowlisted sensitive malformed parameter HTTP 400 are private, no-store and never dispatch',async()=>{
 let dispatched=0;
 globalThis.__web234Rpc=async()=>{dispatched++;throw Error('INVALID_PARAMS_MUST_NOT_DISPATCH')};
 for(const [rpc,payload] of invalid){
   const response=await query(rpc,payload);
   assert.equal(response.status,400,rpc);
   assert.equal(response.headers.get('Cache-Control'),PRIVATE,rpc+' '+JSON.stringify(payload));
   assert.deepEqual(await response.json(),{error:'Invalid public query parameters'});
 }
 assert.equal(dispatched,0,'malformed/unknown sensitive parameters cannot reach DB');
 console.log(JSON.stringify({marker:'WEB234_QR235_SENSITIVE_PREDISPATCH_400_NO_STORE_PASS',cases:invalid.length,dispatches:dispatched}));
});

test('existing sensitive 200 and post-RPC denied 400/404 cache contract stays private with fixed body',async()=>{
 const sensitive=[
 ['community_get_dreamsnap_results_public_v1',{p_challenge_id:UUID}],
 ['community_get_gallery_dreamsnap_public_v1',{p_work_id:UUID}],
 ['community_get_gallery_photo_public_v1',{p_work_id:UUID}],
 ['community_search_gallery_dreamsnaps_public_v1',{p_query:'x',p_limit:3}],
 ['community_list_dreamsnap_result_rounds_public_v1',{p_limit:3}],
 ['community_list_verified_gallery_subjects_v1',{p_gallery_kind:'outdoor',p_limit:3}],
 ];
 let count=0;
 for(const [rpc,payload] of sensitive){
   for(const kind of ['ok','denied','error']){
     let dispatch=0;
     globalThis.__web234Rpc=async(gotRpc)=>{dispatch++;assert.equal(gotRpc,rpc);
       if(kind==='ok')return {data:{synthetic:'result'},error:null};
       return {data:null,error:{message:kind==='denied'?'not accessible':'SQL INTERNAL DETAIL must not escape'}};
     };
     const response=await query(rpc,payload);
     assert.equal(response.status,kind==='ok'?200:kind==='denied'?404:400,rpc+'/'+kind);
     assert.equal(response.headers.get('Cache-Control'),PRIVATE,rpc+'/'+kind);
     assert.equal(dispatch,1,rpc+'/'+kind);
     const responseBody=await response.json();
     assert.deepEqual(responseBody,kind==='ok'?{synthetic:'result'}:{error:kind==='denied'?'NOT_FOUND':'PUBLIC_QUERY_FAILED'});
     count++;
   }
 }
 console.log(JSON.stringify({marker:'WEB234_SENSITIVE_DISPATCH_200_400_404_NO_STORE_PASS',cases:count}));
});

test('unchanged generic JSON/unknown RPC errors, Scene 503, and non-sensitive responses',async()=>{
 let dispatched=0;
 globalThis.__web234Rpc=async()=>{dispatched++;return {data:{public:'generic'},error:null}};
 const invalidJSON=await edgeModule.default.fetch(new Request(endpoint,{method:'POST',body:'{not-json'}));
 assert.equal(invalidJSON.status,400);
 assert.equal(invalidJSON.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await invalidJSON.json(),{error:'Invalid JSON body'});
 const unknown=await query('community_search_public',{p_query:'x'});
 assert.equal(unknown.status,400);
 assert.equal(unknown.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await unknown.json(),{error:'Unsupported public query'});
 const scene=await query('community_get_scene_preset_public_v1',{p_work_id:UUID});
 assert.equal(scene.status,503);
 assert.equal(scene.headers.get('Cache-Control'),PRIVATE);
 assert.deepEqual(await scene.json(),{error:'SCENE_PUBLIC_READER_COMPATIBILITY_UNVERIFIED'});
 const nonSensitive=await query('community_get_tip_public_v1',{p_tip_id:UUID});
 assert.equal(nonSensitive.status,200);
 assert.equal(nonSensitive.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await nonSensitive.json(),{public:'generic'});
 const invalidTip=await query('community_get_tip_public_v1',{p_tip_id:'bad'});
 assert.equal(invalidTip.status,400);
 assert.equal(invalidTip.headers.get('Cache-Control'),CACHE);
 assert.deepEqual(await invalidTip.json(),{error:'Invalid public query parameters'});
 assert.equal(dispatched,1);
 console.log(JSON.stringify({marker:'WEB234_GENERIC_AND_SCENE_BEHAVIOR_UNCHANGED_PASS'}));
});
