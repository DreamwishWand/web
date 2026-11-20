import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile,mkdtemp,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {
 bambooProtectedPagesAllowed,inspectBambooPublicPagesSubjects,
 BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS,bambooAcceptedRustSourceBlobsOk,bambooAcceptedRustCheckoutOk,
 bambooPublicAnchorFromVerifiedPins
} from '../scripts/readonly-release/seal-bamboo-public-pages.mjs';
import {ACTIVE_RELEASE_TUPLE} from '../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {
 bambooReadAnchorOk,validateBambooReadAnchor,
 BAMBOO_READONLY_OPERATION,BAMBOO_READONLY_ASSET_DIR
} from '../src/lib/ddv/core/save/product-steam626-bamboo-readonly-release.mjs';
const head='a'.repeat(40),digest='b'.repeat(64);
const accepted={
 GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'DreamwishWand/web',
 GITHUB_REPOSITORY_ID:'1371485649',GITHUB_EVENT_NAME:'push',
 GITHUB_REF:'refs/heads/main',GITHUB_SHA:head,GITHUB_WORKFLOW_SHA:head,
 GITHUB_WORKFLOW_REF:ACTIVE_RELEASE_TUPLE.signerWorkflow+'@'+ACTIVE_RELEASE_TUPLE.sourceRef,
 WAND_SOURCE_HEAD:head,WAND_RELEASE_BASE_PATH:ACTIVE_RELEASE_TUPLE.basePath,
 WAND_PUBLIC_READONLY_ASSET_GATE:'OWNER_APPROVED_THREE_FILES_20261111',
 WAND_BAMBOO_PUBLIC_RELEASE_GATE:'09INT_ACCEPTED_BAMBOO_READONLY_SIGNED3_PAGES'
};
const pins={contract:'wand.bamboo40700007.pinned-digests@1',sourceHead:head,
 manifestSha256:digest,manifestSizeBytes:1600,
 jsSha256:digest,jsSizeBytes:18000,wasmSha256:digest,wasmSizeBytes:430000};
test('only actual protected Pages issuer and exact main source are eligible',()=>{
 assert.equal(bambooProtectedPagesAllowed(accepted,head),true);
 for(const [name,value] of [
  ['GITHUB_ACTIONS','false'],['GITHUB_REPOSITORY','Other/repo'],
  ['GITHUB_REPOSITORY_ID','12'],['GITHUB_EVENT_NAME','pull_request'],
  ['GITHUB_REF','refs/heads/dev'],['GITHUB_SHA','c'.repeat(40)],
  ['GITHUB_WORKFLOW_SHA','d'.repeat(40)],
  ['GITHUB_WORKFLOW_REF','DreamwishWand/web/.github/workflows/09p-steam626-bamboo-perop-proof.yml@refs/heads/main'],
  ['WAND_SOURCE_HEAD','e'.repeat(40)],['WAND_RELEASE_BASE_PATH',''],
  ['WAND_PUBLIC_READONLY_ASSET_GATE','NOT_APPROVED'],
  ['WAND_BAMBOO_PUBLIC_RELEASE_GATE','PROOF_ONLY']
 ]){
  assert.equal(bambooProtectedPagesAllowed({...accepted,[name]:value},head),false,name);
 }
 assert.equal(bambooProtectedPagesAllowed(accepted,'invalid'),false);
});
test('pins and build-time anchor identity are bounded and refuse foreign fields',async()=>{
 const a=bambooPublicAnchorFromVerifiedPins(pins);
 assert.equal(a.operation,BAMBOO_READONLY_OPERATION);
 assert.equal(a.signerWorkflow,ACTIVE_RELEASE_TUPLE.signerWorkflow);
 assert.equal(a.mode,'public-accepted');
 assert.equal(a.attestationVerifiedAtBuild,true);
 assert.equal(bambooReadAnchorOk(a),true);
 assert.equal(await validateBambooReadAnchor(a),true);
 assert.equal(a.readOnlyOperationAuthorized,true);
 assert.equal(BAMBOO_READONLY_ASSET_DIR,'worker-wasm-steam626-bamboo-readonly');
 for(const mutation of [
  p=>p.sourceHead='invalid',
  p=>p.jsSha256='0',
  p=>p.wasmSizeBytes=0,
  p=>p.manifestSizeBytes=65537,
  p=>p.contract='foreign',
  p=>p.extra=true
 ]){
  const p=structuredClone(pins);mutation(p);
  assert.throws(()=>bambooPublicAnchorFromVerifiedPins(p),/BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/);
 }
});
test('no synthetic marker or fake WASM can turn self-pins into release signature',()=>{
 const bad=[
  [Buffer.from('{}'),Buffer.from('export function stage_switch624_frp01(){}'),Buffer.from('not wasm')],
  [Buffer.from('null'),Buffer.from('export function read_steam626_bamboo_single_target(){}'),Buffer.from('invalid')],
  [Buffer.from('invalid json'),Buffer.from('x'),Buffer.from('a')],
  [Buffer.alloc(65537),Buffer.from('x'),Buffer.from('a')]
 ];
 for(const entry of bad){
  assert.throws(()=>inspectBambooPublicPagesSubjects(entry,head),/BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/);
 }
 assert.throws(()=>inspectBambooPublicPagesSubjects([],head),/BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/);
 assert.throws(()=>inspectBambooPublicPagesSubjects(bad[0],head,{...ACTIVE_RELEASE_TUPLE}),
  /BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/);
});
test('committed Bamboo anchor stays null and old generic Pages release is untouched',async()=>{
 const path=new URL('../src/lib/ddv/core/save/product-steam626-bamboo-readonly-anchor.mjs',import.meta.url);
 assert.match(await readFile(path,'utf8'),/PROTECTED_BAMBOO40700007_READONLY_ANCHOR=null;/);
 const yml=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(yml,/actions\/attest-build-provenance@v2/);
 assert.match(yml,/actions\/deploy-pages@v4/);
 assert.doesNotMatch(yml,/seal-bamboo-public-pages\.mjs/);
 const source=await readFile(new URL('../scripts/readonly-release/seal-bamboo-public-pages.mjs',import.meta.url),'utf8');
 assert.match(source,/verifySignedReleaseSubjects/);
 assert.match(source,/revalidateProtectedCi/);
 assert.match(source,/git\('ls-tree','HEAD','--',path\)/);
 assert.doesNotMatch(source,/upload-pages-artifact|deploy-pages@/);
});

