#!/usr/bin/env node
// 01D R14, owner-private original image proof -> 08 WEB contract HOLD.
// Native GUID/Texture/Sprite decoding is owned by accepted 01D scripts/PR781/PR787.
// This small last-mile verifier never emits a public image, release flag, or game bytes.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat, open, realpath} from 'node:fs/promises';
import {dirname, isAbsolute, join, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SOURCE = Object.freeze({
  platform: 'Steam/Windows',
  gameVersion: '1.25.3',
  externalFullVersion: 'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  furnitureSha256: '823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674',
  furnitureBytes: 2458197,
  bundleSha256: '9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0',
  bundleBytes: 249369620
});
export const TARGET = Object.freeze({
  platform: 'Nintendo Switch', gameVersion: '1.25.3',
  buildID: '9A239D3DB569756D', schema: 626
});
export const SOURCE_ONLY_SAMPLES = Object.freeze([
  Object.freeze({
    itemId:'40000047', iconGuid:'26d1b07fac5a07a4ebea467b962fb6a4',
    nativeTextureName:'Armoir01', nativeFormat:'BC7',
    encodedSha256:'3667a7212306096b69896e7304be9982fd1f95e718b27f742b3ffe0cabb32972',
    steamDerivedPngSha256:'1e195cb2c3a28acd7cd6a6d68ede35928c77245fadd1f465b506162ffd3bd474',
    steamLossless160WebpSha256:'30ab4e9c59d87e2796a56a2bdda2b87bfc03bb39364b3d2267d31db2804865e0'
  }),
  Object.freeze({
    itemId:'40002422', iconGuid:'094a2e721b66fc44cb13be2d368a3c38',
    nativeTextureName:'OogieBoogieSign01', nativeFormat:'BC7',
    encodedSha256:'dfc86319c5f16ad5e1f5f614d0c0b5bf33114962ff48bd79b2f41e6736016811',
    steamDerivedPngSha256:'4af1181ffc411ea4a41bfe03f95d41ffc9c3e0a032c56e073e91ca91bea82ae8',
    steamLossless160WebpSha256:'988eb7ef8d4b295c25882946e1f2d78aa329af583a3b3def392ee8ecfa503c3c'
  }),
  Object.freeze({
    itemId:'40006096', iconGuid:'b569dad82cd3de74397780d1fa7be96a',
    nativeTextureName:'OogieDiceTree', nativeFormat:'DXT5',
    encodedSha256:'7daefc7646df6b25fc07859b28536027323ad12edcbdef4eb19e388ea972e1d4',
    steamDerivedPngSha256:'e1a6a39a50a38acf6f69b70cf4d53c6092396930c41dc3327510ba307e3969f1',
    steamLossless160WebpSha256:'75292936edd3ed82fd97e69f7e8e09771ce4c9ec36d867c7703b066a95b1854c'
  })
]);

const schema = 'wand.01d.v1253-item-image-consumer-hold@1';
const hex64 = /^[a-f0-9]{64}$/;
const expectedKeys = ['fullversion','furniture','bundle','images','output'];
const hashPath = path => createHash('sha256').update(path).digest('hex');
function fail(code) { throw new Error('01D_IMAGE_PROOF_'+code); }
function byteHeaders(bytes,kind) {
  if(kind==='fullversion') return; // Exact 54-byte file is already SHA- and size-pinned.
  if(kind==='png') {
    if(bytes.length<26 || bytes.toString('hex',0,8)!=='89504e470d0a1a0a' ||
       bytes.readUInt32BE(16)!==512 || bytes.readUInt32BE(20)!==512 ||
       bytes[24]!==8 || bytes[25]!==6) fail('DERIVED_PNG_RGBA512_HEADER');
    return;
  }
  if(kind==='webp') {
    if(bytes.length<26 || bytes.toString('ascii',0,4)!=='RIFF' ||
       bytes.toString('ascii',8,12)!=='WEBP' ||
       bytes.toString('ascii',12,16)!=='VP8L' || bytes[20]!==0x2f ||
       bytes.readUInt32LE(4)+8 < bytes.length ||
       ((bytes[21] | ((bytes[22]&63)<<8))+1)!==160 ||
       (((bytes[22]>>6)|(bytes[23]<<2)|((bytes[24]&15)<<10))+1)!==160)
      fail('DERIVED_WEBP_LOSSLESS160_HEADER');
  }
}
export function validateManifestInputs({source=SOURCE,target=TARGET,releaseFlag=false,samples=SOURCE_ONLY_SAMPLES}={}) {
  if(!source || source.platform!==SOURCE.platform ||
     source.gameVersion!==SOURCE.gameVersion ||
     source.externalFullVersion!==SOURCE.externalFullVersion ||
     source.furnitureSha256!==SOURCE.furnitureSha256 ||
     source.bundleSha256!==SOURCE.bundleSha256 ||
     source.furnitureBytes!==SOURCE.furnitureBytes ||
     source.bundleBytes!==SOURCE.bundleBytes) fail('WRONG_STEAM_BUILD_OR_SHA');
  if(!target || target.platform!==TARGET.platform ||
     target.gameVersion!==TARGET.gameVersion ||
     target.buildID!==TARGET.buildID || target.schema!==TARGET.schema)
    fail('WRONG_SWITCH_TARGET_BUILD');
  if(releaseFlag!==false) fail('UNKNOWN_OR_ENABLED_RELEASE_FLAG');
  if(!Array.isArray(samples)||samples.length!==3||new Set(samples.map(s=>s?.itemId)).size!==3)
    fail('DUPLICATE_OR_MISSING_SAMPLE');
  for(let i=0;i<3;i++){
    const actual=samples.find(s=>s?.itemId===SOURCE_ONLY_SAMPLES[i].itemId);
    const pinned=SOURCE_ONLY_SAMPLES[i];
    if(!actual || Object.keys(pinned).some(k=>actual[k]!==pinned[k]) ||
      ![actual.encodedSha256,actual.steamDerivedPngSha256,actual.steamLossless160WebpSha256].every(v=>typeof v==='string'&&hex64.test(v)))
      fail('NATIVE_SAMPLE_OR_DERIVATIVE_SHA_NOT_PINNED');
  }
  return true;
}
export function createHoldManifest({source=SOURCE,target=TARGET,releaseFlag=false,samples=SOURCE_ONLY_SAMPLES,privateFileProof='NOT_RUN'}={}) {
  validateManifestInputs({source,target,releaseFlag,samples});
  if(!['NOT_RUN','PINNED_FILE_SHA_VERIFIED'].includes(privateFileProof))
    fail('UNRECOGNIZED_PRIVATE_PROOF');
  return {
    schema,
    operation:'DEV_READY',
    releaseStatus:'HOLD_INDEPENDENT_QA_AND_SAME_SWITCH_BUILD',
    generatedFrom:'FIRST_PARTY_STEAM1253_PILOT_ONLY',
    source:{...SOURCE, nativeItemCount:6233,
      nativeCountEvidence:'SOURCE_ONLY_PR781_NOT_FULL_ITEM_IMAGE_COVERAGE'},
    target:{...TARGET, sameBuildSwitchOriginalVerified:false,
      switchIconGuidVerifiedCount:0, switchNativeSpriteVerifiedCount:0,
      switchPngSha256VerifiedCount:0, switchReleasedVisibilityVerifiedCount:0},
    evidence:{privateFileProof, validatedItemIds:samples.map(s=>s.itemId),
      provenSteamSampleCount:3, fullCatalogueImageCoverage:'UNKNOWN',
      pngShaKind:'STEAM_RECONSTRUCTED_NOT_ORIGINAL_GAME_PNG',
      imageShaPairs:samples.map(s=>({
        itemId:s.itemId, iconGuid:s.iconGuid, nativeFormat:s.nativeFormat,
        originalSteamCompressedTextureSha256:s.encodedSha256,
        steamReconstructedPngSha256:s.steamDerivedPngSha256,
        steamLossless160WebpSha256:s.steamLossless160WebpSha256,
        alphaPreserved:'OWNER_PRIVATE_RGBA_EXACT_3_SAMPLES',
        switchImageSha256:null, switchVisibility:'UNKNOWN',
        status:'CANDIDATE_NOT_RELEASED'
      }))},
    bridgeTo08Web:{
      requiredConsumerSchema:'wand.item-images.public-catalog-lossless@1',
      currentResolverSource:{platform:'Nintendo Switch',gameVersion:'1.24.13',generation:'R39'},
      currentResolverTarget:{platform:'Nintendo Switch',gameVersion:'1.25.0',
        buildID:'52BD625D9B4E0053',schema:624},
      currentResolverPathVersion:'v1.24.13',
      acceptedByCurrentResolver:false,
      missingContractEvidence:[
        'SWITCH_1253_SAME_BUILD_ICON_GUID_AND_NATIVE_SPRITE',
        'SWITCH_1253_ORIGINAL_IMAGE_SHA_AND_PIXEL_IDENTITY',
        'SWITCH_1253_RELEASED_ITEM_VISIBILITY_PER_ITEM',
        'CURRENT_SOURCE_ORIGINAL_PNG_SHA_VS_STEAM_RECONSTRUCTED_SHA',
        '08WEB_EXPLICIT_VERSIONED_SOURCE_TARGET_AND_SHA_URL_LAYOUT',
        '08WEB_MANAGED_HTTPS_PAGES_REAL_IMAGE_CHROME',
        '07DBK_LICENSE_RIGHTS_CONTACT_TAKEDOWN_AND_CDN_REVOCATION'
      ]
    },
    rights:{ownerDirectionIssue:604,gameOrigin:'Disney Dreamlight Valley',
      unaffiliated:true,rightsHolderLicence:'UNKNOWN',
      perImageTakedown:'NOT_RUN',providerCdnPurge:'NOT_RUN',
      managedHttps:'NOT_RUN'},
    publicProjection:{schema:'HOLD_NOT_PUBLIC_CATALOG',
      items:{},assetVariant:'webp-lossless-160-v1',
      publishedImageCount:0,publishAllowed:false,
      publicUrl:null,publicImagesEnabled:false},
    writerEnabled:false,applyEnabled:false,cloudEnabled:false,
    providerEnabled:false,communityPublicEnabled:false
  };
}
async function verifyPinned(path,{sha,size,kind},seen) {
  const st=await lstat(path);
  if(st.isSymbolicLink()||!st.isFile()||(size!==null&&st.size!==size)||st.size<=0||st.size>300*1024*1024)fail('MISSING_SYMLINK_SIZE');
  const id=st.dev+':'+st.ino;
  if(seen.has(id)) fail('INPUT_INODE_ALIAS');
  seen.add(id);
  const fd=await open(path,constants.O_RDONLY | (constants.O_NOFOLLOW||0));
  let hash=createHash('sha256'),prefix=Buffer.alloc(0);
  try {
    const live=await fd.stat();
    if(!live.isFile()||live.dev!==st.dev||live.ino!==st.ino||(size!==null&&live.size!==size))
      fail('OPEN_INODE_RACE');
    for await(const b of fd.createReadStream({autoClose:false,highWaterMark:1024*1024})){
      if(prefix.length<32)prefix=Buffer.concat([prefix,b.subarray(0,32-prefix.length)]);
      hash.update(b);
    }
    const after=await fd.stat();
    if(after.mtimeMs!==live.mtimeMs||after.size!==live.size||
       after.ino!==live.ino||after.dev!==live.dev)
      fail('MUTATED_DURING_SHA');
    if(hash.digest('hex')!==sha)fail('FILE_SHA_MISMATCH');
    if(kind==='fullversion'||kind==='png'||kind==='webp')
      byteHeaders(prefix,kind);
  }finally{await fd.close();}
}
export async function verifyPrivateFiles({fullversion,furniture,bundle,images,output}) {
  const args={fullversion,furniture,bundle,images,output};
  if(Object.keys(args).some(k=>!isAbsolute(args[k]||'')))fail('ABSOLUTE_PRIVATE_PATHS_REQUIRED');
  const root=resolve(process.cwd());
  for(const p of Object.values(args)){
    if(resolve(p)===root || resolve(p).startsWith(root+sep))
      fail('PRIVATE_INPUT_OR_OUTPUT_INSIDE_REPOSITORY');
  }
  for(const dir of [images,dirname(output)]){
    const st=await lstat(dir);
    if(st.isSymbolicLink()||!st.isDirectory()||
       (await realpath(dir))!==resolve(dir))fail('PRIVATE_DIRECTORY_ALIAS');
  }
  try{await lstat(output);fail('NO_CLOBBER_OUTPUT_EXISTS')}catch(e){
    if(e?.message==='01D_IMAGE_PROOF_NO_CLOBBER_OUTPUT_EXISTS')throw e;
    if(e?.code!=='ENOENT')throw e;
  }
  if([fullversion,furniture,bundle].some(p=>dirname(p)===dirname(output)) ||
     resolve(images)===resolve(dirname(output)))fail('OUTPUT_MUST_BE_SEPARATE');
  const seen=new Set();
  await verifyPinned(fullversion,{sha:hashPath(SOURCE.externalFullVersion+'\n'),size:SOURCE.externalFullVersion.length+1,kind:'fullversion'},seen);
  await verifyPinned(furniture,{sha:SOURCE.furnitureSha256,size:SOURCE.furnitureBytes},seen);
  await verifyPinned(bundle,{sha:SOURCE.bundleSha256,size:SOURCE.bundleBytes},seen);
  for(const p of SOURCE_ONLY_SAMPLES) {
    await verifyPinned(join(images,p.itemId+'-steam1253-reconstructed.png'),
      {sha:p.steamDerivedPngSha256,kind:'png',size:null},seen);
    await verifyPinned(join(images,p.itemId+'-steam1253-lossless160.webp'),
      {sha:p.steamLossless160WebpSha256,kind:'webp',size:null},seen);
  }
  return createHoldManifest({privateFileProof:'PINNED_FILE_SHA_VERIFIED'});
}
export function parseCli(argv) {
  if(argv.length!==expectedKeys.length*2)fail('MISSING_OR_UNKNOWN_FLAGS');
  const fields={};
  for(let i=0;i<argv.length;i+=2) {
    const k=argv[i];
    if(!k.startsWith('--')||!expectedKeys.includes(k.slice(2)) ||
       Object.hasOwn(fields,k.slice(2)) || !argv[i+1] || argv[i+1].startsWith('--'))
      fail('MISSING_DUPLICATE_OR_UNKNOWN_FLAG');
    fields[k.slice(2)]=argv[i+1];
  }
  if(Object.keys(fields).length!==expectedKeys.length)fail('CLI_FIELDS_MISSING');
  return fields;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=parseCli(process.argv.slice(2));
  const out=await verifyPrivateFiles(args);
  const fd=await open(args.output,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|(constants.O_NOFOLLOW||0),0o600);
  try{await fd.writeFile(JSON.stringify(out,null,2)+'\n','utf8');await fd.sync();}
  finally{await fd.close();}
  console.log(JSON.stringify({privateHoldManifestWritten:true,verifiedSteamSampleCount:3,
    publicImages:0,sourcePlatform:'Steam/Windows',switchSameBuildVerified:false}));
}
