// 09P-CODE ACT1581: exact one Windows LF-safe Steam626 DATA attribute
// Source contract. Synthetic ref-free Git commits only, no Owner private
// bytes, no Writer, Consumer, Pages, Save Op or security authority change.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const beforeMain='a9a87c578c8bc2a9c64284b15d3ed2c5eb39f817';
const originalSource='ad210aa3c551615b8c35f8b2970138760a59f5b6';
const gitattributes='crates/ddv-save-core/data/.gitattributes';
const approvedBlob='f67de2e4316397b93f95088c379f724ea81e9399';
const gatePath='scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const reviewedGate='fa595f6a72c7e7fcfa47d1edd6dc0bd142a463e9';
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'R22 exact1 Windows synthetic',GIT_AUTHOR_EMAIL:'synthetic@example.invalid',
 GIT_COMMITTER_NAME:'R22 exact1 Windows synthetic',GIT_COMMITTER_EMAIL:'synthetic@example.invalid'};
const git=(args,extra={})=>execFileSync('git',args,{cwd,
 env:{...env,...extra},encoding:'utf8',maxBuffer:16*1024*1024,
 stdio:['ignore','pipe','pipe']}).trim();
const objectExists=sha=>{try{git(['cat-file','-e',sha+'^{blob}']);return true}catch{return false}};
const newBlob=data=>execFileSync('git',['hash-object','-w','--stdin'],{
 cwd,env,encoding:'utf8',input:data,stdio:['pipe','pipe','pipe']}).trim();
let serial=0;
function candidate(parent,edits){
 const dir=mkdtempSync(join(tmpdir(),'r22-windows-one-data-'));
 try{
  const e={GIT_INDEX_FILE:join(dir,'index-'+(++serial))};
  git(['read-tree',parent+'^{tree}'],e);
  for(const [path,blob,mode='100644'] of edits)
   git(['update-index','--add','--cacheinfo',mode,blob,path],e);
  const tree=git(['write-tree'],e);
  return git(['commit-tree',tree,'-p',parent,'-m','synthetic reviewed exact1, not a ref']);
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('ACT1581 fixed Windows LF data GitBlob exact one permits only reviewed CoreTree, rejects mode/mixed/Rust/issuers',t=>{
 assert.equal(git(['rev-parse','HEAD:'+gatePath]),reviewedGate);
 assert.equal(git(['rev-parse',beforeMain+':crates/ddv-save-core']),
  '10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c');
 assert.equal(git(['rev-parse',beforeMain+':crates/ddv-save-core/Cargo.toml']),
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 assert.equal(git(['rev-parse',beforeMain+':scripts/wasm-distribution/protected-release-inputs.json']),
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
 assert.equal(git(['ls-tree',beforeMain,'--',gitattributes]),'');
 if(!objectExists(approvedBlob)||
    !(()=>{try{git(['cat-file','-e',originalSource+'^{commit}']);return true}catch{return false}})()){
  if(process.env.WAND_REQUIRE_WINDOWS_LF_GATE_FOCUS==='1')
   throw Error('REVIEWED_WINDOWS_SOURCE_GIT_OBJECT_NOT_PRESENT');
  t.skip('Original 01A PR2276 fixed Source Git objects absent in generic checkout');
  return;
 }
 assert.equal(git(['ls-tree',originalSource,'--',gitattributes]),
  '100644 blob '+approvedBlob+'\t'+gitattributes);
 const sourceDiff=git(['diff','--name-only','--no-renames',beforeMain,originalSource])
  .split('\n').filter(Boolean);
 assert.deepEqual(sourceDiff,[gitattributes]);
 const data=git(['cat-file','blob',approvedBlob]);
 assert.equal(data.split('\n').filter(Boolean).length,6);
 for(const name of ['steam626-amount-packaged-candidates.json',
  'steam626-amount-dependency-projection.json',
  'steam626-amount-layout-reference.jsonl'])
  assert.ok(data.includes(name+' -text'),'WINDOWS_SHA_PIN_LF_PRESERVE_'+name);
 assert.equal(git(['rev-parse',originalSource+':crates/ddv-save-core']),
  '623034400b71179b790ae8eca7b152cd892c898f');
 const source=candidate(beforeMain,[[gitattributes,approvedBlob]]);
 assert.equal(git(['rev-parse',source+'^{tree}']),
  'd2fe8b7635202c1ae1857795c51eb6a08c83e67c');
 assert.equal(git(['rev-parse',source+':crates/ddv-save-core']),
  '623034400b71179b790ae8eca7b152cd892c898f');
 const protectedGate=candidate(beforeMain,[[gatePath,reviewedGate]]);
 const accepted=candidate(protectedGate,[[gitattributes,approvedBlob]]);
 const receipt=verifyAcceptedRustScope(cwd,protectedGate,accepted);
 assert.equal(receipt.status,'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY');
 assert.equal(receipt.sourcePr,2276);
 assert.equal(receipt.entryCount,1);
 assert.equal(receipt.coreBefore,'10e9e9bff19ef38c4a3d16def95c0b9448ce1d7c');
 assert.equal(receipt.coreAfter,'623034400b71179b790ae8eca7b152cd892c898f');
 assert.equal(receipt.windowsByteStableOnly,true);
 assert.equal(receipt.mergeAuthorized,false);
 assert.equal(receipt.writerAuthorized,false);
 assert.equal(receipt.operationOn,false);
 const badBlob=newBlob('# forged Windows LF pin\n');
 const variants=[
  candidate(protectedGate,[[gitattributes,badBlob]]),
  candidate(protectedGate,[[gitattributes,approvedBlob,'100755']]),
  candidate(protectedGate,[[gitattributes,approvedBlob,'120000']]),
  candidate(protectedGate,[]),
  candidate(protectedGate,[[gitattributes,approvedBlob],
   ['crates/ddv-save-core/data/steam626-amount-packaged-candidates.json',badBlob]]),
  candidate(protectedGate,[[gitattributes,approvedBlob],
   ['crates/ddv-save-core/src/new_rust.rs',badBlob]]),
  candidate(protectedGate,[[gitattributes,approvedBlob],
   ['crates/ddv-save-core/Cargo.toml',badBlob]]),
  candidate(protectedGate,[[gitattributes,approvedBlob],
   ['scripts/wasm-distribution/protected-release-inputs.json',badBlob]]),
  candidate(accepted,[[gatePath,
   git(['rev-parse',beforeMain+':'+gatePath])]]),
  candidate(accepted,[['scripts/wasm-distribution/verify-protected-release.mjs',badBlob]]),
  candidate(accepted,[['src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs',badBlob]])
 ];
 for(const attempt of variants)
  assert.throws(()=>verifyAcceptedRustScope(cwd,protectedGate,attempt),
   /R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH|INT_SELECTION_/);
 console.log('R22_ACT1581_WINDOWS_LF_EXACT1_1POS11NEG_CORE_TREE_NO_RIGHTS');
});
