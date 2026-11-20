// 09P-CODE ACT1581. Exact CURRENT Inventory0 candidate classification ONLY.
// This is a negative release proof; it grants NO R22 trust/Writer/Bamboo/Op.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {
 BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS,bambooAcceptedRustSourceBlobsOk
} from '../scripts/readonly-release/seal-bamboo-public-pages.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const env={...process.env,GIT_NO_REPLACE_OBJECTS:'1'};
const git=(...args)=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',
 stdio:['ignore','pipe','pipe']}).trim();
const immutableInventorySource='4967897010faa78de494f1a27aea8b365c009d7d';
const reviewedBase='0e57c6b8585002b1baff91e6de573a835bed6577';
const required=new Map([
 [
  ".github/workflows/01a-steam626-inventory0-dedicated-rust-source.yml",
  "0cadac4a069190b71ec228542f43fc62c990e4ac"
 ],
 [
  "crates/ddv-save-core/Cargo.toml",
  "b3455c36d9d60b4a0e415026a095e47fe577644d"
 ],
 [
  "crates/ddv-save-core/src/product_session.rs",
  "e53c4930a84f729ea245f38a1b301c7178146ced"
 ],
 [
  "crates/ddv-save-core/src/wasm_worker.rs",
  "775a2766f237d44ae77fa5347e9adf430c8580d2"
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
 ]
]);
const expectedSourcePaths=[...required.keys()].sort();
const addPaths=['.github/workflows/09p-inventory0-r22-trust-source-deny.yml','tests/09p-inventory0-r22-trust-source-deny.test.mjs'].sort();
const core='6750ed91920f33be9f2acf180ca1326340d969ed';
const productSession='e53c4930a84f729ea245f38a1b301c7178146ced';
const cargo='b3455c36d9d60b4a0e415026a095e47fe577644d';
const wasmWorker='775a2766f237d44ae77fa5347e9adf430c8580d2';
const oldCargo='751a73da41d8b58f7de70643f50b97722a3c1260';
const readonlyConfig='30551c7cc566614f64c8ba04748c3aef44b419bb';
const approvedLock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const blob=(ref,path)=>git('rev-parse',ref+':'+path);
const entry=(ref,path)=>git('ls-tree',ref,'--',path);
const sourceDiff=(a,b)=>git('diff','--name-only','--no-renames',a,b).split('\n').filter(Boolean).sort();
const exactProfile=(p)=>p.core===core&&p.cargo===cargo&&p.worker===wasmWorker&&
 p.product===productSession&&p.config===readonlyConfig&&p.writer===false&&
 p.consumer===false&&p.publicGrant===false;
const stateFor=ref=>{
 const c=JSON.parse(git('show',ref+':scripts/wasm-distribution/protected-release-inputs.json'));
 return {core:blob(ref,'crates/ddv-save-core'),cargo:blob(ref,'crates/ddv-save-core/Cargo.toml'),
  worker:blob(ref,'crates/ddv-save-core/src/wasm_worker.rs'),
  product:blob(ref,'crates/ddv-save-core/src/product_session.rs'),
  config:blob(ref,'scripts/wasm-distribution/protected-release-inputs.json'),
  writer:c.writerEnabled,consumer:c.productConsumerEnabled,publicGrant:false};
};

test('ACT1581 exact source candidate is immutable Inventory0 OFF profile only',()=>{
 assert.equal(git('rev-parse','HEAD^'),immutableInventorySource);
 assert.deepEqual(sourceDiff('HEAD^','HEAD'),addPaths);
 assert.deepEqual(sourceDiff(reviewedBase,immutableInventorySource),expectedSourcePaths);
 assert.equal(git('merge-base',reviewedBase,'HEAD^'),reviewedBase);
 assert.equal(blob(immutableInventorySource,'crates/ddv-save-core'),core);
 for(const [path,hash] of required){
  assert.equal(entry(immutableInventorySource,path),'100644 blob '+hash+'\t'+path,
   'ORIGINAL_SOURCE_SHA_MODE_DENIED_'+path);
  assert.equal(entry('HEAD',path),'100644 blob '+hash+'\t'+path,
   'SCOPED_TEST_COMMIT_MUST_NOT_CHANGE_ORIGINAL_'+path);
 }
 const profile=stateFor('HEAD');
 assert.equal(exactProfile(profile),true);
 assert.equal(exactProfile({...profile,cargo:oldCargo}),false);
 assert.equal(exactProfile({...profile,worker:'f'.repeat(40)}),false);
 assert.equal(exactProfile({...profile,product:'f'.repeat(40)}),false);
 assert.equal(exactProfile({...profile,core:'f'.repeat(40)}),false);
 assert.equal(exactProfile({...profile,config:'f'.repeat(40)}),false);
 assert.equal(exactProfile({...profile,writer:true}),false);
 assert.equal(exactProfile({...profile,consumer:true}),false);
 assert.equal(exactProfile({...profile,publicGrant:true}),false);
 assert.equal(profile.publicGrant,false);
});

test('unmodified protected release Cargo and feature signer MUST DENY new Inventory0 binary',()=>{
 const config=JSON.parse(readFileSync(resolve(root,
  'scripts/wasm-distribution/protected-release-inputs.json'),'utf8'));
 assert.equal(blob('HEAD','scripts/wasm-distribution/protected-release-inputs.json'),readonlyConfig);
 assert.equal(config.cargoTomlGitBlob,oldCargo);
 assert.notEqual(config.cargoTomlGitBlob,cargo,
  'new Catalog0 Cargo feature cannot inherit old signed release pin');
 assert.deepEqual(config.features,['indexed-read','worker-wasm']);
 assert.equal(config.defaultFeatures,false);
 assert.equal(config.writerEnabled,false);
 assert.equal(config.productConsumerEnabled,false);
 assert.equal(config.approvedCargoLockSha256,approvedLock);
 const observed=Object.fromEntries(Object.keys(BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS).map(
  path=>[path,blob('HEAD',path)]));
 assert.equal(observed['crates/ddv-save-core/Cargo.toml'],cargo);
 assert.equal(observed['crates/ddv-save-core/src/wasm_worker.rs'],wasmWorker);
 assert.equal(observed['crates/ddv-save-core/src/product_session.rs'],productSession);
 assert.equal(bambooAcceptedRustSourceBlobsOk(observed),false,
  'Bamboo READ-ONLY signed15 must reject unapproved Inventory0 Cargo/Worker');
 // Even cloning the accepted signer dictionary except one new Source leaf
 // cannot sign an extra compiled feature or alternate Worker ABI.
 for(const path of ['crates/ddv-save-core/Cargo.toml',
  'crates/ddv-save-core/src/wasm_worker.rs',
  'crates/ddv-save-core/src/product_session.rs']){
  const mutated={...BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS,[path]:observed[path]};
  assert.equal(bambooAcceptedRustSourceBlobsOk(mutated),false,path);
 }
 for(const path of ['scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
  'scripts/wasm-distribution/r22-trusted-before-candidate.mjs',
  'scripts/wasm-distribution/protected-release-inputs.json',
  'scripts/readonly-release/seal-bamboo-public-pages.mjs',
  'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs']){
  assert.equal(blob('HEAD',path),blob(immutableInventorySource,path),
   'NO_TRUST_OR_SIGNER_CHANGE_'+path);
 }
 console.log('09P_INVENTORY0_EXACT_SOURCE_ONLY_SIGNER_AND_R22_DENIED_NO_ON');
});
