import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const ownerPin = '8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec';
const source = fs.readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace(/^import[^\n]+\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace(/\bexport default\s*\{/m, '__r18Edge = {');
const account = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const subject = '00000000-0000-4000-8000-000000000003';
const stage = 'staging/' + account + '/00000000-0000-4000-8000-000000000099.json';
const artifact = {
  schema: 'dreamwish-wand-preset', artifactVersion: 1, type: 'scene',
  originPolicy: 'capture-region-top-left', bounds: {w: 1, h: 1},
  objects: [{
    artifactObjectId: 'o1', itemId: 10000001, localX: 0, localY: 0,
    orientation: 0, footprint: [{x: 0, y: 0}], dependencyIds: []
  }]
};
const payload = new Blob([JSON.stringify(artifact)], {type:'application/json'});
const publishBody = (title = 'A') => ({
  action:'publish', storageKey:stage, creatorProfileId:'00000000-0000-4000-8000-000000000004',
  visibility:'public', title, idempotencyKey:'same-key-1'
});
function deferred() {
  let resolve;
  const promise = new Promise(r => {resolve = r;});
  return {promise, resolve};
}
function mockEdge() {
  const storage = new Map([[stage, payload]]);
  const registered = new Set();
  const claimed = new Map();
  const events = [];
  let beforeCommit = async () => {};
  let beforeCopy = async () => {};
  let sessionError = null;
  let actorAccount = account;
  const bucket = {
    download: async key => {
      events.push(['download',key]);
      return storage.has(key) ? {data: storage.get(key), error:null} :
        {data:null,error:{message:'NOT_FOUND'}};
    },
    copy: async (src,dst) => {
      events.push(['copy-enter',src,dst]);
      await beforeCopy(src,dst);
      if (!storage.has(src)) return {error:{message:'STAGING_MISSING'}};
      if (storage.has(dst)) return {error:{message:'ALREADY_EXISTS'}};
      storage.set(dst,storage.get(src));
      events.push(['copy-done',dst]);
      return {error:null};
    },
    remove: async keys => {
      for (const key of keys) {storage.delete(key);events.push(['removed',key]);}
      return {error:null};
    },
    createSignedUrl: async key => ({data:{signedUrl:'mock://'+key},error:null}),
    createSignedUploadUrl: async key => ({data:{signedUrl:'mock://'+key},error:null})
  };
  const admin = {
    storage:{from: () => bucket},
    rpc: async (name,args) => {
      events.push(['rpc',name]);
      if (name === 'community_authorize_session')
        return sessionError ? {data:null,error:{message:sessionError}} :
          {data:{accountId:actorAccount},error:null};
      if (name === 'community_publish_preset_envelope') {
        await beforeCommit(args);
        const key = actorAccount + ':' + args.p_idempotency_key;
        const previous = claimed.get(key);
        if (previous && previous.title !== args.p_title)
          return {data:null,error:{message:'Idempotency key reused with a different request'}};
        if (!previous) {
          claimed.set(key,{title:args.p_title,storageKey:args.p_artifact_storage_key});
          registered.add(args.p_artifact_storage_key);
          events.push(['sql-committed',args.p_title,args.p_artifact_storage_key]);
        }
        return {data:{presetArtifactId:'mock-preset'},error:null};
      }
      if (name === 'wep_get_accessible_preset_blob')
        return {data:{storageKey:[...registered][0],presetArtifactId:'mock-preset',
          presetRevisionId:'mock-revision',presetType:'scene',blobId:'mock-blob',
          schemaVersion:1,contentType:'application/json',byteSize:payload.size,
          checksumSha256:'a'.repeat(64)},error:null};
      if (name === 'community_consume_action_rate_limit')
        return {data:{allowed:true},error:null};
      throw Error('Unexpected RPC: ' + name);
    },
    from: table => {
      assert.equal(table,'artifact_blobs');
      let value = '';
      const query = {
        select: () => query,
        eq: (name,v) => {assert.equal(name,'storage_key');value=v;return query;},
        maybeSingle: async () => ({data:registered.has(value)?{blob_id:'mock-blob'}:null,error:null})
      };
      return query;
    }
  };
  const box = {
    __r18Edge: null, Response, Blob, TextDecoder, TextEncoder, crypto:webcrypto,
    corsHeaders:{'Access-Control-Allow-Origin':'*'},
    resolveRuntimeWepPresetArtifactBucket:()=> 'wep-preset-artifacts',
    withSupabase: (auth,handler) => {
      assert.equal(auth.auth,'user');
      return req => handler(req,box.context);
    }
  };
  vm.runInNewContext(compiled,box,{filename:'actual-wep-preset-artifact-transpiled.js'});
  box.context = {supabaseAdmin:admin,userClaims:{id:subject},jwtClaims:{iat:1761436800}};
  return {
    storage,registered,claimed,events,
    setBeforeCommit:fn=>{beforeCommit=fn;},
    setBeforeCopy:fn=>{beforeCopy=fn;},
    setSessionError:value=>{sessionError=value;},
    setAccount:value=>{actorAccount=value;},
    invoke:async body=>{
      const response=await box.__r18Edge.fetch({method:'POST',json:async()=>body});
      return {status:response.status,body:await response.json()};
    }
  };
}
function publishedKey(b) {return [...b.storage.keys()].find(key=>key.startsWith('published/'));}
function evidence(caseName,b,extra={}) {
  console.log(JSON.stringify({case:caseName,sourcePin:ownerPin,
    actualTranspiledEdge:true,actualPostgreSQL:false,actualProviderStorage:false,
    mockRpc:true,mockStorage:true,dbRegistrations:b.registered.size,
    publishedObjectPresent:!!(publishedKey(b)&&b.storage.has(publishedKey(b))),
    ...extra}));
}

test('R18 actual Edge handler: published discard races the uncommitted copy-to-RPC gap', async () => {
  const b=mockEdge(), entered=deferred(), resume=deferred();
  b.setBeforeCommit(async()=>{entered.resolve();await resume.promise;});
  const a=b.invoke(publishBody('A'));
  await entered.promise;
  const key=publishedKey(b);
  assert.ok(key);
  const discard=await b.invoke({action:'discard',storageKey:key});
  assert.equal(discard.status,200);
  assert.equal(b.storage.has(key),false);
  resume.resolve();
  const result=await a;
  assert.equal(result.status,200);
  assert.ok(b.registered.has(key));
  assert.equal(b.storage.has(key),false);
  evidence('R18_ACTUAL_EDGE_MOCK_PUBLISHED_DISCARD_DANGLING_POINTER',b,{discardStatus:discard.status,publishStatus:result.status,unsafe:true});
});

test('R18 actual Edge handler: failed A SQL idempotency claim compensates away successful B publication', async () => {
  const b=mockEdge(), entered=deferred(), resume=deferred();
  b.setBeforeCommit(async args=>{if(args.p_title==='A'){entered.resolve();await resume.promise;}});
  const a=b.invoke(publishBody('A'));
  await entered.promise;
  const key=publishedKey(b);
  assert.ok(key);
  const committedB=await b.invoke(publishBody('B'));
  assert.equal(committedB.status,200);
  assert.ok(b.storage.has(key));
  resume.resolve();
  const failedA=await a;
  assert.equal(failedA.status,400);
  assert.equal(failedA.body.error,'PRESET_PUBLISH_FAILED');
  assert.ok(b.registered.has(key));
  assert.equal(b.storage.has(key),false);
  assert.ok(b.events.some(event=>event[0]==='removed'&&event[1]===key));
  evidence('R18_ACTUAL_EDGE_MOCK_FAILED_PUBLISH_COMPENSATION_DELETES_WINNER',b,
    {committedB:committedB.status,failedA:failedA.status,unsafe:true});
});

test('R18 actual Edge handler: staged object discard between validation and copy prevents publication', async () => {
  const b=mockEdge(), entered=deferred(), resume=deferred();
  b.setBeforeCopy(async()=>{entered.resolve();await resume.promise;});
  const a=b.invoke(publishBody());
  await entered.promise;
  const discard=await b.invoke({action:'discard',storageKey:stage});
  assert.equal(discard.status,200);
  resume.resolve();
  const result=await a;
  assert.equal(result.status,400);
  assert.equal(b.registered.size,0);
  evidence('R18_ACTUAL_EDGE_MOCK_STAGING_DISCARD_PUBLISH_LIVENESS',b,
    {discardStatus:discard.status,publishStatus:result.status,noDanglingDbPointer:true,unsafeLiveness:true});
});

test('R18 actual Edge handler: cross-account discard and revoked session fail closed', async () => {
  const b=mockEdge();
  const invalid=await b.invoke({action:'discard',storageKey:'published/'+other+'/other.json'});
  assert.equal(invalid.status,403);
  assert.equal(b.events.some(event=>event[0]==='removed'),false);
  b.setSessionError('revoked');
  const revoked=await b.invoke({action:'discard',storageKey:stage});
  assert.equal(revoked.status,401);
  assert.ok(b.storage.has(stage));
  evidence('R18_ACTUAL_EDGE_MOCK_CROSS_ACCOUNT_AND_SESSION_GUARDS',b,
    {foreignStatus:invalid.status,revokedStatus:revoked.status,scopedGuardPassed:true});
});

test('R18 actual Edge handler: existing owner read is nonmutating in mock context', async () => {
  const b=mockEdge();
  b.registered.add('published/'+account+'/owned.json');
  const result=await b.invoke({action:'read',presetArtifactId:'00000000-0000-4000-8000-000000000005'});
  assert.equal(result.status,200);
  assert.equal(result.body.ok,true);
  assert.equal(b.registered.size,1);
  assert.equal(b.events.some(event=>event[0]==='removed'),false);
  evidence('R18_ACTUAL_EDGE_MOCK_OWNER_READ_INERT',b,{readStatus:200,noMutation:true});
});
