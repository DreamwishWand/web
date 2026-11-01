import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compareObservedSaveStructure, observeProfileShape
} from '../scripts/ddv-save-structure-compare.mjs';

const ids = {
  platform: 'switch', leftBuild: '52BD625D9B4E0053', rightBuild: '9A239D3DB569756D'
};
function specimen(version, opts = {}) {
  const o = {
    GameInfo: { Version: version, SessionId: 'PRIVATE-TOKEN-abc' },
    Player: {
      Name: 'PRIVATE_PERSON',
      ListInventories: [{ CompatibleItemType: 'Furniture', Inventory: {
        '000001111': { Amount: 10, Marker: 'Hidden', Secret: 'PRIVATE-INVENTORY' }
      }}],
      CollectionSets: opts.collection ? [{ GroupData: [{ GroupsCollectionItems: { '99999': true } }] }] : []
    },
    World: {
      FloatingIslands: {
        'PRIVATE-ISLAND-1422': { Grid: { Objects: { '1234': { ItemID: 40100068, X: 14, Y: 18, State: null } }, NextGridObjectID: 3 } }
      },
      PrivateName: 'PRIVATE-WORLD'
    },
    PrivateAccount: { Email: 'PRIVATE-EMAIL@example.com' }
  };
  if (opts.noInventory) delete o.Player.ListInventories[0].Inventory;
  return o;
}

test('exact build/schema are mandatory and writer authority remains false', () => {
  const result = compareObservedSaveStructure(specimen(624), specimen(626), ids);
  assert.equal(result.complete, true);
  assert.equal(result.acceptance.write, 'NOT_AUTHORIZED');
  assert.equal(result.acceptance.productApply, false);
  assert.equal(result.sourceIdentity, 'OPERATOR_ATTESTED_NOT_PROVEN_BY_GAMEINFO');
  assert.throws(() => compareObservedSaveStructure(specimen(624), specimen(626), { ...ids, rightBuild: 'WRONG' }), /BUILD_SOURCE_ATTESTATION_REQUIRED/);
  assert.throws(() => compareObservedSaveStructure(specimen(626), specimen(626), ids), /PROFILE_IDENTITY_OR_ROOT_INVALID/);
  assert.throws(() => compareObservedSaveStructure(specimen(624), specimen(627), ids), /PROFILE_IDENTITY_OR_ROOT_INVALID/);
});

test('raw identifiers, values, names and dynamic map keys never appear in report', () => {
  const r = compareObservedSaveStructure(specimen(624), specimen(626, { collection: true }), ids);
  const serialized = JSON.stringify(r);
  for (const secret of ['PRIVATE', 'abc', '000001111', '99999', '1234', '40100068', '14', '18', 'Furniture', 'Hidden', '10']) {
    // Small numbers appear in contract version/build; check paths separately for numeric values.
    if (secret.length > 2) assert.equal(serialized.includes(secret), false, secret);
  }
  assert.ok(r.entries.some(e => e.path.includes('ListInventories')));
  assert.ok(r.entries.some(e => e.path.includes('FloatingIslands')));
  assert.ok(r.entries.some(e => e.path.includes('CollectionSets') && e.observation === 'OPTIONAL_OR_STATE_DEPENDENT_UNOBSERVED'));
  assert.ok(r.entries.every(e => !e.path.includes('Private') && !e.path.includes('000001111')));
});

test('observed mismatch is review-only, and missing paths are not interpreted as deleted schema', () => {
  const r = compareObservedSaveStructure(specimen(624), specimen(626, { noInventory: true }), ids);
  const d = r.entries.filter(e => e.path.endsWith('.Inventory'));
  assert.ok(d.some(e => e.observation === 'OPTIONAL_OR_STATE_DEPENDENT_UNOBSERVED'));
  assert.equal(r.acceptance.model, 'OBSERVED_ONLY_NOT_RUNTIME_VALIDATED');
});

test('traversal budget truncation fails closed, not false-positive structural parity', () => {
  const r = compareObservedSaveStructure(specimen(624), specimen(626), { ...ids, budgets: { maxNodes: 2 } });
  assert.equal(r.complete, false);
  assert.ok(r.entries.every(x => x.observation === 'INCOMPLETE_NO_VERDICT'));
});

test('Steam source cannot be attested using Switch target build', () => {
  assert.throws(() => compareObservedSaveStructure(specimen(624), specimen(626), {
    ...ids, platform: 'steam-windows'
  }), /BUILD_SOURCE_ATTESTATION_REQUIRED/);
});

test('source profiles remain untouched even when nested values are inspected', () => {
  const a = specimen(624); const b = specimen(626);
  const before = [JSON.stringify(a), JSON.stringify(b)];
  observeProfileShape(a);
  compareObservedSaveStructure(a, b, ids);
  assert.deepEqual([JSON.stringify(a), JSON.stringify(b)], before);
});

test('evidence manifest is privacy-safe, version-pinned, and read/model/write separated', () => {
  const manifest = JSON.parse(readFileSync(new URL('../static/ddv/core/save/v1.25.3/save-first-compatibility-matrix-v0.json', import.meta.url), 'utf8'));
  assert.equal(manifest.personalSaveRawIncluded, false);
  assert.equal(manifest.observedRealSaveCrossVersionValueDiffPerformed, false);
  assert.equal(manifest.builds.length, 4);
  assert.ok(manifest.builds.every(x => x.write === 'NOT_AUTHORIZED'));
  assert.ok(Object.values(manifest.hardFlags).every(x => x === false));
  assert.equal(manifest.builds.find(x => x.platform === 'steam-windows' && x.saveSchema === 626).read,
    'STATIC_COMPATIBLE_RUNTIME_PENDING');
});
