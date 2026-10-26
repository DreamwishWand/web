import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/wep-scene-preset-product/index.ts', import.meta.url), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111';
const subject = '22222222-2222-4222-8222-222222222222';
const creator = '33333333-3333-4333-8333-333333333333';
const foreignCreator = '44444444-4444-4444-8444-444444444444';
const preset = '77777777-7777-4777-8777-777777777777';
const staging = `staging/${owner}/55555555-5555-4555-8555-555555555555.json`;
const staging2 = `staging/${owner}/66666666-6666-4666-8666-666666666666.json`;
const published = `published/${owner}/${'a'.repeat(64)}.json`;

const rewritten = source
  .replace("import { withSupabase } from 'npm:@supabase/server';",
    'const withSupabase = (_opts, handler) => (req) => handler(req, globalThis.__sceneProductCtx);')
  .replace("import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';",
    'const corsHeaders = {};');
assert.doesNotMatch(rewritten, /^import /m);
const js = ts.transpileModule(rewritten, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const handler = (await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))).default;

function mockContext({ revoked = false, ownerAccountId = owner, iat = 1793000000, actor = subject,
  creatorOwner = owner, missingCreator = false } = {}) {
  const calls = { storage: [], rpc: [], creatorRead: [] };
  const rpc = async (name, args) => {
    calls.rpc.push([name, args]);
    if (name !== 'community_authorize_session') throw new Error('POSITIVE_MUTATION_RPC_CALLED');
    if (revoked) return { data: null, error: { message: 'revoked' } };
    return { data: { accountId: ownerAccountId }, error: null };
  };
  const storage = new Proxy({}, { get(_target, property) {
    calls.storage.push(String(property));
    throw new Error('STORAGE_ACCESS_FORBIDDEN');
  } });
  const ctx = {
    userClaims: { id: actor }, jwtClaims: { iat },
    supabaseAdmin: {
      rpc,
      storage,
      from(table) {
        calls.creatorRead.push(table);
        if (table !== 'creator_profiles') throw new Error('NON_CREATOR_TABLE_READ');
        return {
          select(column) {
            assert.equal(column, 'owner_account_id');
            return { eq(key, id) {
              assert.equal(key, 'creator_profile_id');
              return { maybeSingle: async () => ({
                data: missingCreator ? null : { owner_account_id: id === foreignCreator ? foreignCreator : creatorOwner },
                error: null
              }) };
            } };
          }
        };
      }
    }
  };
  return { ctx, calls };
}

async function invoke(env, action, fields = {}, method = 'POST') {
  globalThis.__sceneProductCtx = env.ctx;
  const response = await handler.fetch(new Request('https://example.invalid/functions/v1/wep-scene-preset-product', {
    method, ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...fields }) } : {})
  }));
  return { status: response.status, body: method === 'OPTIONS' ? null : await response.json(),
    headers: response.headers };
}

const publish = (storageKey = staging) => ({
  storageKey, creatorProfileId: creator, title: 'Scene', idempotencyKey: 'shared-published-key',
  mediaIds: ['88888888-8888-4888-8888-888888888888']
});

function onlySessionAndRead(env) {
  assert.deepEqual(env.calls.storage, []);
  assert.ok(env.calls.rpc.every(([name]) => name === 'community_authorize_session'));
  assert.ok(env.calls.creatorRead.every(table => table === 'creator_profiles'));
}

