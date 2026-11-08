// PUBLIC SYNTHETIC-only Rust V1 test; no user original, no secret Save.
// Run against the exactly same native ProductSession binary for local V1.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {syntheticProfile} from './helpers/p1g-fixture.mjs';
const exact='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const rust=process.env.WAND_TEST_NATIVE_RUST_V1;
if(!rust){
  console.log('NATIVE_RUST_V1_BINARY_ABSENT_GENERIC_NODE_CI_NOT_RUN');
  process.exit(0);
}
const exe=resolve(rust);
const root=syntheticProfile('DeviceType_Windows');
root.GameInfo.Version=626;
root.Player={};
for(let i=0;i<33;i++)root.Player['synthetic_'+String(i).padStart(3,'0')]=i;
root.World={Root:{nested:'synthetic'},Clock:0};
root.UnknownExtension={future:[true,{opaque:'preserved'}]};
const decoded=Buffer.from(JSON.stringify(root),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const envir=(extra={})=>({...process.env,
 WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:exact,
 WAND_LOCAL_ORIGINAL_SHA256:'a'.repeat(64),
 WAND_LOCAL_ORIGINAL_SIZE_BYTES:'1680',
 WAND_LOCAL_DECODED_SHA256:sha(decoded),...extra});
const exec=(bytes=decoded,extra={})=>spawnSync(exe,[],{
 input:bytes,encoding:'utf8',env:envir(extra),maxBuffer:2*1024*1024,timeout:35000
});
const accepted=exec();
assert.equal(accepted.status,0,'Core Rust V1 positive');
const proof=JSON.parse(accepted.stdout);
assert.equal(proof.contract,'wand.native.private.real-steam-v1@1');
assert.equal(proof.fullDocumentRustValidated,true);
assert.equal(proof.coreOwnedIndexedPlayerFields,33);
assert.equal(proof.coreOwnedIndexedWorldFields,2);
assert.equal(proof.originalBytesSuppliedSeparately,1680);
assert.equal(proof.decodedSHAValidatedByRust,true);
for(const k of ['productReadAccepted','writerAuthorized',
 'editedCopyAuthorized','applyAuthorized','rustV2EditedCopyVerified',
 'allNativeReferencesVerified','physicalGameInstallCryptographicallyProven',
 'cloudUploadPerformed','originalModified'])assert.equal(proof[k],false,k);
assert.equal(proof.originalShaSuppliedSeparately,true);
for(const [name,run] of [
 ['unknownBuild',exec(decoded,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'UNKNOWN'})],
 ['switchBuild',exec(decoded,{WAND_LOCAL_INSTALLED_STEAM_FULLVERSION:'9A239D3DB569756D'})],
 ['wrongDecodedSha',exec(decoded,{WAND_LOCAL_DECODED_SHA256:'b'.repeat(64)})],
 ['wrongEncryptedSha',exec(decoded,{WAND_LOCAL_ORIGINAL_SHA256:'0'.repeat(64)})],
 ['emptyDecoded',exec(Buffer.alloc(0))],
 ['schema624',exec(Buffer.from(JSON.stringify({...root,GameInfo:{Version:624}})))],
 ['badJson',exec(Buffer.from('{bad JSON'))],
 ['missingRequiredWorld',exec(Buffer.from(JSON.stringify({...root,World:undefined})))],
 ['duplicateJson',exec(Buffer.from('{"GameInfo":{"Version":626},"Player":{"x":1,"x":2},"World":{}}'))],
 ['oversizeEncrypted',exec(decoded,{WAND_LOCAL_ORIGINAL_SIZE_BYTES:'134217729'})],
 ['missingSha',exec(decoded,{WAND_LOCAL_ORIGINAL_SHA256:''})]
]){
 assert.notEqual(run.status,0,'negative '+name);
 assert.equal(run.stdout.trim(),'','negative has no success receipt '+name);
 assert.match(run.stderr,/^LOCAL_RUST_V1_DENIED:/,'negative error class '+name);
}
console.log('RUST_NATIVE_V1_SINGLE_PRODUCT_SESSION_SYNTHETIC_12_SCENARIOS_PASS');
