import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BuildIdentityKind,
  BuildMatchStatus,
  CURRENT_V125_BUILD_CONTRACTS,
  PlatformFamily,
  RuntimeGateStatus,
  detectSaveIdentity,
  evaluateWriterAuthorization,
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
