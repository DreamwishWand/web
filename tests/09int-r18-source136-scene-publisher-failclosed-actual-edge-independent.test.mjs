import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const pin='a5bb6d24166eed66fc895447029c75b8014b81ec';
const file=fs.readFileSync(new URL('../supabase/functions/wep-scene-preset-product/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(file.replace(/^import[^\n]+\n/gm,''),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/,'__scene={');
const subject='00000000-0000-4000-8000-000000000002';
const owner='00000000-0000-4000-8000-000000000001';
const scene='00000000-0000-4000-8000-000000000003';
function edge(auth='active'){
 const calls=[];
 const admin={
  rpc:async(name,args)=>{
   calls.push(['rpc',name,args]);
   assert.equal(name,'community_authorize_session','Unexpected positive SQL writer');
   return auth==='revoked'?{data:null,error:{message:'REVOKED'}}:
     {data:{accountId:owner},error:null};
  },
  storage:{from:()=>{throw Error('FORBIDDEN_STORAGE_ACCESS_ON_SOURCE136')}},
  from:()=>{throw Error('FORBIDDEN_DIRECT_DATABASE_ACCESS_ON_SOURCE136')}
 };
 const ctx={__scene:null,Response,
  corsHeaders:{'Access-Control-Allow-Origin':'*'},
  withSupabase:(options,fn)=>{
   assert.equal(options.auth,'user');
   return request=>fn(request,{
    supabaseAdmin:admin,userClaims:{id:auth==='anonymous'?null:subject},
    jwtClaims:{iat:auth==='unsigned'?0:1761436800}
   });
  }};
 vm.runInNewContext(compiled,ctx,{filename:'source136-actual-scene-product.ts'});
 assert.ok(ctx.__scene?.fetch);
 return {
  calls,
  send:async(body,method='POST')=>{
   const response=await ctx.__scene.fetch({
    method,json:async()=>body,headers:{get:()=>null}
   });
   return {status:response.status,body:await response.json()};
  }
 };
}
test('new Owner Source136 actual Edge terminal-blocks both Scene published Writer and all physical cleanup paths BEFORE Storage/RPC',async()=>{
 for(const action of ['publish','prepare','discard','compensate','cleanup','delete','unpublish','recoverPublication','inspectPublishedObject']){
  const b=edge();
  const r=await b.send({action,creatorProfileId:scene,
   idempotencyKey:'same-key',storageKey:'published/'+owner+'/shared.json',
   presetArtifactId:scene,metadata:{ownerAccountId:'forged'}});
  assert.equal(r.status,409,action+':'+JSON.stringify(r));
  assert.equal(r.body.error,['discard','compensate','cleanup'].includes(action)
   ?'R18_SCENE_PRODUCT_STORAGE_CLEANUP_NOT_AUTHORIZED'
   :'R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED');
  for(const field of ['publicationAuthorized','retirementAuthorized','cleanupAuthorized',
   'providerCopyAuthorized','verificationAttested'])assert.equal(r.body[field],false);
  assert.deepEqual(b.calls.map(x=>x[1]),['community_authorize_session']);
 }
 console.log(JSON.stringify({case:'INT_R18_SOURCE136_ACTUAL_EDGE_SCENE_ALL_ACTIONS_FAIL_CLOSED',
  ownerPin:pin,provider:'MOCK_INSTRUMENTATION_NO_STORAGE_CLIENT_CALLED',scope:'ACTUAL_OWNER_EDGE_TS'}));
});
test('Source136 Scene Product cannot operate under invalid/expired signed session',async()=>{
 for(const auth of ['revoked','unsigned','anonymous']){
  const b=edge(auth);
  const r=await b.send({action:'publish',creatorProfileId:scene,idempotencyKey:'same-key'});
  assert.equal(r.status,401);
  assert.equal(r.body.error,'SESSION_REVOKED_OR_INVALID');
  assert.equal(b.calls.length,auth==='revoked'?1:0);
 }
});
test('Source136 Scene Product GET cannot mutate state or access Storage',async()=>{
 const b=edge();
 const response=await b.send({action:'publish'},'GET');
 assert.equal(response.status,405);
 assert.equal(response.body.error,'METHOD_NOT_ALLOWED');
 assert.equal(b.calls.length,0);
});
