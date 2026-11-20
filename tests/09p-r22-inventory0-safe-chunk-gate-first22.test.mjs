// 09P ACT1581 Gate-first trusted selector acceptance PROOF ONLY.
// No refs, Pages, signer, Write, user Save, or Owner workstation operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyAcceptedRustScope} from '../scripts/wasm-distribution/r22-accepted-rust-scope.mjs';
const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const protectedPreGate='e6539d2af04048540f8bfa4fce480bbb80547a59';
const sourceOriginal='0dcf2b8e272442f6108f14eef1909780022c4efb';
const exact=[
  [
    ".github/workflows/01a-steam626-inventory0-dedicated-rust-source.yml",
    "aa407c444f434e444fb459d6c122405369bf220b"
  ],
  [
    "crates/ddv-save-core/Cargo.toml",
    "b3455c36d9d60b4a0e415026a095e47fe577644d"
  ],
  [
    "crates/ddv-save-core/src/wasm_worker.rs",
    "f4cf9d66f857a2e20b597de9f697a458b6ab550c"
  ],
  [
    "crates/ddv-save-core/src/wasm_steam626_eyecolor2.rs",
    "1f31facb11f54d0e52f5b2188393a9d488c1fb35"
  ],
  [
    "crates/ddv-save-core/src/wasm_steam626_makeup_color1.rs",
    "afc6290a286adc8ad68b6cc9c8f0267c64a27106"
  ],
  [
    "crates/ddv-save-core/src/wasm_switch624_frp01.rs",
    "fdd5e85bff63fe0d147c604586e38654cb49d8ed"
  ],
  [
    "crates/ddv-save-core/src/wasm_switch626_fd01.rs",
    "478c950cecbeb89387a555ce1ac56a10f53f30ac"
  ],
  [
    "crates/ddv-save-core/src/wasm_switch626_fe01.rs",
    "242641a0cabb49029df40f1ea27dc4985ffb40db"
  ],
  [
    "crates/ddv-save-core/src/wasm_switch626_fixed_fence_add.rs",
    "ee9fbf6af12ca9ceb6cd9eae1e4814259e770d36"
  ],
  [
    "crates/ddv-save-core/src/wasm_switch626_makeup_color1.rs",
    "1dae83f8c56c6ab6ecb9d6dc8e00c8965d646dc2"
  ],
  [
    "src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs",
    "3b61beb6288826c57ab9d029b214cee614dfafc5"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs",
    "5a9ae08833f11d03fe1986bd679438591842b76e"
  ],
  [
    "src/lib/ddv/core/save/product-scoped-amount-transport.mjs",
    "0312afdd91cb07d377a233f454ff07894de6eec5"
  ],
  [
    "src/lib/ddv/core/save/product-wasm-read-owner.mjs",
    "81cd04b906f6cab7b1ea1749fb7fc981003a3b03"
  ],
  [
    "tests/01a-steam626-catalog0-product-worker-port.test.mjs",
    "0b3c1a8d8a75ac2cbe1a87555d08e75f0deddc6b"
  ],
  [
    "tests/01a-steam626-inventory0-exclusive-rust-feature.test.mjs",
    "0594a05690faf4902e761831887b6a31ae39d89a"
  ],
  [
    "tests/product-steam626-catalog0-local-adapter.test.mjs",
    "4e7f7afe825d7cabb9469385b33322e98ad7aa2b"
  ],
  [
    ".github/workflows/09p-r22-inventory0-product-source.yml",
    "1d5ec9520ee994903a5a44dcca87e7506d735cd5"
  ],
  [
    "scripts/wasm-distribution/r22-inventory0-product-source.mjs",
    "487173537da1611d6e15392ddb76d1cd74940c0e"
  ],
  [
    "tests/09p-r22-inventory0-product-source.test.mjs",
    "3d78946f8afa426d6aa210467f8d37f540efec20"
  ],
  [
    "scripts/wasm-distribution/r22-inventory0-unsigned-pair.mjs",
    "3cc7f2b2954e5146e3d9129db125a6cb9ffd7ea7"
  ],
  [
    "tests/09p-r22-inventory0-unsigned-pair.test.mjs",
    "7e04eb17090b075e72a82c5efb5050762e30a670"
  ]
];
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1',
 GIT_AUTHOR_NAME:'09P source-only synthetic',GIT_AUTHOR_EMAIL:'09p-gate@example.invalid',
 GIT_COMMITTER_NAME:'09P source-only synthetic',GIT_COMMITTER_EMAIL:'09p-gate@example.invalid'};
