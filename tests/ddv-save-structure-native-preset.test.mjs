import test from 'node:test';
import assert from 'node:assert/strict';
import { compareObservedSaveStructure } from '../scripts/ddv-save-structure-compare.mjs';

const ids = { platform: 'switch', leftBuild: '52BD625D9B4E0053', rightBuild: '9A239D3DB569756D' };
function profile(version, withNativeToggle) {
  return {
    GameInfo: { Version: version }, Player: {},
    World: {
      GridCollection: { Grids: { '567': { Objects: {
        '824': { ItemID: 40000001, State: { Toggle: { Value: null, DesignID: null } } }
      } } } },
      DecorationPresets: [{ GridCollection: { Grids: { '101': { Objects: {
        '993': { ItemID: 40000001, State: withNativeToggle
          ? { Toggle: { Value: null, DesignID: null } } : {} }
      } } } } }]
    }
  };
}

test('DDV native DecorationPresets receive a separate feature class, never Road/Fence or Wand preset', () => {
  const result = compareObservedSaveStructure(profile(624, false), profile(626, true), ids);
  assert.equal(result.complete, true);
  const native = result.entries.filter(x => x.feature === 'ddv-native-preset');
  assert.ok(native.length > 0);
  assert.ok(native.some(x => x.path.includes('.DecorationPresets[]') && x.path.endsWith('.State.*')
    && x.observation === 'OPTIONAL_OR_STATE_DEPENDENT_UNOBSERVED'));
  assert.ok(native.every(x => x.path.startsWith('$.World.DecorationPresets[]')));
  assert.ok(result.entries.every(x => !x.path.includes('.824') && !x.path.includes('.993')));
  assert.ok(result.entries.every(x => x.feature !== 'road-fence'));
  assert.equal(result.acceptance.write, 'NOT_AUTHORIZED');
  assert.equal(result.acceptance.productApply, false);
});

test('unknown dictionary names stay redacted even if they spell the canonical native-preset field', () => {
  const left = profile(624, false), right = profile(626, false);
  // A native object-key collision outside the root must not masquerade as a product field.
  left.World.GridCollection.Grids['567'].Objects.DecorationPresets = { State: null };
  right.World.GridCollection.Grids['567'].Objects.DecorationPresets = { State: null };
  const result = compareObservedSaveStructure(left, right, ids);
  assert.ok(result.entries.every(x => !x.path.includes('.Objects.DecorationPresets')));
});
