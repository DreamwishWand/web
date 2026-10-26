import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scene = read('supabase/functions/wep-scene-preset-product/index.ts');
const artifact = read('supabase/functions/wep-preset-artifact/index.ts');
const retention = read('supabase/functions/wep-preset-retention/index.ts');
const closure = read('supabase/migrations/20261025003000_r18_scene_product_publisher_source_closure.sql');
const fencing = read('supabase/migrations/20261025002990_r18_preset_promotion_fencing_candidate.sql');
const compiled = ts.transpileModule(scene.replace(/^import[^\n]+\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace(/\bexport default\s*\{/m, '__edge = {');

async function invoke(action, variant = {}) {
  const calls = [];
  const container = {
    __edge: null,
    Response,
    corsHeaders: {},
    withSupabase: (options, handler) => {
      assert.equal(options.auth, 'user');
      return async request => handler(request, {
        userClaims: variant.missingActor ? {} : { id: 'actual-jwt-owner-A' },
        jwtClaims: { iat: variant.badIat ? 0 : 1761436800 },
        supabaseAdmin: {
          get storage() { throw new Error('STORAGE_ACCESSED'); },
          rpc: async (name, args) => {
            calls.push({ name, args });
            assert.equal(name, 'community_authorize_session', 'mutation RPC was called');
            assert.equal(args.p_auth_subject, 'actual-jwt-owner-A', 'payload actor forgery');
            return variant.revoked ? { data: null, error: { message: 'revoked' } }
              : { data: { accountId: 'account-A' }, error: null };
          }
        }
      });
    }
  };
  vm.runInNewContext(compiled, container, { filename: 'qr-source136-scene-edge.js' });
  const response = await container.__edge.fetch({
    method: variant.method ?? 'POST',
    json: async () => variant.malformed ? null : {
      action, authSubject: 'FORGED-OWNER-B', creatorProfileId: 'FORGED-CREATOR-B',
      idempotencyKey: 'same-owner-key', storageKey: 'published/account-A/same-key.json'
    }
  });
  return { status: response.status, body: await response.json(), calls,
    noStore: response.headers.get('Cache-Control') };
}

test('QR R18 dual publisher: both generic and separate Scene owner SOURCE paths refuse unsupported physical actions', () => {
  for (const [name, code] of [['generic', artifact], ['scene', scene], ['retention', retention]]) {
    assert.doesNotMatch(code, /\.copy\s*\(/, name);
    assert.doesNotMatch(code, /\.remove\s*\(/, name);
  }
  assert.match(artifact, /R18_PRESET_PUBLICATION_RESERVATION_AND_BYTES_NOT_ACCEPTED/);
  assert.match(retention, /R18_PRESET_PHYSICAL_RETENTION_CLEANUP_NOT_ENROLLED/);
  assert.match(scene, /R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED/);
  assert.match(scene, /R18_SCENE_PRODUCT_STORAGE_CLEANUP_NOT_AUTHORIZED/);
  assert.doesNotMatch(scene, /\.rpc\s*\(\s*['"]community_(?:publish|delete|unpublish)_scene_preset/);
});

test('QR R18 dual publisher: Scene actual TS handler closes ALL legacy routes before Storage or SQL mutation', async () => {
  for (const action of ['prepare', 'publish', 'unpublish', 'delete', 'discard',
    'compensate', 'cleanup', 'read', 'unknown']) {
    const r = await invoke(action);
    assert.equal(r.status, 409, action);
    assert.equal(r.noStore, 'private, no-store');
    assert.equal(r.body.publicationAuthorized, false);
    assert.equal(r.body.retirementAuthorized, false);
    assert.equal(r.body.cleanupAuthorized, false);
    assert.equal(r.body.providerCopyAuthorized, false);
    assert.equal(r.body.verificationAttested, false);
    assert.equal(r.body.operatorRolloutRequired, true);
    assert.deepEqual(r.calls.map(c => c.name), ['community_authorize_session']);
    assert.equal(r.body.error, ['discard','compensate','cleanup'].includes(action)
      ? 'R18_SCENE_PRODUCT_STORAGE_CLEANUP_NOT_AUTHORIZED'
      : 'R18_SCENE_PRODUCT_WRITER_NOT_ENROLLED');
  }
});

test('QR R18 dual publisher: same-key concurrent Scene publish/discard/failed-compensation are terminal without side effects', async () => {
  const attempts = await Promise.all([
    invoke('publish'), invoke('discard'), invoke('compensate'),
    invoke('publish'), invoke('unpublish'), invoke('delete')
  ]);
  assert.equal(attempts.length, 6);
  for (const r of attempts) {
    assert.equal(r.status, 409);
    assert.deepEqual(r.calls.map(c => c.name), ['community_authorize_session']);
  }
});

test('QR R18 dual publisher: auth, token age and malformed routes never invoke mutation RPC', async () => {
  for (const options of [{ missingActor: true }, { badIat: true }, { revoked: true }]) {
    const r = await invoke('publish', options);
    assert.equal(r.status, 401);
    assert.equal(r.calls.filter(c => c.name !== 'community_authorize_session').length, 0);
  }
  const bad = await invoke('publish', { malformed: true });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.calls.map(c => c.name), ['community_authorize_session']);
  const method = await invoke('publish', { method: 'GET' });
  assert.equal(method.status, 405);
  assert.equal(method.calls.length, 0);
});

test('QR R18 dual publisher: overloaded old scene RPCs are revoked and documented as still unsafe in live Staging', () => {
  for (const legacy of [
    'community_publish_scene_preset_product_v1',
    'community_unpublish_scene_preset_v1',
    'community_delete_scene_preset_v1'
  ]) assert.ok(closure.includes(legacy), legacy);
  assert.match(closure, /pg_catalog\.pg_proc/);
  assert.match(closure, /p\.oid::regprocedure/);
  assert.match(closure, /revoke all on function %s from public,anon,authenticated,service_role/i);
  assert.match(closure, /has_function_privilege\('service_role',v\.function_oid,'EXECUTE'\)/);
  assert.match(closure, /R18_SCENE_LIFECYCLE_WRITER_EXECUTE_REMAINS_EXPOSED/);
  for (const issuer of [
    'scene-product-staging-publish',
    'scene-product-staging-failed-compensation',
    'scene-product-staging-success-stage-remove',
    'scene-product-staging-discard',
    'scene-product-staging-unpublish',
    'scene-product-staging-delete',
    'preset-retention-staging-physical-remove',
    'scene-product-source-alias-deny'
  ]) assert.ok(closure.includes(issuer), issuer);
  assert.match(closure, /STAGING_DEPLOYED_NOT_SOURCE_ENROLLED/);
  assert.match(closure, /SOURCE_PRESENT_UNENROLLED/);
  assert.match(closure, /NO BEFORE_COPY LEASE OR PROVIDER ATTESTATION/);
});

test('QR R18 dual publisher: Source136 does not silently activate positive commit or Provider-Copy authority', () => {
  assert.match(fencing, /enabled boolean not null default false/);
  assert.match(fencing, /'providerCopyAuthorized',false/);
  assert.match(fencing, /'publicationCommitAuthorized',false/);
  assert.match(fencing, /'EDGE_READBACK_UNATTESTED'/);
  assert.match(fencing, /revoke all on function private\.preset_storage_commit_candidate_r18/);
  assert.doesNotMatch(fencing, /grant execute on function private\.preset_storage_commit_candidate_r18/);
});
