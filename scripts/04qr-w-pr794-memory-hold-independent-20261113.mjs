// Independent QA-only: actual filesystem and synthetic pinned fixture bytes, no game media.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,linkSync,renameSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SOURCE,TARGET,SOURCE_ONLY_SAMPLES,createHoldManifest,verifyPrivateFiles} from './asset-research/01d-v1253-image-consumer-hold.mjs';
const S='31264fac3072119fdcf8f1be7efceb98d40c0ea4',B='1024d4207245ed99126abedcf3452ef670a44c6a',OLD='cb8a08bc64e765c7bf328169300602d4d0b97249';
const P='scripts/asset-research/01d-v1253-image-consumer-hold.mjs';
const pins={[P]:'63d5e239f6d229116dd6ee7d29b1c04260cae615','tests/01d-v1253-image-consumer-hold.test.mjs':'0ce35b8269c914155f77c098caef059bf32a6903','docs/core/01d-r14-v1253-image-consumer-contract-hold-20261108.md':'4d6984a4e619e99046285886e3410de5fd358b55'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
const text=readFileSync(P,'utf8');
function hold(x,proof){
 assert.equal(x.evidence.privateFileProof,proof);assert.deepEqual(x.publicProjection.items,{});
 assert.equal(x.publicProjection.publishAllowed,false);assert.equal(x.publicProjection.publicImagesEnabled,false);assert.equal(x.publicProjection.publicUrl,null);
 assert.equal(x.target.sameBuildSwitchOriginalVerified,false);assert.equal(x.target.switchPngSha256VerifiedCount,0);
 for(const k of ['writerEnabled','applyEnabled','cloudEnabled','providerEnabled','communityPublicEnabled'])assert.equal(x[k],false);
}
test('exact original3 repair3, QA-only2, no production file-write primitive or public proof mint',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>'A\t'+p).sort());
 assert.deepEqual(git('diff','--name-status',OLD,S).split('\n').sort(),Object.keys(pins).map(p=>'M\t'+p).sort());
 for(const [p,h] of Object.entries(pins)){assert.equal(git('rev-parse',S+':'+p),h);assert.equal(git('rev-parse','HEAD:'+p),h)}
 assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr794-memory-hold-20261113.yml','A\tscripts/04qr-w-pr794-memory-hold-independent-20261113.mjs'].sort());
 assert.doesNotMatch(text,/\b(?:O_CREAT|O_WRONLY|O_RDWR|writeFile|writePrivateReceipt|mkdir|rename|unlink)\b/);
 hold(createHoldManifest({privateFileProof:'PINNED_FILE_SHA_VERIFIED'}),'NOT_RUN');
 hold(createHoldManifest(),'NOT_RUN');
 assert.throws(()=>createHoldManifest({privateFileProof:'FORGED'}),/UNRECOGNIZED_PRIVATE_PROOF/);
 assert.throws(()=>createHoldManifest({target:{...TARGET,schema:624}}),/WRONG_SWITCH_TARGET_BUILD/);
});
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'qrw794-synthetic-')),codeRoot=mkdtempSync(join(process.cwd(),'.qrw794-copy-'));
 const source=join(root,'source'),images=join(root,'images'),out=join(root,'out');
 for(const p of [source,images,out])mkdirSync(p);
 const fullversion=join(source,'FullVersion.txt'),furniture=join(source,'Furniture.json'),bundle=join(source,'bundle');
 const files=new Map([[fullversion,Buffer.from(SOURCE.externalFullVersion+'\n')],[furniture,Buffer.from('QA fake furniture bytes')],[bundle,Buffer.from('QA fake bundle bytes')]]);
 let code=text.replace(SOURCE.furnitureSha256,sha(files.get(furniture))).replace('furnitureBytes: '+SOURCE.furnitureBytes,'furnitureBytes: '+files.get(furniture).length).replace(SOURCE.bundleSha256,sha(files.get(bundle))).replace('bundleBytes: '+SOURCE.bundleBytes,'bundleBytes: '+files.get(bundle).length);
 for(const [i,s] of SOURCE_ONLY_SAMPLES.entries()){
  const png=Buffer.alloc(32);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(512,16);png.writeUInt32BE(512,20);png[24]=8;png[25]=6;png[31]=41+i;
  const webp=Buffer.alloc(32);webp.write('RIFF');webp.writeUInt32LE(24,4);webp.write('WEBP',8);webp.write('VP8L',12);webp[20]=0x2f;webp.writeUInt32LE(159|(159<<14),21);webp[31]=51+i;
  files.set(join(images,s.itemId+'-steam1253-reconstructed.png'),png);files.set(join(images,s.itemId+'-steam1253-lossless160.webp'),webp);
  code=code.replace(s.steamDerivedPngSha256,sha(png)).replace(s.steamLossless160WebpSha256,sha(webp));
 }
 for(const [p,b] of files)writeFileSync(p,b);
 const dir=join(codeRoot,'scripts','asset-research');mkdirSync(dir,{recursive:true});const script=join(dir,'hold.mjs');writeFileSync(script,code);
 const args={fullversion,furniture,bundle,images},output=join(out,'receipt.json');
 const run=(extra=[])=>spawnSync(process.execPath,[script,...Object.entries(args).flatMap(([k,v])=>['--'+k,v]),...extra],{encoding:'utf8',timeout:20000});
 return {root,codeRoot,source,images,out,files,args,output,script,run,clean:()=>{rmSync(root,{recursive:true,force:true});rmSync(codeRoot,{recursive:true,force:true})}};
}
function unchanged(x){
 for(const [p,b] of x.files)assert.deepEqual(readFileSync(p),b);
 assert.deepEqual(readdirSync(x.out),[]);assert.equal(existsSync(x.output),false);
}
test('actual nine read fixture: memory receipt, exact CLI digest, no path/bytes leak or output writes',{timeout:30000},async()=>{
 const x=fixture();try{
  const m=await import(pathToFileURL(x.script).href);
  const receipt=await m.verifyPrivateFiles(x.args);hold(receipt,'PINNED_FILE_SHA_VERIFIED');
  const expected=sha(JSON.stringify(receipt,null,2)+'\n');
  for(const extra of [[],['--output',x.output]]){
   const r=x.run(extra);assert.equal(r.status,0,r.stderr);const o=JSON.parse(r.stdout);
   assert.equal(o.privateHoldManifestWritten,false);assert.equal(o.privateHoldManifestVerified,true);assert.equal(o.reportSha256,expected);
   assert.equal(o.verifiedSteamSampleCount,3);assert.equal(o.publicImages,0);assert.equal(o.switchSameBuildVerified,false);
   assert.ok(!r.stdout.includes(x.root));assert.ok(!r.stdout.includes('QA fake'));unchanged(x);
  }
  const moved=join(x.source,'relocated-output');renameSync(x.out,moved);
  const r=x.run(['--output',join(moved,'receipt.json')]);assert.notEqual(r.status,0);assert.deepEqual(readdirSync(moved),[]);
  renameSync(moved,x.out);unchanged(x);
  console.log('QRW794_MEMORY_ONLY_ACTUAL_NINE_READ_DIGEST_AND_RELOCATED_HINT_PASS');
 }finally{x.clean()}
});
test('actual filesystem four old reds, existing hint and repository/worktree path boundary',async()=>{
 const x=fixture();try{
  const repoAlias=join(x.root,'repo-alias');symlinkSync(x.codeRoot,repoAlias,'dir');
  const nested=join(x.images,'child');mkdirSync(nested);
  for(const [args,re] of [
   [{...x.args,fullversion:join(repoAlias,'scripts','asset-research','hold.mjs')},/PRIVATE_DIRECTORY_ALIAS|PRIVATE_INPUT_OR_OUTPUT_INSIDE_REPOSITORY/],
   [{...x.args,output:x.out+'/../source/receipt.json'},/PRIVATE_DIRECTORY_ALIAS|OUTPUT_MUST_BE_SEPARATE/],
   [{...x.args,output:join(nested,'receipt.json')},/OUTPUT_MUST_BE_SEPARATE/],
   [{...x.args,output:join(x.root,'receipt.json')},/OUTPUT_MUST_BE_SEPARATE/]
  ])await assert.rejects(verifyPrivateFiles(args),re);
  writeFileSync(x.output,'sentinel');await assert.rejects(verifyPrivateFiles({...x.args,output:x.output}),/NO_CLOBBER_OUTPUT_EXISTS/);
  assert.equal(readFileSync(x.output,'utf8'),'sentinel');rmSync(x.output);
  assert.deepEqual(readdirSync(nested),[]);unchanged(x);
  console.log('QRW794_OLD_PATH_REDS_AND_NO_CLOBBER_PASS');
 }finally{x.clean()}
});
test('each of nine actual inputs corrupted separately denies verified receipt; hardlink alias denied',{timeout:30000},async()=>{
 const x=fixture();try{
  const m=await import(pathToFileURL(x.script).href);
  for(const [p,b] of x.files){
   const altered=Buffer.from(b);altered[altered.length-1]^=1;writeFileSync(p,altered);
   await assert.rejects(m.verifyPrivateFiles(x.args),/FILE_SHA_MISMATCH/);writeFileSync(p,b);
  }
  const png=[...x.files.keys()].filter(p=>p.endsWith('.png'));rmSync(png[1]);linkSync(png[0],png[1]);
  await assert.rejects(m.verifyPrivateFiles(x.args),/INPUT_INODE_ALIAS/);rmSync(png[1]);writeFileSync(png[1],x.files.get(png[1]));
  unchanged(x);console.log('QRW794_NINE_CORRUPT_FILES_AND_HARDLINK_DENIED_PASS');
 }finally{x.clean()}
});
