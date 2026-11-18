import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceRepo=resolve(fileURLToPath(new URL('../',import.meta.url)));
const currentHead=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRepo,encoding:'utf8'}).trim();
const coreAtHead=execFileSync('git',['rev-parse',currentHead+':crates/ddv-save-core'],
 {cwd:sourceRepo,encoding:'utf8'}).trim();
// Gate-only tests use the checked-out protected source itself. Product exact8
// tests must instead construct their synthetic candidate from the PRE-product
// accepted protected base: HEAD already has new Cargo and would be a no-op.
const acceptedGateAnchor='e7a56d5ce4a717cd76191e345b79be12adef3df4';
const productCore=coreAtHead==='42086449f9deef26ed48b21d7edab0f5685da7c2';
const ongoingBattlePassCore=coreAtHead==='36be23f81c4558eafd3557c85ac71ea56a1e3459';
const baseHead=(productCore||ongoingBattlePassCore)
 ?acceptedGateAnchor:currentHead;
const productPaths=[
 ['.github/workflows/core-product-session-boundary.yml','8de94431af1e6d58e216fa06bf91a1329a7f7063'],
 ['crates/ddv-save-core/Cargo.toml','751a73da41d8b58f7de70643f50b97722a3c1260'],
 ['crates/ddv-save-core/src/product_makeup_color1.rs','749831d8c41a24585a490b5ed23640fc8d50fc3d'],
 ['crates/ddv-save-core/src/worker_session.rs','254af029304f6a357c8c0a0e7a1376b80313d038'],
 ['crates/ddv-save-core/src/wasm_worker.rs','5fbb1f3d393df127da67f1eafe9796fbb7ce3a56'],
 ['crates/ddv-save-core/src/worker_switch626_makeup_color1.rs','945d6dee10f62396d894ea631e40c3fe26e6d0f0'],
 ['crates/ddv-save-core/src/wasm_switch626_makeup_color1.rs','b8a24a1e288f763349355bd05bf3b7cfd51b0b4a']
];
const configPath='scripts/wasm-distribution/protected-release-inputs.json';
const trustedPath='scripts/wasm-distribution/r22-trusted-before-candidate.mjs';
const selector='scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const verifier='scripts/wasm-distribution/verify-protected-release.mjs';
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'R22 isolated Source test',GIT_AUTHOR_EMAIL:'qa@example.invalid',
 GIT_COMMITTER_NAME:'R22 isolated Source test',GIT_COMMITTER_EMAIL:'qa@example.invalid'};
const outerGit=(...args)=>execFileSync('git',args,{cwd:sourceRepo,env,encoding:'utf8',
 stdio:['ignore','pipe','pipe']}).trim();
