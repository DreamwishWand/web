import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROFILE626_SCHEMA_VERSION,
  PROFILE626_STEAM_TARGET,
  PROFILE626_SWITCH_TARGET,
  evaluateProfile626ReadOnlyCompatibility,
  inspectProfile626Structure
} from '../src/lib/ddv/core/save/profile626-compatibility-v1253.js';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { PlatformFamily, ProfileReadCompatibilityStatus } from '../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';

const gate = JSON.parse(readFileSync(new URL('../static/ddv/core/save/v1.25.3/profile626-serialization-structural-gate-v1253.json', import.meta.url), 'utf8'));
const runtimeRequest = JSON.parse(readFileSync(new URL('../static/ddv/core/save/v1.25.3/profile626-01e-readonly-runtime-request-v1253.json', import.meta.url), 'utf8'));

function profile626(deviceType = 'DeviceType_Switch') {
  const root = syntheticProfile(deviceType);
  root.GameInfo.Version = 626;
  root.Opaque.futureSchema626 = {
    unknownObject: { preserve: true, nested: [1, { text: 'opaque' }] },
    unknownScalar: 626
  };
  return root;
}

test('schema626 static gate binds exact Switch and Steam v1.25.3 identities and keeps every writer flag false', () => {
  assert.equal(gate.schema, 'ddv.save.profile626-serialization-structural-gate@1');
  assert.equal(gate.target.switch.buildId, '9A239D3DB569756D');
  assert.equal(gate.target.switch.profileSchema, 626);
  assert.equal(gate.target.steamWindows.fullVersion, 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22');
  assert.equal(gate.target.steamWindows.profileSchema, 626);

  for (const [name, value] of Object.entries(gate.hardFlags)) {
    assert.equal(value, false, `${name} must remain false`);
  }
  assert.equal(gate.compatibilityMatrix.verifiedReplacementCandidate.authorized, false);
  assert.equal(gate.compatibilityMatrix.localSaveWriter.authorized, false);
  assert.equal(gate.compatibilityMatrix.persistentNativeWriting.authorized, false);
});

test('same-platform protobuf declaration sweep is zero-delta for all 2538 generated IMessage types', () => {
  for (const platform of ['switch', 'steamWindows']) {
    const row = gate.staticEvidence.generatedProtobufModel[platform];
    assert.equal(row.v1250Count, 2538);
    assert.equal(row.v1253Count, 2538);
    assert.equal(row.added, 0);
    assert.equal(row.removed, 0);
    assert.equal(row.changed, 0);
  }
});

test('migration registration is frozen at 624 then 625 with CurrentVersion 626', () => {
  assert.deepEqual(gate.staticEvidence.profileUpdates.switchNativeRegistration.map((x) => [x.update, x.version]), [
    ['InvalidPurpleImpatiensFlowerProfileUpdate', 624],
    ['FixRewardsOfVLGLady040ProfileUpdate', 625]
  ]);
  assert.equal(gate.staticEvidence.profileVersioning.to, PROFILE626_SCHEMA_VERSION);
});

test('synthetic schema626 packaged P1G can be decoded read-only without losing opaque JSON semantics', async () => {
  const original = profile626();
  const packaged = makeSyntheticP1gProfile(original);
  const decoded = await p1gPackagedProfileCodec.loadProfile(packaged);
  assert.equal(decoded.metadata.profileVersion, 626);
  assert.deepEqual(JSON.parse(decoded.jsonText), original);

  const report = evaluateProfile626ReadOnlyCompatibility({
    profile: JSON.parse(decoded.jsonText),
    targetBuild: PROFILE626_SWITCH_TARGET,
    sourcePlatform: PlatformFamily.Switch,
    sourceRawSha256: 'a'.repeat(64)
  });

  assert.equal(report.readMatch.status, ProfileReadCompatibilityStatus.ExactAccepted);
  assert.equal(report.capabilities.offlineReadInspectionAllowed, true);
  assert.equal(report.capabilities.productionReadAccepted, true);
  assert.equal(report.capabilities.planOperation, false);
  assert.equal(report.capabilities.encodeCopy, false);
  assert.equal(report.capabilities.verifiedReplacementCandidate, false);
  assert.equal(report.capabilities.localSaveWriter, false);
  assert.equal(report.capabilities.persistentWrite, false);
  assert.ok(!report.findings.some((x) => x.code === 'SCHEMA626_REAL_SAVE_RUNTIME_ACCEPTANCE_PENDING'));
});

test('Steam schema626 gets the same static read-only status without transferring Switch address evidence', () => {
  const report = evaluateProfile626ReadOnlyCompatibility({
    profile: profile626('DeviceType_Windows'),
    targetBuild: PROFILE626_STEAM_TARGET,
    sourcePlatform: PlatformFamily.SteamWindows
  });
  assert.equal(report.readMatch.status, ProfileReadCompatibilityStatus.StaticCompatibleRuntimePending);
  assert.equal(report.capabilities.offlineReadInspectionAllowed, true);
  assert.equal(report.capabilities.productionReadAccepted, false);
  assert.equal(gate.staticEvidence.profileUpdates.steamWindowsNative.classification, 'HIGH_CONFIDENCE');
});

test('schema624, schema625, schema627, malformed roots and wrong exact builds fail the schema626 structural/read gate', () => {
  for (const version of [624, 625, 627]) {
    const p = profile626();
    p.GameInfo.Version = version;
    const structural = inspectProfile626Structure(p);
    assert.equal(structural.valid, false);

    const report = evaluateProfile626ReadOnlyCompatibility({
      profile: p,
      targetBuild: PROFILE626_SWITCH_TARGET,
      sourcePlatform: PlatformFamily.Switch
    });
    assert.equal(report.capabilities.offlineReadInspectionAllowed, false);
    assert.equal(report.capabilities.productionReadAccepted, false);
  }

  assert.equal(inspectProfile626Structure({ GameInfo: { Version: 626 }, Player: {} }).valid, false);

  const wrongBuild = evaluateProfile626ReadOnlyCompatibility({
    profile: profile626(),
    targetBuild: { ...PROFILE626_SWITCH_TARGET, value: 'UNKNOWN_BID' },
    sourcePlatform: PlatformFamily.Switch
  });
  assert.equal(wrongBuild.capabilities.offlineReadInspectionAllowed, false);
  assert.equal(wrongBuild.readMatch.status, ProfileReadCompatibilityStatus.UnsupportedBuild);
});

test('01E schema626 request is read-only and cannot be interpreted as writer promotion', () => {
  assert.equal(runtimeRequest.requestId, '01E-V1253-SCHEMA626-CONTROLLED-SAVE-READONLY-ACCEPTANCE-V1');
  assert.equal(runtimeRequest.prerequisites.currentlyProvided, false);
  assert.ok(runtimeRequest.acceptance.explicitlyNotProvenByPass.includes('schema626 modified encode/repack safety'));
  assert.ok(runtimeRequest.acceptance.explicitlyNotProvenByPass.includes('local save writer'));
  for (const value of Object.values(runtimeRequest.hardFlags)) assert.equal(value, false);
});

test('v1.25.3 schema626 refuses missing/mismatched source platform regardless of matching target BID', () => {
  for (const sourcePlatform of [undefined, PlatformFamily.Unknown, PlatformFamily.SteamWindows]) {
    const report = evaluateProfile626ReadOnlyCompatibility({
      profile: profile626(),
      targetBuild: PROFILE626_SWITCH_TARGET,
      sourcePlatform
    });
    assert.equal(report.readMatch.status, ProfileReadCompatibilityStatus.SourcePlatformMismatch);
    assert.equal(report.capabilities.offlineReadInspectionAllowed, false);
    assert.equal(report.capabilities.productionReadAccepted, false);
    assert.ok(report.findings.some((x) => x.code === 'SOURCE_PLATFORM_MISMATCH'));
  }

  const crossSave = evaluateProfile626ReadOnlyCompatibility({
    profile: profile626('DeviceType_Windows'),
    targetBuild: PROFILE626_SWITCH_TARGET,
    sourcePlatform: PlatformFamily.Switch
  });
  assert.equal(crossSave.capabilities.productionReadAccepted, true,
    'LastSaveDeviceInfo is not the independently sourced platform/build identity');
  assert.equal(crossSave.saveIdentity.sourceLastSaveRelationship, 'DIFFERENT_CROSS_SAVE_POSSIBLE');
});
