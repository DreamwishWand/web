import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const base='../operator/gate-a/wep-source142-stop-candidate/supabase/functions/';
const routes=['wep-preset-artifact','wep-scene-preset-product','wep-preset-retention'];
const blobs={
 'wep-preset-artifact':'631abd4cfb462ce6774b79042a55e580041063d8',
 'wep-scene-preset-product':'4b667fa26408053b75b91575e59443f0375905ae',
 'wep-preset-retention':'2002d24e585156ce9db6cc4dc78af6d323febd32'
};
const owner='11111111-1111-4111-8111-111111111111';
const actor='22222222-2222-4222-8222-222222222222';
const creator='33333333-3333-4333-8333-333333333333';
const preset='55555555-5555-4555-8555-555555555555';
const reservation='77777777-7777-4777-8777-777777777777';
const work='88888888-8888-4888-8888-888888888888';
const key='staging/'+owner+'/'+preset+'.json';
const body={byteSize:200,storageKey:key,creatorProfileId:creator,
 idempotencyKey:'qr-independent-a4',reservationId:reservation,expectedVersion:1,
 presetArtifactId:preset,presetRevisionId:preset,workId:work,title:'Safe Bridge',
 retentionJobId:preset,lockToken:reservation};
const sources={};
const outputs=[];
for(const route of routes){
 const bytes=readFileSync(new URL(base+route+'/index.ts',import.meta.url));
 const sha1=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
 assert.equal(sha1,blobs[route],'PR189 exact candidate blob changed '+route);
 outputs.push({route,gitBlobSHA:sha1,sourceByteSHA256:createHash('sha256').update(bytes).digest('hex')});
 sources[route]=bytes.toString('utf8');
}
function load(route,options={}){
 const calls=[];
 const src=sources[route];
 const js=ts.transpileModule(src.replace(/^import[^\n]+\n/gm,''),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
 }).outputText.replace(/\bexport default\s*\{/m,'__edge={');
 const admin={
  rpc:async(name,args)=>{
   calls.push('RPC:'+name);
   if(name==='community_authorize_session')
    return options.revoked?{data:null,error:{message:'revoked'}}:{data:{accountId:owner},error:null};
   if(name==='community_verify_worker_token')
    return options.badWorker?{data:false,error:null}:{data:true,error:null};
   throw Error('QR_A4_FORBIDDEN_RPC:'+name);
  },
  from:(table)=>{
   calls.push('READ:'+table);
   if(table!=='creator_profiles')throw Error('QR_A4_FORBIDDEN_TABLE:'+table);
   return {select:()=>({eq:()=>({maybeSingle:async()=>({
    data:{owner_account_id:options.foreignCreator?'99999999-9999-4999-8999-999999999999':owner},error:null
   })})})};
  }
 };
 Object.defineProperty(admin,'storage',{get(){calls.push('STORAGE_ACCESS');throw Error('QR_A4_ANY_STORAGE_ACCESS_FORBIDDEN');}});
 const env={
  __edge:null,Response,Blob,TextEncoder,TextDecoder,Request,crypto:webcrypto,corsHeaders:{},
  withSupabase:(_o,fn)=>req=>fn(req,{
   userClaims:options.noActor?{}:{id:actor},
   jwtClaims:{iat:options.badIat?0:1793000000},
   supabaseAdmin:admin
  })
 };
 vm.runInNewContext(js,env,{filename:route+'-qr-independent.js'});
 async function invoke(action,opts={}){
  const method=opts.method||'POST';
  const payload=opts.body??{action,...body};
  const headers={get:field=>field.toLowerCase()==='x-community-worker-token'?
    (opts.noToken?null:'synthetic-worker-token'):null};
  const req={method,headers,json:async()=>payload};
  const response=await env.__edge.fetch(req);
  const result={status:response.status,body:await response.json().catch(()=>null),
   cacheControl:response.headers.get('cache-control')};
  if(calls.includes('STORAGE_ACCESS'))throw Error('STORAGE ACCESS DURING '+route+'/'+action);
  assert.ok(calls.every(c=>c==='RPC:community_authorize_session'||c==='RPC:community_verify_worker_token'||c==='READ:creator_profiles'),JSON.stringify(calls));
  return result;
 }
 return {invoke,calls};
}
test('A4 02 WEP PR189 pinned candidate source byte integrity differs from deployed runtime SHA',()=>{
 assert.equal(outputs.length,3);
 for(const x of outputs)assert.match(x.sourceByteSHA256,/^[0-9a-f]{64}$/);
 console.log('QR_A4_WEP189_PINNED_SOURCE_FILE_HASHES_NOT_DEPLOYED_EDGE_BUNDLE',JSON.stringify(outputs));
});
test('A4 independent Generic and Scene all known actions, reads, legacy aliases reject before signing/Storage/writer SQL',async()=>{
 const cases={
  'wep-preset-artifact':['prepare','reservePublication','recoverPublication','inspectPublishedObject','publish',
   'revisionReadiness','resolveWork','read','discard','unpublish','delete','cleanup','compensate',
   'failedSqlPublishCompensation','retry','retryPublish','prepareUpload','ownerRead','readPreset','publishScene'],
  'wep-scene-preset-product':['prepare','publish','read','unpublish','delete','discard','compensate',
   'failedSqlPublishCompensation','cleanup','retry','retryPublish','prepareUpload','publishScene','ownerRead',
   'readPreset','deleteScene','unpublishScene','physicalCleanup','storageDiscard']
 };
 let actions=0;
 for(const [route,items] of Object.entries(cases)){
  for(const action of items){
   const h=load(route),r=await h.invoke(action);
   assert.equal(r.status,409,route+'/'+action+' '+JSON.stringify(r));
   assert.equal(r.body.ok,false);
   assert.equal(r.body.operatorGate,'A');
   assert.equal(r.body.retryable,false);
   assert.equal(r.body.readAuthorized,false);
   assert.equal(r.body.signedUrlAuthorized,false);
   assert.equal(r.body.storageMutationAuthorized,false);
   assert.equal(r.body.physicalDeleteAuthorized,false);
   assert.equal(r.cacheControl,'private, no-store');
   assert.ok(!/signedUrl|storageKey|signedUpload/i.test(JSON.stringify(r.body)));
   actions++;
  }
 }
 for(let i=0;i<2;i++){
  const h=load('wep-scene-preset-product');
  assert.equal((await h.invoke('publish')).status,409);
 }
 console.log('QR_A4_WEP189_ACTUAL_HANDLER_ALL_ACTIONS_OFFLINE_NEGATIVE',JSON.stringify({
  actions,realJWT:false,providerStorage:false,stageDeployed:false
 }));
});
test('A4 Worker valid and invalid token, retry/cleanup-like job deny before any Storage or claim',async()=>{
 const h=load('wep-preset-retention');
 for(const act of ['purge','retry','cleanup','compensate']){
  const r=await h.invoke(act);
  assert.equal(r.status,409);
  assert.equal(r.body.physicalDeleteAuthorized,false);
  assert.equal(r.body.retryAuthorized,false);
  assert.equal(r.cacheControl,'private, no-store');
 }
 assert.equal((await load('wep-preset-retention',{badWorker:true}).invoke('purge')).status,401);
 assert.equal((await load('wep-preset-retention').invoke('purge',{noToken:true})).status,401);
});
test('A4 no unauthorized actor, Creator, key or method can bypass terminal state',async()=>{
 for(const route of routes.slice(0,2)){
  assert.equal((await load(route,{noActor:true}).invoke('publish')).status,401);
  assert.equal((await load(route,{revoked:true}).invoke('publish')).status,401);
  assert.equal((await load(route,{badIat:true}).invoke('publish')).status,401);
  assert.equal((await load(route).invoke('publish',{body:{...body,action:'publish',storageKey:'staging/FOREIGN/'+preset+'.json'}})).status,403);
  assert.equal((await load(route,{foreignCreator:true}).invoke('publish')).status,403);
  assert.equal((await load(route).invoke('unknown',{body:{...body,action:'UNKNOWN_FUTURE_ALIAS'}})).status,400);
  assert.equal((await load(route).invoke('publish',{method:'GET'})).status,405);
 }
 assert.equal((await load('wep-preset-retention').invoke('purge',{method:'GET'})).status,405);
});
