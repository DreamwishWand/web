import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const root = new URL('../operator/gate-a/wep-source142-stop-candidate/supabase/functions/', import.meta.url);
const names = ['wep-preset-artifact', 'wep-scene-preset-product', 'wep-preset-retention'];
const sources = Object.fromEntries(names.map(n => [n, fs.readFileSync(new URL(n + '/index.ts', root), 'utf8')]));
const subject = '22222222-2222-4222-8222-222222222222';
const account = '11111111-1111-4111-8111-111111111111';
const creator = '33333333-3333-4333-8333-333333333333';
const foreign = '44444444-4444-4444-8444-444444444444';
const preset = '55555555-5555-4555-8555-555555555555';
const revision = '66666666-6666-4666-8666-666666666666';
const reservation = '77777777-7777-4777-8777-777777777777';
const work = '88888888-8888-4888-8888-888888888888';
const staging = 'staging/' + account + '/' + preset + '.json';
const published = 'published/' + account + '/' + 'a'.repeat(64) + '.json';

async function load(name) {
  const isWorker = name === 'wep-preset-retention';
  const source = sources[name];
  const withSupabase = "import { withSupabase } from 'npm:@supabase/server';";
  const cors = "import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';";
  let rewritten = source.replace(withSupabase,
    'const withSupabase = (_opts, handler) => req => handler(req, globalThis.__gateACtx);');
  if (!isWorker) rewritten = rewritten.replace(cors, 'const corsHeaders = {};');
  assert.doesNotMatch(rewritten, /^import /m);
  const js = ts.transpileModule(rewritten, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return (await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))).default;
}

const handlers = Object.fromEntries(await Promise.all(names.map(async name => [name, await load(name)])));

function fixture(opts = {}) {
  const calls = { rpc: [], from: [], storage: [] };
  const admin = {
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      if (name === 'community_verify_worker_token') {
        return { data: !opts.badWorker, error: opts.badWorker ? { message: 'invalid' } : null };
      }
      if (name === 'community_authorize_session') {
        return { data: opts.revoked ? null : { accountId: opts.owner ?? account },
          error: opts.revoked ? { message: 'revoked' } : null };
      }
      throw Error('UNAUTHORIZED_SQL_INVOKED:' + name);
    },
    from(table) {
      calls.from.push(table);
      if (table !== 'creator_profiles') throw Error('UNAUTHORIZED_SQL_TABLE:' + table);
      return { select() { return { eq(_column, id) { return { maybeSingle: async () =>
        ({ data: { owner_account_id: opts.foreignCreator || id === foreign ? foreign : account }, error: null })
      }; } }; } };
    }
  };
  Object.defineProperty(admin, 'storage', { get() {
    calls.storage.push('storage');
    throw Error('STORAGE_USED_BY_GATE_A');
  }});
  return {
    ctx: { userClaims: { id: opts.actor === undefined ? subject : opts.actor },
      jwtClaims: { iat: opts.iat === undefined ? 1793000000 : opts.iat }, supabaseAdmin: admin },
    calls
  };
}

async function call(name, env, action, body = {}, method = 'POST', token = 'valid') {
  globalThis.__gateACtx = env.ctx;
  const response = await handlers[name].fetch(new Request('https://offline.invalid/functions/v1/' + name, {
    method,
    ...(name === 'wep-preset-retention' && token ? { headers: { 'x-community-worker-token': token, 'Content-Type': 'application/json' } } :
      method === 'POST' ? { headers: { 'Content-Type': 'application/json' } } : {}),
    ...(method === 'POST' ? { body: JSON.stringify({ action, ...body }) } : {})
  }));
  const result = { status: response.status, body: await response.json().catch(() => ({})), headers: response.headers };
  assert.deepEqual(env.calls.storage, []);
  assert.ok(env.calls.rpc.every(x => x.name === 'community_authorize_session' ||
    x.name === 'community_verify_worker_token'));
  assert.ok(env.calls.from.every(x => x === 'creator_profiles'));
  return result;
}
const gen = 'wep-preset-artifact';
const scene = 'wep-scene-preset-product';
const worker = 'wep-preset-retention';

test('source candidates have no sign/copy/remove/download/Storage property or positive SQL', () => {
  for (const [n, s] of Object.entries(sources)) {
    for (const bad of ['createSignedUrl','createSignedUploadUrl','storage.from(','.copy(','.remove(','.download(',
      'community_publish_preset_envelope','community_publish_scene_preset_product_v1',
      'community_unpublish_scene_preset_v1','community_delete_scene_preset_v1',
      'community_preset_storage_reserve_r18','community_preset_storage_claim_promotion_r18']) {
      assert.ok(!s.includes(bad), n + ':' + bad);
    }
    assert.match(s, /private, no-store/);
  }
});

test('generic full Source142 action inventory is terminally stopped, including authenticated READ', async () => {
  const list = [
    ['prepare',{ byteSize: 1024 }],
    ['reservePublication',{ storageKey: staging, creatorProfileId: creator, idempotencyKey:'key' }],
    ['recoverPublication',{ reservationId: reservation, expectedVersion:1 }],
    ['inspectPublishedObject',{ reservationId: reservation, expectedVersion:1 }],
    ['publish',{ storageKey: staging, creatorProfileId: creator, idempotencyKey:'key' }],
    ['revisionReadiness',{ presetArtifactId: preset }],
    ['resolveWork',{ workId: work }],
    ['read',{ presetArtifactId: preset, presetRevisionId: revision }],
    ['discard',{ storageKey: staging }],
    ['discard',{ storageKey: published }]
  ];
  const env = fixture();
  for(const [action, body] of list) {
    const r = await call(gen, env, action, body);
    assert.equal(r.status, 409, action);
    assert.equal(r.body.error, 'OPERATOR_GATE_A_WEP_STOP', action);
    assert.equal(r.body.readAuthorized, false);
    assert.equal(r.body.signedUrlAuthorized, false);
    assert.equal(r.body.retryable, false);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
  }
});

