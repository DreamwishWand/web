import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const edge=readFileSync('supabase/functions/community-public-query/index.ts','utf8');
const clean=edge.replace(/^import\s+\{[^\n]+\}\s+from\s+['"][^'"]+['"];?\s*$/gm,'');
assert(!/^import\s/m.test(clean),'unexpected import in exact integrated Edge; test harness must be reviewed');
const transpiled=ts.transpileModule(clean,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const harness=\`
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'};
const withSupabase=(_options,callback)=>req=>callback(req,{
  supabaseAdmin:{rpc:(name,params)=>globalThis.__qr235LocalRpc(name,params)}
});
\`;
const mock=await import('data:text/javascript;base64,'+
 Buffer.from(harness+transpiled).toString('base64'));
const request=(rpc,payload,options={})=>new Request('https://isolated.local.invalid/community-public-query',{
 method:options.method??'POST',
 headers:{'content-type':'application/json'},
 body:options.method==='GET'?undefined:JSON.stringify({rpc,payload})
});
const exec=(rpc,payload)=>mock.default.fetch(request(rpc,payload));
const PRIVATE='private, no-store',OLD='public, max-age=30';
const values={
 community_get_dreamsnap_results_public_v1:{p_challenge_id:'44444444-4444-4444-8444-444444444444'},
 community_list_dreamsnap_result_rounds_public_v1:{p_limit:5},
 community_get_gallery_dreamsnap_public_v1:{p_work_id:'33333333-3333-4333-8333-333333333333'},
 community_search_gallery_dreamsnaps_public_v1:{p_query:'wand',p_limit:5},
 community_get_gallery_photo_public_v1:{p_work_id:'33333333-3333-4333-8333-333333333333'},
 community_list_verified_gallery_subjects_v1:{p_gallery_kind:'outdoor',p_limit:5}
};
const audit=[];
test('real integrated Edge reply execution: identifying public 200 and post-RPC denied 404/400 never cache',async()=>{
 for(const [rpc,payload] of Object.entries(values)){
   for(const mode of ['positive','not-accessible','backend-error']){
     let touched=0;
     globalThis.__qr235LocalRpc=async(name,args)=>{
       touched++;
       assert.equal(name,rpc);
       assert.deepEqual(args,payload);
       if(mode==='positive')return {data:{workId:'SYNTHETIC_PUBLIC_WORK',title:'synthetic_result'},error:null};
       if(mode==='not-accessible')return {data:null,error:{message:'not accessible',code:'P0001',details:'SHOULD_NOT_RENDER'}};
       return {data:null,error:{message:'internal sensitive SQL detail',code:'P0001'}};
     };
     const response=await exec(rpc,payload);
     const data=await response.json();
     const expected=mode==='positive'?200:mode==='not-accessible'?404:400;
     assert.equal(response.status,expected,'RPC '+rpc+'/'+mode);
     assert.equal(response.headers.get('Cache-Control'),PRIVATE,'Edge sensitive '+rpc+'/'+mode);
     assert.equal(touched,1,'RPC dispatch');
     if(mode==='positive')assert.equal(data.workId,'SYNTHETIC_PUBLIC_WORK');
     else {
       assert.deepEqual(data,{error:mode==='not-accessible'?'NOT_FOUND':'PUBLIC_QUERY_FAILED'});
       assert(!JSON.stringify(data).includes('sensitive'),'no raw SQL error');
     }
     audit.push({rpc,mode,status:response.status,cache:response.headers.get('Cache-Control')});
   }
 }
 console.log(JSON.stringify({marker:'QR235_COMBINED_EDGE_SENSITIVE_POST_RPC_NO_STORE_PASS',
   testedResponses:audit.length,allHeadersPrivate:true,allBodiesNoRawSQL:true}));
});

test('distinct pre-dispatch invalid sensitive 400: observable cache parity limitation, non-identifying body',async()=>{
 const invalid={
   community_get_dreamsnap_results_public_v1:{p_challenge_id:'invalid'},
   community_get_gallery_dreamsnap_public_v1:{p_work_id:'invalid'},
   community_search_gallery_dreamsnaps_public_v1:{p_query:'x'.repeat(101)},
   community_list_dreamsnap_result_rounds_public_v1:{p_limit:'not-integer'},
   community_get_gallery_photo_public_v1:{p_work_id:'invalid'}
 };
 const observed=[];
 for(const [rpc,payload] of Object.entries(invalid)){
   globalThis.__qr235LocalRpc=async()=>{throw Error('INVALID_RPC_MUST_NOT_DISPATCH')};
   const response=await exec(rpc,payload);
   const body=await response.json();
   assert.equal(response.status,400);
   assert.deepEqual(body,{error:'Invalid public query parameters'});
   observed.push({rpc,header:response.headers.get('Cache-Control')});
 }
 const anyCacheable=observed.some(x=>x.header!==PRIVATE);
 console.log(JSON.stringify({marker:'QR235_PRE_DISPATCH_400_CACHE_PARITY',
   classification:anyCacheable?'PARTIAL_NONIDENTIFYING_PRE_DISPATCH_CACHE':'ALL_SENSITIVE_NO_STORE',
   observed,anonymousOnly:true,noSensitivePayloadReturned:true}));
 // This is a documented existing Owner review PARTIAL, not a new
 // anonymous RLS leak. Do not invert runtime results into a fake PASS.
 assert(observed.every(x=>x.header===OLD || x.header===PRIVATE));
 assert(anyCacheable,'expected integrated Owner HEAD pre-dispatch limitation changed; re-review new HEAD');
});

test('scene fail closed, disallowed generic Search RPC cannot bypass Edge allowlist',async()=>{
 globalThis.__qr235LocalRpc=async()=>{throw Error('SHOULD_NOT_DISPATCH')};
 const scene=await exec('community_get_scene_preset_public_v1',{p_work_id:'33333333-3333-4333-8333-333333333333'});
 assert.equal(scene.status,503);
 assert.equal(scene.headers.get('Cache-Control'),PRIVATE);
 const unavailable=await exec('community_search_public',{p_query:'x'});
 assert.equal(unavailable.status,400);
 assert.deepEqual(await unavailable.json(),{error:'Unsupported public query'});
 console.log(JSON.stringify({marker:'QR235_SCENE_FAILCLOSED_AND_GENERIC_RPC_SEPARATION_PASS'}));
});
