// 04 QR-W: new Source PR620 dualSHA encoder output matched against ACTUAL
// accepted main227 08WEB ItemThumb consumer. Only synthetic PNG/VP8L bytes.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';

const OLD='218cf1977447476777647a863265bae4be5c18bf';
const SOURCE='85133f5b6e0a5d7b2de04eb08bf98756ff9e2093';
const MAIN='2277411409205017858c6ac6abf2ead002d9b95b';
const CODE='src/lib/item-media/public-item-images.mjs';
const WEB_BLOB='05bb81a0608785aab739a29c78bd2d7f842322aa';
const newSource=[
 'docs/core/01d-r39-lossless-webp160-source-20261105.md',
 'scripts/01d-r39-lossless-webp160.py',
 'tests/01d-r39-lossless-dual-sha-producer-consumer-abi.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-pr620-dualsha-actual-consumer.yml',
 'scripts/04qr-w-pr620-dualsha-synthetic-producer.py',
 'scripts/04qr-w-pr620-dualsha-actual-consumer.mjs'
].sort();
const blobs={
 'docs/core/01d-r39-lossless-webp160-source-20261105.md':'ad30229e4c9b1d59fba0bfc21878f77cb4a58620',
 'scripts/01d-r39-lossless-webp160.py':'f8272f63c3887b0cb75f9e84f109389823a32485',
 'tests/01d-r39-lossless-dual-sha-producer-consumer-abi.test.mjs':'7fc4c96b6ed362f2cf950e2cad6d4161a14f1c0a'
};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',OLD,SOURCE),OLD);
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(git('diff','--name-only',OLD,SOURCE).split('\n').sort(),newSource);
assert.deepEqual(git('diff','--name-only',SOURCE,'HEAD').split('\n').sort(),qa);
for(const [p,s] of Object.entries(blobs))assert.equal(git('rev-parse',SOURCE+':'+p),s,p);
assert.equal(git('rev-parse',MAIN+':'+CODE),WEB_BLOB);
for(const name of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.ok(!process.env[name],'NO private P1G in CI');
console.log('QR620_NEW_SOURCE3_QA3_AND_ACCEPTED_WEB_CONSUMER_SHA_PIN_PASS');

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const py=resolve(root,'scripts/04qr-w-pr620-dualsha-synthetic-producer.py');
const result=spawnSync('python3',[py],{encoding:'utf8',timeout:60000});
assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
assert.match(result.stdout,/QR620_DUALSHA_STRICT_MISSING31_FAILCLOSED_PASS/);
assert.match(result.stdout,/QR620_DUALSHA_ACTUAL_PILLOW_VP8L_BYTES_PATH_CRC_PIXEL_SHA_MATCH_PASS/);
const m=result.stdout.match(/QR620_DUALSHA_SYNTHETIC_RESULT (\{[^\n]+\})/);
assert.ok(m,'no actual converted source output receipt: '+result.stdout);
const measured=JSON.parse(m[1]);
assert.equal(measured.reportStatus,'HOLD_NOT_DEPLOY');
assert.equal(measured.sourceCount,1);
assert.equal(measured.target1250VerifiedRows,0);
assert.equal(measured.target1253VerifiedRows,0);
assert.equal(measured.sourceOriginalUnmodified,true);
console.log('QR620_DUALSHA_PRODUCER_REAL_PILLOW_SOURCE_ONLY_RECEIPT_PASS');

// Do not use mock JS consumer: evaluate byte-for-byte immutable Git source
// deployed on main227. Ephemeral JS resides within repo for package resolution.
const originalWeb=git('show',MAIN+':'+CODE);
const ephemeral=resolve(root,'scripts/.04qr-w-main227-consumer-'+process.pid+'.mjs');
writeFileSync(ephemeral,originalWeb,{flag:'wx'});
let web;
try{web=await import(pathToFileURL(ephemeral).href);}finally{unlinkSync(ephemeral);}
const {
 ITEM_IMAGE_SCHEMA,ITEM_IMAGE_VARIANT,ITEM_IMAGE_CODEC,
 ITEM_IMAGE_TARGET,ITEM_IMAGE_SOURCE,ITEM_IMAGE_OWNER_DECISION_ID,
 R39_ORIGINAL_PNG_MANIFEST_SHA256,
 validateItemImageCatalog,itemImageAssetPath,scopedItemImageHref
}=web;
assert.equal(ITEM_IMAGE_VARIANT,measured.variant);
const ID='10000002'; // deliberately SYNTHETIC test ItemID, not a real native proof
const synthetic=()=>{
 const row={
  sourcePngSha256:measured.sourceSha,webpSha256:measured.encodedSha,
  pixelStatus:'RGBA_EXACT_VERIFIED',identityStatus:'VERSION_VERIFIED',
  visibility:'RELEASED_PLAYER_FACING',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'
 };
 return {
  schema:ITEM_IMAGE_SCHEMA,assetVariant:ITEM_IMAGE_VARIANT,codec:ITEM_IMAGE_CODEC,
  format:'webp',lossless:true,
  source:{...ITEM_IMAGE_SOURCE,originalPngManifestSha256:R39_ORIGINAL_PNG_MANIFEST_SHA256},
  target:{...ITEM_IMAGE_TARGET},
  publication:{gate:'OWNER_GO_FOR_DDV_GAME_IMAGES',
   decisionId:ITEM_IMAGE_OWNER_DECISION_ID,scope:'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS'},
  items:{[ID]:row}
 };
};
const consumer=validateItemImageCatalog(synthetic());
const consumerPath=itemImageAssetPath(ID,consumer);
assert.equal(consumerPath,measured.path,'REAL Python emitted VP8L ZIP path must equal ACTUAL accepted deployed 08 WEB consumer');
assert.equal(scopedItemImageHref('/web',ID,consumer),'/web/'+measured.path);
const changed=synthetic();
changed.items[ID].webpSha256='f'.repeat(64);
assert.notEqual(itemImageAssetPath(ID,validateItemImageCatalog(changed)),measured.path,
 'different encoded WebP bytes for same original PNG must change immutable cache-key URL');
// Invalid encoded digest is structurally blocked; full byte integrity was
// independently verified at the Python-produced ZIP rather than in a browser.
const malformed=synthetic();malformed.items[ID].webpSha256='CORRUPT';
assert.throws(()=>validateItemImageCatalog(malformed),/ITEM_IMAGE_/);
assert.equal(itemImageAssetPath(ID,consumer,{...ITEM_IMAGE_TARGET,schema:626}),null);
assert.equal(scopedItemImageHref('https://external.invalid',ID,consumer),null);
console.log('QR620_ACTUAL_ACCEPTED_WEB_CONSUMER_EMITTED_DUALSHA_URL_MATCH_PASS');
console.log('QR620_TAMPERED_ENCODED_HASH_CHANGE_URI_WRONG_TARGET_EXTERNAL_DENY_PASS');
console.log('QR620_SOURCE_ONLY_NO_REAL_ART_OR_PUBLIC_MANIFEST_NOT_RUN');
