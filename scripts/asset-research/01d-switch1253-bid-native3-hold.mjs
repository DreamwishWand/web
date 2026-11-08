// 01D R14: exact owner-private Nintendo Switch v1.25.3 BID source evidence.
// Metadata only; this is NOT the 08 WEB public image catalog and cannot publish art.
// Native extraction was owner-private; accepted Steam PR781/787/794 parsers remain unchanged.
export const SWITCH_NATIVE3_SCHEMA='wand.01d.switch1253-native-three-hold@1';
export const SWITCH_ORIGINAL=Object.freeze({
  platform:'Nintendo Switch',
  gameVersion:'1.25.3',
  buildID:'9A239D3DB569756D',
  schema:626,
  nsoMainBytes:96027926,
  nsoMainSha256:'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a',
  nsoBuildIDLocation:'NSO0_HEADER_0x40_FIRST8',
  fullVersion:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  fullVersionSha256:'763d42f58ed345430ced4627af6dddd8c31a941e3a6a2de30cba3408cd4aabb4',
  furnitureBytes:2458197,
  furnitureSha256:'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674',
  nativeFurnitureCount:6233,
  originalBundleBytes:86144041,
  originalBundleSha256:'346d9da74c03d93e3db71fe703724a7a1cadf72aa693474da813765e9f54f5ff',
  originalCatalogKeySha256:'077fad62cc15a74b33d9a755b9fea47e3293c2f1d0bf573c612bb975250728ff',
  originalCatalogBucketSha256:'bc4b5e2820da02b42e8e6b799bbd3b344a15980ca51b16cab5797b5aad2bff8d',
  originalCatalogEntrySha256:'b949485e85c398f2c2f57f2753c08fac799c5636eeecda05d5359e3c2388879f',
  originalCatalogInternalIdsSha256:'8267ceb1f7359cea54abadc440cb065daa93ee107b752ab84aa1e80ce5759a83',
  originalCatalogJsonSha256:'c08a970cd87fdf5c7783ed9feae990c181502fb5d11dc7512c2b89dfbd683a1c',
  originalCatalogExtraSha256:'9063e2912f820b7cabffa743a1c7fb8c5c7cb8b185a40f9e9b2cd0b53e00fa61',
  originalCabNode:'CAB-6cb3b1b511f0bc591f6603d3b5032184',
  nativeCatalogDependencyInternalId:17992
});
export const NATIVE_THREE=Object.freeze([
  Object.freeze({
    itemId:'40000047',iconGuid:'26d1b07fac5a07a4ebea467b962fb6a4',
    texturePathId:'5692925760575897650',spritePathId:'-3868758205458743246',
    textureName:'Armoir01',nativeUnityFormat:50,nativeDimensions:[256,256],
    spriteRect:[0,0,256,256],nativeStreamOffset:244180992,nativeStreamLength:45056,
    nativeStreamSha256:'b0352f4fde178c423dbfa0f02c1f3f6fbfdb24bd4edf2603b67ce2f74485a68c',
    nativeEncodedStreamVerified:true,
    nativeRasterStatus:'NOT_RUN_FORMAT50_DECODE',
    switchReconstructedPngSha256:null,switchDerivedLossless160WebpSha256:null,
    pngWebpRgbaVerified:false,releaseVisibility:'UNKNOWN'
  }),
  Object.freeze({
    itemId:'40002422',iconGuid:'094a2e721b66fc44cb13be2d368a3c38',
    texturePathId:'4435370640957887944',spritePathId:'4218552044945069512',
    textureName:'OogieBoogieSign01',nativeUnityFormat:50,nativeDimensions:[256,256],
    spriteRect:[0,0,256,256],nativeStreamOffset:217950720,nativeStreamLength:45056,
    nativeStreamSha256:'5398f7dbe62f9e6bae74bc45454dea2410ecfbad8686d6510713eb9d33a7cd0e',
    nativeEncodedStreamVerified:true,
    nativeRasterStatus:'NOT_RUN_FORMAT50_DECODE',
    switchReconstructedPngSha256:null,switchDerivedLossless160WebpSha256:null,
    pngWebpRgbaVerified:false,releaseVisibility:'UNKNOWN'
  }),
  Object.freeze({
    itemId:'40006096',iconGuid:'b569dad82cd3de74397780d1fa7be96a',
    texturePathId:'-8638488044499403131',spritePathId:'-5161782689389773179',
    textureName:'OogieDiceTree',nativeUnityFormat:12,nativeDimensions:[512,512],
    spriteRect:[0,0,512,512],nativeStreamOffset:9698816,nativeStreamLength:262144,
    nativeStreamSha256:'41622bafd70f97eef4d34eef63db0b4c3be6e85a29f400b7c8bceee370b77b13',
    nativeEncodedStreamVerified:true,
    nativeRasterStatus:'PRIVATE_DXT5_DECODE_AND_LOSSLESS160_RGBA_EXACT',
    switchReconstructedPngSha256:'41fd7dcaf0f4a6ae2b43cd29d111245b0be49873a04e4f7c42c6d572199f78c3',
    switchDerivedLossless160WebpSha256:'4d2cbdf8cac7ad46ee5f7baa112ae5af34d2fc05de271db1a49d98d003a03858',
    pngWebpRgbaVerified:true,releaseVisibility:'UNKNOWN'
  })
]);
const clone=v=>JSON.parse(JSON.stringify(v));
const SHA=/^[0-9a-f]{64}$/;
const ITEM=/^[1-9][0-9]{0,15}$/;
const ID64=/^-?(?:0|[1-9][0-9]*)$/;
function reject(code){throw new TypeError('SWITCH_NATIVE3_'+code);}
export function createPrivateSwitchNative3Hold(){
  return {
    schema:SWITCH_NATIVE3_SCHEMA,operation:'DEV_READY',
    evidenceTier:'OWNER_PRIVATE_REAL_ROMFS_EXEFS_UNITYFS',
    original:clone(SWITCH_ORIGINAL),
    proof:{
      switchNsoBuildIDMatched:true,
      switchFurnitureShaMatchesSteamFurniture:true,
      nativeCatalogGuidTextureSpriteVerifiedCount:3,
      realOriginalCompressedStreamShaVerifiedCount:3,
      switchReconstructedRasterShaVerifiedCount:1,
      privatePngWebpRgbaExactCount:1,
      nativeAllItemCountIsNotImageCoverage:true,
      identityResolution:'NATIVE_THREE_ONLY',
      publicItemEligibility:'UNKNOWN'
    },
    candidates:clone(NATIVE_THREE),
    webConsumer:{
      currentMainSource:'Switch v1.24.13 / R39',
      currentMainTarget:'Switch v1.25.0 / BID52BD625D9B4E0053 / schema624',
      requiredNextTarget:'Switch v1.25.3 / BID9A239D3DB569756D / schema626',
      acceptedByCurrentResolver:false,
      missing:[
        'FORMAT50_RECONSTRUCTED_PNG_WEBP_ALPHA_FOR_FIRST_TWO_SAMPLES',
        'PUBLIC_ITEM_RELEASE_VISIBILITY_PER_ITEM',
        'FIRST_PARTY_ORIGINAL_PNG_SHA_OR_PROVEN_RASTER_EQUIVALENCE',
        'RIGHTS_HOLDER_LICENSE_AND_TAKEDOWN_CDN_PURGE',
        '08WEB_EXPLICIT_SAME_VERSION_RESOLVER_AND_MANAGED_HTTPS_IMAGE_CHROME'
      ]
    },
    rights:{ownerIssue604Direction:'GO_ALREADY_INHERITED',
      rightsHolderLicense:'UNKNOWN',nonAffiliated:true,
      actualReceivingAndTakedown:'NOT_RUN',cdnPurge:'NOT_RUN'},
    publicProjection:{items:{},publishedCount:0,
      publishAllowed:false,publicImagesEnabled:false,manifestUrl:null},
    flags:{writer:false,apply:false,cloud:false,provider:false,
      communityPublic:false,mediaPublic:false},
    sourceCodeScope:'METADATA_ONLY_NO_GAME_MEDIA_AND_NO_NEW_NATIVE_DECODER'
  };
}
export function validatePrivateSwitchNative3Hold(receipt) {
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
      receipt.schema!==SWITCH_NATIVE3_SCHEMA||receipt.operation!=='DEV_READY'||
      receipt.evidenceTier!=='OWNER_PRIVATE_REAL_ROMFS_EXEFS_UNITYFS')
    reject('UNKNOWN_RECEIPT_SCHEMA_OR_EVIDENCE_TIER');
  const expected=createPrivateSwitchNative3Hold();
  // Independent 04 QR-W #802 proved five unrecognized public-media root keys
  // were silently accepted. Reject all unexpected/missing own root keys.
  if(JSON.stringify(Object.keys(receipt).sort())!==JSON.stringify(Object.keys(expected).sort()))
    reject('UNKNOWN_ROOT_MEDIA_FIELD');
  const allEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(!allEqual(receipt.original,expected.original)||receipt.original?.buildID!=='9A239D3DB569756D'||
     receipt.original?.schema!==626||
     ![receipt.original.nsoMainSha256,receipt.original.furnitureSha256,
        receipt.original.originalBundleSha256].every(x=>SHA.test(x||'')))
    reject('ORIGINAL_WRONG_BID_PLATFORM_VERSION_OR_SHA');
  if(!Array.isArray(receipt.candidates)||receipt.candidates.length!==3||
     new Set(receipt.candidates.map(x=>x?.itemId)).size!==3)
    reject('DUPLICATE_OR_MISSING_NATIVE_ITEM');
  for(const pin of NATIVE_THREE){
    const got=receipt.candidates.find(x=>x?.itemId===pin.itemId);
    if(!got||!ITEM.test(got.itemId)||!ID64.test(got.texturePathId||'')||
       !ID64.test(got.spritePathId||'')||
       !SHA.test(got.nativeStreamSha256||'')||
       !allEqual(got,pin)||got.releaseVisibility!=='UNKNOWN')
      reject('NATIVE_GUID_SPRITE_TEXTURE_SHA_OR_VISIBILITY_FORGED');
  }
  if(!allEqual(receipt.proof,expected.proof)||
     !allEqual(receipt.webConsumer,expected.webConsumer))
    reject('PROOF_COVERAGE_OR_CONSUMER_FALSIFIED');
  if(!allEqual(receipt.rights,expected.rights)||
     !allEqual(receipt.publicProjection,expected.publicProjection)||
     !allEqual(receipt.flags,expected.flags)||
     receipt.sourceCodeScope!==expected.sourceCodeScope)
    reject('RIGHTS_OR_PUBLICATION_GATE_FORGED');
  if(receipt.candidates.some(x=>x.releaseVisibility!=='UNKNOWN')||
     receipt.publicProjection.publishAllowed!==false ||
     Object.keys(receipt.publicProjection.items).length!==0)
    reject('PUBLIC_IMAGE_PROMOTION_FORBIDDEN');
  return true;
}
