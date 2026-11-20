// 09P CODE ACT1581 W-CORE-004: exact THREE private native bridge Source
// contract ONLY; no public Writer, Consumer, signed release, or Op activation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const protectedMain='9a5c72ebafe45987b762a8fcb6ecaa198e7a7fd9';
const originalParent='906606344b17604fa4eee55e8b0482a5bec40335';
const immutableSource='f6e789694323750d0c055a8434718116dba11fc7';
const gatePath='scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const newGate='949eda609e5ea91b1d7482d7f5c0324197f95323';
const oldGate='8ce652c75211e9b1071f95060de294acffdeaaba';
const configPath='scripts/wasm-distribution/protected-release-inputs.json';
const cargoPath='crates/ddv-save-core/Cargo.toml';
const privateWorkflow='.github/workflows/01a-private-product-amount-v2-bridge.yml';
const native='crates/ddv-save-core/src/bin/wand-local-rust-v2-noop.rs';
const semantic='crates/ddv-save-core/src/semantic_writer.rs';
const approved=[
 [privateWorkflow,null,'77f8bfa29f55f28d348892086c684af9c52011bd'],
 [native,'052219d4d8078c1ed0ad4fc4a02843423de8ee6c',
  '9f783e64ec44fdc2d863a4634f3d334a89cf7f62'],
 [semantic,'9472a792277f15e69d64118919835b12bed129f1',
  'f11c68ca214853c762788ae032710fc4683dd472']
];
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'R22 temporary reviewed private bridge',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',
 GIT_COMMITTER_NAME:'R22 temporary reviewed private bridge',GIT_COMMITTER_EMAIL:'synthetic@example.invalid'};
