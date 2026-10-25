import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const edgeSource = fs.readFileSync(new URL('../supabase/functions/community-command/index.ts', import.meta.url), 'utf8');
const source = edgeSource.replace(/^import[^\n]+\n/gm, '');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace(/\bexport default\s*\{/m, '__edgeExport = {');

const graphSha = 'a'.repeat(64);
const defaultPayload = {
  workId:'00000000-0000-4000-8000-000000000111',
  expectedVersion:3,title:'QR isolated synthetic',mediaIds:['00000000-0000-4000-8000-000000000222'],
  presetRevisionIds:[],usedItemIds:[],featuredItemIds:[],
  idempotencyKey:'qr-r16-local-only',
  graphPin:{registryVersion:'gallery-scene-scoped@r15',expectedGraphSha256:graphSha}
};

async function runScenario({outcomes, payload=defaultPayload, failReauth=false, command='publishGallery', maxTimeExceeded=false}) {
  const events = [];
  let attempts=0, authorizations=0, rateChecks=0;
  const client={
    rpc:async(name,params)=>{
      events.push({name,params:structuredClone(params)});
      if(name==='community_authorize_session'){
        authorizations++;
        return {data:{},error:failReauth&&authorizations>=2?{message:'revoked'}:null};
      }
      if(name==='community_consume_action_rate_limit'){rateChecks++;return {data:{allowed:true},error:null};}
      if(name==='community_publish_gallery_pinned_r15'){
        const outcome=outcomes[attempts++]??{error:{code:'XX999',message:'unexpected extra attempt'}};
        return outcome;
      }
      throw Error('Unexpected RPC: '+name);
    }
  };
  const sandbox={
    __edgeExport:null,
    withSupabase:(_options,fn)=>(req)=>fn(req,sandbox.context),
    corsHeaders:{},
    Response,
    TextEncoder,
    crypto:globalThis.crypto,
    Deno:{env:{get:()=>null}},
    setTimeout:resolve=>resolve(),
    Date:maxTimeExceeded?class extends Date {static now(){return 5000*(++sandbox.clock)}}:Date,
    clock:0,
    Math
  };
  vm.runInNewContext(compiled,sandbox,{filename:'community-command-edge-transpiled.js'});
  sandbox.context={userClaims:{id:'00000000-0000-4000-8000-000000000333'},
    jwtClaims:{iat:1790000000,session_id:'qr-r16-disposable'},
    supabaseAdmin:client};
  const response=await sandbox.__edgeExport.fetch({
    method:'POST',json:async()=>({command,payload})
  });
  return {response,status:response.status,body:await response.json(),events,attempts,authorizations,rateChecks};
}

for(const code of ['40P01','55P03','40001']) {
  test('R16 mock RPC '+code+' causes fresh bounded whole RPC retry with unmodified caller graph',async()=>{
    const result=await runScenario({outcomes:[
      {data:null,error:{code,message:'transient transaction abort'}},
      {data:null,error:{code,message:'transient transaction abort'}},
      {data:{published:true,revisionId:'synthetic-only'},error:null}
    ]});
    assert.equal(result.status,200);
    assert.equal(result.body.ok,true);
    assert.equal(result.attempts,3);
    assert.equal(result.authorizations,3);
    assert.equal(result.rateChecks,1);
    const writes=result.events.filter(x=>x.name==='community_publish_gallery_pinned_r15');
    assert.equal(writes.length,3);
    assert.ok(writes.every(x=>x.params.p_expected_graph_sha256===graphSha));
    assert.ok(writes.every(x=>x.params.p_idempotency_key==='qr-r16-local-only'));
    assert.ok(writes.every(x=>x.params.p_expected_version===3));
    assert.equal(result.events.filter(x=>x.name==='community_authorize_session').length,3);
  });
}

test('R16 transient max attempts is three, never an unbounded retry',async()=>{
  const result=await runScenario({outcomes:Array.from({length:5},()=>({
    data:null,error:{code:'55P03',message:'lock not available'}
  }))});
  assert.equal(result.attempts,3);
  assert.equal(result.authorizations,3);
  assert.equal(result.body.ok,false);
  assert.notEqual(result.status,200);
});

test('R16 latest session is reauthorized before retry and denied when revoked',async()=>{
  const result=await runScenario({failReauth:true,outcomes:[
    {data:null,error:{code:'40001',message:'serialization failed'}},
    {data:{published:true},error:null}
  ]});
  assert.equal(result.attempts,1);
  assert.equal(result.authorizations,2);
  assert.equal(result.status,401);
  assert.equal(result.body.error,'SESSION_REVOKED_OR_PRIVACY_SUPPRESSED');
});

for(const message of ['R15_STALE_GRAPH_TERMINAL','R15_PINNED_GRAPH_REQUIRED','R15_IDEMPOTENCY_REQUEST_CONFLICT']) {
  test('R16 terminal graph/idempotency does not re-pin or retry: '+message,async()=>{
    const result=await runScenario({outcomes:[
      {data:null,error:{code:'P0001',message}},
      {data:{published:true},error:null}
    ]});
    assert.equal(result.attempts,1);
    assert.equal(result.status,409);
    assert.equal(result.body.error,'STALE_GRAPH');
    assert.equal(result.authorizations,1);
  });
}

test('R16 duplicate-key semantic conflict is terminal',async()=>{
  const result=await runScenario({outcomes:[
    {data:null,error:{code:'P0001',message:'GALLERY_IDEMPOTENCY_CONFLICT'}},
    {data:{published:true},error:null}
  ]});
  assert.equal(result.status,409);
  assert.equal(result.body.error,'CONFLICT');
  assert.equal(result.attempts,1);
});

test('R16 missing or invalid caller graph pin fails closed without write attempts',async()=>{
  for(const graphPin of [undefined,{registryVersion:'gallery-scene-scoped@r15',expectedGraphSha256:'broken'},
    {registryVersion:'unknown',expectedGraphSha256:graphSha}]){
    const result=await runScenario({payload:{...defaultPayload,graphPin},outcomes:[]});
    assert.equal(result.status,409);
    assert.equal(result.body.error,'R15_EXPECTED_GRAPH_PIN_REQUIRED');
    assert.equal(result.attempts,0);
  }
});

test('R16 non-transient failure never retries',async()=>{
  const result=await runScenario({outcomes:[
    {data:null,error:{code:'23503',message:'foreign key denied'}},
    {data:{published:true},error:null}
  ]});
  assert.equal(result.attempts,1);
  assert.equal(result.body.ok,false);
});

test('R16 wall-clock budget fails closed without the fourth or second request',async()=>{
  const result=await runScenario({maxTimeExceeded:true,outcomes:[
    {data:null,error:{code:'55P03',message:'lock not available'}},
    {data:{published:true},error:null}
  ]});
  assert.equal(result.attempts,1);
  assert.equal(result.authorizations,1);
  assert.equal(result.body.ok,false);
});

for(const message of ['GALLERY_WORK_FORBIDDEN','GALLERY_CREATOR_FORBIDDEN','does not own requested work','not active']) {
  test('R16 owner/creator or retired identity semantic denial is never retried: '+message,async()=>{
    const result=await runScenario({outcomes:[
      {data:null,error:{code:'P0001',message}},
      {data:{published:true},error:null}
    ]});
    assert.equal(result.attempts,1);
    assert.equal(result.status,403);
    assert.equal(result.body.error,'FORBIDDEN');
  });
}

