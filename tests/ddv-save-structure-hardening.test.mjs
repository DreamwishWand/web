import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareObservedSaveStructure, cli } from '../scripts/ddv-save-structure-compare.mjs';

const ids = { platform: 'switch', leftBuild: '52BD625D9B4E0053', rightBuild: '9A239D3DB569756D' };
const fixture = version => ({
  GameInfo: { Version: version },
  Player: { ListInventories: [{ Inventory: {} }], CollectionSets: [] },
  World: { FloatingIslands: { 'island-fixture': { Grid: { Objects: {} } } } }
});

test('malformed JSON and missing source files have a generic library error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddv-shape-fixture-'));
  try {
    const left = join(dir, 'fixture-left.json');
    const right = join(dir, 'fixture-right.json');
    writeFileSync(left, 'not a valid json document');
    writeFileSync(right, JSON.stringify(fixture(626)));
    const args = ['--left', left, '--right', right, '--platform', ids.platform,
      '--left-build', ids.leftBuild, '--right-build', ids.rightBuild];
    assert.throws(() => cli(args), e => e.message === 'PROFILE_INPUT_UNREADABLE_OR_INVALID');
    rmSync(left);
    assert.throws(() => cli(args), e => e.message === 'PROFILE_INPUT_UNREADABLE_OR_INVALID');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('version text must be canonical', () => {
  for (const bad of [' 624 ', '0624', '624.0', 624.5, null, true]) {
    const a = fixture(624);
    a.GameInfo.Version = bad;
    assert.throws(() => compareObservedSaveStructure(a, fixture(626), ids), /PROFILE_IDENTITY_OR_ROOT_INVALID/);
  }
});

test('dictionary keys matching schema field names remain dynamic', () => {
  const a = fixture(624), b = fixture(626);
  a.Player.ListInventories[0].Inventory.Amount = { Amount: 8 };
  a.World.FloatingIslands['island-fixture'].Grid.Objects.State = { X: 10 };
  b.Player.CollectionSets = [{ GroupData: [{ GroupsCollectionItems: { Marker: false } }] }];
  const result = compareObservedSaveStructure(a, b, ids);
  const paths = result.entries.map(e => e.path);
  assert.ok(!paths.some(p => p.includes('.Inventory.Amount') || p.includes('.Objects.State') ||
    p.includes('.GroupsCollectionItems.Marker')));
  assert.ok(paths.some(p => p.includes('.Inventory.*')));
  assert.ok(paths.some(p => p.includes('.Objects.*')));
  assert.ok(paths.some(p => p.includes('.GroupsCollectionItems.*')));
});

test('large arrays hit the bound and never claim complete comparison', () => {
  const a = fixture(624), b = fixture(626);
  a.Player.ListInventories = new Array(50000).fill({ Inventory: {} });
  const result = compareObservedSaveStructure(a, b, { ...ids, budgets: { maxNodes: 128, maxPaths: 100, maxDepth: 8 } });
  assert.equal(result.complete, false);
  assert.ok(result.entries.every(e => e.observation === 'INCOMPLETE_NO_VERDICT'));
});


test('generic GridObject geometry never proves Road/Fence topology', () => {
  const a = fixture(624), b = fixture(626);
  a.World.GridCollection = { Grids: { 'grid-a': { Objects: { 'object-a': { ItemID: 42, X: 1, Y: 2, State: { FenceMode: { Style: 0 } } } } } } };
  b.World.GridCollection = { Grids: { 'grid-a': { Objects: { 'object-b': { ItemID: 88, X: 3, Y: 4, State: { FenceMode: { Style: 1 } } } } } } };
  const result = compareObservedSaveStructure(a, b, ids);
  assert.ok(result.entries.some(x => x.feature === 'world-object' && x.path.endsWith('.ItemID')));
  assert.ok(result.entries.some(x => x.feature === 'road-fence' && x.path.endsWith('.FenceMode')));
  assert.ok(result.entries.every(x => x.feature !== 'road-fence' || x.path.includes('.FenceMode') || x.path.includes('.Road') || x.path.includes('.Fence')));
});
