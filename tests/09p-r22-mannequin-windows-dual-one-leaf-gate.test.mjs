// 09P-CODE ACT1581 future source ONLY: exact 01A real Mannequin map
// Rust source one-leaf + independently reviewed Windows LF data attr.
// Either ordering, never a direct two-file unreviewed transition.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const main='a9a87c578c8bc2a9c64284b15d3ed2c5eb39f817';
const original='0778ed44da9b619989a34dde419c686c1934af64';
const originalParent='f6e789694323750d0c055a8434718116dba11fc7';
const gatePath='scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const newGate='949eda609e5ea91b1d7482d7f5c0324197f95323';
const rust='crates/ddv-save-core/src/product_amount_scoped.rs';
const oldRust='13d861165bea3fb37f79d7bbc4cb9ab51669fa78';
const newRust='522e8e8d6beec597b2e5e176cfbe8a6d8e38a124';
const attr='crates/ddv-save-core/data/.gitattributes';
const attrBlob='f67de2e4316397b93f95088c379f724ea81e9399';
const C={before:'10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c',
 win:'623034400b71179b790ae8eca7b152cd892c898f',
 man:'f67531cef7c812757b246a9aef08febb66782200',
 both:'2f712d047e99bc024672e4d7a488baa6276e06f4'};
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'R22 ref-free source child',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',
 GIT_COMMITTER_NAME:'R22 ref-free source child',GIT_COMMITTER_EMAIL:'synthetic@example.invalid'};
