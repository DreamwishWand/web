import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../supabase/functions/wep-preset-retention/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import[^\n]+\n/gm,''),{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m,'__qrRetention = {');
function makeWorker({authorized=true,authError=false}={}){
  const calls={rpc:[],storage:[]};
  const admin={
    storage:{from:(bucket)=>{calls.storage.push(bucket);throw Error('UNAUTHORIZED_PROVIDER_STORAGE_ACCESS')}},
    rpc:async(name,args)=>{
      calls.rpc.push({name,args:structuredClone(args)});
      if(name==='community_verify_worker_token')
        return{data:authorized,error:authError?{message:'invalid'}:null};
      throw Error('UNAUTHORIZED_RETENTION_CLAIM_OR_FINALIZE_RPC '+name);
    }
  };
  const scope={__qrRetention:null,Response,
    resolveRuntimeWepPresetArtifactBucket:()=> 'qr-r18work-isolated',
    withSupabase:(config,handler)=>{
      assert.equal(config.auth,'none');
      return req=>handler(req,{supabaseAdmin:admin});
    }
  };
  vm.runInNewContext(compiled,scope,{filename:'actual-owner134-wep-preset-retention-source.js'});
  const invoke=async({token='approved-worker',body={retentionJobId:'test-job',lockToken:'test-lock'},method='POST'}={})=>{
    const response=await scope.__qrRetention.fetch({
      method,headers:new Headers(token?{'x-community-worker-token':token}:{}),
      json:async()=>body
    });
    return{status:response.status,body:await response.json(),cache:response.headers.get('Cache-Control')};
  };
  return{invoke,calls};
}
test('R18-work actual retention Edge denies authorized worker physical object purge before claim/download/finalize',async()=>{
  const h=makeWorker();
  const result=await h.invoke();
  assert.equal(result.status,409);
  assert.equal(result.cache,'private, no-store');
  assert.equal(result.body.error,'R18_PRESET_PHYSICAL_RETENTION_CLEANUP_NOT_ENROLLED');
  assert.equal(result.body.physicalDeleteAuthorized,false);
  assert.equal(result.body.privacySuppressionIndependent,true);
  assert.equal(result.body.recovery,'DEFERRED_OPERATOR_RECONCILIATION_REQUIRED');
  assert.deepEqual(h.calls.rpc.map(x=>x.name),['community_verify_worker_token']);
  assert.equal(h.calls.rpc[0].args.p_worker_name,'retention_cleanup');
  assert.equal(h.calls.rpc[0].args.p_token,'approved-worker');
  assert.deepEqual(h.calls.storage,[]);
});
test('R18-work actual retention Edge denies missing/invalid worker token before claiming blob',async()=>{
  const h=makeWorker({authorized:false});
  const missing=await h.invoke({token:''});
  assert.equal(missing.status,401);
  assert.equal(missing.body.error,'WORKER_AUTH_REQUIRED');
  assert.equal(h.calls.rpc.length,0);
  const invalid=await h.invoke();
  assert.equal(invalid.status,401);
  assert.equal(invalid.body.error,'WORKER_AUTH_INVALID');
  assert.deepEqual(h.calls.rpc.map(x=>x.name),['community_verify_worker_token']);
  assert.deepEqual(h.calls.storage,[]);
});
test('R18-work actual retention Edge refuses missing job/lock and nonPOST without Storage access',async()=>{
  const h=makeWorker();
  for(const body of [{retentionJobId:'',lockToken:'ok'},{retentionJobId:'ok',lockToken:''},{}]){
    const x=await h.invoke({body});
    assert.equal(x.status,400);
    assert.equal(x.body.error,'INVALID_PURGE_REQUEST');
  }
  const method=await h.invoke({method:'GET'});
  assert.equal(method.status,405);
  assert.equal(method.body.error,'POST required');
  assert.deepEqual(h.calls.storage,[]);
  assert.equal(h.calls.rpc.some(x=>x.name==='wep_get_claimed_retention_artifact_blobs'),false);
  assert.equal(h.calls.rpc.some(x=>x.name==='community_finalize_artifact_blob_purge'),false);
});
