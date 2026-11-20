// 09P ACT1581: immutable real Git Source+adversarial Synthetic Commit proof.
// No user Save, no ref mutation, no protected signing, no extra product authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 verifyR22Inventory0SourceCandidate,r22Inventory0CandidateBytesExact,
 INVENTORY0_EXPECTED_SOURCE,INVENTORY0_EXPECTED_CORE,INVENTORY0_EXPECTED_CARGO,
 INVENTORY0_EXPECTED_WORKER,INVENTORY0_EXPECTED_ARC
} from '../scripts/wasm-distribution/r22-inventory0-product-source.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'09P local synthetic',GIT_AUTHOR_EMAIL:'09p@example.invalid',
 GIT_COMMITTER_NAME:'09P local synthetic',GIT_COMMITTER_EMAIL:'09p@example.invalid'};
const git=(args,input,extra={})=>execFileSync('git',args,{cwd:root,env:{...env,...extra},
 input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
const sourceHead=git(['rev-parse','HEAD']);
const makeChild=(updates)=>{
 const dir=mkdtempSync(join(tmpdir(),'r22-inventory0-candidate-'));
 try{
  const index={GIT_INDEX_FILE:join(dir,'index')};
  git(['read-tree',sourceHead+'^{tree}'],undefined,index);
  for(const [path,content,mode='100644'] of updates){
   const blob=content===null?git(['rev-parse',sourceHead+':'+path]):
    git(['hash-object','-w','--stdin'],content);
   git(['update-index','--add','--cacheinfo',mode,blob,path],undefined,index);
  }
  const tree=git(['write-tree'],undefined,index);
  return git(['commit-tree',tree,'-p',sourceHead,'-m','9p isolated source negative only']);
 }finally{rmSync(dir,{recursive:true,force:true})}
};
const denied=(ref)=>assert.throws(()=>verifyR22Inventory0SourceCandidate(ref),
 /R22_INVENTORY0_SOURCE_DENIED_/);

test('Inventory0 exact Core/Cargo/Worker/secure final-Arc Source is candidate ONLY',()=>{
 const a=verifyR22Inventory0SourceCandidate(sourceHead);
 assert.equal(a.sourceHead,sourceHead);assert.equal(a.sourcePaths,11);
 assert.equal(a.coreTree,INVENTORY0_EXPECTED_CORE);
 assert.equal(a.cargoGitBlob,INVENTORY0_EXPECTED_CARGO);
 assert.equal(a.workerGitBlob,INVENTORY0_EXPECTED_WORKER);
 assert.equal(a.productSessionGitBlob,INVENTORY0_EXPECTED_ARC);
 for(const key of ['mergeAuthorized','signerAuthorized','writerAuthorized','operationOn',
  'oldBambooSignerGrantsThisBuild'])assert.equal(a[key],false,key);
 assert.equal(a.productCandidateOnly,true);
 assert.equal(a.requiresNewSecurityL2,true);
 assert.equal(a.sourceBytesPinned,true);
 assert.throws(()=>verifyR22Inventory0SourceCandidate('not-a-commit'),/NONCOMMIT_SHA/);
 denied('f420bbe72fbc3374f0a3867403c660873ce5f06a');
});

test('Every original Source blob and product authority field refuses substitutions',()=>{
 const x={core:INVENTORY0_EXPECTED_CORE,
  paths:Object.fromEntries(Object.entries(INVENTORY0_EXPECTED_SOURCE).map(
   ([p,b])=>[p,{blob:b,mode:'100644'}])),
  config:'30551c7cc566614f64c8ba04748c3aef44b419bb',
  readerCargo:'751a73da41d8b58f7de70643f50b97722a3c1260',
  lockSha256:'e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c',
  cargoFeature:true,exclusiveFeature:true,writer:false,consumer:false,
  releasePermission:false};
 assert.equal(r22Inventory0CandidateBytesExact(x),true);
 for(const path of Object.keys(x.paths)){
  assert.equal(r22Inventory0CandidateBytesExact({...x,paths:{...x.paths,
   [path]:{...x.paths[path],blob:'f'.repeat(40)}}}),false,path);
  assert.equal(r22Inventory0CandidateBytesExact({...x,paths:{...x.paths,
   [path]:{...x.paths[path],mode:'100755'}}}),false,path+' chmod');
 }
 for(const key of ['core','config','readerCargo','lockSha256'])
  assert.equal(r22Inventory0CandidateBytesExact({...x,[key]:'f'.repeat(64)}),false,key);
 for(const key of ['writer','consumer','releasePermission'])
  assert.equal(r22Inventory0CandidateBytesExact({...x,[key]:true}),false,key);
 for(const key of ['cargoFeature','exclusiveFeature'])
  assert.equal(r22Inventory0CandidateBytesExact({...x,[key]:false}),false,key);
 assert.equal(r22Inventory0CandidateBytesExact({...x,extra:true}),false);
 assert.equal(r22Inventory0CandidateBytesExact({...x,paths:{...x.paths,untrusted:{blob:'f'.repeat(40),mode:'100644'}}}),false);
});

test('Actual unreferenced forged Git trees reject Rust, Cargo, ABI, mode, trusted signer and rights',()=>{
 const old='34286a10bc726d9195d806b15273792614c99fa6';
 const cargo='crates/ddv-save-core/Cargo.toml',worker='crates/ddv-save-core/src/wasm_worker.rs';
 denied(makeChild([[cargo,'# FORGED_NEW_CARGO_FEATURE\n']]));
 denied(makeChild([[worker,'// FORGED_WORKER_ABI\n']]));
 denied(makeChild([['crates/ddv-save-core/src/product_session.rs','// OLD_LEAKING_ARC\n']]));
 denied(makeChild([['src/lib/ddv/core/save/product-scoped-amount-transport.mjs','// UNREVIEWED_ABI\n']]));
 denied(makeChild([[cargo,null,'100755']]));
 denied(makeChild([[worker,'../../unsafe-wasm', '120000']]));
 denied(makeChild([['scripts/wasm-distribution/protected-release-inputs.json','{"writerEnabled":true}']]));
 denied(makeChild([['scripts/wasm-distribution/r22-accepted-rust-scope.mjs','// R22_SELECTOR_MINT\n']]));
 denied(makeChild([['scripts/readonly-release/seal-bamboo-public-pages.mjs','// UNREVIEWED_SIGNER\n']]));
 denied(makeChild([['src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs','// FORGED_ISSUER\n']]));
 denied(makeChild([['crates/ddv-save-core/src/semantic_writer.rs','// UNREVIEWED_WRITER\n']]));
 denied(makeChild([['docs/09p-unreviewed-source.txt','unexpected new source\n']]));
 // A synthetic unrelated child without content changes remains valid; the
 // selection contract is Source-SHA scoped, not an ancient HEAD comparison.
 const same=makeChild([]);
 assert.equal(verifyR22Inventory0SourceCandidate(same).writerAuthorized,false);
 console.log('09P_INVENTORY0_R22_SCOPED_SOURCE_1POS_AND_NEGATIVE_GIT_OBJECTS_NO_SIGN_NO_ON');
});
