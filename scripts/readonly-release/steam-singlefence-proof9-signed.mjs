// 09P CODE: protected Steam626 SingleFence Proof9 only. No Pages, Writer, Stage, or private Save.
import {readFile,mkdir,writeFile,readdir,lstat,realpath} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SINGLEFENCE_PROOF9_BASE as signedReaderAncestor,
 SINGLEFENCE_PROOF9_BID as buildId,SINGLEFENCE_PROOF9_PINS as pinned} from './steam-singlefence-proof9-preflight.mjs';
import {ACTIVE_RELEASE_TUPLE} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {verifySignedReleaseSubjects} from './seal.mjs';
import {inspectProtectedCi,revalidateProtectedCi,createPublicJsonGetter} from '../int-protected-ci-gate.mjs';

const root=resolve(import.meta.dirname,'../..');
const proofWorkflow='.github/workflows/steam626-singlefence-proof9.yml';
const proofOutput='tests/wasm-distribution/fixtures/steam626-singlefence-proof9';
const names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const sha40=/^[0-9a-f]{40}$/,sha64=/^[0-9a-f]{64}$/;
const lockSha='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const cargoPin=pinned.find(p=>p.path==='crates/ddv-save-core/Cargo.toml').sha;
export const PROOF_SIGNER=Object.freeze({...ACTIVE_RELEASE_TUPLE,
 signerWorkflow:ACTIVE_RELEASE_TUPLE.repository+'/'+proofWorkflow});
const fail=()=>{throw Error('SINGLEFENCE_PROOF9_SIGNED_SCOPE_DENIED')};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
 same(Object.keys(obj).sort(),keys.slice().sort());
const hex=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8',
 env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},stdio:['ignore','pipe','ignore']}).trim()}catch{fail()}};
const featureNames=['product-steam626-singlefence-readonly','worker-wasm'];

// Synthetic receipts are never evidence of signing. Only on-main Git and
// actual Sigstore signature checks may advance to a signed proof.
export function validateProofGitSnapshot(s){
 if(!exact(s,['repositoryId','sourceHead','buildId','blobs'])||
 s.repositoryId!==1371485649||!sha40.test(s.sourceHead)||s.buildId!==buildId||
 !exact(s.blobs,pinned.map(p=>p.path)))fail();
 for(const p of pinned){
  if(!exact(s.blobs[p.path],['sha','mode','type'])||
   !same(s.blobs[p.path],{sha:p.sha,mode:p.mode,type:p.type}))fail();
 }
 return Object.freeze({status:'SINGLEFENCE_PROOF9_EXACT10_SOURCE_ONLY',
  sourceHead:s.sourceHead,pinCount:10,proofDispatched:false,
  signedSubjectsVerified:false,writerAuthorized:false,operationOn:false});
}
export function proofWorkflowContext(e){
 const source=e.WAND_PROOF_EXPECTED_SOURCE;
 if(!sha40.test(source??'')||e.GITHUB_ACTIONS!=='true'||
  e.GITHUB_EVENT_NAME!=='workflow_dispatch'||
  e.GITHUB_REPOSITORY_ID!=='1371485649'||
  e.GITHUB_REPOSITORY!==PROOF_SIGNER.repository||
  e.GITHUB_REF!==PROOF_SIGNER.sourceRef||
  e.GITHUB_SHA!==source||e.GITHUB_WORKFLOW_SHA!==source||
  e.GITHUB_WORKFLOW_REF!==PROOF_SIGNER.signerWorkflow+'@'+PROOF_SIGNER.sourceRef)fail();
 return source;
}
async function checkSource(){
 const source=proofWorkflowContext(process.env);
 if(git('rev-parse','HEAD')!==source)fail();
 git('merge-base','--is-ancestor',signedReaderAncestor,source);
 const blobs={};
 for(const p of pinned){
  const match=/^(\d{6}) (blob) ([0-9a-f]{40})\t(.+)$/.exec(git('ls-tree',source,'--',p.path));
  if(!match||match[4]!==p.path)fail();
  blobs[p.path]={sha:match[3],mode:match[1],type:match[2]};
 }
 validateProofGitSnapshot({repositoryId:1371485649,sourceHead:source,buildId,blobs});
 const cfg=JSON.parse((await readFile(join(root,'scripts/wasm-distribution/protected-release-inputs.json'))).toString('utf8'));
 if(cfg.contract!=='wand.r22.protected-main-signed-wasm-release-inputs@1'||
  cfg.cargoTomlGitBlob!==cargoPin||cfg.writerEnabled!==false||
  cfg.productConsumerEnabled!==false||cfg.publicReadonlyAssetsApproved!==true||
  cfg.releasePermission!=='OWNER_APPROVED_20261111_THREE_READONLY_PUBLIC_ASSETS_ONLY'||
  cfg.approvedCargoLockSha256!==lockSha||
  cfg.rustcVersion!=='1.99.1'||cfg.wasmBindgenCliVersion!=='0.2.105')fail();
 const lock=await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock'));
 if(hex(lock)!==lockSha)fail();
 return source;
}
const pinsFor=(bytes,source)=>Object.freeze({
 contract:'wand.steam626.singlefence.proof9.pinned-digests@1',sourceHead:source,
 manifestSha256:hex(bytes[0]),manifestSizeBytes:bytes[0].length,
 jsSha256:hex(bytes[1]),jsSizeBytes:bytes[1].length,
 wasmSha256:hex(bytes[2]),wasmSizeBytes:bytes[2].length,
 publicWriter:false,operationOn:false});
