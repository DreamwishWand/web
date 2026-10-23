import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BuildIdentityKind,
  BuildMatchStatus,
  CURRENT_PROFILE_READ_CONTRACTS,
  CURRENT_V125_BUILD_CONTRACTS,
  PlatformFamily,
  ProfileReadCompatibilityStatus,
  RuntimeGateStatus,
  detectSaveIdentity,
  evaluateWriterAuthorization,
  matchProfileReadContract,
  matchSupportedBuild
} from '../src/lib/ddv/core/save/versioning.js';

const switchTarget = {
  platform: PlatformFamily.Switch,
  kind: BuildIdentityKind.SwitchBid,
  value: '52BD625D9B4E0053'
};
const steamTarget = {
  platform: PlatformFamily.SteamWindows,
  kind: BuildIdentityKind.SteamFullVersion,
  value: 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'
};

function root(version = 624, deviceType = 'DeviceType_Switch') {
  return {
    GameInfo: {
      InitialVersion: 518,
      Version: version,
      LastSaveDeviceInfo: { deviceType }
    },
    Player: {},
    World: {}
  };
}

function readyCodec() {
  return { readSupported: true, encodeSupported: true, roundTripVerified: true, contract: 'p1g-v0' };
}

function readyOperation(runtimeGate = RuntimeGateStatus.NotRequired) {
  return {
    structuralCapabilitiesSupported: true,
    planSupported: true,
    validationPassed: true,
    runtimeGate
  };
}

test('current Switch and Steam exact build contracts remain platform-specific', () => {
  const switchIdentity = detectSaveIdentity(root(624, 'DeviceType_Switch'), { sourcePlatform: PlatformFamily.Switch });
  const steamIdentity = detectSaveIdentity(root(624, 'DeviceType_Windows'), { sourcePlatform: PlatformFamily.SteamWindows });

  assert.equal(matchSupportedBuild(switchIdentity, switchTarget).status, BuildMatchStatus.Exact);
  assert.equal(matchSupportedBuild(steamIdentity, steamTarget).status, BuildMatchStatus.Exact);
  assert.equal(matchSupportedBuild(switchIdentity, steamTarget).status, BuildMatchStatus.Exact,
    'cross-save profile schema may be used with another exact target build; target identity is a separate axis');
});

test('source/last-save platform difference is diagnostic and not automatically fatal', () => {
  const identity = detectSaveIdentity(root(624, 'DeviceType_Windows'), { sourcePlatform: PlatformFamily.Switch });
  assert.equal(identity.sourceLastSaveRelationship, 'DIFFERENT_CROSS_SAVE_POSSIBLE');

  const report = evaluateWriterAuthorization({
    saveIdentity: identity,
    targetBuild: switchTarget,
    codec: readyCodec(),
    operation: readyOperation()
  });
  assert.equal(report.capabilities.encodeCopy, true);
  assert.ok(report.findings.some((x) => x.code === 'SOURCE_LAST_SAVE_PLATFORM_DIFFER' && x.severity === 'INFO'));
});

test('unknown exact build fails closed even when structural capability is reported supported', () => {
  const identity = detectSaveIdentity(root());
  const report = evaluateWriterAuthorization({
    saveIdentity: identity,
    targetBuild: { ...switchTarget, value: 'UNKNOWN_BID' },
    codec: readyCodec(),
    operation: readyOperation()
  });

  assert.equal(report.build.status, BuildMatchStatus.UnsupportedBuild);
  assert.equal(report.capabilities.planOperation, false);
  assert.equal(report.capabilities.encodeCopy, false);
  assert.equal(report.capabilities.persistentReplace, false);
});

test('profile GameInfo.Version mismatch fails build/schema gate', () => {
  const identity = detectSaveIdentity(root(625));
  const match = matchSupportedBuild(identity, switchTarget);
  assert.equal(match.status, BuildMatchStatus.SchemaMismatch);
});



test('target build kind must match its platform and codec contract is mandatory', () => {
  const identity = detectSaveIdentity(root());
  const wrongKind = matchSupportedBuild(identity, {
    platform: PlatformFamily.Switch,
    kind: BuildIdentityKind.SteamFullVersion,
    value: steamTarget.value
  });
  assert.equal(wrongKind.status, BuildMatchStatus.InvalidTarget);

  const report = evaluateWriterAuthorization({
    saveIdentity: identity,
    targetBuild: switchTarget,
    codec: { readSupported: true, encodeSupported: true, roundTripVerified: true },
    operation: readyOperation()
  });
  assert.equal(report.capabilities.planOperation, false);
  assert.equal(report.capabilities.encodeCopy, false);
  assert.ok(report.findings.some((x) => x.code === 'CODEC_CONTRACT_MISMATCH'));
});

