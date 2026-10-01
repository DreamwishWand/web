import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createVerifiedExportBundle } from '../src/lib/ddv/core/save/verified-export-bundle.js';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { BuildIdentityKind, PlatformFamily, RuntimeGateStatus } from '../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile, syntheticProfile } from './helpers/p1g-fixture.mjs';

const switchTarget={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'52BD625D9B4E0053'};
const operation={structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate:RuntimeGateStatus.NotRequired};

async function makeResult(source,target=switchTarget,sourcePlatform=PlatformFamily.Switch){
  const s=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform});
  return s.exportVerifiedCopy({
    edit(root){root.World.__wandExportBundleTest={value:1,opaque:{keep:'yes'}};},
    exactAllowedPaths:['/World/__wandExportBundleTest'],targetBuild:target,operation
  });
}

function parseStoredZip(bytes){
  const out=new Map(); let o=0; const d=new TextDecoder();
  while(o+4<=bytes.length){
    const v=new DataView(bytes.buffer,bytes.byteOffset+o,bytes.byteLength-o); const sig=v.getUint32(0,true);
    if(sig!==0x04034b50) break;
    const method=v.getUint16(8,true), csize=v.getUint32(18,true), usize=v.getUint32(22,true), nl=v.getUint16(26,true), el=v.getUint16(28,true);
    assert.equal(method,0); assert.equal(csize,usize);
    const name=d.decode(bytes.slice(o+30,o+30+nl)); const start=o+30+nl+el; out.set(name,bytes.slice(start,start+csize)); o=start+csize;
  }
  return out;
}

test('verified export ZIP contains exact backup, verified edited copy and integrity manifest',async()=>{
  const source=makeSyntheticP1gProfile(syntheticProfile()); const result=await makeResult(source);
  const bundle=await createVerifiedExportBundle({result,gameVersion:'1.25.0',targetBuild:switchTarget});
  assert.equal(bundle.mimeType,'application/zip'); assert.equal(createHash('sha256').update(bundle.bytes).digest('hex'),bundle.sha256);
  const entries=parseStoredZip(bundle.bytes); assert.equal(entries.size,3);
  const backup=entries.get(bundle.manifest.backupFile); const edited=entries.get(bundle.manifest.editedFile);
  assert.deepEqual(backup,source); assert.deepEqual(edited,result.editedBytes);
  const manifest=JSON.parse(new TextDecoder().decode(entries.get('DDV_WAND_EXPORT_MANIFEST.json')));
  assert.equal(manifest.sourceSha256,result.sourceRawSha256); assert.equal(manifest.editedSha256,result.editedRawSha256);
  assert.equal(manifest.persistentWriteAuthorized,false); assert.deepEqual(manifest.changedPaths,['/World/__wandExportBundleTest']);
});

test('verified export rejects target-build and game-version relabeling',async()=>{
  const source=makeSyntheticP1gProfile(syntheticProfile()); const result=await makeResult(source);
  const steamTarget={platform:PlatformFamily.SteamWindows,kind:BuildIdentityKind.SteamFullVersion,value:'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'};
  await assert.rejects(()=>createVerifiedExportBundle({result,gameVersion:'1.25.0',targetBuild:steamTarget}),/EXPORT_TARGET_BUILD_CONTEXT_MISMATCH/);
  await assert.rejects(()=>createVerifiedExportBundle({result,gameVersion:'9.99.9',targetBuild:switchTarget}),/EXPORT_GAME_VERSION_BUILD_MISMATCH/);
});

test('tampered backup bytes fail closed before bundle creation',async()=>{
  const source=makeSyntheticP1gProfile(syntheticProfile()); const result=await makeResult(source);
  const tampered={...result,backupOriginalBytes:result.backupOriginalBytes.slice()}; tampered.backupOriginalBytes[0]^=1;
  await assert.rejects(()=>createVerifiedExportBundle({result:tampered,gameVersion:'1.25.0',targetBuild:switchTarget}),/BACKUP_SOURCE_HASH_MISMATCH/);
});

for(const c of [
  {label:'Switch',env:'DDV_V125_SWITCH_PROFILE_RAW',platform:PlatformFamily.Switch,target:switchTarget},
  {label:'Steam',env:'DDV_V125_STEAM_PROFILE_RAW',platform:PlatformFamily.SteamWindows,target:{platform:PlatformFamily.SteamWindows,kind:BuildIdentityKind.SteamFullVersion,value:'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'}}
]){
  const p=process.env[c.env]; const maybe=p?test:test.skip;
  maybe(`${c.label} current raw fixture produces exact-backup verified export ZIP`,async()=>{
    const source=new Uint8Array(await readFile(p)); const result=await makeResult(source,c.target,c.platform);
    const bundle=await createVerifiedExportBundle({result,gameVersion:'1.25.0',targetBuild:c.target});
    const entries=parseStoredZip(bundle.bytes);
    assert.deepEqual(entries.get(bundle.manifest.backupFile),source);
    assert.deepEqual(entries.get(bundle.manifest.editedFile),result.editedBytes);
    assert.equal(bundle.manifest.sourceSha256,createHash('sha256').update(source).digest('hex'));
    await writeFile(`/mnt/data/${c.label.toLowerCase()}_verified_export_bundle.zip`,bundle.bytes);
  });
}