const releasePolicy={proofOnly:true,publicAssets:false,productConsumerEnabled:false,
 writerAuthorized:false,operationOn:false,autoUpload:false,
 originalOverwriteAuthorized:false,realEncryptedSaveV2Verified:false};
const requiredAbi={exportClass:'WorkerWasmSource',
 method:'read_steam626_singlefence_target',writerAuthorized:false};
const danger=/(?:dev_(?:stage|undo|redo|begin|take)|semantic_writer|private_native)/i;
export function inspectProofSubjects(bytes,source,tuple=PROOF_SIGNER){
 if(!sha40.test(source??'')||!exact(tuple,['repository','signerWorkflow','sourceRef','origin','basePath'])||
 !same(tuple,PROOF_SIGNER)||!Array.isArray(bytes)||bytes.length!==3||
 bytes.some((b,i)=>!Buffer.isBuffer(b)||!b.length||b.length>[64*1024,2*1024*1024,20*1024*1024][i]))fail();
 const [raw,js,wasm]=bytes;
 let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{fail()}
 if(!exact(m,['contract','kind','source','assets','release','abi'])||
  m.contract!=='wand.steam626.singlefence.proof9.source-candidate@1'||
  m.kind!=='PROOF_ONLY_THREE_SIGNED_SUBJECTS_NO_PUBLIC_DEPLOY'||
  !exact(m.source,['repository','commit','buildId','cargoTomlGitBlob',
   'cargoLockSha256','rustcVersion','wasmBindgenCliVersion','features','defaultFeatures'])||
  !same(m.source,{repository:tuple.repository,commit:source,buildId,
   cargoTomlGitBlob:cargoPin,cargoLockSha256:lockSha,rustcVersion:'1.99.1',
   wasmBindgenCliVersion:'0.2.105',features:featureNames,defaultFeatures:false})||
  !exact(m.assets,['js','wasm'])||
  !exact(m.assets.js,['path','sizeBytes','sha256'])||
  !exact(m.assets.wasm,['path','sizeBytes','sha256'])||
  m.assets.js.path!==names[1]||m.assets.wasm.path!==names[2]||
  m.assets.js.sizeBytes!==js.length||m.assets.wasm.sizeBytes!==wasm.length||
  m.assets.js.sha256!==hex(js)||m.assets.wasm.sha256!==hex(wasm)||
  !exact(m.release,Object.keys(releasePolicy))||!same(m.release,releasePolicy)||
  !exact(m.abi,Object.keys(requiredAbi))||!same(m.abi,requiredAbi))fail();
 let exports;
 try{exports=WebAssembly.Module.exports(new WebAssembly.Module(wasm))}
 catch{fail()}
 if(!exports.some(e=>e.kind==='function'&&e.name.includes('read_steam626_singlefence_target'))||
  exports.some(e=>danger.test(e.name))||
  !new TextDecoder('utf-8',{fatal:true}).decode(js).includes(requiredAbi.method)||
  danger.test(new TextDecoder('utf-8',{fatal:true}).decode(js)))fail();
 return pinsFor(bytes,source);
}
// Fixed repo-local proof directory only: protect every existing ancestor from
// symlink or non-directory redirection before a proof byte is staged or read.
// The parent may be absent on a fresh Actions checkout; create ONLY that
// missing parent, then create an exclusive child and never overwrite it.
async function privateProofDirectory(createFresh=false){
 let canonical;try{canonical=await realpath(root)}catch{fail()}
 if(canonical!==root)fail();
 let parent=root;
 for(const [i,part] of ['tests','wasm-distribution','fixtures'].entries()){
  parent=join(parent,part);
  let st;
  try{st=await lstat(parent)}catch(error){
   if(i!==2||!createFresh||error?.code!=='ENOENT')fail();
   try{await mkdir(parent,{recursive:false});st=await lstat(parent)}catch{fail()}
  }
  if(st.isSymbolicLink()||!st.isDirectory())fail();
  try{canonical=await realpath(parent)}catch{fail()}
  if(canonical!==parent)fail();
 }
 const dir=join(root,proofOutput);
 if(createFresh)try{await mkdir(dir,{recursive:false})}catch{fail()}
 let child;try{child=await lstat(dir);canonical=await realpath(dir)}catch{fail()}
 if(child.isSymbolicLink()||!child.isDirectory()||canonical!==dir)fail();
 return dir;
}
async function readProofBytes(){
 const dir=await privateProofDirectory();
 if(!same((await readdir(dir)).sort(),names.slice().sort()))fail();
 return Promise.all(names.map(n=>readFile(join(dir,n))));
}
async function generateProofSubjects(source){
 const [js,wasm]=await Promise.all(['ddv_save_core.js','ddv_save_core_bg.wasm']
  .map(n=>readFile(join(root,'tests/stage-e/pkg',n))));
 const m={contract:'wand.steam626.singlefence.proof9.source-candidate@1',
  kind:'PROOF_ONLY_THREE_SIGNED_SUBJECTS_NO_PUBLIC_DEPLOY',
  source:{repository:PROOF_SIGNER.repository,commit:source,buildId,
   cargoTomlGitBlob:cargoPin,cargoLockSha256:lockSha,rustcVersion:'1.99.1',
   wasmBindgenCliVersion:'0.2.105',features:featureNames,defaultFeatures:false},
  assets:{js:{path:names[1],sizeBytes:js.length,sha256:hex(js)},
   wasm:{path:names[2],sizeBytes:wasm.length,sha256:hex(wasm)}},
  release:releasePolicy,abi:requiredAbi};
 const raw=Buffer.from(JSON.stringify(m,null,2)+'\n');
 const receipt=inspectProofSubjects([raw,js,wasm],source);
 const dir=await privateProofDirectory(true);
 for(let i=0;i<names.length;i++){
  if(await privateProofDirectory()!==dir)fail();
  await writeFile(join(dir,names[i]),[raw,js,wasm][i],{flag:'wx',mode:0o600});
 }
 if(!same(receipt,inspectProofSubjects(await readProofBytes(),source)))fail();
 console.log('SINGLEFENCE_PROOF9_THREE_UNSIGNED_CANDIDATE_PROOF_ONLY',JSON.stringify(receipt));
}
async function actualProtectedCi(phase,source){
 const token=process.env.WAND_GATE_READ_TOKEN;
 if(typeof token!=='string'||!token.length)fail();
 const ci={repository:PROOF_SIGNER.repository,head:source,
  workflowBlob:git('rev-parse','HEAD:.github/workflows/ci.yml')};
 const get=createPublicJsonGetter(undefined,undefined,undefined,token);
 if(phase==='ci-build'){
  const r=await inspectProtectedCi(ci,get);
  if(r.status!=='PROTECTED_CI_PREDECESSOR_MATCH'||!process.env.GITHUB_OUTPUT)fail();
  appendFileSync(process.env.GITHUB_OUTPUT,'ci_receipt='+JSON.stringify(r)+'\n');
 }else{
  const raw=process.env.WAND_CI_RECEIPT;
  if(typeof raw!=='string'||!raw.length||raw.length>4096)fail();
  await revalidateProtectedCi(ci,JSON.parse(raw),get);
 }
 console.log('SINGLEFENCE_PROOF9_PROTECTED_CI_EXACT_MAIN_ACCEPTED');
}
async function main(){
 if(process.argv.length!==3)fail();
 const phase=process.argv[2];
 if(!['source-check','ci-build','ci-recheck','build-subjects','verify-signed'].includes(phase))fail();
 const source=await checkSource();
 if(phase==='source-check'){
  console.log('SINGLEFENCE_PROOF9_PROTECTED_SOURCE10_MATCH_ONLY');
 }else if(phase==='ci-build'||phase==='ci-recheck'){
  await actualProtectedCi(phase,source);
 }else if(phase==='build-subjects'){
  await generateProofSubjects(source);
 }else{
  const bundle=process.env.WAND_PROOF_BUNDLE;
  if(typeof bundle!=='string'||!bundle||!(await readFile(bundle)).length)fail();
  const dir=await privateProofDirectory();
  const verified=await verifySignedReleaseSubjects(dir,source,bundle,PROOF_SIGNER,
   inspectProofSubjects);
  if(!same(verified,inspectProofSubjects(await readProofBytes(),source)))fail();
  console.log('SINGLEFENCE_PROOF9_EXACT_THREE_SIGNATURES_VERIFIED_PROOF_ONLY',
   JSON.stringify(verified));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(()=>{console.error('SINGLEFENCE_PROOF9_SIGNED_SCOPE_DENIED');process.exitCode=1});