const hasBlob=sha=>{try{outerGit('cat-file','-e',sha+'^{blob}');return true}catch{return false}};
test('ACT1581 independent PRE-candidate trusted-main executable denies self-changing R22 verifier, selector, mode, and worktree',t=>{
 const unavailable=productPaths.filter(([,blob])=>!hasBlob(blob));
 if(unavailable.length){
  if(process.env.WAND_REQUIRE_SWITCH_MAKEUP_GATE_FOCUS==='1')
   throw Error('PRODUCT_SOURCE_BLOBS_REQUIRED_'+JSON.stringify(unavailable));
  t.skip('Original PR2217 blobs not present in generic CI checkout');return;
 }
 const dir=mkdtempSync(join(tmpdir(),'r22-external-base-'));
 const cwd=join(dir,'isolated');
 const git=(args,opts={})=>{
  const result=spawnSync('git',['-C',cwd,...args],{env:{...env,...(opts.env||{})},
   input:opts.input,encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(result.status,0,'git '+args.join(' ')+' '+String(result.stderr).slice(0,500));
  return result.stdout.trim();
 };
 const createBlob=s=>git(['hash-object','-w','--stdin'],{input:s});
 let seq=0;
 const makeCommit=(parent,updates)=>{
  const index=join(dir,'index-'+(++seq));
  git(['read-tree',parent+'^{tree}'],{env:{GIT_INDEX_FILE:index}});
  for(const [path,sha,mode='100644'] of updates)
   git(['update-index','--add','--cacheinfo',mode,sha,path],{env:{GIT_INDEX_FILE:index}});
  const tree=git(['write-tree'],{env:{GIT_INDEX_FILE:index}});
  return git(['commit-tree',tree,'-p',parent,'-m','R22 disposable source candidate']);
 };
 const run=(base,source)=>spawnSync(process.execPath,[join(cwd,trustedPath),base,source],
   {cwd,env,encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
 try{
  const clone=spawnSync('git',['clone','--no-hardlinks','--no-checkout','-q',sourceRepo,cwd],{encoding:'utf8'});
  assert.equal(clone.status,0,String(clone.stderr));
  assert.equal(git(['cat-file','-t',baseHead]),'commit');
  const currentConfig=outerGit('rev-parse',currentHead+':'+configPath);
  const currentStage=new Map([
   ['b5416aa726caea9d311075599ac606e11285b295',
    '5d2b35f6bc9f0b8544fc52f25a35614b59913d96'],
   ['42086449f9deef26ed48b21d7edab0f5685da7c2',
    '30551c7cc566614f64c8ba04748c3aef44b419bb'],
   ['36be23f81c4558eafd3557c85ac71ea56a1e3459',
    '30551c7cc566614f64c8ba04748c3aef44b419bb']
  ]);
  assert.ok(currentStage.has(coreAtHead),'UNAPPROVED_CURRENT_R22_CORE_STAGE');
  assert.equal(currentConfig,currentStage.get(coreAtHead),
    'CURRENT_HEAD_R22_CONFIG_CORE_STAGE_MISMATCH');
  assert.equal(git(['rev-parse',baseHead+':crates/ddv-save-core']),
    'b5416aa726caea9d311075599ac606e11285b295');
  assert.equal(git(['rev-parse',baseHead+':'+configPath]),
    '5d2b35f6bc9f0b8544fc52f25a35614b59913d96');
  assert.equal(git(['rev-parse',baseHead+':'+trustedPath]),
    '5aefdaff6a46ae9bdf1f5a37c4f0973442308a4a');
  if(productCore||ongoingBattlePassCore){
   assert.equal(outerGit('merge-base','--is-ancestor',baseHead,currentHead),'');
  }
  // Explicitly seed each exact immutable public Source blob, even if clone
  // omitted unreachable fetched PR objects. No ref or remote main changes.
  for(const [,blob] of productPaths){
   if(!(()=>{try{git(['cat-file','-e',blob+'^{blob}']);return true}catch{return false}})()){
    const bytes=execFileSync('git',['cat-file','blob',blob],{cwd:sourceRepo,env,encoding:'buffer'});
    assert.equal(createBlob(bytes),blob);
   }
  }
  git(['checkout','--force','--detach',baseHead]);
  // LOCAL simulated protected main, never GitHub protected main.
  git(['update-ref','refs/remotes/origin/main',baseHead]);
  assert.equal(git(['rev-parse','HEAD']),baseHead);
  assert.equal(git(['rev-parse','refs/remotes/origin/main']),baseHead);
  const original=execFileSync('git',['show',baseHead+':'+configPath],{cwd,env,encoding:'utf8'});
  const oldCargo='aa6b1dd771da305bf7a21c6101fb4620a8b74b93';
  const newCargo='751a73da41d8b58f7de70643f50b97722a3c1260';
  assert.equal(original.split(oldCargo).length,2);
  const futureBlob=createBlob(original.replace(oldCargo,newCargo));
  assert.equal(futureBlob,'30551c7cc566614f64c8ba04748c3aef44b419bb');
  const approved=makeCommit(baseHead,[...productPaths,[configPath,futureBlob]]);
  // Product may be deployed after unrelated accepted Web/Media updates,
  // or tested after Gate-only stage test Source has already landed.
  // Never compare the WHOLE HEAD tree with the ancient accepted Gate root:
  // pin each of the reviewed 8 source blobs/modes and all trusted Gate
  // authorities instead; the Core subtree is already pinned to its exact
  // accepted complete tree by currentStage above.
  if(productCore||ongoingBattlePassCore){
   for(const [path,blob] of [...productPaths,[configPath,futureBlob]]){
    assert.equal(outerGit('ls-tree',currentHead,'--',path),
     '100644 blob '+blob+String.fromCharCode(9)+path,
     'PRODUCT_CURRENT_HEAD_BLOB_MODE_MISMATCH_'+path);
   }
   // Stage profiles may change ONLY the accepted selector GitBlob;
   // verifier/issuer/raw external trusted closure must remain immutable.
   for(const path of [trustedPath,verifier,
    'scripts/wasm-distribution/r22-raw-rust-checkout.mjs',
    'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs']){
    assert.equal(outerGit('rev-parse',currentHead+':'+path),
      git(['rev-parse',baseHead+':'+path]),
      'PRODUCT_CURRENT_HEAD_MUTATED_TRUSTED_GATE_'+path);
   }
   const allowedSelectors=productCore?
    ['f9675e69a30abf101e78aa77369e86707abba076',
     '8ce652c75211e9b1071f95060de294acffdeaaba']:['8ce652c75211e9b1071f95060de294acffdeaaba'];
   const selectorBlob=outerGit('rev-parse',currentHead+':'+selector);
   assert.ok(allowedSelectors.includes(selectorBlob),'UNREVIEWED_SELECTOR_STAGE_BLOB');
   assert.equal(outerGit('ls-tree',currentHead,'--',selector),
    '100644 blob '+selectorBlob+String.fromCharCode(9)+selector);
   if(ongoingBattlePassCore){
    const amount='crates/ddv-save-core/src/product_amount_scoped.rs';
    assert.equal(outerGit('ls-tree',currentHead,'--',amount),
     '100644 blob 13d861165bea3fb37f79d7bbc4cb9ab51669fa78'+
      String.fromCharCode(9)+amount,'UNREVIEWED_BATTLEPASS_AMOUNT_LEAF');
   }
  }
  const clean=run(baseHead,approved);
  assert.equal(clean.status,0,'trusted POS '+String(clean.stderr).slice(0,900));
  assert.match(clean.stdout,/R22_TRUSTED_PRE_CANDIDATE_EXACT8_SCOPE_ONLY/);
  for(const path of [selector,verifier,trustedPath,
   'scripts/wasm-distribution/r22-raw-rust-checkout.mjs',
   'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs']){
   const before=git(['show',baseHead+':'+path]);
   const changed=path===verifier?before.replace("const root=resolve(import.meta.dirname,'../..');",
    "const root=resolve(import.meta.dirname,'../..');\nif(process.argv[2]==='inputs')process.exit(0);"):
    before+'\n// ADVERSARIAL_BLOB_CHANGE\n';
   assert.notEqual(changed,before);
   const bad=makeCommit(approved,[[path,createBlob(changed)]]);
   const check=run(baseHead,bad);
   assert.notEqual(check.status,0,'trusted preflight must reject '+path);
   assert.match(check.stderr,/R22_TRUSTED_PRE_CANDIDATE_DENIED/);
  }
  const originalVerifierSha=git(['rev-parse',baseHead+':'+verifier]);
  const executable=makeCommit(approved,[[verifier,originalVerifierSha,'100755']]);
  const execRejected=run(baseHead,executable);
  assert.notEqual(execRejected.status,0,'100755 changed mode must fail closed');
  const altered=join(cwd,selector),originalSelector=readFileSync(altered);
  try{
   writeFileSync(altered,Buffer.concat([originalSelector,Buffer.from('\n// WORKTREE_DIRTY\n')]));
   const dirty=run(baseHead,approved);
   assert.notEqual(dirty.status,0,'raw protected worktree drift must fail closed');
   assert.match(dirty.stderr,/TRUSTED_WORKTREE_DRIFT/);
  }finally{writeFileSync(altered,originalSelector)}
  // The issuer leaf has the EXACT approved Git bytes, but a parent folder
  // is now a symlink into an untrusted outside-repo location. This previously
  // false-accepted; no candidate file or Git blob is changed by this test.
  const issuerParent=join(cwd,'src/lib/ddv/core/save');
  const outsideIssuerParent=join(dir,'outside-repository-issuer-save');
  renameSync(issuerParent,outsideIssuerParent);
  try{
   symlinkSync(outsideIssuerParent,issuerParent,'dir');
   const escaped=run(baseHead,approved);
   assert.notEqual(escaped.status,0,
    'trusted external CLI must reject outside-repo symlinked issuer parent');
   assert.ok(escaped.stderr.includes('R22_TRUSTED_SELECTION_TRUSTED_PATH_SYMLINK_src/lib/ddv/core/save'), 'external parent symlink denial marker required');
  }finally{
   unlinkSync(issuerParent);
   renameSync(outsideIssuerParent,issuerParent);
  }
  // Repeat for a different protected module parent: normal in-tree files
  // with original content must never bypass the parent-component guard.
  const scriptsParent=join(cwd,'scripts');
  const outsideScripts=join(dir,'outside-repository-scripts');
  renameSync(scriptsParent,outsideScripts);
  try{
   symlinkSync(outsideScripts,scriptsParent,'dir');
   const escaped=run(baseHead,approved);
   assert.notEqual(escaped.status,0,
    'trusted external CLI must reject outside-repo symlinked script parent');
  }finally{
   unlinkSync(scriptsParent);
   renameSync(outsideScripts,scriptsParent);
  }
  // Incorrect protected base is rejected before reading candidate JS.
  const forgedBase=run('d37a774a8ce2ac08ef05389f0d14d3442063edeb',approved);
  assert.notEqual(forgedBase.status,0);
  console.log('R22_TRUSTED_EXTERNAL_BASE_1POS_9SOURCE_MODE_WORKTREE_PARENT_SYMLINK_NEG_NO_PAGES_NO_ON');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
