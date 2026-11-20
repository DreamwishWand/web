// ACT1581 R22 Steam626 Inventory0: new product source candidate classifier.
// NO release signer/issuer, trusted R22 selector mutation, Writer, ON or Pages grant.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const base='0e57c6b8585002b1baff91e6de573a835bed6577';
const shaPattern=/^[0-9a-f]{40}$/;
const fullCore='6750ed91920f33be9f2acf180ca1326340d969ed';
const cargo='b3455c36d9d60b4a0e415026a095e47fe577644d';
const worker='775a2766f237d44ae77fa5347e9adf430c8580d2';
const finalArc='e53c4930a84f729ea245f38a1b301c7178146ced';
const readonlyConfig='30551c7cc566614f64c8ba04748c3aef44b419bb';
const acceptedReaderCargo='751a73da41d8b58f7de70643f50b97722a3c1260';
const approvedLock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const productFilePairs=[
 [
  ".github/workflows/01a-steam626-inventory0-dedicated-rust-source.yml",
  "19d7f0c532badecc86f8d36ff89eed1ba0e28bf2"
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
];
const ownPaths=Object.freeze(['scripts/wasm-distribution/r22-inventory0-product-source.mjs','tests/09p-r22-inventory0-product-source.test.mjs','.github/workflows/09p-r22-inventory0-product-source.yml','scripts/wasm-distribution/r22-inventory0-unsigned-pair.mjs','tests/09p-r22-inventory0-unsigned-pair.test.mjs']);
export const INVENTORY0_EXPECTED_SOURCE=Object.freeze(Object.fromEntries(productFilePairs));
export const INVENTORY0_EXPECTED_CORE=fullCore;
export const INVENTORY0_EXPECTED_CARGO=cargo;
export const INVENTORY0_EXPECTED_WORKER=worker;
export const INVENTORY0_EXPECTED_ARC=finalArc;
const allPaths=[...Object.keys(INVENTORY0_EXPECTED_SOURCE),...ownPaths].sort();
const cleanEnv={...process.env,GIT_NO_REPLACE_OBJECTS:'1'};
const git=(...args)=>execFileSync('git',args,{cwd:root,env:cleanEnv,encoding:'utf8',
 stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024}).trim();
const gitBytes=(...args)=>execFileSync('git',args,{cwd:root,env:cleanEnv,
 stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
const deny=(reason)=>{throw Error('R22_INVENTORY0_SOURCE_DENIED_'+reason)};
const shaOk=x=>typeof x==='string'&&shaPattern.test(x);
const exactKeys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===expected.length&&expected.every(k=>Object.hasOwn(value,k));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function r22Inventory0CandidateBytesExact(snapshot){
 const fileKeys=Object.keys(INVENTORY0_EXPECTED_SOURCE);
 if(!exactKeys(snapshot,['core','paths','config','readerCargo','lockSha256',
  'cargoFeature','exclusiveFeature','writer','consumer','releasePermission']))return false;
 if(!exactKeys(snapshot.paths,fileKeys))return false;
 for(const [path,blob] of productFilePairs){
  const entry=snapshot.paths[path];
  if(!exactKeys(entry,['blob','mode'])||entry.blob!==blob||entry.mode!=='100644')return false;
 }
 return snapshot.core===fullCore&&snapshot.config===readonlyConfig&&
  snapshot.readerCargo===acceptedReaderCargo&&snapshot.lockSha256===approvedLock&&
  snapshot.cargoFeature===true&&snapshot.exclusiveFeature===true&&
  snapshot.writer===false&&snapshot.consumer===false&&
  snapshot.releasePermission===false;
}

// Fixed Git commit only: no caller-provided path, branch selectors, Source bytes
// or environment variable can expand the allowed Rust/ABI surface.
export function verifyR22Inventory0SourceCandidate(sourceHead){
 if(!shaOk(sourceHead))deny('NONCOMMIT_SHA');
 try{
  if(git('cat-file','-t',sourceHead)!=='commit')deny('NOT_COMMIT');
  if(git('merge-base',base,sourceHead)!==base)deny('WRONG_PROTECTED_BASE');
  const changed=git('diff','--name-only','--no-renames',base,sourceHead)
   .split('\n').filter(Boolean).sort();
  if(!equal(changed,allPaths))deny('UNREVIEWED_CHANGED_PATHS');
  const paths={};
  for(const path of Object.keys(INVENTORY0_EXPECTED_SOURCE)){
   const line=git('ls-tree',sourceHead,'--',path);
   const exact=/^(100644|100755|120000) blob ([0-9a-f]{40})\t(.+)$/.exec(line);
   if(!exact||exact[3]!==path)deny('MISSING_OR_BAD_MODE_'+path);
   paths[path]={blob:exact[2],mode:exact[1]};
  }
  for(const path of ownPaths){
   const line=git('ls-tree',sourceHead,'--',path);
   if(!/^100644 blob [0-9a-f]{40}\t/.test(line)||
      !line.endsWith('\t'+path))deny('CANDIDATE_TEST_PATH_MODE_'+path);
  }
  // Existing security/issuer/signer bytes must stay unchanged. This does
  // NOT enroll the new Cargo in any Bamboo public signed15 profile.
  for(const path of [
   'scripts/wasm-distribution/protected-release-inputs.json',
   'scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
   'scripts/wasm-distribution/r22-trusted-before-candidate.mjs',
   'scripts/readonly-release/seal-bamboo-public-pages.mjs',
   'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs']){
   if(git('rev-parse',base+':'+path)!==git('rev-parse',sourceHead+':'+path))
    deny('SIGNER_OR_ISSUER_DRIFT_'+path);
  }
  const input=JSON.parse(git('show',sourceHead+':scripts/wasm-distribution/protected-release-inputs.json'));
  const cargoBody=git('show',sourceHead+':crates/ddv-save-core/Cargo.toml');
  const workerBody=git('show',sourceHead+':crates/ddv-save-core/src/wasm_worker.rs');
  const actualLock=createHash('sha256')
   .update(gitBytes('show',sourceHead+':scripts/wasm-distribution/approved-Cargo.lock')).digest('hex');
  const profile={
   core:git('rev-parse',sourceHead+':crates/ddv-save-core'),
   paths,config:git('rev-parse',sourceHead+':scripts/wasm-distribution/protected-release-inputs.json'),
   readerCargo:input.cargoTomlGitBlob,lockSha256:actualLock,
   cargoFeature:cargoBody.includes('product-steam626-catalog0-scoped = ["product-amount-scoped"]'),
   exclusiveFeature:workerBody.includes('STEAM626_CATALOG0_PRODUCT_FEATURE_CONFLICT'),
   writer:input.writerEnabled,consumer:input.productConsumerEnabled,
   releasePermission:false
  };
  if(!r22Inventory0CandidateBytesExact(profile))deny('EXACT_CORE_CARGO_ABI_SHA_OR_FLAGS');
  if(input.approvedCargoLockSha256!==approvedLock||
     !equal(input.features,['indexed-read','worker-wasm'])||
     input.defaultFeatures!==false||input.publicReadonlyAssetsApproved!==true||
     input.cargoTomlGitBlob===cargo)deny('OLD_READER_SIGNATURE_PIN_MUST_NOT_GRANT_CATALOG0');
  // Deliberately not an accepted source selector: QA, protected-main CAS,
  // separate product-signing contract, Owner V2, and 09INT remain mandatory.
  return Object.freeze({contract:'wand.r22.steam626.inventory0.source-candidate@1',
   sourceHead,sourcePaths:productFilePairs.length,coreTree:fullCore,
   cargoGitBlob:cargo,workerGitBlob:worker,productSessionGitBlob:finalArc,
   sourceBytesPinned:true,oldBambooSignerGrantsThisBuild:false,
   productCandidateOnly:true,mergeAuthorized:false,signerAuthorized:false,
   writerAuthorized:false,operationOn:false,requiresNewSecurityL2:true});
 }catch(err){
  if(String(err).includes('R22_INVENTORY0_SOURCE_DENIED_'))throw err;
  deny('GIT_OR_JSON_FAILURE');
 }
}

const protectedSecurityBase='f420bbe72fbc3374f0a3867403c660873ce5f06a';
const lastSourcePaths=[...Object.keys(INVENTORY0_EXPECTED_SOURCE),...ownPaths]
 .filter(path=>path!=='crates/ddv-save-core/src/product_session.rs').sort();

// This is an offline synthetic read-only composition of the SOURCE GitBlobs
// with the exact protected SECURITY main; it cannot merge refs or sign Pages.
// Current-live protected-main CAS remains 09INT's exclusive responsibility.
export function verifyR22Inventory0MainFirstSynthetic(candidateHead){
 if(!shaOk(candidateHead))deny('MAIN_FIRST_NONCOMMIT_SHA');
 try{
  if(git('cat-file','-t',candidateHead)!=='commit')deny('MAIN_FIRST_NOT_COMMIT');
  if(git('rev-parse',candidateHead+'^')!==protectedSecurityBase)
   deny('MAIN_FIRST_WRONG_PROTECTED_PARENT');
  const delta=git('diff','--name-only','--no-renames',
   protectedSecurityBase,candidateHead).split('\n').filter(Boolean).sort();
  if(!equal(delta,lastSourcePaths))deny('MAIN_FIRST_UNREVIEWED_PATHS');
  for(const [path,blob] of productFilePairs){
   const entry=git('ls-tree',candidateHead,'--',path);
   if(entry!=='100644 blob '+blob+'\t'+path)
    deny('MAIN_FIRST_SOURCE_BLOB_MODE_'+path);
  }
  for(const path of ownPaths){
   const entry=git('ls-tree',candidateHead,'--',path);
   if(!/^100644 blob [0-9a-f]{40}\t/.test(entry)||
      !entry.endsWith('\t'+path))deny('MAIN_FIRST_09P_PATH_MODE_'+path);
  }
  for(const path of [
    'scripts/wasm-distribution/protected-release-inputs.json',
    'scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
    'scripts/wasm-distribution/r22-trusted-before-candidate.mjs',
    'scripts/wasm-distribution/verify-protected-release.mjs',
    'scripts/readonly-release/seal-bamboo-public-pages.mjs',
    'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs',
    '.github/workflows/pages.yml',
    'scripts/wasm-distribution/approved-Cargo.lock'
  ]){
   const accepted=git('ls-tree',protectedSecurityBase,'--',path);
   if(git('ls-tree',candidateHead,'--',path)!==accepted)
    deny('MAIN_FIRST_PROTECTED_AUTHORITY_DRIFT_'+path);
  }
  const config=JSON.parse(git('show',
   candidateHead+':scripts/wasm-distribution/protected-release-inputs.json'));
  if(config.cargoTomlGitBlob!==acceptedReaderCargo||
     config.approvedCargoLockSha256!==approvedLock||
     !equal(config.features,['indexed-read','worker-wasm'])||
     config.writerEnabled!==false||config.productConsumerEnabled!==false||
     config.defaultFeatures!==false)
   deny('MAIN_FIRST_OLD_SIGNER_MUST_DENY_NEW_CARGO');
  if(git('rev-parse',candidateHead+':crates/ddv-save-core')!==fullCore)
   deny('MAIN_FIRST_FULL_RUST_CORE');
  // No Source stage grants protected rights, even if GitBlob composition fits.
  return Object.freeze({contract:'wand.r22.steam626.inventory0.synthetic-main-first@1',
   fixedProtectedBase:protectedSecurityBase,candidateHead,
   changedPaths:lastSourcePaths.length,sourceBytesPinned:true,
   oldSignerGrantsInventory0:false,mergeAuthorized:false,signerAuthorized:false,
   writerAuthorized:false,operationOn:false,latestProtectedCASVerified:false,
   genuineEncryptedProductV2Verified:false,requiresIndependentSecurityL2:true});
 }catch(err){
  if(String(err).includes('R22_INVENTORY0_SOURCE_DENIED_'))throw err;
  deny('MAIN_FIRST_GIT_OR_JSON_FAILURE');
 }
}