const git=(args,extra={})=>execFileSync('git',args,{cwd,env:{...env,...extra},encoding:'utf8',
 maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const exists=sha=>{try{git(['cat-file','-e',sha+'^{object}']);return true}catch{return false}};
const blob=data=>execFileSync('git',['hash-object','-w','--stdin'],{
 cwd,env,encoding:'utf8',input:data,stdio:['pipe','pipe','pipe']}).trim();
let seq=0;
function candidate(parent,edits){
 const dir=mkdtempSync(join(tmpdir(),'r22-man-windows-edge-'));
 try{
  const idx=join(dir,'index-'+(++seq)),e={GIT_INDEX_FILE:idx};
  git(['read-tree',parent+'^{tree}'],e);
  for(const [path,sha,mode='100644'] of edits)
   git(['update-index','--add','--cacheinfo',mode,sha,path],e);
  const tree=git(['write-tree'],e);
  return git(['commit-tree',tree,'-p',parent,'-m','ref-free one reviewed child']);
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('ACT1581 exact Mannequin saved-int32 Rust and Windows pack LF both orders: 3 POS / 13+ NEG, no writer',t=>{
 assert.ok([ 'd3997b2d4460109562489c6afa2c5d5e51fa2b5a',
  // New ACT1581 Inventory0 Gate-first source selector ONLY; review/merge by
  // independent 04 QR-S and sole09INT required. No new signed/Writer grant.
  'dda72d9cfd1836f77830a94b74a3f0fce16478b9' ].includes(git(['rev-parse','HEAD:'+gatePath])));
 assert.equal(git(['rev-parse',main+':crates/ddv-save-core']),C.before);
 assert.equal(git(['rev-parse',main+':'+rust]),oldRust);
 assert.equal(git(['ls-tree',main,'--',attr]),'');
 assert.equal(git(['rev-parse',main+':crates/ddv-save-core/Cargo.toml']),
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 assert.equal(git(['rev-parse',main+':scripts/wasm-distribution/protected-release-inputs.json']),
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
 if(!exists(original)||!exists(newRust)||!exists(attrBlob)){
  if(process.env.WAND_REQUIRE_MANNEQUIN_GATE_FOCUS==='1')
   throw Error('ORIGINAL_PR2278_FIXED_SOURCE_GIT_OBJECTS_UNAVAILABLE');
  t.skip('Original PR2278 immutable Source not yet fetched in generic checkout');
  return;
 }
 assert.deepEqual(git(['diff','--name-only','--no-renames',originalParent,original])
  .split('\n').filter(Boolean),[rust]);
 assert.equal(git(['ls-tree',original,'--',rust]),'100644 blob '+newRust+'\t'+rust);
 // Real immutable Git Tree checks, before any synthetic Gate authority.
 const rawMan=candidate(main,[[rust,newRust]]);
 const rawWin=candidate(main,[[attr,attrBlob]]);
 const rawBoth=candidate(main,[[attr,attrBlob],[rust,newRust]]);
 assert.equal(git(['rev-parse',rawMan+'^{tree}']),
  '33923b77bfa3d9224db08164a2b21baebb3c3b3b');
 assert.equal(git(['rev-parse',rawWin+'^{tree}']),
  'd2fe8b7635202c1ae1857795c51eb6a08c83e67c');
 assert.equal(git(['rev-parse',rawBoth+'^{tree}']),
  '5c818402af2ae91984412db6987e1f0febb45b33');
 for(const [ref,target] of [[rawMan,C.man],[rawWin,C.win],[rawBoth,C.both]])
  assert.equal(git(['rev-parse',ref+':crates/ddv-save-core']),target);
 const trusted=candidate(main,[[gatePath,newGate]]);
 const man=candidate(trusted,[[rust,newRust]]);
 const win=candidate(trusted,[[attr,attrBlob]]);
 const bothWin=candidate(win,[[rust,newRust]]);
 const bothMan=candidate(man,[[attr,attrBlob]]);
 const positives=[
  [trusted,man,2278,C.before,C.man],
  [win,bothWin,2278,C.win,C.both],
  [man,bothMan,2276,C.man,C.both]
 ];
 for(const [base,child,sourcePr,before,after] of positives){
  const receipt=verifyAcceptedRustScope(cwd,base,child);
  assert.equal(receipt.status,'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY');
  assert.equal(receipt.entryCount,1);
  assert.equal(receipt.sourcePr,sourcePr);
  assert.equal(receipt.coreBefore,before);
  assert.equal(receipt.coreAfter,after);
  assert.equal(receipt.mergeAuthorized,false);
  assert.equal(receipt.writerAuthorized,false);
  assert.equal(receipt.operationOn,false);
 }
 const forged=blob('// WRONG FUTURE MANNEQUIN RUST');
 const denied=[
  [trusted,candidate(trusted,[[rust,forged]])],
  [trusted,candidate(trusted,[[rust,newRust,'100755']])],
  [trusted,candidate(trusted,[[rust,newRust,'120000']])],
  [trusted,candidate(trusted,[])],
  [trusted,candidate(trusted,[[rust,newRust],[attr,attrBlob]])],
  [trusted,candidate(trusted,[[rust,newRust],['crates/ddv-save-core/src/unreviewed.rs',forged]])],
  [trusted,candidate(trusted,[[rust,newRust],['crates/ddv-save-core/Cargo.toml',forged]])],
  [trusted,candidate(trusted,[[rust,newRust],['scripts/wasm-distribution/protected-release-inputs.json',forged]])],
  [trusted,candidate(trusted,[[rust,newRust],['src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs',forged]])],
  [trusted,candidate(man,[[gatePath,git(['rev-parse',main+':'+gatePath])]])],
  [win,candidate(win,[[rust,forged]])],
  [win,candidate(win,[[rust,newRust,'100755']])],
  [man,candidate(man,[[attr,forged]])],
  [man,candidate(man,[[attr,attrBlob,'120000']])],
  [man,candidate(man,[[attr,attrBlob],['crates/ddv-save-core/data/unreviewed.json',forged]])],
  [man,candidate(man,[[attr,attrBlob],['scripts/wasm-distribution/verify-protected-release.mjs',forged]])]
 ];
 for(const [base,child] of denied)
  assert.throws(()=>verifyAcceptedRustScope(cwd,base,child),
   /R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH|INT_SELECTION_/);
 console.log('R22_ACT1581_MANNEQUIN_WINDOWS_TWO_ORDER_3POS16NEG_EXACT_ONLY_NO_WRITER');
});