const git=(args,extra={})=>execFileSync('git',args,{cwd,env:{...env,...extra},
 encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const blob=data=>execFileSync('git',['hash-object','-w','--stdin'],{
 cwd,env,encoding:'utf8',input:data,stdio:['pipe','pipe','pipe']}).trim();
let seq=0;
function synthetic(parent,changed){
 const dir=mkdtempSync(join(tmpdir(),'r22-private-exact3-'));
 try{
  const idx=join(dir,'index-'+(++seq));
  const e={GIT_INDEX_FILE:idx};
  git(['read-tree',parent+'^{tree}'],e);
  for(const [path,sha,mode='100644'] of changed)
   git(['update-index','--add','--cacheinfo',mode,sha,path],e);
  const tree=git(['write-tree'],e);
  return git(['commit-tree',tree,'-p',parent,'-m','R22 local no-ref candidate only']);
 }finally{rmSync(dir,{recursive:true,force:true})}
}
const exists=sha=>{try{git(['cat-file','-e',sha+'^{blob}']);return true}catch{return false}};
test('ACT1581 private bridge exact3 reviewed original Git blobs/core tree and hostile Rust/issuer gate deny',t=>{
 assert.ok([ 'd3997b2d4460109562489c6afa2c5d5e51fa2b5a',
  // New ACT1581 Inventory0 Gate-first source selector ONLY; review/merge by
  // independent 04 QR-S and sole09INT required. No new signed/Writer grant.
  'b468da7916a53bf1ad65a6577e24db0e17d7a1b5' ].includes(git(['rev-parse','HEAD:'+gatePath])),
  'Only these TWO fixed 100644 trusted Gate GitBlobs allowed');
 assert.equal(git(['rev-parse',protectedMain+':crates/ddv-save-core']),
  '36be23f81c4558eafd3557c85ac71ea56a1e3459');
 assert.equal(git(['rev-parse',protectedMain+':'+configPath]),
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
 assert.equal(git(['rev-parse',protectedMain+':'+cargoPath]),
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 assert.equal(git(['rev-parse',protectedMain+':'+gatePath]),oldGate);
 if(!exists(approved[1][2])||!exists(approved[2][2])||
    !(()=>{try{git(['cat-file','-t',immutableSource]);return true}catch{return false}})()){
  if(process.env.WAND_REQUIRE_PRIVATE_AMOUNT_GATE_FOCUS==='1')
   throw Error('ORIGINAL_PRIVATE_BRIDGE_SOURCE_COMMIT_OR_BLOBS_NOT_FETCHED');
  t.skip('Original reviewed 01A PR2267 immutable Git objects not present in generic checkout');
  return;
 }
 assert.equal(git(['merge-base',originalParent,immutableSource]),originalParent);
 assert.deepEqual(git(['diff','--name-only','--no-renames',originalParent,immutableSource])
  .split('\n').filter(Boolean).sort(),approved.map(([path])=>path).sort());
 for(const [path,before,after] of approved){
  const actualBefore=git(['ls-tree',protectedMain,'--',path]);
  assert.equal(actualBefore,before===null?'':'100644 blob '+before+'\t'+path);
  assert.equal(git(['ls-tree',immutableSource,'--',path]),
   '100644 blob '+after+'\t'+path);
 }
 assert.equal(git(['rev-parse',immutableSource+':crates/ddv-save-core']),
  '10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c');
 const entries=approved.map(([path,,after])=>[path,after]);
 // Independently reconstruct original product candidate from last protected
 // signed parent. No public branch, no ref, no remote, no Writer.
 const rawProduct=synthetic(protectedMain,entries);
 assert.equal(git(['rev-parse',rawProduct+'^{tree}']),
  '96c713b1986e015edcf723110b56e934bb094f02');
 assert.equal(git(['rev-parse',rawProduct+':crates/ddv-save-core']),
  '10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c');
 const trusted=synthetic(protectedMain,[[gatePath,newGate]]);
 const product=synthetic(trusted,entries);
 const receipt=verifyAcceptedRustScope(cwd,trusted,product);
 assert.equal(receipt.status,'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY');
 assert.equal(receipt.sourcePr,2267);
 assert.equal(receipt.sourceHead,immutableSource);
 assert.equal(receipt.entryCount,3);
 assert.equal(receipt.coreBefore,'36be23f81c4558eafd3557c85ac71ea56a1e3459');
 assert.equal(receipt.coreAfter,'10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c');
 assert.equal(receipt.privateNativeOnly,true);
 assert.equal(receipt.mergeAuthorized,false);
 assert.equal(receipt.writerAuthorized,false);
 assert.equal(receipt.operationOn,false);
 const trash=blob('// adversarial extra code - no user Save\n');
 const bad=[
  synthetic(trusted,[[privateWorkflow,trash],[native,approved[1][2]],[semantic,approved[2][2]]]),
  synthetic(trusted,[[privateWorkflow,approved[0][2]],[native,trash],[semantic,approved[2][2]]]),
  synthetic(trusted,[[privateWorkflow,approved[0][2]],[native,approved[1][1]],[semantic,approved[2][2]]]),
  synthetic(trusted,[[privateWorkflow,approved[0][2]],[native,approved[1][2]],[semantic,trash]]),
  synthetic(trusted,[[privateWorkflow,approved[0][2]],[native,approved[1][2],'100755'],[semantic,approved[2][2]]]),
  synthetic(trusted,[[privateWorkflow,approved[0][2]],[native,approved[1][2],'120000'],[semantic,approved[2][2]]]),
  synthetic(trusted,[...entries,['crates/ddv-save-core/src/other_unreviewed.rs',trash]]),
  synthetic(trusted,[...entries,[cargoPath,trash]]),
  synthetic(trusted,[...entries,[configPath,trash]]),
  synthetic(trusted,entries.filter(([p])=>p!==privateWorkflow)),
  synthetic(product,[[gatePath,oldGate]]),
  synthetic(product,[['scripts/wasm-distribution/verify-protected-release.mjs',trash]]),
  synthetic(product,[['src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs',trash]]),
  synthetic(trusted,[])
 ];
 for(const commit of bad)
  assert.throws(()=>verifyAcceptedRustScope(cwd,trusted,commit),
   /R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH|INT_SELECTION_/);
 console.log('R22_ACT1581_PR2267_PRIVATE_EXACT3_1POS14NEG_GIT_SHA_MODE_NO_WRITER_NO_ON');
});
