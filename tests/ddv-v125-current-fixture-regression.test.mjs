import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { BuildIdentityKind, PlatformFamily, RuntimeGateStatus } from '../src/lib/ddv/core/save/versioning.js';

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

const plainCodec = {
  contract: 'p1g-v0',
  async loadProfile(bytes) {
    const jsonText = decoder.decode(bytes);
    const root = JSON.parse(jsonText);
    return { inputType: 'plain', jsonText, metadata: { version: root.GameInfo.Version } };
  },
  parseProfileText(text) {
    return { metadata: { version: JSON.parse(text).GameInfo.Version } };
  },
  async createEncodedProfile(text) {
    return encoder.encode(text);
  },
  getProfileVersion(metadata) {
    return metadata.version;
  }
};

const cases = [
  {
    label: 'Switch',
    env: 'DDV_V125_SWITCH_PROFILE_JSON',
    sourcePlatform: PlatformFamily.Switch,
    deviceType: 'DeviceType_Switch',
    targetBuild: { platform: PlatformFamily.Switch, kind: BuildIdentityKind.SwitchBid, value: '52BD625D9B4E0053' }
  },
  {
    label: 'Steam',
    env: 'DDV_V125_STEAM_PROFILE_JSON',
    sourcePlatform: PlatformFamily.SteamWindows,
    deviceType: 'DeviceType_Windows',
    targetBuild: {
      platform: PlatformFamily.SteamWindows,
      kind: BuildIdentityKind.SteamFullVersion,
      value: 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'
    }
  }
];

for (const entry of cases) {
  const fixturePath = process.env[entry.env];
  const maybeTest = fixturePath ? test : test.skip;

  maybeTest(`${entry.label} current v1.25 fixture passes strict no-op session`, async () => {
    const source = new Uint8Array(await readFile(fixturePath));
    const session = await SafeProfileEditSession.open({ sourceBytes: source, codec: plainCodec, sourcePlatform: entry.sourcePlatform });
    const identity = session.getSaveIdentity();
    assert.equal(identity.profileGameInfoVersion, 624);
    assert.equal(identity.initialProfileGameInfoVersion, 518);
    assert.equal(identity.lastSaveDeviceType, entry.deviceType);
    assert.equal(identity.sourceLastSaveRelationship, 'SAME');

    const output = await session.exportVerifiedCopy({ edit() {}, exactAllowedPaths: [], targetBuild: entry.targetBuild, operation: {} });
    assert.deepEqual(output.editedBytes, source);
  });

  maybeTest(`${entry.label} full current object graph preserves unrelated state around an allowlisted sentinel mutation`, async () => {
    const sourceRoot = JSON.parse(await readFile(fixturePath, 'utf8'));
    const sentinelKey = '__wandRegressionSentinel';
    assert.equal(Object.prototype.hasOwnProperty.call(sourceRoot, sentinelKey), false);
    sourceRoot[sentinelKey] = { mutable: 1, opaque: { keep: 'unchanged', values: [1, 2, 3] } };

    const derivedSource = encoder.encode(JSON.stringify(sourceRoot));
    const session = await SafeProfileEditSession.open({ sourceBytes: derivedSource, codec: plainCodec, sourcePlatform: entry.sourcePlatform });
    const output = await session.exportVerifiedCopy({
      edit(root) { root[sentinelKey].mutable = 2; },
      exactAllowedPaths: [`/${sentinelKey}/mutable`],
      targetBuild: entry.targetBuild,
      operation: {
        structuralCapabilitiesSupported: true,
        planSupported: true,
        validationPassed: true,
        runtimeGate: RuntimeGateStatus.NotRequired
      }
    });

    assert.deepEqual(output.changedPaths, [`/${sentinelKey}/mutable`]);
    const editedRoot = JSON.parse(decoder.decode(output.editedBytes));
    assert.equal(editedRoot[sentinelKey].mutable, 2);
    assert.deepEqual(editedRoot[sentinelKey].opaque, { keep: 'unchanged', values: [1, 2, 3] });

    editedRoot[sentinelKey].mutable = 1;
    assert.deepEqual(editedRoot, sourceRoot, 'all unrelated state in the full current fixture must remain semantically identical');
  });
}
