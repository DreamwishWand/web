import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const backend = '8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec';
const source = fs.readFileSync(new URL('../supabase/functions/wep-preset-artifact/index.ts', import.meta.url), 'utf8');
assert.match(source, /community_publish_preset_envelope/);
const compiled = ts.transpileModule(source.replace(/^import[^\n]+\n/gm, ''), {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m, '__wepPresetEdge = {');
const ownerAccount = '11111111-1111-4111-8111-111111111111';
const ownerActor = '11111111-1111-4111-8111-222222222222';
const foreignAccount = '33333333-3333-4333-8333-333333333333';
const foreignActor = '33333333-3333-4333-8333-444444444444';
const creatorId = '55555555-5555-4555-8555-555555555555';
const goodScene = {
  schema: 'dreamwish-wand-preset', artifactVersion: 1, type: 'scene',
  bounds: {w: 2, h: 2}, originPolicy: 'capture-region-top-left',
  objects: [{
    artifactObjectId: 'o1', itemId: 777, localX: 0, localY: 0,
    orientation: 0, footprint: [{x: 0, y: 0}], dependencyIds: []
  }]
};
function defer() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}
async function deterministicPublishedKey(idempotencyKey) {
  const src = new TextEncoder().encode(ownerAccount + ':' + idempotencyKey);
  const sum = await webcrypto.subtle.digest('SHA-256', src);
  return 'published/' + ownerAccount + '/' + Array.from(new Uint8Array(sum), b => b.toString(16).padStart(2, '0')).join('') + '.json';
}
function makeState(id) {
  const stagingKey = 'staging/' + ownerAccount + '/' + id + '.json';
  const objects = new Map([[stagingKey, new TextEncoder().encode(JSON.stringify(goodScene))]]);
  const blobs = new Map();
  const stats = {copy: 0, remove: [], committed: 0, rpc: [], externalStorageProvider: false, externalPg: false};
  return {stagingKey, objects, blobs, stats, beforePublish: null, readPublic: false};
}
function createEdge(state) {
  const from = () => ({
    download: async key => state.objects.has(key)
      ? {data: new Blob([state.objects.get(key)], {type: 'application/json'}), error: null}
      : {data: null, error: {message: 'missing object'}},
    copy: async (fromKey, toKey) => {
      state.stats.copy++;
      if (!state.objects.has(fromKey)) return {error: {message: 'copy source absent'}};
      if (state.objects.has(toKey)) return {error: {message: 'copy destination exists'}};
      state.objects.set(toKey, state.objects.get(fromKey));
      return {error: null};
    },
    remove: async keys => {
      for (const key of keys) {
        state.stats.remove.push(key);
        state.objects.delete(key);
      }
      return {error: null};
    }
  });
  const admin = {
    storage: {from},
    from: table => {
      assert.equal(table, 'artifact_blobs');
      const query = {
        select(field) { assert.equal(field, 'blob_id'); return this; },
        eq(field, key) {assert.equal(field, 'storage_key'); this.key = key; return this;},
        async maybeSingle() {
          return {data: state.blobs.has(this.key) ? {blob_id: state.blobs.get(this.key).blobId} : null, error: null};
        }
      };
      return query;
    },
    async rpc(name, params) {
      state.stats.rpc.push(name);
      if (name === 'community_authorize_session') {
        const accountId = params.p_auth_subject === ownerActor ? ownerAccount
          : params.p_auth_subject === foreignActor ? foreignAccount : null;
        return accountId
          ? {data: {accountId}, error: null}
          : {data: null, error: {message: 'actor rejected'}};
      }
      if (name === 'community_publish_preset_envelope') {
        const decision = state.beforePublish ? await state.beforePublish(params) : null;
        if (decision?.error) return {data: null, error: decision.error};
        const key = params.p_artifact_storage_key;
        const previous = state.blobs.get(key);
        if (previous) return {data: previous.receipt, error: null};
        const receipt = {workId: '77777777-7777-4777-8777-777777777777', revisionNumber: 1};
        state.blobs.set(key, {blobId: '66666666-6666-4666-8666-666666666666',receipt,
          checksumSha256: params.p_checksum_sha256, size: params.p_byte_size});
        state.stats.committed++;
        return {data: receipt, error: null};
      }
      throw Error('Unexpected RPC: ' + name);
    }
  };
  const scope = {
    __wepPresetEdge: null,
    Response, TextEncoder, TextDecoder, Blob, crypto: webcrypto,
    corsHeaders: {'Access-Control-Allow-Origin': '*'},
    resolveRuntimeWepPresetArtifactBucket: () => 'qr-artifacts-isolated-mock',
    withSupabase: (config, handler) => {
      assert.equal(config.auth, 'user');
      return req => handler(req, {
        userClaims: {id: req.qrActor}, jwtClaims: {iat: 1761436800},
        supabaseAdmin: admin
      });
    }
  };
  vm.runInNewContext(compiled,scope, {filename:'wep-preset-artifact-actual-ts-mock.js'});
  return async (body, actor = ownerActor) => {
    const response = await scope.__wepPresetEdge.fetch({
      method:'POST', qrActor:actor, json:async()=>body
    });
    return {status:response.status,body:await response.json()};
  };
}
function publishPayload(stagingKey, idempotencyKey) {
  return {action:'publish',storageKey:stagingKey,creatorProfileId:creatorId,
    visibility:'public',title:'QA disposable Scene',description:'mock-only',
    idempotencyKey,metadata:{}};
}
test('R18-work Source133 PRE-FIX real Edge TS allows copied published key to be discarded before DB registration, producing dangling DB Blob', async () => {
  const state = makeState('copy-discard-before-db');
  const invoke = createEdge(state);
  const id='qa-source-risk-1';
  const key = await deterministicPublishedKey(id);
  const reachedRpc=defer(),releaseRpc=defer();
  state.beforePublish = async () => {reachedRpc.resolve(); return releaseRpc.promise;};
  const publication=invoke(publishPayload(state.stagingKey,id));
  await reachedRpc.promise;
  assert.equal(state.objects.has(key), true, 'copy completed before DB call');
  assert.equal(state.blobs.has(key),false,'no committed DB row yet');
  const discarded=await invoke({action:'discard',storageKey:key});
  assert.equal(discarded.status,200,'pre-fix published-key discard incorrectly succeeds');
  assert.equal(state.objects.has(key),false,'physical published object removed in fake Storage');
  releaseRpc.resolve(null);
  const result=await publication;
  assert.equal(result.status,200,'source Edge returns success even though Storage key missing');
  assert.equal(state.blobs.has(key),true);
  assert.equal(state.objects.has(key),false,'mock dangling published Preset binary key');
  assert.equal(state.stats.committed,1);
  assert.equal(state.stats.remove.includes(key),true);
  assert.equal(state.stats.externalStorageProvider,false);
});

