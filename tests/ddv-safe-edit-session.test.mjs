import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { BuildIdentityKind, PlatformFamily, RuntimeGateStatus } from '../src/lib/ddv/core/save/versioning.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const switchTarget = {
  platform: PlatformFamily.Switch,
  kind: BuildIdentityKind.SwitchBid,
  value: '52BD625D9B4E0053'
};

function profile(overrides = {}) {
  return {
    GameInfo: {
      InitialVersion: 518,
      Version: 624,
      LastSaveDeviceInfo: { deviceType: 'DeviceType_Switch' }
    },
    Player: { Level: 1, Name: 'X' },
    World: { DecorationPresets: [] },
    Opaque: { untouched: { sentinel: 'keep-me' }, integerAsString: '90071992547409931234567' },
    ...overrides
  };
}

function makeCodec({ mutateOnReopen = null } = {}) {
  let loadCount = 0;
  return {
    contract: 'p1g-v0',
    async loadProfile(bytes) {
      const packaged = bytes[0] === 80 && bytes[1] === 58; // P:
      loadCount += 1;
      const originalText = decoder.decode(packaged ? bytes.slice(2) : bytes);
      let root = JSON.parse(originalText);
      if (mutateOnReopen && packaged && loadCount > 1) root = mutateOnReopen(root);
      return {
        inputType: packaged ? 'packaged' : 'plain',
        jsonText: mutateOnReopen && packaged && loadCount > 1 ? JSON.stringify(root) : originalText,
        metadata: { version: root.GameInfo.Version }
      };
    },
    parseProfileText(text) {
      const root = JSON.parse(text);
      return { metadata: { version: root.GameInfo.Version } };
    },
    async createEncodedProfile(text) {
      return encoder.encode(`P:${text}`);
    },
    getProfileVersion(metadata) {
      return metadata.version;
    }
  };
}

function operation(runtimeGate = RuntimeGateStatus.NotRequired) {
  return {
    structuralCapabilitiesSupported: true,
    planSupported: true,
    validationPassed: true,
    runtimeGate
  };
}

test('no-op returns exact source bytes and an isolated backup without requiring a writer build', async () => {
  const source = encoder.encode(`  ${JSON.stringify(profile())}\n`);
  const session = await SafeProfileEditSession.open({ sourceBytes: source, codec: makeCodec() });
  const result = await session.exportVerifiedCopy({
    edit() {},
    exactAllowedPaths: [],
    targetBuild: { ...switchTarget, value: 'UNKNOWN' },
    operation: operation()
  });

  assert.equal(result.noOp, true);
  assert.deepEqual(result.editedBytes, source);
  assert.deepEqual(result.backupOriginalBytes, source);
  result.backupOriginalBytes[0] = 0;
  assert.notEqual(result.editedBytes[0], 0);
});

test('exact allowed mutation preserves unrelated unknown state through encode/reopen', async () => {
  const source = encoder.encode(`P:${JSON.stringify(profile())}`);
  const session = await SafeProfileEditSession.open({
    sourceBytes: source,
    codec: makeCodec(),
    sourcePlatform: PlatformFamily.Switch
  });

  const result = await session.exportVerifiedCopy({
    edit(root) { root.Player.Level = 2; },
    exactAllowedPaths: ['/Player/Level'],
    targetBuild: switchTarget,
    operation: operation()
  });

  assert.equal(result.noOp, false);
  assert.deepEqual(result.changedPaths, ['/Player/Level']);
  assert.equal(result.authorization.capabilities.encodeCopy, true);
  assert.equal(result.authorization.capabilities.persistentReplace, false);

  const reopened = JSON.parse(decoder.decode(result.editedBytes.slice(2)));
  assert.equal(reopened.Player.Level, 2);
  assert.equal(reopened.Opaque.untouched.sentinel, 'keep-me');
  assert.equal(reopened.Opaque.integerAsString, '90071992547409931234567');
});

test('unapproved change and GameInfo change fail closed', async () => {
  const session = await SafeProfileEditSession.open({
    sourceBytes: encoder.encode(JSON.stringify(profile())),
    codec: makeCodec()
  });

  await assert.rejects(() => session.exportVerifiedCopy({
    edit(root) { root.Player.Name = 'Y'; },
    exactAllowedPaths: ['/Player/Level'],
    targetBuild: switchTarget,
    operation: operation()
  }), /unapproved/);

  await assert.rejects(() => session.exportVerifiedCopy({
    edit(root) { root.GameInfo.Version = 625; },
    exactAllowedPaths: ['/GameInfo/Version'],
    targetBuild: switchTarget,
    operation: operation()
  }), /Writer build gate failed|GameInfo/);
});

test('unknown exact build blocks changed-copy encoding even when operation shape is supported', async () => {
  const session = await SafeProfileEditSession.open({
    sourceBytes: encoder.encode(JSON.stringify(profile())),
    codec: makeCodec()
  });

  await assert.rejects(() => session.exportVerifiedCopy({
    edit(root) { root.Player.Level = 2; },
    exactAllowedPaths: ['/Player/Level'],
    targetBuild: { ...switchTarget, value: 'UNKNOWN_BID' },
    operation: operation()
  }), /UNSUPPORTED_BUILD/);
});

test('duplicate object keys, unsafe integers and underflowed numbers are rejected before mutation', async () => {
  const base = JSON.stringify(profile());
  const invalid = [
    base.replace('"Level":1', '"Level":1,"Level":2'),
    base.replace('"Level":1', '"Level":9007199254740993'),
    base.replace('"Level":1', '"Level":1e-999')
  ];

  for (const text of invalid) {
    await assert.rejects(() => SafeProfileEditSession.open({ sourceBytes: encoder.encode(text), codec: makeCodec() }), /Duplicate|Unsafe|Underflowed/);
  }
});

test('independent reopen semantic drift blocks output', async () => {
  const session = await SafeProfileEditSession.open({
    sourceBytes: encoder.encode(`P:${JSON.stringify(profile())}`),
    codec: makeCodec({ mutateOnReopen(root) { root.Opaque.untouched.sentinel = 'corrupted'; return root; } })
  });

  await assert.rejects(() => session.exportVerifiedCopy({
    edit(root) { root.Player.Level = 2; },
    exactAllowedPaths: ['/Player/Level'],
    targetBuild: switchTarget,
    operation: operation()
  }), /reopen\/reparse/);
});
