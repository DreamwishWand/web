import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';

const realCases = [
  {label:'Switch', env:'DDV_V125_SWITCH_PROFILE_RAW', sha:'0e8bf5a0e1da5f3d24da063be0442f2cda04dcb652e4f4e06989d56bc095a7fb', device:'DeviceType_Switch'},
  {label:'Steam', env:'DDV_V125_STEAM_PROFILE_RAW', sha:'1025e46aa8c86b0c4e854b8f3035c3a469aeac1bcc5c69e83da66d1d1fc68466', device:'DeviceType_Windows'}
];

test('independent Node AES/ZIP fixture decodes and browser codec modified encode reopens', async () => {
  const root = syntheticProfile();
  const source = makeSyntheticP1gProfile(root);
  const loaded = await p1gPackagedProfileCodec.loadProfile(source);
  assert.equal(loaded.inputType, 'packaged');
  assert.equal(loaded.metadata.profileVersion, 624);
  assert.equal(loaded.metadata.zip.entryCount, 1);
  assert.equal(loaded.metadata.zip.profileEntry.compressType, 8);
  assert.deepEqual(JSON.parse(loaded.jsonText), root);

  const modified = structuredClone(root);
  modified.World.__wandCodecSynthetic = { value: 1, opaque: { keep: 'yes' } };
  const out = await p1gPackagedProfileCodec.createEncodedProfile(JSON.stringify(modified), loaded.metadata);
  assert.ok(out.length > 0 && out.length % 16 === 0);
  const reopened = await p1gPackagedProfileCodec.loadProfile(out);
  assert.deepEqual(JSON.parse(reopened.jsonText), modified);
});

test('direct codec API rejects duplicate keys and unsafe numeric preservation hazards',async()=>{
  const source=makeSyntheticP1gProfile(syntheticProfile());
  const loaded=await p1gPackagedProfileCodec.loadProfile(source);
  const duplicate='{"GameInfo":{"Version":624,"Version":624,"InitialVersion":518,"LastSaveDeviceInfo":{"deviceType":"DeviceType_Switch"}},"Player":{},"World":{}}';
  await assert.rejects(()=>p1gPackagedProfileCodec.createEncodedProfile(duplicate,loaded.metadata),/PROFILE_JSON_INVALID/);
  const unsafe='{"GameInfo":{"Version":624,"InitialVersion":518,"LastSaveDeviceInfo":{"deviceType":"DeviceType_Switch"}},"Player":{},"World":{"n":9007199254740993}}';
  await assert.rejects(()=>p1gPackagedProfileCodec.createEncodedProfile(unsafe,loaded.metadata),/PROFILE_JSON_INVALID/);
});

test('codec corruption/metadata gates fail closed', async () => {
  const root = syntheticProfile();
  const source = makeSyntheticP1gProfile(root);
  await assert.rejects(() => p1gPackagedProfileCodec.loadProfile(source.slice(0, -1)), /INVALID_ENCRYPTED_PROFILE_LENGTH/);

  const corrupted = source.slice();
  corrupted[Math.floor(corrupted.length / 2)] ^= 0x80;
  await assert.rejects(() => p1gPackagedProfileCodec.loadProfile(corrupted), /ZIP_|DEFLATE|PROFILE_|AES_/);

  const loaded = await p1gPackagedProfileCodec.loadProfile(source);
  const extraEntries = structuredClone(loaded.metadata);
  extraEntries.zip.entryCount = 2;
  await assert.rejects(() => p1gPackagedProfileCodec.createEncodedProfile(JSON.stringify(root), extraEntries), /EXTRA_ENTRIES/);
});

for (const c of realCases) {
  const p = process.env[c.env];
  const maybe = p ? test : test.skip;
  maybe(`${c.label} current raw P1G fixture decodes and modified encode reopens`, async () => {
    const source = new Uint8Array(await readFile(p));
    assert.equal(createHash('sha256').update(source).digest('hex'), c.sha);
    const loaded = await p1gPackagedProfileCodec.loadProfile(source);
    assert.equal(loaded.metadata.profileVersion, 624);
    assert.equal(loaded.metadata.zip.entryCount, 1);
    assert.equal(loaded.metadata.zip.profileEntry.compressType, 8);
    const root = JSON.parse(loaded.jsonText);
    assert.equal(root.GameInfo.LastSaveDeviceInfo.deviceType, c.device);

    const modified = structuredClone(root);
    modified.World.__wandP1gBrowserAdapterSentinel = { value: 1, opaque: { keep: 'yes' } };
    const out = await p1gPackagedProfileCodec.createEncodedProfile(JSON.stringify(modified), loaded.metadata);
    const reopened = await p1gPackagedProfileCodec.loadProfile(out);
    assert.deepEqual(JSON.parse(reopened.jsonText), modified);
  });
}
