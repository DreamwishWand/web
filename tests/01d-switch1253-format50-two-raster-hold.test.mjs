import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SWITCH_ASTC2_SCHEMA,PLATFORM,ASTC6X6_SAMPLES,
  makeSwitchAstc2Hold,validateSwitchAstc2Hold
} from '../scripts/asset-research/01d-switch1253-format50-two-raster-hold.mjs';

const expectInvalid=(change,code)=>{
  const receipt=makeSwitchAstc2Hold();
  change(receipt);
  assert.throws(()=>validateSwitchAstc2Hold(receipt),new RegExp('SWITCH_ASTC6X6_R14_'+code));
};

test('R14 original same-BID Switch ASTC6x6 two private real images have exact SHA but zero public item rows',()=>{
  const got=makeSwitchAstc2Hold();
  assert.equal(got.schema,SWITCH_ASTC2_SCHEMA);
  assert.equal(validateSwitchAstc2Hold(got),true);
  assert.equal(got.platform.buildID,'9A239D3DB569756D');
  assert.equal(got.platform.schema,626);
  assert.equal(got.evidence.originalStreamShaVerified,2);
  assert.equal(got.evidence.reconstructedPngSHAStored,2);
  assert.equal(got.evidence.derivedWebp160SHAStored,2);
  assert.equal(got.evidence.resizedPngVersusWebpExactRGBA,2);
  assert.equal(got.evidence.whiteDarkBackgroundExactRGBA,4);
  assert.deepEqual(got.candidates.map(x=>x.itemId),['40000047','40002422']);
  assert.deepEqual(got.publicProjection.items,{});
  assert.equal(got.publicProjection.publishAllowed,false);
  assert.equal(got.evidence.releaseVisibilityVerified,0);
  assert.equal(got.rights.rightsHolderLicence,'UNKNOWN');
});
test('R14 wrong Version/BID/schema/Source SHA or Steam original clone is rejected',()=>{
  expectInvalid(x=>{x.platform.buildID='52BD625D9B4E0053'},'WRONG_SWITCH_BUILD');
  expectInvalid(x=>{x.platform.schema=624},'WRONG_SWITCH_BUILD');
  expectInvalid(x=>{x.platform.name='Steam/Windows'},'WRONG_SWITCH_BUILD');
  expectInvalid(x=>{x.platform.sourceNsoSha256='f'.repeat(64)},'WRONG_SWITCH_BUILD');
  expectInvalid(x=>{x.platform.nativeSwitchIconBundleSha256='9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0'},'WRONG_SWITCH_BUILD');
});
test('R14 wrong layout height 4, no orientation, wrong decoded raster and forged source SHA fail closed',()=>{
  expectInvalid(x=>{x.converter.gobBlockHeight=4},'FORMAT_OR_ORIENTATION');
  expectInvalid(x=>{x.converter.rasterOrientation='NONE'},'FORMAT_OR_ORIENTATION');
  expectInvalid(x=>{x.converter.rawDecodeInterpolation='ASTC_LDR_UNVERIFIED_ASTRAL'},'FORMAT_OR_ORIENTATION');
  expectInvalid(x=>{x.candidates[0].orientedDecodedRgbaSha256='f'.repeat(64)},'ORIGINAL_DERIVATIVE');
  expectInvalid(x=>{x.candidates[1].nativeCompressedSha256=ASTC6X6_SAMPLES[0].nativeCompressedSha256},'ORIGINAL_DERIVATIVE');
  expectInvalid(x=>{x.candidates[0].derivedWebpLossless160Sha256='f'.repeat(64)},'ORIGINAL_DERIVATIVE');
});
test('R14 ID alias, duplicate/missing sample and inferred 6233 image coverage never accepted',()=>{
  expectInvalid(x=>{x.candidates[1]=x.candidates[0]},'DUPLICATE_OR_MISSING');
  expectInvalid(x=>{x.candidates.pop()},'DUPLICATE_OR_MISSING');
  expectInvalid(x=>{x.candidates[0].itemId='40000048'},'ORIGINAL_DERIVATIVE');
  expectInvalid(x=>{x.evidence.reconstructedPngSHAStored=6233},'EVIDENCE_COUNT');
  expectInvalid(x=>{x.webConsumer.releaseQualifiedRows=2},'PUBLIC_RIGHTS');
});
test('R14 game native derivative != first-party original PNG; colour/device/rights/visibility Gate remains distinct',()=>{
  const x=makeSwitchAstc2Hold();
  assert.equal(x.converter.pngSource,'RECONSTRUCTED_FROM_SWITCH_NATIVE_COMPRESSED_STREAM_NOT_FIRST_PARTY_PNG');
  assert.equal(x.converter.interpolationIdenticalToDevice,'NOT_RUN');
  assert.equal(x.evidence.nativeDevicePixelParityVerified,0);
  assert.equal(x.candidates.every(c=>c.firstPartyPngSha256===null && c.releaseVisibility==='UNKNOWN'),true);
  expectInvalid(x=>{x.evidence.firstPartyOriginalPngShaKnown=2},'EVIDENCE_COUNT');
  expectInvalid(x=>{x.converter.interpolationIdenticalToDevice='PASS'},'FORMAT_OR_ORIENTATION');
  expectInvalid(x=>{x.candidates[0].releaseVisibility='RELEASED_PLAYER_FACING'},'ORIGINAL_DERIVATIVE');
  expectInvalid(x=>{x.rights.rightsHolderLicence='ASSUMED_GRANTED'},'PUBLIC_RIGHTS');
});
test('R14 no R39 lossy fallback, public image URL/media/Writer/Cloud/CDN flags remain disabled',()=>{
  expectInvalid(x=>{x.webConsumer.supportedByCurrentResolver=true},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.publicProjection.items={'40000047':{}}},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.publicProjection.publishAllowed=true},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.publicProjection.manifestUrl='/web/ddv/item-images/v1.25.3/manifest.json'},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.publicProjection.mediaPublic=true},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.safety.oldR39Quality88NotLossless=false},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.safety.writer=true},'PUBLIC_RIGHTS');
  expectInvalid(x=>{x.rights.cdnRevocation='PASSED'},'PUBLIC_RIGHTS');
  // Independent QR-W QA802 found that undefined root media fields previously passed.
  for(const [k,value] of Object.entries({
    assetUrl:'https://assets.invalid/native/40000047.webp',
    mediaPublic:true, publicImagesEnabled:true,
    publicItemEligibility:'PUBLIC',
    images:{'40000047':{url:'https://assets.invalid/other.png'}}
  })) expectInvalid(x=>{x[k]=value},'UNKNOWN_ROOT_KEYS');
});
