import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  assert.throws(()=>parseCli(good.slice(0,-2)),/MISSING_OR_UNKNOWN_FLAGS/);
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
