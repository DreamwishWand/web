import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SWITCH_NATIVE3_SCHEMA,SWITCH_ORIGINAL,NATIVE_THREE,
  createPrivateSwitchNative3Hold,validatePrivateSwitchNative3Hold
} from '../scripts/asset-research/01d-switch1253-bid-native3-hold.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const bad=(mutator,code)=>{
  const x=createPrivateSwitchNative3Hold();mutator(x);
  assert.throws(()=>validatePrivateSwitchNative3Hold(x),
    new RegExp('SWITCH_NATIVE3_'+code));
};
test('01D R14 genuine Switch1253 NSO BID source has exactly three native GUID→Texture/Sprite SHA, not public image rows',()=>{
  const r=createPrivateSwitchNative3Hold();
  assert.equal(validatePrivateSwitchNative3Hold(r),true);
  assert.equal(r.schema,SWITCH_NATIVE3_SCHEMA);
  assert.equal(r.original.platform,'Nintendo Switch');
  assert.equal(r.original.gameVersion,'1.25.3');
  assert.equal(r.original.buildID,'9A239D3DB569756D');
  assert.equal(r.original.schema,626);
  assert.equal(r.original.nsoMainBytes,96027926);
  assert.equal(r.original.nativeFurnitureCount,6233);
  assert.equal(r.proof.nativeCatalogGuidTextureSpriteVerifiedCount,3);
  assert.equal(r.proof.realOriginalCompressedStreamShaVerifiedCount,3);
  assert.equal(r.proof.switchReconstructedRasterShaVerifiedCount,1);
  assert.deepEqual(r.candidates.map(x=>x.itemId),['40000047','40002422','40006096']);
  assert.equal(r.candidates.every(x=>x.nativeEncodedStreamVerified),true);
  assert.equal(r.publicProjection.publishedCount,0);
  assert.deepEqual(r.publicProjection.items,{});
  assert.equal(r.publicProjection.publishAllowed,false);
  assert.equal(r.webConsumer.acceptedByCurrentResolver,false);
  assert.equal(r.rights.rightsHolderLicense,'UNKNOWN');
  assert.equal(Object.values(r.flags).every(v=>v===false),true);
});
test('01D R14 wrong Switch BID/schema/ExeFS hash/version, wrong compressed UnityFS original fail closed',()=>{
  bad(r=>r.original.buildID='52BD625D9B4E0053','ORIGINAL_WRONG_BID');
  bad(r=>r.original.schema=624,'ORIGINAL_WRONG_BID');
  bad(r=>r.original.platform='Steam/Windows','ORIGINAL_WRONG_BID');
  bad(r=>r.original.fullVersion='releases_1.25-v1.25.0','ORIGINAL_WRONG_BID');
  bad(r=>r.original.nsoMainSha256='f'.repeat(64),'ORIGINAL_WRONG_BID');
  bad(r=>r.original.originalBundleSha256='f'.repeat(64),'ORIGINAL_WRONG_BID');
});
test('01D R14 forged ItemID/GUID/TextureSHA, unsafe JS Number PathID and duplicate candidate fail closed',()=>{
  bad(r=>r.candidates[1].iconGuid='a'.repeat(32),'NATIVE_GUID_SPRITE');
  bad(r=>r.candidates[2].nativeStreamSha256='0'.repeat(64),'NATIVE_GUID_SPRITE');
  bad(r=>r.candidates[0].texturePathId=5692925760575897650,'NATIVE_GUID_SPRITE');
  bad(r=>r.candidates[2].spritePathId='1000000000000000000','NATIVE_GUID_SPRITE');
  bad(r=>r.candidates[1]=copy(r.candidates[0]),'DUPLICATE_OR_MISSING');
  bad(r=>r.candidates.pop(),'DUPLICATE_OR_MISSING');
});
test('01D R14 format50 dual raster remains NOT_RUN, Switch DXT5 only 1/3 PNG/WebP alpha proof',()=>{
  const r=createPrivateSwitchNative3Hold();
  assert.deepEqual(r.candidates.map(x=>x.nativeUnityFormat),[50,50,12]);
  assert.deepEqual(r.candidates.map(x=>x.nativeDimensions),[[256,256],[256,256],[512,512]]);
  assert.equal(r.candidates.filter(x=>x.pngWebpRgbaVerified).length,1);
  assert.equal(r.candidates.filter(x=>x.switchReconstructedPngSha256===null).length,2);
  assert.equal(r.candidates[2].switchReconstructedPngSha256,'41fd7dcaf0f4a6ae2b43cd29d111245b0be49873a04e4f7c42c6d572199f78c3');
  assert.equal(r.candidates[2].switchDerivedLossless160WebpSha256,'4d2cbdf8cac7ad46ee5f7baa112ae5af34d2fc05de271db1a49d98d003a03858');
  bad(r=>r.candidates[0].nativeRasterStatus='PRIVATE_ASTC_ALREADY_VERIFIED','NATIVE_GUID_SPRITE');
  bad(r=>r.candidates[1].switchReconstructedPngSha256=r.candidates[2].switchReconstructedPngSha256,'NATIVE_GUID_SPRITE');
  bad(r=>r.proof.switchReconstructedRasterShaVerifiedCount=3,'PROOF_COVERAGE');
});
test('01D R14 release visibility, rights, CDN and publication cannot be inferred from a Switch native SHA',()=>{
  bad(r=>r.candidates[0].releaseVisibility='RELEASED_PLAYER_FACING','NATIVE_GUID_SPRITE');
  bad(r=>r.proof.publicItemEligibility='ACCEPTED','PROOF_COVERAGE');
  bad(r=>r.rights.rightsHolderLicense='LICENSED','RIGHTS_OR_PUBLICATION');
  bad(r=>r.publicProjection.publishAllowed=true,'RIGHTS_OR_PUBLICATION');
  bad(r=>r.publicProjection.items={'40006096':{}} ,'RIGHTS_OR_PUBLICATION');
  bad(r=>r.flags.mediaPublic=true,'RIGHTS_OR_PUBLICATION');
  bad(r=>r.webConsumer.acceptedByCurrentResolver=true,'PROOF_COVERAGE');
});
test('01D R14 immutable source-only metadata has no game asset bytes, private paths, inferred legacy fallback or URL',()=>{
  const r=createPrivateSwitchNative3Hold();
  const s=JSON.stringify(r);
  assert.equal(r.sourceCodeScope,'METADATA_ONLY_NO_GAME_MEDIA_AND_NO_NEW_NATIVE_DECODER');
  assert.equal(r.publicProjection.manifestUrl,null);
  assert.equal(r.proof.nativeAllItemCountIsNotImageCoverage,true);
  assert.equal(r.webConsumer.missing.length,5);
  assert.equal(/(?:https?:\/\/|file:\/\/|\.resS|quality-88|data:image)/i.test(s),false);
  assert.equal(r.candidates.some(x=>x.releaseVisibility!=='UNKNOWN'),false);
});
