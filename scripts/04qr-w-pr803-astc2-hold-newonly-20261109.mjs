// 04 QR-W PR803: only new Source2 metadata; Owner-private media bytes are NOT_RUN.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {SWITCH_ASTC2_SCHEMA,PLATFORM,makeSwitchAstc2Hold,validateSwitchAstc2Hold}
 from './asset-research/01d-switch1253-format50-two-raster-hold.mjs';

const SOURCE='c03b51d65f2a93f5cb5d728fb7b3a4a33e8cd758';
const PARENT='3921e33de23ce042db48d2a50a9495d3b8a79881';
const source=new Map([
 ['scripts/asset-research/01d-switch1253-format50-two-raster-hold.mjs','82f0e621527619717955e1f676c7856f657ee40c'],
 ['tests/01d-switch1253-format50-two-raster-hold.test.mjs','cc375baf9339dceea256e9d058799003f88c96d6']
]);
const audit=[
 '.github/workflows/04qr-w-pr803-astc2-hold-newonly-20261109.yml',
 'scripts/04qr-w-pr803-astc2-hold-newonly-20261109.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const changed=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
assert.deepEqual(changed(PARENT,SOURCE),[...source.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(changed(SOURCE,'HEAD'),audit);
for(const [name,sha] of source){
 assert.equal(git('rev-parse',SOURCE+':'+name),sha);
 assert.equal(git('hash-object',name),sha);
}
assert.equal(git('diff','--name-only',PARENT,SOURCE,'--','src/','static/','supabase/','.github/workflows/pages.yml'),'');
console.log('QRW803_SOURCE2_IMMUTABLE_QA2_ONLY_ZERO_PUBLIC_PRODUCT_MEDIA_DIFF_PASS');

const clean=makeSwitchAstc2Hold();
assert.equal(validateSwitchAstc2Hold(clean),true);
assert.equal(clean.schema,SWITCH_ASTC2_SCHEMA);
assert.equal(clean.platform.name,'Nintendo Switch');
assert.equal(clean.platform.gameVersion,'1.25.3');
assert.equal(clean.platform.buildID,'9A239D3DB569756D');
assert.equal(clean.platform.schema,626);
assert.deepEqual(clean.candidates.map(x=>x.itemId),['40000047','40002422']);
assert.equal(clean.converter.sourceFormat,'UNITY_TEXTURE_FORMAT_50_ASTC_6X6_LDR');
assert.equal(clean.converter.gobBlockHeight,8);
assert.equal(clean.converter.excludedGobBlockHeight,4);
assert.equal(clean.converter.rasterOrientation,'FLIP_TOP_BOTTOM_TO_UI_DISPLAY');
assert.equal(clean.converter.interpolationIdenticalToDevice,'NOT_RUN');
assert.equal(clean.converter.decoderIndependentDeviceParity,'NOT_RUN');
assert.equal(clean.evidence.correctGobHeightAstcBlocksOk,3698);
assert.equal(clean.evidence.wrongGobHeightAstcBlocksRejected,862);
assert.equal(clean.evidence.originalStreamShaVerified,2);
assert.equal(clean.evidence.reconstructedPngSHAStored,2);
assert.equal(clean.evidence.derivedWebp160SHAStored,2);
const SHA=/^[0-9a-f]{64}$/;
for(const s of clean.candidates){
 assert.deepEqual(s.blockFootprint,[6,6]);
 assert.deepEqual(s.blockGrid,[43,43]);
 assert.equal(s.gpuGobBlockHeight,8);
 assert.equal(s.blockLinearByteLength,45056);
 assert.equal(s.linearAstcByteLength,29584);
 assert.equal(s.validAstcBlocks,1849);
 assert.equal(s.invalidAstcBlocks,0);
 assert.equal(s.unsupportedAlternateGobHeight,4);
 assert.equal(s.alternateInvalidAstcBlocks,431);
 for(const k of ['nativeCompressedSha256','linearAstcSha256',
 'orientedDecodedRgbaSha256','reconstructedPngSha256',
 'derivedWebpLossless160Sha256','whiteCompositeSha256','darkCompositeSha256'])assert.match(s[k],SHA);
 assert.ok(s.hiddenRgbNonzeroAlphaZeroPixels<=s.alphaZeroPixels);
 assert.equal(s.firstPartyPngSha256,null);
 assert.equal(s.releaseVisibility,'UNKNOWN');
 assert.equal(s.releaseRights,'UNKNOWN');
 assert.equal(s.publicEligible,false);
}
console.log('QRW803_SWITCH1253_BID_SCHEMA_NATIVE_ASTC6X6_DERIVED2_PINNED_HOLD_PASS');

let total=0;
const negative=(label,edit)=>{
 const x=makeSwitchAstc2Hold();edit(x);
 assert.throws(()=>validateSwitchAstc2Hold(x),e=>e instanceof TypeError&&String(e).includes('SWITCH_ASTC6X6_R14_'),label);
 total++;
};
const bad=[
 ['different Platform',x=>{x.platform.name='SteamWindows';}],
 ['Steam swapped bundle SHA',x=>{x.platform.nativeSwitchIconBundleSha256='9fbf4b75e50bd08b7479e4dc372ca0568254051c64872b66ba9332ecf139cdb0';}],
 ['wrong game version',x=>{x.platform.gameVersion='1.25.0';}],
 ['wrong BID',x=>{x.platform.buildID='52BD625D9B4E0053';}],
 ['old schema624',x=>{x.platform.schema=624;}],
 ['native stream SHA',x=>{x.candidates[0].nativeCompressedSha256='f'.repeat(64);}],
 ['linear ASTC SHA',x=>{x.candidates[1].linearAstcSha256='f'.repeat(64);}],
 ['PNG reconstruction SHA',x=>{x.candidates[0].reconstructedPngSha256='f'.repeat(64);}],
 ['WebP derivative SHA',x=>{x.candidates[1].derivedWebpLossless160Sha256='f'.repeat(64);}],
 ['wrong alpha0',x=>{x.candidates[0].alphaZeroPixels=0;}],
 ['blockheight4',x=>{x.converter.gobBlockHeight=4;}],
 ['native blockheight4',x=>{x.candidates[1].gpuGobBlockHeight=4;}],
 ['accepted bad blocks',x=>{x.candidates[0].alternateInvalidAstcBlocks=0;}],
 ['wrong linear length',x=>{x.candidates[1].linearAstcByteLength=45056;}],
 ['wrong orientation',x=>{x.converter.rasterOrientation='UNFLIPPED';}],
 ['device parity forged',x=>{x.converter.decoderIndependentDeviceParity='PASS';}],
 ['native PNG source forged',x=>{x.candidates[0].firstPartyPngSha256='f'.repeat(64);}],
 ['duplicate ItemID',x=>{x.candidates[1]=x.candidates[0];}],
 ['missing candidate',x=>{x.candidates.pop();}],
 ['wrong ItemID',x=>{x.candidates[0].itemId='40000048';}],
 ['all furniture inferred',x=>{x.evidence.reconstructedPngSHAStored=6233;}],
 ['wrong target web resolver',x=>{x.webConsumer.supportedByCurrentResolver=true;}],
 ['release rows 2',x=>{x.webConsumer.releaseQualifiedRows=2;}],
 ['public right assumed',x=>{x.rights.rightsHolderLicence='GRANTED';}],
 ['CDN purge passed',x=>{x.rights.cdnRevocation='PASS';}],
 ['publish enabled',x=>{x.publicProjection.publishAllowed=true;}],
 ['media public ON',x=>{x.publicProjection.mediaPublic=true;}],
 ['public row injected',x=>{x.publicProjection.items={'40000047':{url:'https://invalid.example/image.webp'}};}],
 ['manifest URL',x=>{x.publicProjection.manifestUrl='https://invalid.example/image.webp';}],
 ['writer ON',x=>{x.safety.writer=true;}],
 ['provider ON',x=>{x.safety.provider=true;}],
 ['cloud ON',x=>{x.safety.cloud=true;}],
 ['unknown root URL',x=>{x.assetUrl='https://invalid.example/image.webp';}],
 ['unknown root media flag',x=>{x.mediaPublic=true;}],
 ['unknown nested web URL',x=>{x.webConsumer.assetUrl='https://invalid.example/image.webp';}],
 ['unknown nested Item CDN',x=>{x.candidates[0].cdnUrl='https://invalid.example/image.webp';}],
 ['original private receipt SHA',x=>{x.evidence.privateReceiptSHA256='f'.repeat(64);}]
];
for(const [label,mutate] of bad)negative(label,mutate);
console.log('QRW803_NEGATIVE_MUTATIONS_'+total+'_BUILD_ASTC_SHA_UNKNOWN_ROOT_RIGHTS_PUBLIC_WRITER_DENIED_PASS');

assert.deepEqual(clean.publicProjection.items,{});
assert.equal(clean.publicProjection.publishAllowed,false);
assert.equal(clean.publicProjection.mediaPublic,false);
assert.equal(clean.webConsumer.releaseQualifiedRows,0);
assert.equal(clean.evidence.nativeDevicePixelParityVerified,0);
assert.equal(clean.rights.rightsHolderLicence,'UNKNOWN');
assert.equal(clean.safety.publicRepoContainsOriginalMedia,false);
assert.equal(clean.safety.steamBundleNeverSubstitutedForSwitch,true);
const content=readFileSync('scripts/asset-research/01d-switch1253-format50-two-raster-hold.mjs','utf8');
assert.doesNotMatch(content,/data:image|base64,|<img|<canvas|fetch\(|writeFileSync|CloudUpload|service_role/);
console.log('QRW803_NO_PRIVATE_IMAGE_BYTES_NO_PUBLIC_MANIFEST_NO_WEB_PRODUCT_WRITER_PASS');
console.log('QRW803_INDEPENDENT_SOURCE_ONLY_SYNTHETIC_SCOPED_PASS_DEVICE_RIGHTS_REAL_PIXELS_NOT_RUN');
