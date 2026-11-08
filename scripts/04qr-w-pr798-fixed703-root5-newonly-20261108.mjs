// Independent 04 QR-W / R14 — PR798 Switch1253 SOURCE-ONLY native metadata receipt gate.
// Changed-only negative tests; NEVER load owner-private ROM/Texture/P1G bytes into Actions.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  SWITCH_NATIVE3_SCHEMA,SWITCH_ORIGINAL,NATIVE_THREE,
  createPrivateSwitchNative3Hold,validatePrivateSwitchNative3Hold
} from '../scripts/asset-research/01d-switch1253-bid-native3-hold.mjs';
const CURRENT_MAIN_AT_SOURCE='7167f153a24adb9e7f5e7e05658aed86ca90d7d5';
const ACCEPTED_ANCESTOR='00390e4ebc2f25568e583f390bfc41b6fb06083c';
const SOURCE='703089e586e880b73c82f016fc63edd6d29839f2';
const original2=new Map([
 ['scripts/asset-research/01d-switch1253-bid-native3-hold.mjs','111ac0c18404f9dcf228731a65a35112b074ff15'],
 ['tests/01d-switch1253-bid-native3-hold.test.mjs','30e672e0441c00840ea8f03f4afff782b954bb55']
]);
const qaOnly2=[
 '.github/workflows/04qr-w-pr798-fixed703-root5-newonly-20261108.yml',
 'scripts/04qr-w-pr798-fixed703-root5-newonly-20261108.mjs'
].sort();
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
const changed=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',CURRENT_MAIN_AT_SOURCE,SOURCE),ACCEPTED_ANCESTOR,
 'Source branch diverges from latest main due accepted Rust native10; no inherited reQA');
