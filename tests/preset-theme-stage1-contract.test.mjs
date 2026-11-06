import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_THEME_STAGE1_CONTRACT, PRESET_THEME_PICKER_GROUPS,
  PRESET_THEME_FACETS, PRESET_THEME_LIFECYCLE,
  PRESET_THEME_WORKING_BATCH, PRESET_THEME_STAGE1_BOUNDARIES,
  isPresetThemePickerGroup, matchesPresetThemeFacets
} from '../src/lib/product/preset-theme-stage1-contract.mjs';

test('latest owner eight-group canonical picker order supersedes old nine-group draft', () => {
  assert.equal(PRESET_THEME_STAGE1_CONTRACT, 'wand.presets.theme.stage1-product@1');
  assert.deepEqual(PRESET_THEME_PICKER_GROUPS, [
    'Style & Aesthetic', 'Era & Design', 'Mood & Atmosphere',
    'Regional & Cultural', 'Fantasy & Genre', 'Nature & Landscape',
    'Place & Setting', 'Venue & Function'
  ]);
  assert.equal(isPresetThemePickerGroup('Era & Design'), true);
  assert.equal(isPresetThemePickerGroup('Composition & Visual Character'), false);
  assert.equal(isPresetThemePickerGroup(''), false);
  assert.ok(Object.isFrozen(PRESET_THEME_PICKER_GROUPS));
});

test('CANDIDATE working counts cannot masquerade as ACTIVE public authority or an authoring cap', () => {
  assert.deepEqual(PRESET_THEME_LIFECYCLE, ['CANDIDATE', 'ACTIVE', 'DEPRECATED', 'MERGED']);
  assert.equal(PRESET_THEME_WORKING_BATCH.highConfidenceCandidates, 148);
  assert.equal(PRESET_THEME_WORKING_BATCH.aliasMergeCandidates, 31);
  assert.equal(PRESET_THEME_WORKING_BATCH.heldCandidates, 48);
  assert.equal(PRESET_THEME_WORKING_BATCH.publicActiveCount, null);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.draftDefaultState, 'CANDIDATE');
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.publicRegistryApproved, false);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.numericAssignmentCapApproved, false);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.typicalAssignmentCountApproved, false);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.candidateAutomaticallyActive, false);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.themeRequestAutomaticallyPublic, false);
});

test('Featured Work cannot be inferred from Item Universe or non-DDV franchises', () => {
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.featuredWorkRequiresCurrentDdvNativeIdentityAndIcon, true);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.featuredWorkMustBeAuthorSelected, true);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.automaticFeaturedWorkAssignmentFromItems, false);
  assert.equal(PRESET_THEME_STAGE1_BOUNDARIES.createdOrPublishedByThisModule, false);
});

test('four controlled facet families combine OR within family AND across families', () => {
  assert.deepEqual(PRESET_THEME_FACETS, ['season', 'seasonalEvent', 'decorationTheme', 'featuredWork']);
  const row = {season: ['autumn'], seasonalEvent: ['halloween'], decorationTheme: ['urban', 'cafe'], featuredWork: ['verified-current-ddv-work']};
  assert.equal(matchesPresetThemeFacets(row, {season: ['autumn', 'winter'], decorationTheme: ['urban', 'garden']}), true);
  assert.equal(matchesPresetThemeFacets(row, {season: ['winter'], decorationTheme: ['urban']}), false);
  assert.equal(matchesPresetThemeFacets(row, {season: ['autumn'], decorationTheme: ['garden']}), false);
  assert.equal(matchesPresetThemeFacets(row, {season: ['autumn'], featuredWork: ['other-work']}), false);
  assert.equal(matchesPresetThemeFacets(row, {}), true);
  assert.equal(matchesPresetThemeFacets(row, {season: []}), true);
});

test('malformed, unproven or foreign facet payloads fail closed rather than matching', () => {
  const row = {season:['autumn'],decorationTheme:['urban']};
  for (const input of [null, [], {globalSearch:['urban']}, {season:'autumn'}, {season:[null]}, {season:['']}, {season:[123]}]) {
    assert.equal(matchesPresetThemeFacets(row, input), false);
  }
  assert.equal(matchesPresetThemeFacets({season:'autumn'}, {season:['autumn']}), false);
  assert.equal(matchesPresetThemeFacets({season:[null]}, {season:['autumn']}), false);
  assert.equal(matchesPresetThemeFacets({}, {season:['autumn']}), false);
  assert.equal(matchesPresetThemeFacets(null, {}), false);
});

test('QR677 Q07: inherited record facet cannot satisfy a canonical selected facet', () => {
  const record = Object.create({season: ['winter']});
  record.decorationTheme = ['cozy'];
  assert.equal(Object.hasOwn(record, 'season'), false);
  assert.equal(matchesPresetThemeFacets(record, {season: ['winter'], decorationTheme: ['cozy']}), false);
});

test('QR677 Q08: inherited array index is not an owned canonical facet value', () => {
  const inherited = Array(1);
  const proto = Object.create(Array.prototype);
  Object.defineProperty(proto, '0', {value: 'winter', configurable: true});
  Object.setPrototypeOf(inherited, proto);
  assert.equal(inherited[0], 'winter');
  assert.equal(Object.hasOwn(inherited, 0), false);
  assert.equal(matchesPresetThemeFacets({season: inherited}, {season: ['winter']}), false);
  assert.equal(matchesPresetThemeFacets({season: ['winter']}, {season: inherited}), false);
});

test('inherited selected facets and sparse arrays without own indexes deny', () => {
  const selected = Object.create({season: ['winter']});
  assert.equal(Object.hasOwn(selected, 'season'), false);
  assert.equal(matchesPresetThemeFacets({season: ['winter']}, selected), false);
  assert.equal(matchesPresetThemeFacets({season: Array(1)}, {season: ['winter']}), false);
  assert.equal(matchesPresetThemeFacets({season: ['winter']}, {season: Array(1)}), false);
  assert.equal(matchesPresetThemeFacets({season: ['winter']}, {season: []}), true);
});
