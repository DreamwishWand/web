// 01D R14: exact genuine Switch v1.25.3 ASTC 6x6 two-raster private evidence.
// This is NOT a published Item image catalog, asset bundle, or native decoder.
// No raw compressed bytes/PNG/WebP/Save may be committed to public GitHub/CI/Pages.
export const SWITCH_ASTC2_SCHEMA='wand.01d.switch1253-astc6x6-derived2-hold@1';
export const PLATFORM=Object.freeze({
  name:'Nintendo Switch',gameVersion:'1.25.3',
  buildID:'9A239D3DB569756D',schema:626,
  sourceNsoSha256:'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a',
  nativeFurnitureSha256:'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674',
  nativeSwitchIconBundleSha256:'346d9da74c03d93e3db71fe703724a7a1cadf72aa693474da813765e9f54f5ff'
});
export const ASTC6X6_SAMPLES=Object.freeze([
  Object.freeze({
    itemId:'40000047',iconGuid:'26d1b07fac5a07a4ebea467b962fb6a4',
    texturePathId:'5692925760575897650',spritePathId:'-3868758205458743246',
    nativeCompressedSha256:'b0352f4fde178c423dbfa0f02c1f3f6fbfdb24bd4edf2603b67ce2f74485a68c',
    blockLinearByteLength:45056,blockFootprint:[6,6],blockGrid:[43,43],
    gpuGobBlockHeight:8,linearAstcByteLength:29584,
    linearAstcSha256:'fccffd6011a61edb9401628d3f18be12fb38fac23d280ebc18f62da73df9c961',
    validAstcBlocks:1849,invalidAstcBlocks:0,
    unsupportedAlternateGobHeight:4,alternateInvalidAstcBlocks:431,
    unorientatedDecodedRgbaSha256:'a623a3bb0ffe93ac8c73eae5d66e10856fa80d83d122d03944a27230b3c36744',
    orientedDecodedRgbaSha256:'d19fdf79e6f4c8475467ab6c6adb5017fde96c85cc2c92e9f67be41538740b31',
    reconstructedPngSha256:'c156d4e1a32de6e61a851704349f17333098bab39f20ace06f56a7ecf591cc26',
    reconstructedPngBytes:53112,
    derivedWebpLossless160Sha256:'b3d130ebf054038655970ed6b9a963b387b2c82be4a1658c2835775ac61d1f54',
    derivedWebpLossless160Bytes:19064,
    alphaZeroPixels:42884,hiddenRgbNonzeroAlphaZeroPixels:42884,
    whiteCompositeSha256:'3782bf299e1eea25f59455707711515a12266998542c7945a8599d51dfef6051',
    darkCompositeSha256:'5198bb4b6bbeca1ce3c4e9f61ed7473d76428b2fd6afebcab9b36c603a6c54d2',
    canvasPixelsVerified:'RGBA_EXACT_PRIVATE',
    firstPartyPngSha256:null,releaseVisibility:'UNKNOWN',releaseRights:'UNKNOWN',
    publicEligible:false
  }),
  Object.freeze({
    itemId:'40002422',iconGuid:'094a2e721b66fc44cb13be2d368a3c38',
    texturePathId:'4435370640957887944',spritePathId:'4218552044945069512',
    nativeCompressedSha256:'5398f7dbe62f9e6bae74bc45454dea2410ecfbad8686d6510713eb9d33a7cd0e',
    blockLinearByteLength:45056,blockFootprint:[6,6],blockGrid:[43,43],
    gpuGobBlockHeight:8,linearAstcByteLength:29584,
    linearAstcSha256:'385f99fbd9d436046ca8a85ef620c50a3ee5ce7b1071e32c46ae7302aa1695d1',
    validAstcBlocks:1849,invalidAstcBlocks:0,
    unsupportedAlternateGobHeight:4,alternateInvalidAstcBlocks:431,
    unorientatedDecodedRgbaSha256:'17feb7eb887a3009b407113cec58203bcfab8b9ebac3096376fd93139cf4a916',
    orientedDecodedRgbaSha256:'acfd5bf6d2e08921f202fc029352e4d401794db063feac3730f9978164b2c74c',
    reconstructedPngSha256:'75f198f89e186ae681b1716e1d214fd6221f886d8f61533d5e5cd9bf8f43e1b9',
    reconstructedPngBytes:32514,
    derivedWebpLossless160Sha256:'980f4b2d65d16692f2f7ed70b5e2b015a00a8d3d5579037f74ebb6c4d66f4cdd',
    derivedWebpLossless160Bytes:11904,
    alphaZeroPixels:52663,hiddenRgbNonzeroAlphaZeroPixels:13365,
    whiteCompositeSha256:'f9443d206618acbae5dab925b7a7c670ccb6ff0add67a400e806b327551c59ac',
    darkCompositeSha256:'132e5a77e37efb2a0dbaa03aca37c584f72b9236d08a8e679874da8239c768fa',
    canvasPixelsVerified:'RGBA_EXACT_PRIVATE',
    firstPartyPngSha256:null,releaseVisibility:'UNKNOWN',releaseRights:'UNKNOWN',
    publicEligible:false
  })
]);
const copy=x=>JSON.parse(JSON.stringify(x));
const SHA=/^[0-9a-f]{64}$/;
function fail(message){throw new TypeError('SWITCH_ASTC6X6_R14_'+message);}
export function makeSwitchAstc2Hold() {
 return {
   schema:SWITCH_ASTC2_SCHEMA,
   task:'W-01D-ASSET-IMG-028',operation:'DEV_READY',
   evidenceTier:'REAL_PRIVATE_SWITCH_BID_ASTC_2_RGBA_EXACT',
   sourceAncestor:{originalPr:798,originalHead:'e57a696510c31d55a6fae04ca14985eb691edfe8'},
   platform:copy(PLATFORM),
   converter:{
     sourceFormat:'UNITY_TEXTURE_FORMAT_50_ASTC_6X6_LDR',
     tegraLayout:'X1_BLOCK_LINEAR_GOB_64_BY_8_BYTES',
     sourceNativeBytesPerSample:45056,
     linearBlocksPerAxis:43,
     decodeBlockSize:[6,6],
     gobBlockHeight:8,
     excludedGobBlockHeight:4,
     rawDecodeInterpolation:'ASTC_LDR_isSRGB_TRUE',
     interpolationIdenticalToDevice:'NOT_RUN',
     rasterOrientation:'FLIP_TOP_BOTTOM_TO_UI_DISPLAY',
     pngSource:'RECONSTRUCTED_FROM_SWITCH_NATIVE_COMPRESSED_STREAM_NOT_FIRST_PARTY_PNG',
     jpegLoss:'NONE',
     resample:'PILLOW_LANCZOS_160x160',
     losslessWebp:'PILLOW_WEBP_lossless_true_exact_true_method6',
     externalAstcLdrDecoder:'richgel999/astc_dec Apache-2.0, OWNER_PRIVATE_OFFLINE_ONLY',
     decoderIndependentDeviceParity:'NOT_RUN'
   },
   evidence:{
     privateReceiptSHA256:'72a338bc0ce568fd84a34e40731c5c9e8126df80c7ceae0795abd225255b5712',
     originalStreamShaVerified:2,
     originalBundleUnchanged:true,
     correctGobHeightAstcBlocksOk:3698,
     wrongGobHeightAstcBlocksRejected:862,
     reconstructedPngSHAStored:2,
     derivedWebp160SHAStored:2,
     resizedPngVersusWebpExactRGBA:2,
     whiteDarkBackgroundExactRGBA:4,
     firstPartyOriginalPngShaKnown:0,
     nativeDevicePixelParityVerified:0,
     releaseVisibilityVerified:0
   },
   candidates:copy(ASTC6X6_SAMPLES),
   webConsumer:{
     currentResolverSource:'Switch v1.24.13 R39',
     currentResolverTarget:'Switch v1.25.0 BID52BD625D9B4E0053 schema624',
     expectedTarget:'Switch v1.25.3 BID9A239D3DB569756D schema626',
     supportedByCurrentResolver:false,
     candidateImageRows:2,
     releaseQualifiedRows:0,
     rightToShow:'UNKNOWN',
     missing:[
       'FIRST_PARTY_PNG_OR_ACCEPTED_SWITCH_NATIVE_RASTER_EQUIVALENCE',
       'RELEASE_ITEM_VISIBILITY_DLC_ENTITLEMENT_FOR_EACH_ITEM',
       'COLOUR_SPACE_DEVICE_PIXEL_PARITY',
       '08WEB_VERSIONED_IMAGE_CONSUMER_AND_MANAGED_HTTPS_CHROME',
       '07DBK_RIGHTS_LICENSE_CONTACT_TAKEDOWN_AND_CDN_PURGE'
     ]
   },
   publicProjection:{items:{},publishedImageCount:0,publishAllowed:false,
     manifestUrl:null,mediaPublic:false},
   safety:{steamBundleNeverSubstitutedForSwitch:true,
     oldR39Quality88NotLossless:true,publicRepoContainsOriginalMedia:false,
     writer:false,apply:false,cloud:false,provider:false,communityPublic:false},
   rights:{issue604Direction:'GO_ALREADY_INHERITED',
     rightsHolderLicence:'UNKNOWN',takedownReceiving:'NOT_RUN',cdnRevocation:'NOT_RUN'}
 };
}
export function validateSwitchAstc2Hold(receipt) {
 const known=makeSwitchAstc2Hold();
 if(!receipt ||typeof receipt!=='object'||Array.isArray(receipt)||receipt.schema!==SWITCH_ASTC2_SCHEMA)
    fail('WRONG_SCHEMA');
 if(!receipt.platform||receipt.platform.buildID!==PLATFORM.buildID||
    receipt.platform.schema!==PLATFORM.schema||
    JSON.stringify(receipt.platform)!==JSON.stringify(known.platform))
    fail('WRONG_SWITCH_BUILD_OR_ORIGINAL_SHA');
 if(!Array.isArray(receipt.candidates)||receipt.candidates.length!==2||
    new Set(receipt.candidates.map(s=>s?.itemId)).size!==2)
    fail('DUPLICATE_OR_MISSING_SAMPLE');
 for (const pinned of ASTC6X6_SAMPLES){
   const sample=receipt.candidates.find(s=>s?.itemId===pinned.itemId);
   if(!sample || [sample.nativeCompressedSha256,sample.reconstructedPngSha256,
     sample.derivedWebpLossless160Sha256].some(h=>!SHA.test(h||''))||
     JSON.stringify(sample)!==JSON.stringify(pinned))
    fail('ORIGINAL_DERIVATIVE_SHA_OR_ITEM_FORGED');
 }
 if(receipt.converter?.gobBlockHeight!==8||
    receipt.converter?.rasterOrientation!=='FLIP_TOP_BOTTOM_TO_UI_DISPLAY'||
    JSON.stringify(receipt.converter)!==JSON.stringify(known.converter))
    fail('FORMAT_OR_ORIENTATION_OR_DEVICE_PARITY_ASSUMED');
 if(JSON.stringify(receipt.evidence)!==JSON.stringify(known.evidence)||
    JSON.stringify(receipt.sourceAncestor)!==JSON.stringify(known.sourceAncestor))
    fail('EVIDENCE_COUNT_OR_ORIGIN_FORGED');
 if(JSON.stringify(receipt.webConsumer)!==JSON.stringify(known.webConsumer)||
    JSON.stringify(receipt.publicProjection)!==JSON.stringify(known.publicProjection)||
    JSON.stringify(receipt.safety)!==JSON.stringify(known.safety)||
    JSON.stringify(receipt.rights)!==JSON.stringify(known.rights)||
    receipt.task!==known.task||receipt.operation!==known.operation||
    receipt.evidenceTier!==known.evidenceTier)
    fail('PUBLIC_RIGHTS_CONSUMER_WRITER_GATE_FORGED');
 if(Object.keys(receipt.publicProjection.items).length!==0||
    receipt.publicProjection.publishAllowed!==false||
    receipt.publicProjection.mediaPublic!==false||
    receipt.candidates.some(c=>c.publicEligible||c.releaseVisibility!=='UNKNOWN'))
    fail('PUBLIC_MEDIA_OR_VISIBILITY_NOT_ALLOWED');
 return true;
}