assert.deepEqual(changed(ACCEPTED_ANCESTOR,SOURCE),[...original2.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(changed(SOURCE,'HEAD'),qaOnly2);
for(const [path,sha] of original2){
 assert.equal(git('rev-parse',SOURCE+':'+path),sha,'frozen Source blob '+path);
 assert.equal(git('hash-object',path),sha,'no QA modifications to Source '+path);
}
for(const env of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
 assert.ok(!process.env[env],'private originals forbidden '+env);
console.log('QRW798_FIXED_GIT_ORIGINAL_SOURCE2_QA2_BLOBS_FROZEN_PASS');

const clone=v=>JSON.parse(JSON.stringify(v));
const original=createPrivateSwitchNative3Hold();
assert.equal(validatePrivateSwitchNative3Hold(original),true);
assert.equal(original.schema,SWITCH_NATIVE3_SCHEMA);
assert.equal(original.original.platform,'Nintendo Switch');
assert.equal(original.original.gameVersion,'1.25.3');
assert.equal(original.original.schema,626);
assert.equal(original.original.buildID,'9A239D3DB569756D');
assert.equal(original.original.nsoBuildIDLocation,'NSO0_HEADER_0x40_FIRST8');
assert.equal(original.original.nsoMainSha256,SWITCH_ORIGINAL.nsoMainSha256);
assert.equal(original.candidates.length,3);
assert.deepEqual(original.candidates.map(c=>c.itemId),NATIVE_THREE.map(c=>c.itemId));
assert.deepEqual(original.candidates.map(c=>c.nativeUnityFormat),[50,50,12]);
assert.equal(original.candidates.filter(c=>c.nativeEncodedStreamVerified).length,3);
assert.equal(original.candidates.filter(c=>c.pngWebpRgbaVerified).length,1);
assert.deepEqual(original.candidates.slice(0,2).map(c=>[
 c.nativeRasterStatus,c.switchReconstructedPngSha256,c.switchDerivedLossless160WebpSha256,c.pngWebpRgbaVerified
]),Array.from({length:2},()=>['NOT_RUN_FORMAT50_DECODE',null,null,false]));
assert.equal(original.candidates[2].nativeRasterStatus,'PRIVATE_DXT5_DECODE_AND_LOSSLESS160_RGBA_EXACT');
assert.equal(original.publicProjection.publishAllowed,false);
assert.equal(original.publicProjection.publicImagesEnabled,false);
assert.equal(original.publicProjection.publishedCount,0);
assert.deepEqual(original.publicProjection.items,{});
assert.equal(original.publicProjection.manifestUrl,null);
assert.equal(original.rights.rightsHolderLicense,'UNKNOWN');
assert.equal(original.rights.actualReceivingAndTakedown,'NOT_RUN');
assert.equal(original.rights.cdnPurge,'NOT_RUN');
assert.equal(original.webConsumer.acceptedByCurrentResolver,false);
assert.match(original.webConsumer.currentMainTarget,/schema624/);
assert.match(original.webConsumer.requiredNextTarget,/schema626/);
assert.equal(Object.values(original.flags).every(x=>x===false),true);
assert.equal(original.sourceCodeScope,'METADATA_ONLY_NO_GAME_MEDIA_AND_NO_NEW_NATIVE_DECODER');
assert.equal(/https?:\/\/|file:\/\/|data:image|\.resS|\.png|\.webp/i.test(JSON.stringify(original)),false);
console.log('QRW798_FIXED_SWITCH1253_BID_SCHEMA626_NATIVE_COMPRESSED_SHA3_DXT5_ONE_FORMAT50_TWO_PIXELS_NOTRUN_PUBLIC0_PASS');
const failure=[];
let negativesPassed=0;
const denial=(label,mutate,expectedCode)=>{
 const receipt=clone(original);mutate(receipt);
 let result,raised=null;
 try{result=validatePrivateSwitchNative3Hold(receipt);}
 catch(err){raised=err;}
 if(!raised){
  const note=label+' RECEIPT_ACCEPTED='+String(result);
  failure.push(note);
  console.error('QRW798_FIXED_TRUE_RED_UNRECOGNIZED_PUBLISH_SURFACE_ACCEPTED '+note);
 }else{
  assert.match(String(raised.message),new RegExp('^SWITCH_NATIVE3_'+expectedCode),label);
  negativesPassed++;
 }
};
for(const [label,fn,code] of [
 ['wrong BID',r=>r.original.buildID='52BD625D9B4E0053','ORIGINAL_WRONG_BID'],
 ['wrong schema624',r=>r.original.schema=624,'ORIGINAL_WRONG_BID'],
 ['wrong target Steam',r=>r.original.platform='Steam/Windows','ORIGINAL_WRONG_BID'],
 ['wrong gameVersion',r=>r.original.gameVersion='1.25.0','ORIGINAL_WRONG_BID'],
 ['wrong NSO0 SHA',r=>r.original.nsoMainSha256='0'.repeat(64),'ORIGINAL_WRONG_BID'],
 ['wrong UnityFS bundle SHA',r=>r.original.originalBundleSha256='0'.repeat(64),'ORIGINAL_WRONG_BID'],
 ['wrong Furniture SHA',r=>r.original.furnitureSha256='0'.repeat(64),'ORIGINAL_WRONG_BID'],
 ['wrong native stream SHA',r=>r.candidates[0].nativeStreamSha256='0'.repeat(64),'NATIVE_GUID_SPRITE'],
 ['duplicate Sprite GUID',r=>r.candidates[1].iconGuid=r.candidates[0].iconGuid,'NATIVE_GUID_SPRITE'],
 ['duplicate ItemID',r=>r.candidates[1].itemId=r.candidates[0].itemId,'DUPLICATE_OR_MISSING_NATIVE_ITEM'],
 ['JS Number 64bit PathID',r=>r.candidates[1].texturePathId=4435370640957887944,'NATIVE_GUID_SPRITE'],
 ['signed64 overflow',r=>r.candidates[0].texturePathId='9223372036854775808','NATIVE_GUID_SPRITE'],
 ['negative signed64 underflow',r=>r.candidates[2].spritePathId='-9223372036854775809','NATIVE_GUID_SPRITE'],
 ['unsupported format50 raster promoted',r=>r.candidates[0].pngWebpRgbaVerified=true,'NATIVE_GUID_SPRITE'],
 ['unsupported format50 PNG SHA promoted',r=>r.candidates[1].switchReconstructedPngSha256='a'.repeat(64),'NATIVE_GUID_SPRITE'],
 ['false raster coverage3',r=>r.proof.switchReconstructedRasterShaVerifiedCount=3,'PROOF_COVERAGE'],
 ['older R39 consumer accepted',r=>r.webConsumer.acceptedByCurrentResolver=true,'PROOF_COVERAGE'],
 ['older schema624 forced current',r=>r.webConsumer.requiredNextTarget='Switch v1.25.0 / schema624','PROOF_COVERAGE'],
 ['private CDN URL promoted',r=>r.publicProjection.manifestUrl='https://assets.invalid/public/image.webp','RIGHTS_OR_PUBLICATION'],
 ['published item map injected',r=>r.publicProjection.items={'40006096':{url:'https://assets.invalid/public.png'}},'RIGHTS_OR_PUBLICATION'],
 ['publishedCount injected',r=>r.publicProjection.publishedCount=1,'RIGHTS_OR_PUBLICATION'],
 ['release visibility forced',r=>r.candidates[2].releaseVisibility='PUBLIC','NATIVE_GUID_SPRITE'],
 ['rights holder inferred',r=>r.rights.rightsHolderLicense='LICENSED','RIGHTS_OR_PUBLICATION'],
 ['unknown takedown assumed',r=>r.rights.actualReceivingAndTakedown='PASS','RIGHTS_OR_PUBLICATION'],
 ['CDN purge assumed',r=>r.rights.cdnPurge='PASS','RIGHTS_OR_PUBLICATION'],
 ['flag mediaPublic enabled',r=>r.flags.mediaPublic=true,'RIGHTS_OR_PUBLICATION'],
 ['flag writer enabled',r=>r.flags.writer=true,'RIGHTS_OR_PUBLICATION'],
 ['publishAllowed enabled',r=>r.publicProjection.publishAllowed=true,'RIGHTS_OR_PUBLICATION']
])denial(label,fn,code);
console.log('QRW798_FIXED_ALL_DECLARED_METADATA_AND_PUBLICATION_GATE_NEGATIVES_DENIED '+negativesPassed);

// Independent changed-only unknown-field fail-closed gate. A receipt may later
// pass through a consumer treating unknown top-level keys as credentials or
// public media. Never accept a new root assetUrl / public flag from an untrusted
// metadata receipt simply because known nested fields remained unchanged.
for(const [label,fn] of [
 ['ROOT_ASSET_URL',r=>r.assetUrl='https://assets.invalid/native/40006096.webp'],
 ['ROOT_MEDIA_PUBLIC_FLAG',r=>r.mediaPublic=true],
 ['ROOT_PUBLIC_IMAGES_ENABLED',r=>r.publicImagesEnabled=true],
 ['ROOT_PUBLIC_ITEM_ELIGIBILITY',r=>r.publicItemEligibility='PUBLIC'],
 ['ROOT_IMAGES_MANIFEST',r=>r.images={'40006096':{url:'https://assets.invalid/other.png'}}]
]){
 const receipt=clone(original);fn(receipt);
 let accepted=false,err;
 try{accepted=validatePrivateSwitchNative3Hold(receipt)===true;}
 catch(e){err=e;}
 if(accepted){
  failure.push(label);
  console.error('QRW798_FIXED_TRUE_RED_UNKNOWN_TOPLEVEL_FIELD_NOT_FAILCLOSED '+label);
 }else{
  assert.match(String(err?.message),/^SWITCH_NATIVE3_/,
   'unexpected non-policy failure '+label);
  console.log('QRW798_FIXED_UNKNOWN_ROOT_DENIED_'+label+'_PASS');
 }
}
// NEW fixed-root allowlist regression: deleting mandatory root members must
// also fail closed, not only adding unknown public-media members.
for(const key of Object.keys(original)){
 const missing=clone(original);delete missing[key];
 assert.throws(()=>validatePrivateSwitchNative3Hold(missing),/^TypeError: SWITCH_NATIVE3_/,
  'missing canonical root must deny '+key);
}
console.log('QRW798_FIXED_MISSING_CANONICAL_ROOT_MEMBERS_FAILCLOSED_PASS');
if(failure.length){
 console.error('QRW798_FIXED_TRUE_RED_SCOPED_UNKNOWN_ROOT_PUBLIC_MEDIA_FIELDS '+JSON.stringify(failure));
 throw new Error('TRUE_RED_SCOPED: Switch native3 hold validator accepts unknown root publication/media fields even though release must fail closed; metadata Source only, no actual image bytes.');
}
console.log('QRW798_FIXED_INDEPENDENT_META_ONLY_PUBLICATION_HOLD_SCOPED_PASS');