const git=(args,input,extra={})=>execFileSync('git',args,{
 cwd,env:{...env,...extra},input,encoding:'utf8',
 stdio:['pipe','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
const base=git(['rev-parse','HEAD']);
function construct(deltas=[],otherParents=[]){
 const dir=mkdtempSync(join(tmpdir(),'9p-gate-first22-'));
 try{
  const index={GIT_INDEX_FILE:join(dir,'index')};
  git(['read-tree',base+'^{tree}'],undefined,index);
  for(const [path,sha] of exact)
   git(['update-index','--add','--cacheinfo','100644',sha,path],undefined,index);
  for(const [path,content,mode='100644'] of deltas){
   const sha=content===null?git(['rev-parse',base+':'+path]):
    git(['hash-object','-w','--stdin'],content);
   git(['update-index','--add','--cacheinfo',mode,sha,path],undefined,index);
  }
  const tree=git(['write-tree'],undefined,index);
  const argv=['commit-tree',tree,'-p',base];
  for(const p of otherParents)argv.push('-p',p);
  return git([...argv,'-m','09P source-only immutable synthetic never signed']);
 }finally{rmSync(dir,{recursive:true,force:true})}
}
const denied=c=>assert.throws(()=>verifyAcceptedRustScope(cwd,base,c),/R22_ACCEPTED_SCOPE_|SOURCE_PATH_SET_MISMATCH|MAIN_PREIMAGE_MISMATCH|NON_REGULAR_OR_AMBIGUOUS_PATH/);
test('Gate-first HEAD only changed trusted scope; Rust/Bamboo/approved Cargo remain original',()=>{
 assert.equal(git(['rev-parse',protectedPreGate+':crates/ddv-save-core']),
  '42bebc4aa5a451abc4a9df29f0bc298df92df6a3');
 assert.equal(git(['rev-parse',base+':crates/ddv-save-core']),
  '42bebc4aa5a451abc4a9df29f0bc298df92df6a3');
 assert.equal(git(['rev-parse',base+':crates/ddv-save-core/Cargo.toml']),
  '751a73da41d8b58f7de70643f50b97722a3c1260');
 assert.equal(git(['rev-parse',base+':scripts/readonly-release/seal-bamboo-public-pages.mjs']),
  'e6290e890ac205f6486a76567e7ccac90f8d9aba');
 assert.equal(git(['rev-parse',base+':scripts/wasm-distribution/protected-release-inputs.json']),
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
 assert.equal(git(['rev-parse',base+':crates/ddv-save-core/src/product_session.rs']),
  'e53c4930a84f729ea245f38a1b301c7178146ced');
 assert.equal(exact.length,22);
 for(const [path,sha] of exact){
  assert.equal(git(['cat-file','-t',sha]),'blob','original '+path);
  assert.equal(git(['ls-tree',sourceOriginal,'--',path]),
   '100644 blob '+sha+'\t'+path);
 }
});
test('exact reviewed product10+09P5 Git blobs are source-selector-only, OFF',()=>{
 const s=construct();
 const result=verifyAcceptedRustScope(cwd,base,s);
 assert.equal(result.status,'R22_EXACT_ACCEPTED_SOURCE_SCOPE_MATCH_ONLY');
 assert.equal(result.entryCount,22);
 assert.equal(result.inventory0GateFirstSourceOnly,true);
 assert.equal(result.inventory0SafeChunkOnly,true);
 assert.equal(result.newInventory0WorkerGitBlob,'f4cf9d66f857a2e20b597de9f697a458b6ab550c');
 assert.equal(result.originalSourceCount,17);
 assert.equal(result.originalExternalProofCount,5);
 for(const key of ['mergeAuthorized','signerAuthorized','writerAuthorized',
  'operationOn','productSignedBuild'])assert.equal(result[key],false,key);
 assert.equal(result.originalEncryptedSaveV2,'NOT_RUN');
 assert.equal(result.independentProductSignerSecurityL2,'NOT_RUN');
 assert.equal(git(['rev-parse','HEAD']),base);
 assert.equal(git(['rev-parse',s+':crates/ddv-save-core']),
  '66eeda64ddfa60835b446f94f7b98df715f59e14');
 assert.equal(git(['rev-parse',s+':scripts/readonly-release/seal-bamboo-public-pages.mjs']),
  'e6290e890ac205f6486a76567e7ccac90f8d9aba');
 assert.equal(git(['rev-parse',s+':scripts/wasm-distribution/protected-release-inputs.json']),
  '30551c7cc566614f64c8ba04748c3aef44b419bb');
 console.log('09P_INVENTORY0_REPAIRED_GATE_FIRST_EXACT22_SOURCE_ONLY_NO_SIGN_NO_ON');
});
test('mutated Rust/Cargo/Worker/aux/source mode, extras, second parent all denied',()=>{
 const cargo='crates/ddv-save-core/Cargo.toml';
 const worker='crates/ddv-save-core/src/wasm_worker.rs';
 const own='scripts/wasm-distribution/r22-inventory0-product-source.mjs';
 denied(construct([[cargo,'# R22_UNREVIEWED_CARGO_FEATURE\n']]));
 denied(construct([[worker,'// R22_UNREVIEWED_WORKER_ABI\n']]));
 // Independent 05QR-C TRUE_RED old Worker775 temporary returned plaintext.
 denied(construct([[worker,git(['cat-file','-p','775a2766f237d44ae77fa5347e9adf430c8580d2'])]]));
 denied(construct([[own,'// R22_SELF_APPROVAL_MUTATION\n']]));
 denied(construct([[own,'// R22_WRONG_EXECUTABLE_MODE\n','100755']]));
 denied(construct([[worker,'/tmp/unsafe-worker','120000']]));
 denied(construct([['src/lib/ddv/core/save/product-unknown-writer.mjs','// unreviewed\n']]));
 denied(construct([['scripts/wasm-distribution/protected-release-inputs.json','{"writerEnabled":true}']]));
 denied(construct([['scripts/readonly-release/seal-bamboo-public-pages.mjs','// untrusted signer\n']]));
 denied(construct([['crates/ddv-save-core/src/product_session.rs','// old Arc leak\n']]));
 denied(construct([], [sourceOriginal]));
 console.log('09P_INVENTORY0_GATE_FIRST_10_NEG_WRITER_OFF');
});
