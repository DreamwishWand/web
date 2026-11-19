import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {writeFileSync,unlinkSync,symlinkSync} from 'node:fs';
import {assertR22RawRustCheckout} from '../scripts/wasm-distribution/r22-raw-rust-checkout.mjs';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'R22 Synthetic QA',GIT_AUTHOR_EMAIL:'r22-qa@example.invalid',
 GIT_COMMITTER_NAME:'R22 Synthetic QA',GIT_COMMITTER_EMAIL:'r22-qa@example.invalid'};
const raw=(args,options={})=>execFileSync('git',args,{
 cwd,env:{...env,...options.env},encoding:options.raw?null:'utf8',input:options.input,
 stdio:['pipe','pipe','pipe'],maxBuffer:12*1024*1024});
const git=(...args)=>raw(args).trim();
const bytes=(...args)=>raw(args,{raw:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputPath='scripts/wasm-distribution/protected-release-inputs.json';
const cargoPath='crates/ddv-save-core/Cargo.toml';
const lockPath='scripts/wasm-distribution/approved-Cargo.lock';
const base='05e9e86da643e545b6b750611183bdf57f648798';
const prior='9157b04a92dfe203d71a9c3977e8f9f50d5ce9b8';
const postCargo='aa6b1dd771da305bf7a21c6101fb4620a8b74b93';
const beforeCargo='e4f2e2c5d4451baba2dea699fe497cb7b40668d4';
const acceptedReleaseProfiles=Object.freeze([
 {core:'b5416aa726caea9d311075599ac606e11285b295',
  cargo:'aa6b1dd771da305bf7a21c6101fb4620a8b74b93',
  config:'5d2b35f6bc9f0b8544fc52f25a35614b59913d96'},
 // A *future* scoped profile, NOT a current public permission. Gate-first and
 // independent Security L2 + 09INT are required before it becomes main.
 {core:'42086449f9deef26ed48b21d7edab0f5685da7c2',
  cargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb'},
 // Pending exact one Rust leaf 01A BattlePass safety Core stage. Owner/
 // 09INT release and independent L2 are separate from a test profile.
 {core:'36be23f81c4558eafd3557c85ac71ea56a1e3459',
  cargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb'},
 // Original PR2267 private-only 2Rust+1CI, no Writer entitlement.
 {core:'10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c',
  cargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb'},
 // The only additional within-crate data attribute GitBlob changes the
 // whole CoreTree. No generic different attribute content is permitted.
 {core:'623034400b71179b790ae8eca7b152cd892c898f',
  cargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb'},
 // Original PR2278 exact Mannequin map one Rust leaf and both singleton
 // accepted leaves composed, without authorizing direct two-file edit.
 {core:'f67531cef7c812757b246a9aef08febb66782200',
  cargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb'},
 {core:'2f712d047e99bc024672e4d7a488baa6276e06f4',
  cargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb'}
]);
const lock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const originalConfig=JSON.parse(git('show',base+':'+inputPath));
const approvedSourceChanged=[
 '.github/workflows/09p-bamboo-public-pages-sealer-source.yml',
 '.github/workflows/core-product-session-boundary.yml',
 'crates/ddv-save-core/Cargo.toml',
 'crates/ddv-save-core/src/product_eyeball_color2.rs',
 'crates/ddv-save-core/src/wasm_steam626_eyecolor2.rs',
 'crates/ddv-save-core/src/wasm_worker.rs',
 'crates/ddv-save-core/src/worker_session.rs',
 'crates/ddv-save-core/src/worker_steam626_eyecolor2.rs',
 'tests/09p-bamboo-public-pages-sealer.test.mjs'
].sort();

// Deliberately evaluates a named commit, NOT HEAD^ or the cumulative diff
// to an old base. Future unrelated commits must not invalidate the release.
function currentR22ContractAllowed(ref){
 try{
  const tuple=JSON.parse(git('show',ref+':'+inputPath));
  const accepted=acceptedReleaseProfiles.some(profile=>
   git('rev-parse',ref+':crates/ddv-save-core')===profile.core&&
   git('rev-parse',ref+':'+cargoPath)===profile.cargo&&
   git('rev-parse',ref+':'+inputPath)===profile.config&&
   tuple.cargoTomlGitBlob===profile.cargo);
  return accepted&&
   tuple.cargoTomlGitBlob===git('rev-parse',ref+':'+cargoPath)&&
   JSON.stringify({...tuple,cargoTomlGitBlob:beforeCargo})===JSON.stringify(originalConfig)&&
   sha(bytes('show',ref+':'+lockPath))===lock&&
   tuple.approvedCargoLockSha256===lock&&
   JSON.stringify(tuple.features)==='["indexed-read","worker-wasm"]'&&
   tuple.defaultFeatures===false&&tuple.writerEnabled===false&&
   tuple.productConsumerEnabled===false&&
   tuple.publicReadonlyAssetsApproved===true;
 }catch{return false}
}
// Unreachable synthetic Git commits in the CI-local object database only.
// No ref/worktree/main/branch mutation, no push, no production action.
function syntheticChild(path,content){
 const dir=mkdtempSync(join(tmpdir(),'wand-r22-local-commit-'));
 try{
  const indexEnv={GIT_INDEX_FILE:join(dir,'index')};
  raw(['read-tree','HEAD^{tree}'],{env:indexEnv});
  const blob=raw(['hash-object','-w','--stdin'],{input:content}).trim();
  raw(['update-index','--add','--cacheinfo','100644',blob,path],{env:indexEnv});
  const tree=raw(['write-tree'],{env:indexEnv}).trim();
  return git('commit-tree',tree,'-p','HEAD','-m','Synthetic local R22 CI child only');
 }finally{
  rmSync(dir,{recursive:true,force:true});
 }
}

test('R22 exact protected Core/Cargo/config profiles remain read-only under Gate-first updates',()=>{
 assert.doesNotThrow(()=>git('merge-base','--is-ancestor',base,'HEAD'));
 assert.equal(git('rev-parse',base+':'+cargoPath),postCargo);
 assert.equal(git('rev-parse',prior+':'+cargoPath),beforeCargo);
 assert.equal(git('rev-parse',base+':'+inputPath),'9a382ff6b669c1a7c00f0385373f030c69502a7e');
 assert.ok(acceptedReleaseProfiles.some(profile=>
  git('rev-parse','HEAD:crates/ddv-save-core')===profile.core&&
  git('rev-parse','HEAD:'+cargoPath)===profile.cargo&&
  git('rev-parse','HEAD:'+inputPath)===profile.config));
 assert.equal(acceptedReleaseProfiles[0].cargo,postCargo);
 assert.equal(currentR22ContractAllowed('HEAD'),true);
 assert.equal(sha(readFileSync(resolve(cwd,lockPath))),lock);
});
test('Immutable historical 09INT nine-file accepted Source evidence stays pinned without freezing future HEAD',()=>{
 assert.deepEqual(git('diff','--name-only','--no-renames',prior,base).split('\n').filter(Boolean).sort(),approvedSourceChanged);
 assert.equal(git('rev-parse',prior+':crates/ddv-save-core'),'972261d9e60e66df67209583a356ad812e29b37c');
 assert.equal(git('rev-parse',base+':crates/ddv-save-core'),'b5416aa726caea9d311075599ac606e11285b295');
 assert.equal(git('rev-parse',base+':crates/ddv-save-core/src/wasm_steam626_eyecolor2.rs'),'1b68343ef3093352dceb00af6dfd67bf1bdde24d');
 assert.equal(git('rev-parse',base+':crates/ddv-save-core/src/worker_steam626_eyecolor2.rs'),'2f6b077cf2cc1b47892b7a01ce697ce48bb505ce');
 assert.equal(originalConfig.cargoTomlGitBlob,beforeCargo);
 assert.equal(originalConfig.writerEnabled,false);
 assert.equal(originalConfig.productConsumerEnabled,false);
});
test('Actual future unrelated child Git commit remains acceptable with unchanged R22 bytes and signer rights',()=>{
 const future=syntheticChild('docs/r22-future-unrelated-ci-test-only.txt','synthetic non-release documentation only\n');
 assert.notEqual(future,git('rev-parse','HEAD'));
 assert.equal(git('rev-parse',future+'^'),git('rev-parse','HEAD'));
 assert.deepEqual(git('diff','--name-only','HEAD',future).trim(),'docs/r22-future-unrelated-ci-test-only.txt');
 assert.equal(currentR22ContractAllowed(future),true);
});
test('Actual synthetic untrusted Cargo, Lock or Writer grant source commits are rejected, without touching a branch',()=>{
 const originalCargo=readFileSync(resolve(cwd,cargoPath),'utf8');
 const originalLock=readFileSync(resolve(cwd,lockPath));
 const valid=JSON.parse(git('show','HEAD:'+inputPath));
 const wrongCargo=syntheticChild(cargoPath,originalCargo+'\n# forged Rust config\n');
 const wrongLock=syntheticChild(lockPath,Buffer.concat([originalLock,Buffer.from('\n# forged lock bytes\n')]));
 const wrongWriter=syntheticChild(inputPath,JSON.stringify({...valid,writerEnabled:true}));
 const wrongFeature=syntheticChild(inputPath,JSON.stringify({...valid,features:['worker-wasm','product-steam626-eyecolor2-scoped']}));
 for(const commit of [wrongCargo,wrongLock,wrongWriter,wrongFeature]){
  assert.equal(git('rev-parse',commit+'^'),git('rev-parse','HEAD'));
  assert.equal(currentR22ContractAllowed(commit),false,commit);
 }
});

test('R22 real checkout rejects uncommitted Rust/Cargo, untracked module and source symlink',()=>{
 const dir=mkdtempSync(join(tmpdir(),'wand-r22-dirty-checkout-'));
 const work=join(dir,'worktree');
 let added=false;
 try{
  git('worktree','add','--detach',work,'HEAD');
  added=true;
  const good=assertR22RawRustCheckout(work);
  assert.equal(good.compilationInputsMatchHead,true);
  assert.ok(good.trackedSourceFiles>=80);
  const paths=['crates/ddv-save-core/Cargo.toml','crates/ddv-save-core/src/wasm_worker.rs'];
  for(const path of paths){
   const file=join(work,path),original=readFileSync(file);
   const blob=execFileSync('git',['rev-parse','HEAD:'+path],{cwd:work,encoding:'utf8'}).trim();
   try{
    writeFileSync(file,Buffer.concat([original,Buffer.from('\n// dirty input bytes\n')]));
    assert.equal(execFileSync('git',['rev-parse','HEAD:'+path],{cwd:work,encoding:'utf8'}).trim(),blob);
    assert.notEqual(execFileSync('git',['hash-object','--no-filters','--',path],{cwd:work,encoding:'utf8'}).trim(),blob);
    assert.throws(()=>assertR22RawRustCheckout(work),/R22_RAW_RUST_CHECKOUT_/);
   }finally{writeFileSync(file,original)}
   assert.equal(assertR22RawRustCheckout(work).compilationInputsMatchHead,true);
  }
  const extra=join(work,'crates/ddv-save-core/src/r22_untracked_injected.rs');
  try{
   writeFileSync(extra,'pub fn injected()->bool{true}\n');
   assert.throws(()=>assertR22RawRustCheckout(work),/R22_RAW_RUST_CHECKOUT_UNTRACKED_COMPILED_INPUT/);
  }finally{unlinkSync(extra)}
  if(process.platform!=='win32'){
   const linked=join(work,'crates/ddv-save-core/src/r22_symlink_injected.rs');
   try{
    symlinkSync(join(work,'crates/ddv-save-core/Cargo.toml'),linked);
    assert.throws(()=>assertR22RawRustCheckout(work),/R22_RAW_RUST_CHECKOUT_SYMLINK/);
   }finally{unlinkSync(linked)}
  }
  assert.equal(assertR22RawRustCheckout(work).compilationInputsMatchHead,true);
 }finally{
  if(added)git('worktree','remove','--force',work);
  rmSync(dir,{recursive:true,force:true});
 }
});
test('R22 validator actually invokes strict real checkout before approving release inputs',()=>{
 const source=readFileSync(resolve(cwd,'scripts/wasm-distribution/verify-protected-release.mjs'),'utf8');
 assert.ok(source.includes("const {assertR22RawRustCheckout}=await import('./r22-raw-rust-checkout.mjs')"));
 const beforeImport=source.indexOf('assertTrustedRustGateBeforeImport(prBase,expectedSource)');
 const imported=source.indexOf("await import('./r22-raw-rust-checkout.mjs')");
 assert.ok(beforeImport>=0&&imported>beforeImport,'trusted gate must be pinned before loading raw Rust checker');
 for(const path of ['scripts/wasm-distribution/verify-protected-release.mjs',
   'scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
   'scripts/int-selection-preflight.mjs',
   'scripts/wasm-distribution/r22-raw-rust-checkout.mjs',
   'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs'])
  assert.ok(source.includes("'"+path+"'"),'missing release trust pin '+path);
 assert.match(source,/try\{assertR22RawRustCheckout\(root\)\}/);
 assert.ok(source.indexOf('assertR22RawRustCheckout(root)')<source.indexOf("if(stage==='inputs')"));
 assert.ok(source.indexOf('assertR22RawRustCheckout(root)')<source.indexOf("if(stage==='built')")||
           !source.includes("if(stage==='built')"));
});
