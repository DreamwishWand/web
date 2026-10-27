import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
const src=readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts',import.meta.url),'utf8');
const transpiled=ts.transpileModule(src.replace(/^import[^\n]+\n/gm,''),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__edge = {');
const owner='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const reservationId='33333333-3333-4333-8333-333333333333';
const token='44444444-4444-4444-8444-444444444444';
const sourceKey='staging/'+owner+'/55555555-5555-4555-8555-555555555555.json';
const publishedKey='published/'+owner+'/'+'a'.repeat(64)+'.json';
const scene={schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
 bounds:{w:1,h:1},originPolicy:'capture-region-top-left',
 objects:[{artifactObjectId:'o1',itemId:123,localX:0,localY:0,orientation:0,
 footprint:[{x:0,y:0}],dependencyIds:[]}]};
const valid=new TextEncoder().encode(JSON.stringify(scene));
async function digest(bytes){return Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',bytes)),
 b=>b.toString(16).padStart(2,'0')).join('')}
async function harness(cfg={}){
 const sha=await digest(valid),calls={rpc:[],download:[],copy:[],remove:[]};
 const store=new Map([[sourceKey,cfg.badStage?new TextEncoder().encode('bad'):valid]]);
 if(!cfg.missingPublished)store.set(publishedKey,cfg.badPublished?new TextEncoder().encode(JSON.stringify({...scene,artifactVersion:2})):valid);
 const storage={
  download:async key=>{calls.download.push(key);return store.has(key)?
    {data:new Blob([store.get(key)]),error:null}:{data:null,error:{message:'not found'}};},
  copy:async(...args)=>{calls.copy.push(args);throw Error('COPY_NOT_AUTHORIZED')},
  remove:async(...args)=>{calls.remove.push(args);throw Error('REMOVE_NOT_AUTHORIZED')}
 };
 const admin={storage:{from:()=>storage},rpc:async(name,args)=>{
  calls.rpc.push({name,args:structuredClone(args)});
  if(name==='community_authorize_session')return{data:{accountId:owner},error:null};
  if(name==='community_preset_storage_claim_promotion_r18')return cfg.badClaim?
    {data:null,error:{message:'STALE'}}:
    {data:{reservationId,stateVersion:2,leaseToken:token,leaseFence:1,
      sourceStagingKey:sourceKey,publishedStorageKey:publishedKey,
      checksumSha256:sha,byteSize:valid.byteLength,providerCopyAuthorized:false,
      publicationCommitAuthorized:false},error:null};
  if(name==='community_preset_storage_report_readback_r18')return cfg.badReport?
    {data:null,error:{message:'R18_PRESET_STALE_FENCE_OR_LEASE'}}:
    {data:{readbackMatches:args.p_downloaded_sha256===sha && args.p_downloaded_byte_size===valid.byteLength,
      state:args.p_downloaded_sha256===sha?'VERIFICATION_REQUIRED':'FAILED_RECOVERABLE',
      verifiedPublishedObject:false,publicationCommitAuthorized:false,cleanupAuthorized:false},error:null};
  throw Error('UNEXPECTED_RPC '+name);
 }};
 const env={__edge:null,Response,Blob,TextEncoder,TextDecoder,crypto:webcrypto,
  corsHeaders:{},resolveRuntimeWepPresetArtifactBucket:()=> 'isolated',
  withSupabase:(_opts,handler)=>req=>handler(req,{
    userClaims:{id:actor},jwtClaims:{iat:1761436800},supabaseAdmin:admin
  })};
 vm.runInNewContext(transpiled,env,{filename:'source135-edge-inspect.js'});
 const response=await env.__edge.fetch({method:'POST',json:async()=>({
   action:'inspectPublishedObject',reservationId,expectedVersion:1,
   accountId:'forged',p_auth_subject:'forged'
 })});
 return {status:response.status,body:await response.json(),calls,sha};
}
const noMutation=h=>{
 assert.deepEqual(h.calls.copy,[]);
 assert.deepEqual(h.calls.remove,[]);
 assert.equal(h.calls.rpc.some(x=>x.name.includes('commit_candidate')),false);
};
test('source135 actual Edge downloads BOTH staging and published bytes, reports rehashed metadata without publication',async()=>{
 const h=await harness();
 assert.equal(h.status,200);
 assert.equal(h.body.publicationAuthorized,false);
 assert.equal(h.body.realProviderAccepted,false);
 assert.equal(h.body.verificationAttested,false);
 assert.equal(h.body.inspection.state,'VERIFICATION_REQUIRED');
 assert.deepEqual(h.calls.download,[sourceKey,publishedKey]);
 const report=h.calls.rpc.find(x=>x.name==='community_preset_storage_report_readback_r18');
 assert.equal(report.args.p_auth_subject,actor);
 assert.equal(report.args.p_lease_token,token);
 assert.equal(report.args.p_lease_fence,1);
 assert.equal(report.args.p_expected_version,2);
 assert.equal(report.args.p_downloaded_sha256,h.sha);
 noMutation(h);
});
test('source135 actual Edge refuses missing published object without issuing copy or SQL commit',async()=>{
 const h=await harness({missingPublished:true});
 assert.equal(h.status,409);
 assert.equal(h.body.error,'PRESET_PROVIDER_READBACK_UNAVAILABLE');
 assert.equal(h.calls.rpc.some(x=>x.name==='community_preset_storage_report_readback_r18'),false);
 noMutation(h);
});
test('source135 actual Edge records downloaded published digest mismatch and returns recoverable 409',async()=>{
 const h=await harness({badPublished:true});
 assert.equal(h.status,409);
 assert.equal(h.body.inspection.readbackMatches,false);
 assert.equal(h.body.inspection.state,'FAILED_RECOVERABLE');
 noMutation(h);
});
test('source135 actual Edge refuses mutated staging after reservation before accepting published object',async()=>{
 const h=await harness({badStage:true});
 assert.equal(h.status,409);
 assert.equal(h.body.error,'PRESET_PROVIDER_READBACK_UNAVAILABLE');
 assert.equal(h.calls.rpc.some(x=>x.name==='community_preset_storage_report_readback_r18'),false);
 noMutation(h);
});
test('source135 actual Edge CAS rejects stale claim and stale readback without physical compensation',async()=>{
 for(const cfg of [{badClaim:true},{badReport:true}]){
  const h=await harness(cfg);
  assert.equal(h.status,409);
  assert.equal(h.body.error,cfg.badClaim?'PRESET_INSPECTION_LEASE_DENIED':'PRESET_READBACK_FENCE_REJECTED');
  noMutation(h);
 }
});