test('current registry never authorizes persistent replacement even if caller claims all lower gates passed', () => {
  for (const contract of CURRENT_V125_BUILD_CONTRACTS) {
    assert.equal(contract.persistentWriteAuthorized, false);
  }

  const identity = detectSaveIdentity(root());
  const report = evaluateWriterAuthorization({
    saveIdentity: identity,
    targetBuild: switchTarget,
    codec: readyCodec(),
    operation: readyOperation(RuntimeGateStatus.Passed),
    persistence: { backupReady: true, atomicReplaceReady: true, postCommitVerifyReady: true }
  });

  assert.equal(report.capabilities.encodeCopy, true);
  assert.equal(report.capabilities.persistentReplace, false);
  assert.ok(report.findings.some((x) => x.code === 'PERSISTENT_WRITE_NOT_RELEASE_AUTHORIZED'));
});


const switch1253Target = {
  platform: PlatformFamily.Switch,
  kind: BuildIdentityKind.SwitchBid,
  value: '9A239D3DB569756D'
};
const steam1253Target = {
  platform: PlatformFamily.SteamWindows,
  kind: BuildIdentityKind.SteamFullVersion,
  value: 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22'
};

test('v1.25.3 schema626 is separate read-only compatibility and is not added to writer contracts', () => {
  assert.equal(CURRENT_V125_BUILD_CONTRACTS.length, 2);
  assert.ok(CURRENT_V125_BUILD_CONTRACTS.every((x) => x.gameVersion === '1.25.0' && x.profileGameInfoVersion === 624));

  const switchIdentity = detectSaveIdentity(root(626, 'DeviceType_Switch'), { sourcePlatform: PlatformFamily.Switch });
  const steamIdentity = detectSaveIdentity(root(626, 'DeviceType_Windows'), { sourcePlatform: PlatformFamily.SteamWindows });

  assert.equal(matchSupportedBuild(switchIdentity, switch1253Target).status, BuildMatchStatus.UnsupportedBuild);
  assert.equal(matchSupportedBuild(steamIdentity, steam1253Target).status, BuildMatchStatus.UnsupportedBuild);

  const switchRead = matchProfileReadContract(switchIdentity, switch1253Target);
  const steamRead = matchProfileReadContract(steamIdentity, steam1253Target);
  assert.equal(switchRead.status, ProfileReadCompatibilityStatus.StaticCompatibleRuntimePending);
  assert.equal(steamRead.status, ProfileReadCompatibilityStatus.StaticCompatibleRuntimePending);
  assert.equal(switchRead.contract.runtimeReadAcceptance, RuntimeGateStatus.Pending);
  assert.equal(steamRead.contract.runtimeReadAcceptance, RuntimeGateStatus.Pending);
  assert.equal(switchRead.contract.productionReadAccepted, false);
  assert.equal(steamRead.contract.productionReadAccepted, false);
});

test('v1.25.3 read gate requires exact build identity and schema626', () => {
  const schema626 = detectSaveIdentity(root(626), { sourcePlatform: PlatformFamily.Switch });
  const schema624 = detectSaveIdentity(root(624), { sourcePlatform: PlatformFamily.Switch });

  assert.equal(matchProfileReadContract(schema624, switch1253Target).status, ProfileReadCompatibilityStatus.SchemaMismatch);
  assert.equal(matchProfileReadContract(schema626, { ...switch1253Target, value: 'UNKNOWN_BID' }).status,
    ProfileReadCompatibilityStatus.UnsupportedBuild);
  assert.equal(matchProfileReadContract(schema626, {
    platform: PlatformFamily.Switch,
    kind: BuildIdentityKind.SteamFullVersion,
    value: steam1253Target.value
  }).status, ProfileReadCompatibilityStatus.InvalidTarget);
});

test('existing v1.25.0 read and writer contracts remain accepted unchanged', () => {
  const identity = detectSaveIdentity(root(624), { sourcePlatform: PlatformFamily.Switch });
  assert.equal(matchSupportedBuild(identity, switchTarget).status, BuildMatchStatus.Exact);
  assert.equal(matchProfileReadContract(identity, switchTarget).status, ProfileReadCompatibilityStatus.ExactAccepted);
  assert.equal(CURRENT_PROFILE_READ_CONTRACTS.filter((x) => x.gameVersion === '1.25.0').length, 2);
});