test('R18-work Source133 PRE-FIX failed Publish compensation can erase shared deterministic key after another request commits it', async () => {
  const state = makeState('failure-compensation');
  const invoke = createEdge(state);
  const id='qa-source-risk-2';
  const key=await deterministicPublishedKey(id);
  const reachedRpc=defer(),releaseRpc=defer();
  let count=0;
  state.beforePublish=async()=>{
    count++;
    if(count===1){reachedRpc.resolve();return releaseRpc.promise;}
    return null;
  };
  const failedFirst=invoke(publishPayload(state.stagingKey,id));
  await reachedRpc.promise;
  assert.equal(state.objects.has(key),true);
  const second=await invoke(publishPayload(state.stagingKey,id));
  assert.equal(second.status,200,'concurrent second publish accepted by injected DB');
  assert.equal(state.blobs.has(key),true);
  releaseRpc.resolve({error:{message:'injected failure on older in-flight writer'}});
  const failed=await failedFirst;
  assert.equal(failed.status,400);
  assert.equal(failed.body.error,'PRESET_PUBLISH_FAILED');
  assert.equal(state.stats.remove.includes(key),true);
  assert.equal(state.blobs.has(key),true);
  assert.equal(state.objects.has(key),false,'the compensation deleted second request committed key');
  assert.equal(state.stats.committed,1);
});

test('R18-work Source133 prior committed key discard is denied and unrelated owner path cannot be removed', async () => {
  const state=makeState('registered-protection');
  const invoke=createEdge(state);
  const key=await deterministicPublishedKey('qa-source-risk-3');
  state.objects.set(key, new TextEncoder().encode(JSON.stringify(goodScene)));
  state.blobs.set(key,{blobId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
  const before=state.stats.remove.length;
  const registered=await invoke({action:'discard',storageKey:key});
  assert.equal(registered.status,409);
  assert.equal(registered.body.error,'REGISTERED_ARTIFACT_CANNOT_BE_DISCARDED');
  const foreign=await invoke({action:'discard',storageKey:key},foreignActor);
  assert.equal(foreign.status,403);
  assert.equal(foreign.body.error,'INVALID_STORAGE_KEY');
  assert.equal(state.stats.remove.length,before);
  assert.equal(state.objects.has(key),true);
});

test('R18-work Source133 replay after same-key compensation lacks both staging and published bytes despite DB idempotency record', async () => {
  const state=makeState('replay-availability');
  const invoke=createEdge(state);
  const id='qa-source-risk-4';
  const key=await deterministicPublishedKey(id);
  const reachedRpc=defer(),releaseRpc=defer();
  let count=0;
  state.beforePublish=async()=>{
    count++;
    if(count===1){reachedRpc.resolve();return releaseRpc.promise;}
    return null;
  };
  const first=invoke(publishPayload(state.stagingKey,id));
  await reachedRpc.promise;
  const second=await invoke(publishPayload(state.stagingKey,id));
  assert.equal(second.status,200);
  assert.equal(state.objects.has(state.stagingKey),false,'second committed response cleaned staging');
  releaseRpc.resolve({error:{message:'injected delayed first response failure'}});
  const result=await first;
  assert.equal(result.status,400);
  assert.equal(state.blobs.has(key),true);
  assert.equal(state.objects.has(key),false);
  const replay=await invoke(publishPayload(state.stagingKey,id));
  assert.notEqual(replay.status,200,'idempotent DB result cannot be accessed when both physical keys missing');
  assert.equal(state.stats.committed,1);
  assert.equal(state.objects.has(key),false);
});
