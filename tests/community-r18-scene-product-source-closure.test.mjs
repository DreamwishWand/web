import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261025003000_r18_scene_product_publisher_source_closure.sql');
const src=read('supabase/functions/wep-scene-preset-product/index.ts');
const generic=read('supabase/functions/wep-preset-artifact/index.ts');
const retention=read('supabase/functions/wep-preset-retention/index.ts');
const js=ts.transpileModule(src.replace(/^import[^\n]+\n/gm,''),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__edge = {');

async function run(action,cfg={}){
 const calls=[];
 const env={__edge:null,Response,corsHeaders:{},
  withSupabase:(_opts,handler)=>req=>handler(req,{
   userClaims:cfg.noActor?{}:{id:'actor'},
   jwtClaims:{iat:1761436800},
   supabaseAdmin:{
    get storage(){throw Error('STORAGE_ACCESSED_BY_SOURCE_STUB')},
    rpc:async(name,args)=>{
     calls.push({name,args});
     if(name!=='community_authorize_session')throw Error('UNAUTHORIZED_MUTATION_RPC:'+name);
     return cfg.revoked?{data:null,error:{message:'revoked'}}:
       {data:{accountId:'owner'},error:null};
    }
   }
  })
 };
 vm.runInNewContext(js,env,{filename:'scene-product-source-stub.js'});
 const response=await env.__edge.fetch({
  method:'POST',json:async()=>({action,idempotencyKey:'same-key',storageKey:'published/attacker'})
 });
 return {status:response.status,body:await response.json(),calls};
}

test('distinct deployed Scene published Copy/SQL/compensation, discard and lifecycle are registered without claiming staging closure',()=>{
 for(const x of ['community_publish_scene_preset_product_v1','community_unpublish_scene_preset_v1',
  'community_delete_scene_preset_v1','scene-product-staging-failed-compensation',
  'scene-product-staging-discard','scene-product-staging-success-stage-remove',
  'preset-retention-staging-physical-remove','r18-scene-generic-shared-key',
  'SOURCE_PRESENT_UNENROLLED','r18-scene-source-inert-alias','FAIL_CLOSED'])
  assert.ok(sql.includes(x),x);
 assert.match(sql,/pg_catalog\.pg_proc/);
 assert.match(sql,/v\.signature/);
 assert.match(sql,/revoke all on function %s from public,anon,authenticated,service_role/);
 assert.match(sql,/has_function_privilege\('service_role',v\.function_oid,'EXECUTE'\)/);
 assert.match(sql,/R18_SCENE_LIFECYCLE_WRITER_EXECUTE_REMAINS_EXPOSED/);
});

test('actual Scene product source stub rejects all positive lifecycle/storage paths before any RPC mutation or Storage access',async()=>{
 for(const action of ['publish','unpublish','delete','discard','compensate','cleanup','prepare','unknown']){
  const h=await run(action);
  assert.equal(h.status,409,action);
  assert.equal(h.body.publicationAuthorized,false);
  assert.equal(h.body.retirementAuthorized,false);
  assert.equal(h.body.cleanupAuthorized,false);
  assert.equal(h.body.providerCopyAuthorized,false);
  assert.equal(h.body.verificationAttested,false);
  assert.equal(h.body.operatorRolloutRequired,true);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].name,'community_authorize_session');
  assert.equal(h.body.error,['discard','compensate','cleanup'].includes(action)
    ?'R18_SCENE_PRODUCT_STORAGE_CLEANUP_NOT_AUTHORIZED'
    :'R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED');
 }
});

test('Scene stub never treats anonymous or revoked identity as safe, and neither alias/retention has physical delete',async()=>{
 assert.equal((await run('publish',{revoked:true})).status,401);
 assert.equal((await run('publish',{noActor:true})).status,401);
 for(const source of [src,generic,retention]){
  assert.doesNotMatch(source,/\.copy\s*\(/);
  assert.doesNotMatch(source,/\.remove\s*\(/);
 }
 assert.doesNotMatch(src,/community_publish_scene_preset_product_v1\s*\(/);
 assert.doesNotMatch(src,/community_unpublish_scene_preset_v1\s*\(/);
 assert.doesNotMatch(src,/community_delete_scene_preset_v1\s*\(/);
});

test('new Source136 clean-bootstrap includes independent Scene-issuer SQL fixture and does not enable positive Provider Copy',()=>{
 const workflow=read('.github/workflows/comm-clean-bootstrap-acceptance.yml');
 const pg=read('tests/comm-r18-scene-publisher-acl-postgres.py');
 assert.match(workflow,/assert len\(fs\)==140/);
 assert.match(workflow,/IF v<>140 THEN/);
 assert.match(workflow,/TWENTY_NINE_ADDITIVE_SOURCE_MIGRATIONS/);
 assert.match(workflow,/comm-r18-scene-publisher-acl-postgres\.py/);
 assert.match(pg,/03COMM_R18_SCENE_SOURCE_ISSUER_ACL_ROLLBACK_ACCEPTED/);
 assert.match(pg,/has_function_privilege/);
});