test('public signed3 Source pins the accepted Rust semantic closure (exact GitBlobs)',async()=>{
 const trusted={
  'crates/ddv-save-core/Cargo.toml':'751a73da41d8b58f7de70643f50b97722a3c1260',
  'crates/ddv-save-core/src/lib.rs':'9cc0dfdde15399d2797f30c861684f530635c4ef',
  'crates/ddv-save-core/src/wasm_steam_bamboo_readonly.rs':'26414572b41211076f1f83a3f8752eea2ab65142',
  'crates/ddv-save-core/src/wasm_worker.rs':'6432275d2909e6bc6d39265ae70cc7176fc37106',
  'crates/ddv-save-core/src/worker_steam_bamboo_readonly.rs':'b3aa885d7668e6f8d3df9a20be4962d609ab6762',
  'crates/ddv-save-core/src/worker_session.rs':'254af029304f6a357c8c0a0e7a1376b80313d038',
  'crates/ddv-save-core/src/steam_bamboo_single_product_target.rs':'a5aef59173ee99454f7f108af58fa7c46dac6f19',
  'crates/ddv-save-core/src/steam_single_fence_readonly.rs':'c64c460917d2d3730e9ffe8807112f724f10a723',
  'crates/ddv-save-core/src/sr03_installed_geometry.rs':'4ff82faf19cc9883259cea36da5f90faa5bea698',
  'crates/ddv-save-core/src/comp03_installed_geometry.rs':'645e6e6a64664088997df46954cd1d8bb4a2995a',
  'crates/ddv-save-core/src/placement_saved_refs.rs':'2ad0d925cebfcb19bb39b2afe5ff6404966ad849',
  'crates/ddv-save-core/src/product_session.rs':'34286a10bc726d9195d806b15273792614c99fa6',
  'crates/ddv-save-core/src/indexed_read.rs':'47b8b07e013f357fceee51cbc0ce676b271fb207',
  'crates/ddv-save-core/src/strict_document.rs':'e49ea87eb18227c68e049e3de7278af02550fdbd',
  'crates/ddv-save-core/src/saved_diffgrids_index.rs':'b8980ee01cd8edea46400dc6fcccdafcdc4cb6c2'
 };
 assert.deepEqual(BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS,trusted);
 const observed=Object.fromEntries(Object.keys(trusted).map(path=>[
  path,execFileSync('git',['rev-parse','HEAD:'+path],{
   cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim()
 ]));
 // The approved protected release must remain a genuine positive. Adding an
 // unrelated Rust Cargo feature on another branch must FAIL this release gate.
 const acceptedHead='ac7e95f638592a77da908f340b650692ffc7f47c';
 const approved=Object.fromEntries(Object.keys(trusted).map(path=>[
  path,execFileSync('git',['rev-parse',acceptedHead+':'+path],{
   cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim()
 ]));
 assert.notDeepEqual(approved,trusted,'historical signer no longer trusted');
 assert.equal(bambooAcceptedRustSourceBlobsOk(approved),false);
 // The archived 419 signer is not the new reviewed CURRENT trust predicate.
 const historical=Object.fromEntries(Object.keys(trusted).map(path=>[
  path,execFileSync('git',['rev-parse','419162ef5bc3a75fac05baaee10021a0d269bc2d:'+path],{
   cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim()
 ]));
 assert.equal(bambooAcceptedRustSourceBlobsOk(historical),false);
 assert.deepEqual(observed,trusted,'fixed new Rust Source15 required');
 const sourceStillAccepted=bambooAcceptedRustSourceBlobsOk(observed);
 assert.equal(await bambooAcceptedRustCheckoutOk(),sourceStillAccepted);
 if(!sourceStillAccepted){
  assert.ok(Object.keys(trusted).some(path=>observed[path]!==trusted[path]));
 }
 // Same named WASM ABI does NOT authorize changed read logic or an altered
 // ProductSession mint; fail at the git-committed Source before signing.
 for(const path of Object.keys(trusted)){
  assert.equal(bambooAcceptedRustSourceBlobsOk({...observed,[path]:'f'.repeat(40)}),false,path);
 }
 const missing={...observed};delete missing['crates/ddv-save-core/src/worker_steam_bamboo_readonly.rs'];
 assert.equal(bambooAcceptedRustSourceBlobsOk(missing),false);
 assert.equal(bambooAcceptedRustSourceBlobsOk({...observed,'crates/ddv-save-core/src/semantic_writer.rs':'0'.repeat(40)}),false);
 assert.equal(bambooAcceptedRustSourceBlobsOk(null),false);
});

test('actual CLI preflight denies dirty Worker, minted target and transitive geometry bytes',async()=>{
 const sourceRoot=new URL('../',import.meta.url);
 const temp=await mkdtemp(join(tmpdir(),'wand-bamboo-pins-'));
 const work=join(temp,'checkout');
 const git=(args,cwd=sourceRoot)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 let attached=false;
 try{
  // Keep historical 419 original signer positive and dirty negatives.
  // The CURRENT signer has a different fixed reviewed Rust closure.
  const current=git(['rev-parse','HEAD']);
  const head='419162ef5bc3a75fac05baaee10021a0d269bc2d';
  git(['worktree','add','--detach',work,head]);
  attached=true;
  await copyFile(join(work,'scripts/wasm-distribution/approved-Cargo.lock'),
   join(work,'crates/ddv-save-core/Cargo.lock'));
  const run=()=>spawnSync(process.execPath,
   ['scripts/readonly-release/seal-bamboo-public-pages.mjs','preflight'],{
    cwd:work,encoding:'utf8',
    env:{...process.env,GITHUB_EVENT_NAME:'pull_request',
     GITHUB_REPOSITORY:'DreamwishWand/web',GITHUB_REPOSITORY_ID:'1371485649',
     WAND_SOURCE_HEAD:head}
   });
  const ok=run();
  assert.equal(ok.status,0,ok.stderr);
  if(current!==head){
   const currentRun=spawnSync(process.execPath,
    ['scripts/readonly-release/seal-bamboo-public-pages.mjs','preflight'],{
     cwd:sourceRoot,encoding:'utf8',env:{...process.env,
      GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'DreamwishWand/web',
      GITHUB_REPOSITORY_ID:'0',WAND_SOURCE_HEAD:current}
    });
   assert.notEqual(currentRun.status,0,'untrusted repository ID reached a signed gate');
   assert.match(currentRun.stderr,/BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/);
  }
  const targets=[
   ['crates/ddv-save-core/src/worker_steam_bamboo_readonly.rs','"stageAuthorized": false','"stageAuthorized": true'],
   ['crates/ddv-save-core/src/steam_bamboo_single_product_target.rs','self.worker_bound&&','true&&'],
   ['crates/ddv-save-core/src/sr03_installed_geometry.rs','const W:u32=392;','const W:u32=394;']
  ];
  for(const [path,search,replace] of targets){
   const file=join(work,path),original=await readFile(file,'utf8');
   assert.ok(original.includes(search),path);
   const committed=git(['rev-parse','HEAD:'+path],work);
   await writeFile(file,original.replace(search,replace));
   assert.equal(git(['rev-parse','HEAD:'+path],work),committed);
   assert.notEqual(git(['hash-object','--no-filters','--',path],work),committed);
   const denied=run();
   assert.notEqual(denied.status,0,'dirty '+path+' incorrectly passed');
   assert.match(denied.stderr,/BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/,path);
   await writeFile(file,original);
   assert.equal(run().status,0,'restore '+path);
  }
 }finally{
  if(attached)try{git(['worktree','remove','--force',work])}catch{}
  await rm(temp,{recursive:true,force:true});
 }
});

test('current accepted Bamboo signer rejects committed mode100755 with IDENTICAL GitBlob and clean checked-out bytes',async()=>{
 const sourceRoot=new URL('../',import.meta.url);
 const temp=await mkdtemp(join(tmpdir(),'wand-bamboo-current-mode-'));
 const work=join(temp,'checkout');
 const git=(args,cwd=sourceRoot)=>execFileSync('git',args,{
  cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']
 }).trim();
 let attached=false;
 try{
  const good=git(['rev-parse','HEAD']);
  git(['worktree','add','--detach',work,good]);
  attached=true;
  await copyFile(join(work,'scripts/wasm-distribution/approved-Cargo.lock'),
   join(work,'crates/ddv-save-core/Cargo.lock'));
  const run=(expectedHead)=>spawnSync(process.execPath,
   ['scripts/readonly-release/seal-bamboo-public-pages.mjs','preflight'],{
    cwd:work,encoding:'utf8',env:{...process.env,
     GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'DreamwishWand/web',
     GITHUB_REPOSITORY_ID:'1371485649',WAND_SOURCE_HEAD:expectedHead}
   });
  const positive=run(good);
  assert.equal(positive.status,0,positive.stderr);
  const target='crates/ddv-save-core/src/wasm_worker.rs';
  const before=git(['rev-parse','HEAD:'+target],work);
  assert.match(git(['ls-tree','HEAD','--',target],work),/^100644 blob [a-f0-9]{40}\t/);
  git(['update-index','--chmod=+x','--',target],work);
  assert.match(git(['ls-files','--stage','--',target],work),/^100755 [a-f0-9]{40} 0\t/);
  // Use immutable Git Tree/commit objects: normal git commit may restage the
  // working-tree file mode back to 100644 during the index refresh.
  const modeTree=git(['write-tree'],work);
  assert.equal(git(['ls-tree',modeTree,'--',target],work),
   '100755 blob '+before+'\t'+target);
  const tampered=git(['-c','user.name=Wand Review','-c',
   'user.email=qa@example.invalid','commit-tree',modeTree,'-p',good],work);
  git(['reset','--hard',tampered],work);
  // A real mode-only committed tree, not changed Rust bytes or dirty checkout.
  await chmod(join(work,target),0o755);
  assert.notEqual(tampered,good);
  assert.equal(git(['rev-parse','HEAD:'+target],work),before);
  assert.equal(git(['ls-tree','HEAD','--',target],work),'100755 blob '+before+'\t'+target);
  assert.equal(git(['status','--porcelain=v1','--untracked-files=all','--',
    'crates/ddv-save-core/src']), '');
  const negative=run(tampered);
  assert.notEqual(negative.status,0,'committed-mode-only change was accepted');
  assert.match(negative.stderr,/BAMBOO_PUBLIC_PAGES_SIGNER_DENIED/);
 }finally{
  if(attached)try{git(['worktree','remove','--force',work])}catch{}
  await rm(temp,{recursive:true,force:true});
 }
});
