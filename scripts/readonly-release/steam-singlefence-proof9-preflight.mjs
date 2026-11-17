// 09P-CODE ACT1582: exact accepted Steam626 SingleFence Proof9 source preflight.
// This is NOT a signed proof, workflow_dispatch, Writer, V2, or Merge permission.
// Do not add a new runtime Registry/Engine or modify existing issuer/Pages.
//
// This narrow preflight pins the currently accepted proof inputs. A proof-only
// signer/workflow requires a separate 04 QR-S L2 acceptance and 09 INT gate.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SINGLEFENCE_PROOF9_BASE='93332153aed6b3b24ae885084470974c367eb484';
export const SINGLEFENCE_PROOF9_BID='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
export const SINGLEFENCE_PROOF9_PINS=Object.freeze([
  {
    "path": "crates/ddv-save-core/src/steam_single_fence_product_target.rs",
    "sha": "dd71dddccb4e961952529905dc7ac6f54f38cea5",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "crates/ddv-save-core/src/fence_add_shape.rs",
    "sha": "6805c67f525829744dde2fe32b31668b5c401e12",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "crates/ddv-save-core/src/product_session.rs",
    "sha": "6c7cf61f41a8b985ae5ccbd7d84c0aa475040f28",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "crates/ddv-save-core/src/wasm_worker.rs",
    "sha": "e7da141bc3525f234b999b0febc47540d95e1560",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "crates/ddv-save-core/Cargo.toml",
    "sha": "cfd550b690e42e93a48b913457c35a5ea0cb7bc7",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "scripts/wasm-distribution/r22-accepted-rust-scope.mjs",
    "sha": "7c778ad1dfaed2b6ff82b4200dab134384783179",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "scripts/wasm-distribution/protected-release-inputs.json",
    "sha": "865aa54e99d11029250478ba6583bdec226dfa6d",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "scripts/wasm-distribution/approved-Cargo.lock",
    "sha": "b667b42cfef2032c2925be7b2aa9b7142bff4b52",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": ".github/workflows/pages.yml",
    "sha": "31339903787633703f8b438800d66fb42052f2f5",
    "mode": "100644",
    "type": "blob"
  },
  {
    "path": "scripts/readonly-release/seal.mjs",
    "sha": "5b86ff1cf2dc009ba1733bf213e4cb979bf500ec",
    "mode": "100644",
    "type": "blob"
  }
].map(Object.freeze));
export const SINGLEFENCE_PROOF9_ALLOWED_DIFF=Object.freeze(["scripts/readonly-release/steam-singlefence-proof9-preflight.mjs","tests/steam-singlefence-proof9-preflight.test.mjs"].sort());
const SHA=/^[0-9a-f]{40}$/;
const fail=()=>{throw Error('SINGLEFENCE_PROOF9_PREFLIGHT_DENIED')};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,fields)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&equal(Object.keys(o).sort(),fields.slice().sort());
const pathList=a=>Array.isArray(a)&&a.length===SINGLEFENCE_PROOF9_ALLOWED_DIFF.length&&a.every(p=>typeof p==='string')&&equal(a.slice().sort(),SINGLEFENCE_PROOF9_ALLOWED_DIFF);
export function verifySteamSingleFenceProof9Preflight(s){
 if(!exact(s,['repositoryId','protectedMain','parent','candidate','buildId','changedPaths','blobs']))fail();
 if(s.repositoryId!==1371485649||s.protectedMain!==SINGLEFENCE_PROOF9_BASE||s.parent!==SINGLEFENCE_PROOF9_BASE||
    !SHA.test(s.candidate)||s.candidate===SINGLEFENCE_PROOF9_BASE||s.buildId!==SINGLEFENCE_PROOF9_BID||
    !pathList(s.changedPaths)||!exact(s.blobs,SINGLEFENCE_PROOF9_PINS.map(p=>p.path)))fail();
 for(const p of SINGLEFENCE_PROOF9_PINS){
  const actual=s.blobs[p.path];
  if(!exact(actual,['sha','mode','type'])||actual.sha!==p.sha||actual.mode!==p.mode||actual.type!==p.type)fail();
 }
 return Object.freeze({
  status:'SINGLEFENCE_PROOF9_SOURCE_PINS_EXACT_ONLY',
  contract:'wand.steam626.single-fence.proof9.preflight@1',
  candidate:s.candidate,protectedMain:s.protectedMain,pinCount:SINGLEFENCE_PROOF9_PINS.length,
  exactBuildId:SINGLEFENCE_PROOF9_BID,
  proofDispatched:false,signedSubjectsVerified:false,realEncryptedSaveV2Verified:false,
  releaseAuthorized:false,writerAuthorized:false,operationOn:false
 });
}
// Local/GitHub CLI inspection; no network, secret, mutation, upload or signing.
export function inspectGitProof9Candidate(candidate,protectedMain){
 const cwd=resolve(import.meta.dirname,'../..');
 const git=(...a)=>execFileSync('git',a,{cwd,encoding:'utf8'}).trim();
 if(!SHA.test(candidate)||!SHA.test(protectedMain))fail();
 const verified=git('rev-parse','--verify',candidate+'^{commit}');
 const parent=git('rev-parse','--verify',candidate+'^');
 if(verified!==candidate||parent!==protectedMain)fail();
 const changedPaths=git('diff','--name-only',protectedMain,candidate).split('\n').filter(Boolean);
 const blobs={};
 for(const p of SINGLEFENCE_PROOF9_PINS){
  const entry=git('ls-tree',candidate,'--',p.path);
  const match=/^(\d{6}) (blob) ([0-9a-f]{40})\t(.+)$/.exec(entry);
  if(!match||match[4]!==p.path)fail();
  blobs[p.path]={mode:match[1],type:match[2],sha:match[3]};
 }
 return verifySteamSingleFenceProof9Preflight({
  repositoryId:1371485649,protectedMain,parent,candidate,buildId:SINGLEFENCE_PROOF9_BID,
  changedPaths,blobs
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==4)fail();
  const result=inspectGitProof9Candidate(process.argv[2],process.argv[3]);
  console.log(JSON.stringify(result));
 }catch{
  console.error('SINGLEFENCE_PROOF9_PREFLIGHT_DENIED');
  process.exitCode=1;
 }
}