test('Scene full Source142 and deployed aliases never mutate lifecycle, sign or copy', async () => {
  const env = fixture();
  for (const [action, body] of [
    ['prepare',{byteSize:1000}],['publish',{storageKey:staging,creatorProfileId:creator,title:'Scene',idempotencyKey:'k'}],
    ['read',{presetArtifactId:preset}],['unpublish',{presetArtifactId:preset,idempotencyKey:'k'}],
    ['delete',{presetArtifactId:preset,idempotencyKey:'k'}],
    ['discard',{storageKey:staging}],['compensate',{storageKey:published}],
    ['failedSqlPublishCompensation',{storageKey:published}],['cleanup',{storageKey:staging}]
  ]) {
    const r = await call(scene, env, action, body);
    assert.equal(r.status,409,action);
    assert.equal(r.body.retryable,false,action);
    assert.equal(r.body.signedUrlAuthorized,false,action);
  }
});

test('parallel same-key dual publisher retry is terminally denied for BOTH routes', async () => {
  const env = fixture();
  const requests = await Promise.all([
    call(gen,env,'publish',{storageKey:staging,creatorProfileId:creator,idempotencyKey:'identical'}),
    call(scene,env,'publish',{storageKey:staging,creatorProfileId:creator,title:'Scene',idempotencyKey:'identical'}),
    call(scene,env,'publish',{storageKey:staging,creatorProfileId:creator,title:'Scene',idempotencyKey:'identical'})
  ]);
  assert.deepEqual(requests.map(x=>x.status),[409,409,409]);
  assert.deepEqual(env.calls.storage,[]);
});

test('Legacy aliases disabled distinctly; unknown actions never trigger upstream writes', async () => {
  for (const name of [gen,scene]) {
    const env = fixture();
    for (const action of ['retry','retryPublish','prepareUpload','ownerRead','readPreset','publishScene']) {
      const r=await call(name,env,action,{storageKey:staging});
      assert.equal(r.status,409);
      assert.equal(r.body.error,'OPERATOR_GATE_A_LEGACY_ALIAS_DISABLED');
    }
    const unknown=await call(name,env,'unrecognized-future-action');
    assert.equal(unknown.status,400);
    assert.equal(unknown.body.error,'UNSUPPORTED_ACTION');
  }
});

test('foreign path and malformed payloads deny before all signed or Storage actions', async () => {
  for(const name of [gen,scene]) {
    const env=fixture();
    for(const key of [staging.replace(account,foreign),published.replace(account,foreign),
      'staging/'+account+'/../traversal.json','staging/'+account+'/%2e%2e/attack.json']) {
      assert.equal((await call(name,env,'discard',{storageKey:key})).status,403);
    }
    assert.equal((await call(name,env,'prepare',{byteSize:0})).status,400);
    assert.equal((await call(name,env,'read',{})).status,400);
  }
});

test('invalid or revoked session and owner/creator isolation fail before Read', async () => {
  for(const name of [gen,scene]) {
    for(const opts of [{actor:null},{iat:0},{revoked:true},{owner:''}]) {
      const env=fixture(opts);
      const r=await call(name,env,'read',{presetArtifactId:preset});
      assert.equal(r.status,401,JSON.stringify(opts));
    }
    const env=fixture({foreignCreator:true});
    const r=await call(name,env,'publish',{storageKey:staging,creatorProfileId:creator,idempotencyKey:'key',title:'Scene'});
    assert.equal(r.status,403);
    assert.equal(r.body.error,'CREATOR_FORBIDDEN_OR_UNAVAILABLE');
  }
});

test('all methods denied except harmless OPTIONS; no service on GET/PUT/DELETE', async () => {
  for(const name of [gen,scene,worker]) {
    const env=fixture();
    for(const method of ['GET','PUT','DELETE']) assert.equal((await call(name,env,'read',{},method)).status,405);
    assert.equal((await call(name,env,'anything',{},'OPTIONS')).status,200);
  }
});

test('valid Retention worker token never claims/removes, missing/revoked token fails', async () => {
  const env=fixture();
  for(const action of ['retention','purge','retry','cleanup']) {
    const r=await call(worker,env,action,{retentionJobId:reservation,lockToken:'lock'});
    assert.equal(r.status,409);
    assert.equal(r.body.physicalDeleteAuthorized,false);
    assert.equal(r.body.retryable,false);
  }
  assert.equal((await call(worker,fixture(),'purge',{retentionJobId:reservation,lockToken:'lock'},'POST','')).status,401);
  assert.equal((await call(worker,fixture({badWorker:true}),'purge',{retentionJobId:reservation,lockToken:'lock'})).status,401);
  assert.equal((await call(worker,fixture(),'purge',{retentionJobId:'',lockToken:''})).status,400);
});

test('denial is not in-flight drain or a deployed SHA attestation', () => {
  assert.equal(typeof handlers[gen].fetch,'function');
  assert.equal(typeof handlers[scene].fetch,'function');
  assert.equal(typeof handlers[worker].fetch,'function');
});
