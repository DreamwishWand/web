import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { BuildIdentityKind, PlatformFamily, RuntimeGateStatus } from '../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';

const switchTarget = { platform: PlatformFamily.Switch, kind: BuildIdentityKind.SwitchBid, value: '52BD625D9B4E0053' };
const operation = { structuralCapabilitiesSupported: true, planSupported: true, validationPassed: true, runtimeGate: RuntimeGateStatus.NotRequired };

async function assertSession(source, sourcePlatform, targetBuild) {
  const session = await SafeProfileEditSession.open({ sourceBytes: source, codec: p1gPackagedProfileCodec, sourcePlatform });
  const before = session.getSnapshot();

  const noOp = await session.exportVerifiedCopy({ edit() {}, exactAllowedPaths: [], targetBuild, operation });
  assert.equal(noOp.noOp, true);
  assert.deepEqual(noOp.editedBytes, source);
  assert.deepEqual(noOp.backupOriginalBytes, source);

  const result = await session.exportVerifiedCopy({
    edit(root) { root.World.__wandP1gIntegrationSentinel = { value: 1, opaque: { keep: 'yes' } }; },
    exactAllowedPaths: ['/World/__wandP1gIntegrationSentinel'],
    targetBuild,
    operation
  });
  assert.equal(result.noOp, false);
  assert.deepEqual(result.changedPaths, ['/World/__wandP1gIntegrationSentinel']);
  assert.equal(result.authorization.capabilities.encodeCopy, true);
  assert.equal(result.authorization.capabilities.persistentReplace, false);
  assert.deepEqual(result.backupOriginalBytes, source);

  const reopened = await p1gPackagedProfileCodec.loadProfile(result.editedBytes);
  const after = JSON.parse(reopened.jsonText);
  assert.deepEqual(after.World.__wandP1gIntegrationSentinel, { value: 1, opaque: { keep: 'yes' } });
  delete after.World.__wandP1gIntegrationSentinel;
  assert.deepEqual(after, before);
}

test('synthetic independent P1G package integrates with SafeProfileEditSession', async () => {
  await assertSession(makeSyntheticP1gProfile(syntheticProfile()), PlatformFamily.Switch, switchTarget);
});

const realCases = [
  { label: 'Switch', env: 'DDV_V125_SWITCH_PROFILE_RAW', sourcePlatform: PlatformFamily.Switch, targetBuild: switchTarget },
  {
    label: 'Steam', env: 'DDV_V125_STEAM_PROFILE_RAW', sourcePlatform: PlatformFamily.SteamWindows,
    targetBuild: { platform: PlatformFamily.SteamWindows, kind: BuildIdentityKind.SteamFullVersion, value: 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14' }
  }
];

for (const entry of realCases) {
  const fixturePath = process.env[entry.env];
  const maybeTest = fixturePath ? test : test.skip;
  maybeTest(`${entry.label} current raw P1G package integrates with SafeProfileEditSession`, async () => {
    const source = new Uint8Array(await readFile(fixturePath));
    await assertSession(source, entry.sourcePlatform, entry.targetBuild);
  });
}
