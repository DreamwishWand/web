// Independent PR794 QA: synthetic filesystem only; no game images or Save bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,symlink,link,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {runInNewContext} from 'node:vm';
import {SOURCE,TARGET,SOURCE_ONLY_SAMPLES,createHoldManifest,validateManifestInputs,parseCli,verifyPrivateFiles} from './01d-v1253-image-consumer-hold.mjs';
import {validateItemImageCatalog,itemImageAssetPath,ITEM_IMAGE_TARGET} from '../../src/lib/item-media/public-item-images.mjs';
const S='cb8a08bc64e765c7bf328169300602d4d0b97249',M='1024d4207245ed99126abedcf3452ef670a44c6a',L='9972e712a58aefa14003f591dc52b911b823ef19';
const P='scripts/asset-research/01d-v1253-image-consumer-hold.mjs';
const pins=[[P,'c1050811339a0b8bbe092c9c47e663fe1afda5ec'],['tests/01d-v1253-image-consumer-hold.test.mjs','4aa865fda3a7ebba255766a6f7382becc31da3f9'],['docs/core/01d-r14-v1253-image-consumer-contract-hold-20261108.md','b7d11f246c2b5c3df3cd866d54f1de6dc0ff18c8']];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
test('exact source original3, latest-main absent, unchanged actual resolver, QA-only2',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.deepEqual(git('diff','--name-status',M,S).split('\n').sort(),pins.map(([p])=>'A\t'+p).sort());
 for(const [p,sha] of pins){assert.equal(git('rev-parse',S+':'+p),sha);assert.throws(()=>git('cat-file','-e',L+':'+p))}
 const r='src/lib/item-media/public-item-images.mjs';
 assert.equal(git('rev-parse',S+':'+r),'05bb81a0608785aab739a29c78bd2d7f842322aa');
 assert.equal(git('rev-parse',L+':'+r),'05bb81a0608785aab739a29c78bd2d7f842322aa');
 assert.equal(git('diff','--name-status',S,'HEAD').split('\n').length,2);
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&x.includes('04qr-w-pr794')));
});
test('private HOLD is not resolver catalog; all flags false, three pinned IDs, all Switch evidence unknown',()=>{
 const h=createHoldManifest();
 assert.equal(h.evidence.privateFileProof,'NOT_RUN');
 assert.equal(h.source.nativeItemCount,6233);assert.equal(h.evidence.provenSteamSampleCount,3);assert.equal(h.evidence.fullCatalogueImageCoverage,'UNKNOWN');
 assert.equal(h.target.buildID,'9A239D3DB569756D');assert.equal(h.target.schema,626);
 assert.equal(h.target.sameBuildSwitchOriginalVerified,false);
 for(const [k,v] of Object.entries(h.target))if(k.endsWith('VerifiedCount'))assert.equal(v,0,k);
 for(const k of ['writerEnabled','applyEnabled','cloudEnabled','providerEnabled','communityPublicEnabled'])assert.equal(h[k],false,k);
 assert.deepEqual(h.publicProjection.items,{});assert.equal(h.publicProjection.publicUrl,null);assert.equal(h.publicProjection.publishAllowed,false);assert.equal(h.publicProjection.publicImagesEnabled,false);
 assert.equal(h.rights.rightsHolderLicence,'UNKNOWN');assert.equal(h.rights.perImageTakedown,'NOT_RUN');
 assert.deepEqual(h.evidence.validatedItemIds,['40000047','40002422','40006096']);
 for(const x of h.evidence.imageShaPairs){assert.equal(x.switchImageSha256,null);assert.equal(x.switchVisibility,'UNKNOWN');assert.equal(x.status,'CANDIDATE_NOT_RELEASED')}
 assert.throws(()=>validateItemImageCatalog(h),/SOURCE_OR_VERSION_UNVERIFIED/);
 assert.throws(()=>validateItemImageCatalog(h.publicProjection),/SOURCE_OR_VERSION_UNVERIFIED/);
 assert.throws(()=>validateItemImageCatalog({...h,schema:'wand.item-images.public-catalog-lossless@1'}),/SOURCE_OR_VERSION_UNVERIFIED/);
 assert.equal(itemImageAssetPath('40000047',h),null);
 assert.equal(ITEM_IMAGE_TARGET.schema,624);
 console.log('QRW794_HOLD_NOT_PUBLIC_ACTUAL_RESOLVER_PASS');
});
test('wrong platform/fullversion/build/size/hash, wrong sample pins and promotion flags denied',()=>{
 for(const key of ['platform','gameVersion','externalFullVersion','furnitureSha256','bundleSha256','furnitureBytes','bundleBytes'])assert.throws(()=>validateManifestInputs({source:{...SOURCE,[key]:'wrong'}}),/WRONG_STEAM_BUILD_OR_SHA/,key);
 for(const key of ['platform','gameVersion','buildID','schema'])assert.throws(()=>validateManifestInputs({target:{...TARGET,[key]:'wrong'}}),/WRONG_SWITCH_TARGET_BUILD/,key);
 for(const key of ['itemId','iconGuid','nativeTextureName','nativeFormat','encodedSha256','steamDerivedPngSha256','steamLossless160WebpSha256'])assert.throws(()=>validateManifestInputs({samples:[{...SOURCE_ONLY_SAMPLES[0],[key]:'wrong'},...SOURCE_ONLY_SAMPLES.slice(1)]}),/NATIVE_SAMPLE_OR_DERIVATIVE_SHA_NOT_PINNED/,key);
 for(const v of [true,null,1,'false','OWNER_APPROVED'])assert.throws(()=>createHoldManifest({releaseFlag:v}),/UNKNOWN_OR_ENABLED_RELEASE_FLAG/);
 assert.throws(()=>createHoldManifest({privateFileProof:'PASS'}),/UNRECOGNIZED_PRIVATE_PROOF/);
});
test('caller cannot self-issue PINNED_FILE_SHA_VERIFIED without any file witness',()=>{
 // No file I/O is made here. A verified receipt must be verifier-owned,
 // rather than accepting a magic caller-supplied string.
 const h=createHoldManifest({privateFileProof:'PINNED_FILE_SHA_VERIFIED'});
 assert.notEqual(h.evidence.privateFileProof,'PINNED_FILE_SHA_VERIFIED','FORGED_PRIVATE_FILE_PROOF_ACCEPTED_WITHOUT_FILES');
});
async function fixture(fn){
 const root=await mkdtemp(join(tmpdir(),'qrw794-'));
 const source=join(root,'source'),images=join(root,'images'),out=join(root,'out');
 await Promise.all([mkdir(source),mkdir(images),mkdir(out)]);
 const fullversion=join(source,'FullVersion.txt'),furniture=join(source,'Furniture.json'),bundle=join(source,'bundle');
 await writeFile(fullversion,SOURCE.externalFullVersion+'\n');await writeFile(furniture,'synthetic wrong source');await writeFile(bundle,'synthetic wrong bundle');
 const args={fullversion,furniture,bundle,images,output:join(out,'hold.json')};
 try{await fn({root,source,images,out,args})}finally{await rm(root,{recursive:true,force:true})}
}
test('ordinary filesystem denial: direct repository input, final symlink, directory alias, existing output, same parent, wrong SHA/size',()=>fixture(async x=>{
 const {args,root,source,images,out}=x;
 await assert.rejects(verifyPrivateFiles({...args,fullversion:join(process.cwd(),'synthetic-not-present')}),/PRIVATE_INPUT_OR_OUTPUT_INSIDE_REPOSITORY/);
 const alias=join(root,'fullversion-link');await symlink(args.fullversion,alias);
 await assert.rejects(verifyPrivateFiles({...args,fullversion:alias}),/MISSING_SYMLINK_SIZE/);
 const dirAlias=join(root,'images-link');await symlink(images,dirAlias,'dir');
 await assert.rejects(verifyPrivateFiles({...args,images:dirAlias}),/PRIVATE_DIRECTORY_ALIAS/);
 await writeFile(args.output,'sentinel');await assert.rejects(verifyPrivateFiles(args),/NO_CLOBBER_OUTPUT_EXISTS/);assert.equal(await readFile(args.output,'utf8'),'sentinel');await rm(args.output);
 await assert.rejects(verifyPrivateFiles({...args,output:join(source,'hold.json')}),/OUTPUT_MUST_BE_SEPARATE/);
 await assert.rejects(verifyPrivateFiles(args),/MISSING_SYMLINK_SIZE/);
 await writeFile(args.furniture,Buffer.alloc(SOURCE.furnitureBytes));
 await assert.rejects(verifyPrivateFiles(args),/FILE_SHA_MISMATCH/);
 await assert.rejects(access(args.output),e=>e.code==='ENOENT');
}));
test('repository file via external ancestor symlink denied before content read',()=>fixture(async x=>{
 const repoTemp=await mkdtemp(join(process.cwd(),'.qrw794-synthetic-'));
 try{
  await writeFile(join(repoTemp,'FullVersion.txt'),SOURCE.externalFullVersion+'\n');
  const alias=join(x.root,'repo-alias');await symlink(repoTemp,alias,'dir');
  await assert.rejects(verifyPrivateFiles({...x.args,fullversion:join(alias,'FullVersion.txt')}),/PRIVATE_INPUT_OR_OUTPUT_INSIDE_REPOSITORY|PRIVATE_DIRECTORY_ALIAS/,'REPO_ANCESTOR_SYMLINK_NOT_DENIED');
 }finally{await rm(repoTemp,{recursive:true,force:true})}
}));
test('dotdot lexical output alias into original directory denied before source hashing',()=>fixture(async x=>{
 const alias=x.out+'/../source/hold.json';
 await assert.rejects(verifyPrivateFiles({...x.args,output:alias}),/OUTPUT_MUST_BE_SEPARATE|PRIVATE_DIRECTORY_ALIAS/,'DOTDOT_OUTPUT_ALIAS_NOT_DENIED');
}));
test('output nested inside original image directory denied before source hashing',()=>fixture(async x=>{
 const child=join(x.images,'child');await mkdir(child);
 await assert.rejects(verifyPrivateFiles({...x.args,output:join(child,'hold.json')}),/OUTPUT_MUST_BE_SEPARATE|PRIVATE_DIRECTORY_ALIAS/,'NESTED_IMAGE_OUTPUT_NOT_DENIED');
}));
test('exact source header helper on synthetic PNG/WebP bytes (not pinned-file or raster proof)',()=>{
 const text=git('show',S+':'+P);
 const begin=text.indexOf('function byteHeaders('),end=text.indexOf('export function validateManifestInputs');
 assert.ok(begin>=0&&end>begin);
 const header=runInNewContext(text.slice(begin,end)+';byteHeaders',{fail:code=>{throw Error(code)}});
 const png=Buffer.alloc(32);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(512,16);png.writeUInt32BE(512,20);png[24]=8;png[25]=6;
 const webp=Buffer.alloc(32);webp.write('RIFF');webp.writeUInt32LE(24,4);webp.write('WEBP',8);webp.write('VP8L',12);webp[20]=0x2f;const bits=159|(159<<14);webp.writeUInt32LE(bits,21);
 assert.doesNotThrow(()=>header(png,'png'));assert.doesNotThrow(()=>header(webp,'webp'));
 for(const i of [0,16,20,24,25]){const b=Buffer.from(png);b[i]^=1;assert.throws(()=>header(b,'png'),/PNG_RGBA512/)}
 for(const i of [0,8,12,20,21,23]){const b=Buffer.from(webp);b[i]^=1;assert.throws(()=>header(b,'webp'),/WEBP_LOSSLESS160/)}
 assert.throws(()=>header(png.subarray(0,25),'png'),/PNG_RGBA512/);assert.throws(()=>header(webp.subarray(0,25),'webp'),/WEBP_LOSSLESS160/);
 console.log('QRW794_EXACT_HEADER_HELPER_SYNTHETIC_ONLY_PASS');
});
