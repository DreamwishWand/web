import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  openWorldSaveBytes,
  WEP_WORLD_READONLY_626_PROVENANCE
} from '../src/lib/wep/world-save-source.ts';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';

const profile626 = {
  GameInfo: {
    Version: 626,
    InitialVersion: 518,
    LastSaveDeviceInfo: { deviceType: 'DeviceType_Windows' }
  },
  Player: { ContainerInventories: { unknown: { test: 4 } } },
  World: {
    Villages: [{ Areas: { '1': { GridIDs: [7], Unlocked: true } } }],
    GridCollection: { Grids: { '7': { ID: 7, Objects: { '8': { State: { UnknownFutureFlag: true } } } } } }
  },
  FutureRoot: { binaryPreservationMarker: [1, 2, 3] }
};
const raw = makeSyntheticP1gProfile(profile626);
const accepted = {
  sourcePlatform: 'switch',
  targetBuild: { platform: 'switch', kind: 'switch-bid', value: '9A239D3DB569756D' },
  sourceEvidence: WEP_WORLD_READONLY_626_PROVENANCE
};

test('synthetic exact Switch schema626 packaged source: structural read only, no v125 route projector', async () => {
  const original = raw.slice();
  const opened = await openWorldSaveBytes(raw, accepted);
  assert.deepEqual(raw, original, 'source bytes immutable');
  assert.equal(opened.profileSchemaVersion, 626);
  assert.equal(opened.compatibility.gameVersion, '1.25.3');
  assert.equal(opened.compatibility.productionReadAccepted, true);
  assert.equal(opened.compatibility.exactBuildKnown, true);
  assert.equal(opened.compatibility.readOnly, true);
  assert.equal(opened.compatibility.routesAuthorized, false);
  assert.equal(opened.compatibility.editingAuthorized, false);
  assert.equal(opened.compatibility.verifiedReplacementCandidateAuthorized, false);
  assert.equal(opened.compatibility.productApplyAuthorized, false);
  assert.equal(opened.compatibility.persistentWriteAuthorized, false);
  assert.deepEqual(opened.areas, []);
  assert.deepEqual(opened.floatingIslands, []);
  assert.deepEqual(opened.structuralDiagnostics, {
    villageCount: 1,
    areaRecordCount: 1,
    gridRecordCount: 1,
    notes: [
      'WEP_SCHEMA626_WORLD_STRUCTURE_ONLY',
      'WEP_SCHEMA626_AREA_GRID_NATIVE_SEMANTICS_UNVERIFIED',
      'WEP_SCHEMA626_EDITOR_DRAFT_AND_WRITER_DISABLED'
    ]
  });
  assert.deepEqual(opened.profile.FutureRoot, profile626.FutureRoot);
  assert.equal(opened.saveIdentity.sourceLastSaveRelationship, 'DIFFERENT_CROSS_SAVE_POSSIBLE');
});

const negative = [
  ['missing provenance', { ...accepted, sourceEvidence: null }, /EXTERNAL_SOURCE_VERIFICATION_REQUIRED/],
  ['unknown source', { ...accepted, sourcePlatform: 'unknown' }, /EXTERNAL_SOURCE_VERIFICATION_REQUIRED/],
  ['wrong source', { ...accepted, sourcePlatform: 'steam-windows' }, /EXTERNAL_SOURCE_VERIFICATION_REQUIRED/],
  ['wrong BID', { ...accepted, targetBuild: { ...accepted.targetBuild, value: '0000000000000000' } }, /READ_CONTRACT_UNSUPPORTED_BUILD/],
  ['unknown BID', { ...accepted, targetBuild: { ...accepted.targetBuild, value: '' } }, /EXTERNAL_SOURCE_VERIFICATION_REQUIRED/],
  ['wrong platform', { ...accepted, targetBuild: { ...accepted.targetBuild, platform: 'steam-windows' } }, /EXTERNAL_SOURCE_VERIFICATION_REQUIRED/],
  ['Steam626', { ...accepted, targetBuild: { platform: 'steam-windows', kind: 'steam-full-version', value: 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22' } }, /EXTERNAL_SOURCE_VERIFICATION_REQUIRED/]
];
for (const [name, options, reason] of negative) {
  test('schema626 fail closed: ' + name, async () => {
    await assert.rejects(() => openWorldSaveBytes(raw, options), reason);
  });
}
test('schema626 plain JSON is not promoted to real packaged-source read acceptance', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(profile626));
  await assert.rejects(() => openWorldSaveBytes(bytes, accepted), /PACKAGED_SOURCE_REQUIRED/);
});
test('unknown schema / mismatched schema are denied, not projected', async () => {
  const unknown = structuredClone(profile626);
  unknown.GameInfo.Version = 627;
  await assert.rejects(() => openWorldSaveBytes(makeSyntheticP1gProfile(unknown), accepted), /PROFILE_SCHEMA_UNSUPPORTED/);
  const legacy = structuredClone(profile626);
  legacy.GameInfo.Version = 624;
  const opened = await openWorldSaveBytes(makeSyntheticP1gProfile(legacy), accepted);
  assert.equal(opened.profileSchemaVersion, 624);
  assert.equal(opened.compatibility.routesAuthorized, true);
  assert.equal(opened.compatibility.gameVersion, '1.25.0');
});
test('malformed required root and malformed packaged bytes fail closed', async () => {
  const broken = structuredClone(profile626);
  delete broken.Player;
  await assert.rejects(() => openWorldSaveBytes(makeSyntheticP1gProfile(broken), accepted), /REQUIRED_SECTIONS_MISSING/);
  await assert.rejects(() => openWorldSaveBytes(new Uint8Array([80,49,71,0,0,0]), accepted));
});
test('UI never opens a schema626 v125 session or displays editing actions', () => {
  const page = readFileSync(new URL('../src/routes/editor/world/+page.svelte', import.meta.url), 'utf8');
  assert.match(page, /data-wep-626-readonly/);
  assert.match(page, /worldSource\.compatibility\.readOnly/);
  assert.match(page, /!worldSource\.compatibility\?\.routesAuthorized/);
  assert.match(page, /WEP_WORLD_626_RECOVERY_NOT_AUTHORIZED/);
  assert.match(page, /WEP_FULL_DESIGN_DESTINATION_V125_ONLY/);
  assert.match(page, /sourceProvenanceConfirmed/);
  assert.match(page, /sourceBuildId/);
  assert.match(page, /\{:else\}\s*\{#if roomFinishRoutes/);
});
test('eight language copies present and no source save is embedded in test', async () => {
  const { WORLD_READONLY_COPY_LOCALES, worldReadonlyCopy } = await import('../src/lib/wep/world-readonly-copy.js');
  assert.deepEqual([...WORLD_READONLY_COPY_LOCALES].sort(), ['de', 'en', 'es-ES', 'fr', 'it', 'ja', 'pt-BR', 'zh-CN'].sort());
  for (const id of WORLD_READONLY_COPY_LOCALES) {
    for (const key of ['build','proof','proofHint','viewing','editing','source','unsupported','diagnostic','village','area','grids','boundary','retry']) {
      assert.ok(worldReadonlyCopy(id)[key]?.length > 2, id + ':' + key);
    }
  }
});
