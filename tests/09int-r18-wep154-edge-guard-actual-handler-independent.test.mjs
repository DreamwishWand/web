import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

const ownerPin = '66dc71ee828d965af04685844508d000261263a5';
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


test('R18 WEP154 actual Edge denies published owner discard before DB or Storage',async()=>{
 const b=mockEdge();
 const key='published/'+account+'/'+('a'.repeat(64))+'.json';
 b.storage.set(key,payload);
 const r=await b.invoke({action:'discard',storageKey:key});
 assert.equal(r.status,409);
 assert.equal(r.body.error,'PUBLISHED_ARTIFACT_PHYSICAL_DISCARD_UNAUTHORIZED');
 assert.equal(b.storage.has(key),true);
 assert.deepEqual(b.events.map(e=>e[1]),['community_authorize_session']);
 evidence('R18_WEP154_PUBLISHED_DISCARD_FAIL_CLOSED_ACTUAL_HANDLER_MOCK',b,{status:r.status,physicalRemoval:false});
});

test('R18 WEP154 actual Edge denies staging discard without a lease',async()=>{
 const b=mockEdge();
 const r=await b.invoke({action:'discard',storageKey:stage});
 assert.equal(r.status,409);
 assert.equal(r.body.error,'STAGING_ARTIFACT_DISCARD_REQUIRES_RESERVATION');
 assert.equal(b.storage.has(stage),true);
 assert.equal(b.events.some(e=>e[0]==='removed'),false);
 evidence('R18_WEP154_STAGING_DISCARD_FAIL_CLOSED_ACTUAL_HANDLER_MOCK',b,{status:r.status});
});

test('R18 WEP154 actual Edge SQL compensation never removes winner same-key publication',async()=>{
 const b=mockEdge(), entered=deferred(), resume=deferred();
 b.setBeforeCommit(async args=>{if(args.p_title==='A'){entered.resolve();await resume.promise;}});
 const a=b.invoke(publishBody('A'));
 await entered.promise;
 const key=publishedKey(b);
 assert.ok(key);
 const bsuccess=await b.invoke(publishBody('B'));
 assert.equal(bsuccess.status,200);
 resume.resolve();
 const afail=await a;
 assert.equal(afail.status,400);
 assert.equal(afail.body.error,'PRESET_PUBLISH_FAILED');
 assert.equal(b.storage.has(key),true);
 assert.ok(b.registered.has(key));
 assert.equal(b.events.some(e=>e[0]==='removed'&&e[1]===key),false);
 evidence('R18_WEP154_COMPENSATION_KEY_IMMUTABLE_ACTUAL_HANDLER_MOCK',b,{bSuccess:200,aFailure:400});
});

test('R18 WEP154 actual Edge active staging copy survives rejected staging discard',async()=>{
 const b=mockEdge(), entered=deferred(), resume=deferred();
 b.setBeforeCopy(async()=>{entered.resolve();await resume.promise;});
 const a=b.invoke(publishBody('A'));
 await entered.promise;
 const discard=await b.invoke({action:'discard',storageKey:stage});
 assert.equal(discard.status,409);
 assert.equal(b.storage.has(stage),true);
 resume.resolve();
 const result=await a;
 assert.equal(result.status,200);
 const key=publishedKey(b);
 assert.ok(b.storage.has(key));
 assert.ok(b.registered.has(key));
 evidence('R18_WEP154_STAGING_PUBLISH_DISCARD_SERIALIZED_BY_DENIAL',b,{discard:409,publish:200});
});

test('R18 WEP154 actual Edge foreign, traversal and revoked-session discard fail closed',async()=>{
 const b=mockEdge();
 for(const bad of ['published/'+other+'/other.json','staging/'+account+'/../evil.json']) {
   const r=await b.invoke({action:'discard',storageKey:bad});
   assert.equal(r.status,403);
   assert.equal(r.body.error,'INVALID_STORAGE_KEY');
 }
 b.setSessionError('revoked');
 const r=await b.invoke({action:'discard',storageKey:stage});
 assert.equal(r.status,401);
 assert.equal(b.storage.has(stage),true);
 assert.equal(b.events.some(e=>e[0]==='removed'),false);
 evidence('R18_WEP154_AUTH_SESSION_CROSS_ACCOUNT_DENY_ACTUAL_HANDLER_MOCK',b,{revokedStatus:401});
});

test('R18 WEP154 actual Edge unchanged owner read stays nonmutating',async()=>{
 const b=mockEdge();
 b.registered.add('published/'+account+'/owned.json');
 const r=await b.invoke({action:'read',presetArtifactId:'00000000-0000-4000-8000-000000000005'});
 assert.equal(r.status,200);
 assert.equal(r.body.ok,true);
 assert.equal(b.events.some(e=>e[0]==='removed'),false);
 evidence('R18_WEP154_OWNER_READ_UNMODIFIED',b,{status:200});
});
