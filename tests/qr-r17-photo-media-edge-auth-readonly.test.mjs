import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const ownerSha = '8a4a5a8d23fe89e4b4402cd7ce0d048cc5e2b0ec';
const source = fs.readFileSync(new URL('../supabase/functions/community-query/index.ts', import.meta.url), 'utf8');
assert.match(source, /galleryPhotoMediaPreflight:\s*'community_gallery_photo_media_preflight_r17'/);
const code = ts.transpileModule(source.replace(/^import[^\n]+\n/gm, ''), {
  compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}
}).outputText.replace(/\bexport default\s*\{/m, '__qrEdge = {');

const owner = '00000000-0000-4000-8000-000000000001';
const nonowner = '00000000-0000-4000-8000-000000000002';
const workId = '00000000-0000-4000-8000-000000000111';
const dto = {
  schemaVersion: 1, contract: 'ddv.gallery-photo-media-readonly@r17', workId,
  sourceStorageState: 'DATABASE_METADATA_ONLY', snapshotNotAtomicMutationFence: true,
  actualStorageBytesVerified: false, metadataSha256IsStorageProof: false,
  priorSignedUrlsRevoked: false, cdnBrowserPurgeProven: false,
  storageIssuerGraphComplete: false, graphComplete: false, mutationAuthorized: false,
  saveRevisionAuthorized: false, pairedGalleryPublishAuthorized: false,
  retirementAuthorized: false, physicalCleanupAuthorized: false,
  knownDependencyCounts: {coverSubjectOrReferenceMismatch: 1},
  blockedReasons: ['MEDIA_COVER_METADATA_INCONSISTENT']
};

async function invoke(opts = {}) {
  const events = [];
  const box = { __qrEdge: null, __authConfig: null,
    corsHeaders: {'Access-Control-Allow-Origin': '*'}, Response,
    withSupabase: (auth, handler) => {
      box.__authConfig = auth;
      return req => handler(req, box.context);
    }
  };
  const admin = {rpc: async (name, params) => {
    events.push({name, params: structuredClone(params)});
    if (name === 'community_authorize_session')
      return {data: null, error: opts.sessionError ?? null};
    if (name === 'community_gallery_photo_media_preflight_r17')
      return {data: opts.data ?? dto, error: opts.rpcError ?? null};
    throw Error('Unexpected RPC: ' + name);
  }};
  vm.runInNewContext(code, box, {filename: 'actual-community-query-transpiled.js'});
  box.context = {
    userClaims: opts.actor === null ? {} : {id: opts.actor ?? owner},
    jwtClaims: {iat: opts.iat === undefined ? 1761436800 : opts.iat},
    supabaseAdmin: admin
  };
  const req = {
    method: opts.method ?? 'POST',
    json: async () => {
      if (opts.badJson) throw Error('Bad JSON');
      return opts.body ?? {query: 'galleryPhotoMediaPreflight', payload: {workId}};
    }
  };
  const response = await box.__qrEdge.fetch(req);
  let body = null;
  try {body = await response.json();} catch {}
  return {response, status: response.status, body, events, auth: box.__authConfig};
}

test('R17 actual TS Edge Owner observer route authorizes current session and passes scoped actor/work only', async () => {
  const r = await invoke();
  assert.equal(r.status, 200);
  assert.equal(r.auth.auth, 'user');
  assert.equal(r.response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(r.body.ok, true);
  assert.equal(r.body.query, 'galleryPhotoMediaPreflight');
  assert.equal(r.body.data.contract, 'ddv.gallery-photo-media-readonly@r17');
  assert.equal(r.body.data.knownDependencyCounts.coverSubjectOrReferenceMismatch, 1);
  assert.ok(r.body.data.blockedReasons.includes('MEDIA_COVER_METADATA_INCONSISTENT'));
  for (const key of ['actualStorageBytesVerified','metadataSha256IsStorageProof',
    'priorSignedUrlsRevoked','cdnBrowserPurgeProven','storageIssuerGraphComplete',
    'graphComplete','mutationAuthorized','saveRevisionAuthorized','pairedGalleryPublishAuthorized',
    'retirementAuthorized','physicalCleanupAuthorized'])
    assert.equal(r.body.data[key], false, key);
  assert.deepEqual(r.events.map(x => x.name),
    ['community_authorize_session','community_gallery_photo_media_preflight_r17']);
  assert.deepEqual(r.events[0].params, {
    p_auth_subject: owner, p_issued_at_epoch: 1761436800, p_max_age_seconds: null
  });
  assert.deepEqual(r.events[1].params, {p_auth_subject: owner, p_gallery_work_id: workId});
  assert.equal(ownerSha.length, 40);
});

test('R17 Edge rejects forged auth subject and maps SQL nonowner denial to 403 without DTO', async () => {
  const r = await invoke({
    actor: nonowner,
    body: {query: 'galleryPhotoMediaPreflight', payload: {
      workId, p_auth_subject: owner, ownerAccountId: owner
    }},
    rpcError: {message: 'R17_PHOTO_PREFLIGHT_FORBIDDEN'}
  });
  assert.equal(r.status, 403);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.error, 'FORBIDDEN');
  assert.equal(r.body.data, undefined);
  assert.equal(r.events[1].params.p_auth_subject, nonowner);
  assert.deepEqual(r.events[1].params, {p_auth_subject: nonowner, p_gallery_work_id: workId});
  assert.equal(r.response.headers.get('Cache-Control'), 'private, no-store');
});

for (const [name, args, calls] of [
  ['missing subject', {actor: null}, 0],
  ['missing iat', {iat: 0}, 0],
  ['revoked session', {sessionError: {message: 'retired'}}, 1]
]) {
  test('R17 query fails closed before Photo RPC for ' + name, async () => {
    const r = await invoke(args);
    assert.equal(r.status, 401);
    assert.equal(r.events.length, calls);
    assert.equal(r.events.some(x => x.name === 'community_gallery_photo_media_preflight_r17'), false);
  });
}

for (const bad of [undefined, null, '', 'xyz', 3, {}, '00000000-0000-4000-8000-000000000111/../x']) {
  test('R17 invalid UUID never reaches Photo RPC (' + String(bad) + ')', async () => {
    const r = await invoke({body: {query: 'galleryPhotoMediaPreflight', payload: {workId: bad}}});
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'INVALID_WORK_ID');
    assert.equal(r.events.length, 1);
  });
}

test('R17 SQL observer operational error yields no DTO or positive authority', async () => {
  const r = await invoke({rpcError: {code: 'XX001', message: 'Database unavailable'}});
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'QUERY_FAILED');
  assert.equal(r.body.data, undefined);
});

test('R17 invalid JSON, unsupported query and GET cannot reach observer RPC', async () => {
  for (const args of [{badJson: true},{body:{query:'nonexistent',payload:{workId}}},{method:'GET'}]) {
    const r = await invoke(args);
    assert.ok([400,405].includes(r.status));
    assert.equal(r.body.ok, false);
    assert.equal(r.events.some(x => x.name === 'community_gallery_photo_media_preflight_r17'), false);
  }
});

test('R17 OPTIONS does not authenticate or disclose private observer data', async () => {
  const r = await invoke({method:'OPTIONS',actor:null,iat:0});
  assert.equal(r.status, 200);
  assert.equal(r.events.length, 0);
  assert.equal(r.body, null);
});