test('the deployed issuer namespace has a Source stub but no positive RPC, copy, remove, signed upload or signed read', () => {
  for (const token of ['community_publish_scene_preset_product_v1',
    'community_unpublish_scene_preset_v1', 'community_delete_scene_preset_v1',
    'community_publish_preset_envelope', '.copy(', '.remove(', '.download(',
    'createSignedUploadUrl', 'createSignedUrl', 'storage.from(']) {
    assert.ok(!source.includes(token), token);
  }
  assert.match(source, /withSupabase\(\{ auth: 'user' \}/);
  assert.match(source, /community_authorize_session/);
});

test('invalid method, JWT subject, iat, missing owner and revoked session deny before action', async () => {
  const e = mockContext();
  assert.equal((await invoke(e, 'publish', publish(), 'GET')).status, 405);
  for (const options of [{ actor: null }, { iat: 0 }, { ownerAccountId: '' }, { revoked: true }]) {
    const x = mockContext(options);
    const r = await invoke(x, 'publish', publish());
    assert.equal(r.status, 401, JSON.stringify(options));
    onlySessionAndRead(x);
  }
});

test('valid prepare is suspended before signed upload; invalid byte size is 400', async () => {
  const e = mockContext();
  assert.equal((await invoke(e, 'prepare', { byteSize: 1024 })).status, 409);
  assert.equal((await invoke(e, 'prepare', { byteSize: 0 })).status, 400);
  onlySessionAndRead(e);
});

test('same-key dual publishers fail closed without copied bytes or registration', async () => {
  const e = mockContext();
  const results = await Promise.all([
    invoke(e, 'publish', publish(staging)),
    invoke(e, 'publish', publish(staging2))
  ]);
  assert.deepEqual(results.map(r => r.status), [409, 409]);
  for (const r of results) {
    assert.equal(r.body.error, 'R18_SCENE_PRODUCT_PUBLICATION_ISSUER_NOT_ENROLLED');
    assert.equal(r.body.publicationAuthorized, false);
  }
  onlySessionAndRead(e);
});

test('failed SQL publish compensation and public key operations never physically remove', async () => {
  const e = mockContext();
  const a = await invoke(e, 'failedSqlPublishCompensation', { storageKey: published });
  const b = await invoke(e, 'compensate', { storageKey: staging });
  assert.equal(a.status, 409);
  assert.equal(b.status, 409);
  assert.equal(a.body.physicalDeleteAuthorized, false);
  assert.equal(b.body.physicalDeleteAuthorized, false);
  onlySessionAndRead(e);
});

test('Scene Unpublish and Delete are denied after metadata validation, no Owner RPC', async () => {
  const e = mockContext();
  for (const action of ['unpublish','delete']) {
    const r = await invoke(e, action, { presetArtifactId: preset, idempotencyKey: 'same-key' });
    assert.equal(r.status, 409);
    assert.equal(r.body.lifecycleAuthorized, false);
  }
  assert.equal((await invoke(e, 'delete', { presetArtifactId: 'x', idempotencyKey: 'same-key' })).status, 400);
  onlySessionAndRead(e);
});

test('staging discard and published discard cannot unlink and foreign/malformed paths return 403', async () => {
  const e = mockContext();
  assert.equal((await invoke(e, 'discard', { storageKey: staging })).status, 409);
  for (const key of [published, staging.replace(owner, foreignCreator),
    `staging/${owner}/../x.json`, `staging/${owner}//x.json`,
    `staging/${owner}/%2e%2e/x.json`]) {
    assert.equal((await invoke(e, 'discard', { storageKey: key })).status, 403, key);
  }
  assert.equal((await invoke(e, 'publish', publish(staging.replace(owner, foreignCreator)))).status, 403);
  onlySessionAndRead(e);
});

test('foreign or missing Creator fails 403 even when issuer disabled', async () => {
  const e = mockContext();
  const r = await invoke(e, 'publish', { ...publish(), creatorProfileId: foreignCreator });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'CREATOR_FORBIDDEN_OR_UNAVAILABLE');
  const missing = mockContext({ missingCreator: true });
  assert.equal((await invoke(missing, 'publish', publish())).status, 403);
  onlySessionAndRead(e);
  onlySessionAndRead(missing);
});

test('separate read alias denied; canonical R15 readers are not modified', async () => {
  const e = mockContext();
  const r = await invoke(e, 'read', { presetArtifactId: preset });
  assert.equal(r.status, 409);
  assert.equal(r.body.readAuthorized, false);
  assert.equal((await invoke(e, 'read', {})).status, 400);
  onlySessionAndRead(e);
});

test('unknown action and invalid payload fail closed, OPTIONS still works', async () => {
  const e = mockContext();
  assert.equal((await invoke(e, 'somethingElse', {})).status, 400);
  const preflight = await invoke(e, 'prepare', {}, 'OPTIONS');
  assert.equal(preflight.status, 200);
  onlySessionAndRead(e);
});
