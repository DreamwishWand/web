import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {SOURCE,TARGET,SOURCE_ONLY_SAMPLES,createHoldManifest,validateManifestInputs,parseCli,verifyPrivateFiles} from '../scripts/asset-research/01d-v1253-image-consumer-hold.mjs';

test('R14 same Steam FullVersion three real sample SHAs are only a private HOLD, never public Image Resolver rows',()=>{
  assert.equal(validateManifestInputs(),true);
  const hold=createHoldManifest();
  assert.equal(hold.schema,'wand.01d.v1253-item-image-consumer-hold@1');
  assert.equal(hold.source.externalFullVersion,SOURCE.externalFullVersion);
  assert.equal(hold.target.buildID,TARGET.buildID);
  assert.equal(hold.target.schema,626);
  assert.equal(hold.source.nativeItemCount,6233);
  assert.equal(hold.evidence.provenSteamSampleCount,3);
  assert.equal(hold.evidence.fullCatalogueImageCoverage,'UNKNOWN');
  assert.equal(hold.evidence.privateFileProof,'NOT_RUN');
  assert.deepEqual(hold.evidence.validatedItemIds,['40000047','40002422','40006096']);
  assert.equal(hold.bridgeTo08Web.acceptedByCurrentResolver,false);
  assert.equal(hold.bridgeTo08Web.currentResolverTarget.schema,624);
  assert.equal(hold.bridgeTo08Web.currentResolverPathVersion,'v1.24.13');
  assert.deepEqual(hold.publicProjection.items,{});
  assert.equal(hold.publicProjection.publishAllowed,false);
  assert.equal(hold.publicProjection.publicImagesEnabled,false);
  assert.equal(hold.rights.rightsHolderLicence,'UNKNOWN');
  assert.equal(hold.target.switchPngSha256VerifiedCount,0);
  assert.equal(hold.evidence.imageShaPairs.every(x=>x.switchImageSha256===null && x.switchVisibility==='UNKNOWN'),true);
});
test('R14 wrong Steam build, source original sha or Nintendo Switch target build/schema fail closed',()=>{
  assert.throws(()=>validateManifestInputs({source:{...SOURCE,externalFullVersion:'v1.25.0'}}),/WRONG_STEAM_BUILD/);
  assert.throws(()=>validateManifestInputs({source:{...SOURCE,furnitureSha256:'f'.repeat(64)}}),/WRONG_STEAM_BUILD/);
  assert.throws(()=>validateManifestInputs({source:{...SOURCE,bundleBytes:1}}),/WRONG_STEAM_BUILD/);
  assert.throws(()=>validateManifestInputs({target:{...TARGET,buildID:'52BD625D9B4E0053'}}),/WRONG_SWITCH_TARGET_BUILD/);
  assert.throws(()=>validateManifestInputs({target:{...TARGET,schema:624}}),/WRONG_SWITCH_TARGET_BUILD/);
});
test('R14 duplicate, missing, malformed GUID, forged or missing asset hash rejected',()=>{
  assert.throws(()=>validateManifestInputs({samples:[SOURCE_ONLY_SAMPLES[0],SOURCE_ONLY_SAMPLES[0],SOURCE_ONLY_SAMPLES[2]]}),/DUPLICATE_OR_MISSING/);
  assert.throws(()=>validateManifestInputs({samples:SOURCE_ONLY_SAMPLES.slice(0,2)}),/DUPLICATE_OR_MISSING/);
  assert.throws(()=>validateManifestInputs({samples:[{...SOURCE_ONLY_SAMPLES[0],iconGuid:'c'.repeat(32)},...SOURCE_ONLY_SAMPLES.slice(1)]}),/SAMPLE_OR_DERIVATIVE/);
  assert.throws(()=>validateManifestInputs({samples:[{...SOURCE_ONLY_SAMPLES[0],steamDerivedPngSha256:null},...SOURCE_ONLY_SAMPLES.slice(1)]}),/SAMPLE_OR_DERIVATIVE/);
});
test('R14 release flag true, missing, or guessed status cannot be promoted',()=>{
  assert.throws(()=>createHoldManifest({releaseFlag:true}),/UNKNOWN_OR_ENABLED_RELEASE_FLAG/);
  assert.throws(()=>createHoldManifest({releaseFlag:'OWNER_APPROVED'}),/UNKNOWN_OR_ENABLED_RELEASE_FLAG/);
  assert.throws(()=>createHoldManifest({privateFileProof:'INDEPENDENT_QA_PASS'}),/UNRECOGNIZED_PRIVATE_PROOF/);
});
test('R14 CLI requires every private source and rejects duplicate/unknown public promotion flag',()=>{
  const good=['--fullversion','/private/FullVersion.txt','--furniture','/private/Furniture.json','--bundle','/private/furniture.bundle','--images','/private/images','--output','/private/report/hold.json'];
  assert.equal(parseCli(good).fullversion,'/private/FullVersion.txt');
  assert.throws(()=>parseCli([...good,'--release','true']),/MISSING_OR_UNKNOWN_FLAGS/);
  assert.throws(()=>parseCli(['--fullversion','a','--fullversion','b',...good.slice(4)]),/DUPLICATE_OR_UNKNOWN/);
  assert.equal(parseCli(good.slice(0,-2)).output,undefined);
  assert.throws(()=>parseCli(good.slice(0,-4)),/MISSING_OR_UNKNOWN_FLAGS/);
});
test('R14 private files reject symlink directories, existing output and false first-party original bytes before publication',async()=>{
  const root=mkdtempSync(join(tmpdir(),'wand-01d-r14-contract-'));
  try {
    const images=join(root,'images'),out=join(root,'out'),source=join(root,'source');
    mkdirSync(images);mkdirSync(out);mkdirSync(source);
    const fullversion=join(source,'FullVersion.txt'),furniture=join(source,'Furniture.json'),bundle=join(source,'furniture.bundle');
    writeFileSync(fullversion,SOURCE.externalFullVersion+'\n');
    writeFileSync(furniture,'FORGED_823316');
    writeFileSync(bundle,'FORGED_9fbf4');
    const args={fullversion,furniture,bundle,images,output:join(out,'hold.json')};
    await assert.rejects(()=>verifyPrivateFiles(args),/MISSING_SYMLINK_SIZE/);
    const link=join(root,'link');symlinkSync(images,link,'dir');
    await assert.rejects(()=>verifyPrivateFiles({...args,images:link}),/PRIVATE_DIRECTORY_ALIAS/);
    writeFileSync(args.output,'not clobber');
    await assert.rejects(()=>verifyPrivateFiles(args),/NO_CLOBBER_OUTPUT_EXISTS/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('R14 repaired authority and actual OS path boundaries deny before hashing',async()=>{
  const root=mkdtempSync(join(tmpdir(),'wand-794-repair-'));
  const repoFixture=mkdtempSync(join(process.cwd(),'.wand-794-synthetic-'));
  try{
    const source=join(root,'source'),images=join(root,'images'),out=join(root,'out');
    mkdirSync(source);mkdirSync(images);mkdirSync(out);mkdirSync(join(images,'child'));
    const fullversion=join(source,'FullVersion.txt'),furniture=join(source,'Furniture.json'),bundle=join(source,'bundle');
    writeFileSync(fullversion,SOURCE.externalFullVersion+'\n');
    writeFileSync(furniture,'synthetic wrong size');writeFileSync(bundle,'synthetic wrong size');
    const args={fullversion,furniture,bundle,images,output:join(out,'hold.json')};
    assert.equal(createHoldManifest({privateFileProof:'PINNED_FILE_SHA_VERIFIED'}).evidence.privateFileProof,'NOT_RUN');
    const repoFile=join(repoFixture,'FullVersion.txt');writeFileSync(repoFile,SOURCE.externalFullVersion+'\n');
    const alias=join(root,'repo-alias');symlinkSync(repoFixture,alias,'dir');
    await assert.rejects(verifyPrivateFiles({...args,fullversion:join(alias,'FullVersion.txt')}),/PRIVATE_DIRECTORY_ALIAS|PRIVATE_INPUT_OR_OUTPUT_INSIDE_REPOSITORY/);
    await assert.rejects(verifyPrivateFiles({...args,output:out+'/../source/hold.json'}),/PRIVATE_DIRECTORY_ALIAS|OUTPUT_MUST_BE_SEPARATE/);
    await assert.rejects(verifyPrivateFiles({...args,output:join(images,'child','hold.json')}),/OUTPUT_MUST_BE_SEPARATE/);
    await assert.rejects(verifyPrivateFiles({...args,output:join(root,'ancestor.json')}),/OUTPUT_MUST_BE_SEPARATE/);
    const other=join(root,'other-checkout');mkdirSync(other);writeFileSync(join(other,'.git'),'gitdir: dummy');
    await assert.rejects(verifyPrivateFiles({...args,output:join(other,'hold.json')}),/PRIVATE_INPUT_OR_OUTPUT_INSIDE_REPOSITORY/);
    const imageAlias=join(root,'image-alias');symlinkSync(images,imageAlias,'dir');
    await assert.rejects(verifyPrivateFiles({...args,images:imageAlias}),/PRIVATE_DIRECTORY_ALIAS/);
    await assert.rejects(verifyPrivateFiles(args),/MISSING_SYMLINK_SIZE/);
    assert.equal(readFileSync(furniture,'utf8'),'synthetic wrong size');
    for(const p of [args.output,join(source,'hold.json'),join(images,'child','hold.json'),join(root,'ancestor.json'),join(other,'hold.json')])assert.equal(existsSync(p),false);
  }finally{rmSync(root,{recursive:true,force:true});rmSync(repoFixture,{recursive:true,force:true});}
});

test('R14 verifier-only label: test-local synthetic pins, nine actual reads, memory-only HOLD and no file writes',async()=>{
  // This temporary module substitutes synthetic fixture hashes ONLY. The
  // committed verifier's original Steam pins are untouched; no media proof.
  const root=mkdtempSync(join(tmpdir(),'wand-794-positive-'));
  const codeRoot=mkdtempSync(join(process.cwd(),'.wand-794-testmodule-'));
  try{
    const source=join(root,'source'),images=join(root,'images'),out=join(root,'out');
    mkdirSync(source);mkdirSync(images);mkdirSync(out);
    const fullversion=join(source,'FullVersion.txt'),furniture=join(source,'Furniture.json'),bundle=join(source,'bundle');
    writeFileSync(fullversion,SOURCE.externalFullVersion+'\n');
    const f=Buffer.from('synthetic furniture'),b=Buffer.from('synthetic bundle');
    writeFileSync(furniture,f);writeFileSync(bundle,b);
    const sha=x=>createHash('sha256').update(x).digest('hex');
    let text=readFileSync(resolve('scripts/asset-research/01d-v1253-image-consumer-hold.mjs'),'utf8');
    text=text.replace(SOURCE.furnitureSha256,sha(f)).replace('furnitureBytes: '+SOURCE.furnitureBytes,'furnitureBytes: '+f.length)
      .replace(SOURCE.bundleSha256,sha(b)).replace('bundleBytes: '+SOURCE.bundleBytes,'bundleBytes: '+b.length);
    for(const [i,p] of SOURCE_ONLY_SAMPLES.entries()){
      const png=Buffer.alloc(32);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(512,16);png.writeUInt32BE(512,20);png[24]=8;png[25]=6;png[31]=i+1;
      const webp=Buffer.alloc(32);webp.write('RIFF');webp.writeUInt32LE(24,4);webp.write('WEBP',8);webp.write('VP8L',12);webp[20]=0x2f;webp.writeUInt32LE(159|(159<<14),21);webp[31]=i+1;
      writeFileSync(join(images,p.itemId+'-steam1253-reconstructed.png'),png);
      writeFileSync(join(images,p.itemId+'-steam1253-lossless160.webp'),webp);
      text=text.replace(p.steamDerivedPngSha256,sha(png)).replace(p.steamLossless160WebpSha256,sha(webp));
    }
    // Keep the copy under a checkout-shaped location so its source-relative
    // repository fence cannot encompass the isolated private fixture root.
    const moduleDir=join(codeRoot,'scripts','asset-research');mkdirSync(moduleDir,{recursive:true});
    const script=join(moduleDir,'hold.mjs');writeFileSync(script,text);
    const output=join(out,'hold.json'),args=['--fullversion',fullversion,'--furniture',furniture,'--bundle',bundle,'--images',images];
    const mod=await import(pathToFileURL(script).href);
    const receipt=await mod.verifyPrivateFiles({fullversion,furniture,bundle,images});
    assert.equal(receipt.evidence.privateFileProof,'PINNED_FILE_SHA_VERIFIED');
    assert.deepEqual(receipt.publicProjection.items,{});assert.equal(receipt.publicProjection.publishAllowed,false);
    assert.equal(receipt.writerEnabled,false);assert.equal(receipt.target.sameBuildSwitchOriginalVerified,false);
    const run=(extra=[])=>spawnSync(process.execPath,[script,...args,...extra],{encoding:'utf8',timeout:20000});
    const first=run();assert.equal(first.status,0,first.stderr);
    const summary=JSON.parse(first.stdout);assert.equal(summary.privateHoldManifestWritten,false);
    assert.equal(summary.privateHoldManifestVerified,true);assert.equal(summary.reportSha256,sha(JSON.stringify(receipt,null,2)+'\n'));
    const hinted=run(['--output',output]);assert.equal(hinted.status,0,hinted.stderr);
    assert.equal(JSON.parse(hinted.stdout).privateHoldManifestWritten,false);assert.equal(existsSync(output),false);
    writeFileSync(output,'sentinel');assert.notEqual(run(['--output',output]).status,0);
    assert.equal(readFileSync(output,'utf8'),'sentinel');rmSync(output);
    // Simulate the QA997 output-directory relocation boundary. The report
    // producer has no output write primitive, so no new file can be created.
    const relocated=join(source,'relocated');mkdirSync(relocated);
    const badHint=join(relocated,'late.json');
    assert.notEqual(run(['--output',badHint]).status,0);assert.equal(existsSync(badHint),false);
    writeFileSync(join(images,SOURCE_ONLY_SAMPLES[2].itemId+'-steam1253-lossless160.webp'),'corrupt');
    assert.notEqual(run().status,0);assert.equal(existsSync(output),false);
  }finally{rmSync(root,{recursive:true,force:true});rmSync(codeRoot,{recursive:true,force:true});}
});
