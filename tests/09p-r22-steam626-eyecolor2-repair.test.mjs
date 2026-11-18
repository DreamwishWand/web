import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const cwd=resolve(fileURLToPath(new URL('../',import.meta.url)));
const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}}).trim();
const inputPath='scripts/wasm-distribution/protected-release-inputs.json';
const base='05e9e86da643e545b6b750611183bdf57f648798';
const prior='9157b04a92dfe203d71a9c3977e8f9f50d5ce9b8';
const postCargo='aa6b1dd771da305bf7a21c6101fb4620a8b74b93';
const beforeCargo='e4f2e2c5d4451baba2dea699fe497cb7b40668d4';
const lock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const sha=b=>createHash('sha256').update(b).digest('hex');
const config=JSON.parse(readFileSync(resolve(cwd,inputPath),'utf8'));
const previous=JSON.parse(git('show',base+':'+inputPath));
const expectedSourceChanged=[
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
test('R22 protected Cargo input is exactly current integrated EyeColor2 product source, not a generic opt-in',()=>{
 assert.equal(git('rev-parse','HEAD^'),base);
 assert.equal(git('rev-parse','HEAD:crates/ddv-save-core/Cargo.toml'),postCargo);
 assert.equal(git('rev-parse',base+':crates/ddv-save-core/Cargo.toml'),postCargo);
 assert.equal(git('rev-parse',prior+':crates/ddv-save-core/Cargo.toml'),beforeCargo);
 assert.equal(previous.cargoTomlGitBlob,beforeCargo);
 assert.equal(config.cargoTomlGitBlob,postCargo);
 assert.deepEqual({...config,cargoTomlGitBlob:beforeCargo},previous);
 assert.deepEqual(config.features,['indexed-read','worker-wasm']);
 assert.equal(config.defaultFeatures,false);
 assert.equal(config.publicReadonlyAssetsApproved,true);
 assert.equal(config.writerEnabled,false);
 assert.equal(config.productConsumerEnabled,false);
 assert.equal(config.approvedCargoLockSha256,lock);
 assert.equal(sha(readFileSync(resolve(cwd,'scripts/wasm-distribution/approved-Cargo.lock'))),lock);
});
test('R22 source provenance pin covers the exact original 09 INT nine-file merge and nothing more',()=>{
 assert.deepEqual(git('diff','--name-only','--no-renames',prior,base).split('\n').filter(Boolean).sort(),expectedSourceChanged);
 assert.equal(git('rev-parse',prior+':crates/ddv-save-core'), '972261d9e60e66df67209583a356ad812e29b37c');
 assert.equal(git('rev-parse',base+':crates/ddv-save-core'), 'b5416aa726caea9d311075599ac606e11285b295');
 assert.equal(git('rev-parse',base+':crates/ddv-save-core/src/wasm_steam626_eyecolor2.rs'),'1b68343ef3093352dceb00af6dfd67bf1bdde24d');
 assert.equal(git('rev-parse',base+':crates/ddv-save-core/src/worker_steam626_eyecolor2.rs'),'2f6b077cf2cc1b47892b7a01ce697ce48bb505ce');
 const expectedChanged=[
  '.github/workflows/09p-r22-steam626-eyecolor2-repair.yml',
  inputPath,
  'tests/09p-r22-steam626-eyecolor2-repair.test.mjs'
 ].sort();
 assert.deepEqual(git('diff','--name-only','--no-renames',base,'HEAD').split('\n').filter(Boolean).sort(),expectedChanged);
 for(const path of expectedChanged){
  assert.equal(git('ls-tree','HEAD',path).slice(0,6),'100644',path);
 }
});
test('R22 protected issuer and private Save boundaries stay fixed, rejected input mutations are not approved',()=>{
 const unchanged=[
  '.github/workflows/pages.yml',
  'scripts/wasm-distribution/verify-protected-release.mjs',
  'scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
  'scripts/readonly-release/seal.mjs',
  'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs',
  'src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs',
  'scripts/wasm-distribution/approved-Cargo.lock'
 ];
 for(const path of unchanged){
  assert.equal(git('rev-parse',base+':'+path),git('rev-parse','HEAD:'+path),path);
 }
 const isAccepted=tuple=>tuple.cargoTomlGitBlob===postCargo&&
  JSON.stringify(tuple.features)==='["indexed-read","worker-wasm"]'&&
  tuple.defaultFeatures===false&&tuple.writerEnabled===false&&
  tuple.productConsumerEnabled===false&&tuple.approvedCargoLockSha256===lock;
 assert.equal(isAccepted(config),true);
 assert.equal(isAccepted({...config,cargoTomlGitBlob:beforeCargo}),false);
 assert.equal(isAccepted({...config,features:['worker-wasm','product-steam626-eyecolor2-scoped']}),false);
 assert.equal(isAccepted({...config,writerEnabled:true}),false);
 assert.equal(isAccepted({...config,approvedCargoLockSha256:'0'.repeat(64)}),false);
 assert.equal(git('rev-parse','HEAD:.github/workflows/pages.yml'),'ed8aabff1dc8c8b426054c7dff0d88faa2b02da4');
});
