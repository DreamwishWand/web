// 09P CODE ACT1740: only trusted, already-protected Pages can seal a separate
// Steam626 Bamboo read-only release. This source never publishes or grants a Reader.
import {readFile,writeFile,mkdir,rename,rm,readdir,lstat,realpath} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ACTIVE_RELEASE_TUPLE,RELEASE_REPOSITORY_ID,protectedPagesContextMatches} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {BAMBOO_READONLY_ASSET_DIR,BAMBOO_READONLY_OPERATION,BAMBOO_BUILD,
 bambooReadPinsOk,bambooReadManifestOk,bambooReadJsSymbolsOk,bambooWasmExportsOk,
 bambooReadAnchorOk,bambooReadReleaseIdentityText} from '../../src/lib/ddv/core/save/product-steam626-bamboo-readonly-release.mjs';
import {verifySignedReleaseSubjects} from './seal.mjs';
import {inspectProtectedCi,revalidateProtectedCi,createPublicJsonGetter} from '../int-protected-ci-gate.mjs';

const root=resolve(import.meta.dirname,'../..');
const names=Object.freeze(['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm']);
const candidate=join(root,'tests/wasm-distribution/fixtures/steam626-bamboo-public-readonly-candidate');
const staged=join(root,'static',BAMBOO_READONLY_ASSET_DIR);
const built=join(root,'build',BAMBOO_READONLY_ASSET_DIR);
const anchorFile=join(root,'src/lib/ddv/core/save/product-steam626-bamboo-readonly-anchor.mjs');
const ALLOW='09INT_ACCEPTED_BAMBOO_READONLY_SIGNED3_PAGES';
const sha=x=>createHash('sha256').update(x).digest('hex');
const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const fail=()=>{throw Error('BAMBOO_PUBLIC_PAGES_SIGNER_DENIED')};
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}}).trim();
const is40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
// Exact accepted Bamboo Rust semantics; Cargo and the WASM wrapper alone do
// not pin the Worker ReadDomain body or core-minted one-item target.
export const BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS=Object.freeze({
 'crates/ddv-save-core/Cargo.toml':'e4f2e2c5d4451baba2dea699fe497cb7b40668d4',
 'crates/ddv-save-core/src/lib.rs':'9cc0dfdde15399d2797f30c861684f530635c4ef',
 'crates/ddv-save-core/src/wasm_steam_bamboo_readonly.rs':'26414572b41211076f1f83a3f8752eea2ab65142',
 'crates/ddv-save-core/src/wasm_worker.rs':'4287cb5184331ba5c4c5681166a1bda0dd0c6106',
 'crates/ddv-save-core/src/worker_steam_bamboo_readonly.rs':'b3aa885d7668e6f8d3df9a20be4962d609ab6762',
 'crates/ddv-save-core/src/worker_session.rs':'c2fd0115c3850c963a9994ea1f8e4feac859557f',
 'crates/ddv-save-core/src/steam_bamboo_single_product_target.rs':'a5aef59173ee99454f7f108af58fa7c46dac6f19',
 'crates/ddv-save-core/src/steam_single_fence_readonly.rs':'c64c460917d2d3730e9ffe8807112f724f10a723',
 'crates/ddv-save-core/src/sr03_installed_geometry.rs':'4ff82faf19cc9883259cea36da5f90faa5bea698',
 'crates/ddv-save-core/src/comp03_installed_geometry.rs':'645e6e6a64664088997df46954cd1d8bb4a2995a',
 'crates/ddv-save-core/src/placement_saved_refs.rs':'2ad0d925cebfcb19bb39b2afe5ff6404966ad849',
 'crates/ddv-save-core/src/product_session.rs':'08a854a949fbd115cc656a1d4bbdc4d867515a39',
 'crates/ddv-save-core/src/indexed_read.rs':'47b8b07e013f357fceee51cbc0ce676b271fb207',
 'crates/ddv-save-core/src/strict_document.rs':'e49ea87eb18227c68e049e3de7278af02550fdbd',
 'crates/ddv-save-core/src/saved_diffgrids_index.rs':'b8980ee01cd8edea46400dc6fcccdafcdc4cb6c2'
});
export function bambooAcceptedRustSourceBlobsOk(observed){
 return observed!==null&&typeof observed==='object'&&!Array.isArray(observed)&&
  eq(Object.keys(observed).sort(),Object.keys(BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS).sort())&&
  Object.entries(BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS).every(([path,blob])=>observed[path]===blob);
}

// Git HEAD predicates alone can be bypassed by dirty tracked files. The
// signed executable is compiled from checked-out bytes, not from a Git tree.
// This check is repeated at each protected Pages phase, including seal/check.
export async function bambooAcceptedRustCheckoutOk(){
 try{
  if(await realpath(root)!==root||
   git('status','--porcelain=v1','--untracked-files=all','--','crates/ddv-save-core/src')!=='')return false;
  const observed={};
  for(const [path,blob] of Object.entries(BAMBOO_ACCEPTED_RUST_SOURCE_BLOBS)){
   const file=join(root,path),st=await lstat(file);
   if(st.isSymbolicLink()||!st.isFile()||await realpath(file)!==file||
      git('rev-parse','HEAD:'+path)!==blob||
      git('hash-object','--no-filters','--',path)!==blob)return false;
   observed[path]=blob;
  }
  return bambooAcceptedRustSourceBlobsOk(observed);
 }catch{return false}
}

export function bambooProtectedPagesAllowed(env,head){
 return is40(head)&&env?.WAND_SOURCE_HEAD===head&&
  env?.WAND_BAMBOO_PUBLIC_RELEASE_GATE===ALLOW&&
  env?.WAND_RELEASE_BASE_PATH===ACTIVE_RELEASE_TUPLE.basePath&&
  env?.GITHUB_REPOSITORY_ID===RELEASE_REPOSITORY_ID&&
  protectedPagesContextMatches(env,head,head);
}
export function inspectBambooPublicPagesSubjects(bytes,head,issuer=ACTIVE_RELEASE_TUPLE){
 if(issuer!==ACTIVE_RELEASE_TUPLE||!is40(head)||!Array.isArray(bytes)||bytes.length!==3||
   bytes.some((b,i)=>!Buffer.isBuffer(b)||b.length<1||b.length>[65536,2097152,20971520][i]))fail();
 const [raw,js,wasm]=bytes;
 const pins={contract:'wand.bamboo40700007.pinned-digests@1',sourceHead:head,
  manifestSha256:sha(raw),manifestSizeBytes:raw.length,
  jsSha256:sha(js),jsSizeBytes:js.length,wasmSha256:sha(wasm),wasmSizeBytes:wasm.length};
 let m,j,module;
 try{
  m=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw));
  j=new TextDecoder('utf8',{fatal:true}).decode(js);
  module=new WebAssembly.Module(wasm);
 }catch{fail()}
 if(!bambooReadPinsOk(pins)||!bambooReadManifestOk(m,pins,issuer)||
  !bambooReadJsSymbolsOk(j)||!bambooWasmExportsOk(module)||m.source.commit!==head||
  m.operation!==BAMBOO_READONLY_OPERATION||m.abi.buildId!==BAMBOO_BUILD||
  m.abi.readOnly!==true||m.release.candidateOnly!==true||
  m.release.productConsumerEnabled!==false||m.release.writerAuthorized!==false)fail();
 return Object.freeze(pins);
}
export function bambooPublicAnchorFromVerifiedPins(pins){
 if(!bambooReadPinsOk(pins))fail();
 const base={contract:'wand.bamboo40700007.protected-readonly-release@1',
  ...ACTIVE_RELEASE_TUPLE,operation:BAMBOO_READONLY_OPERATION,pins,
  mode:'public-accepted',buildId:BAMBOO_BUILD,
  attestationVerifiedAtBuild:true,readOnlyOperationAuthorized:true};
 const a=Object.freeze({...base,releaseId:sha(bambooReadReleaseIdentityText(base))});
 if(!bambooReadAnchorOk(a))fail();
 return a;
}
async function exactFiles(dir){
 if(await realpath(dir)!==dir||!eq((await readdir(dir)).sort(),[...names].sort()))fail();
 const bytes=[];
 for(const name of names){
  const p=join(dir,name),st=await lstat(p);
  if(st.isSymbolicLink()||!st.isFile()||await realpath(p)!==p)fail();
  bytes.push(await readFile(p));
 }
 return bytes;
}
async function source(head){
 if(!is40(head)||git('rev-parse','HEAD')!==head||
  process.env.GITHUB_REPOSITORY!==ACTIVE_RELEASE_TUPLE.repository||
  process.env.GITHUB_REPOSITORY_ID!==RELEASE_REPOSITORY_ID||
  !(await bambooAcceptedRustCheckoutOk())||
  git('rev-parse','HEAD:src/lib/ddv/core/save/product-steam626-bamboo-readonly-anchor.mjs')!=='6fc525e975de9db68544d1feaff5ec9cd0011348'||
  git('ls-files','--',BAMBOO_READONLY_ASSET_DIR,'static/'+BAMBOO_READONLY_ASSET_DIR,'build/'+BAMBOO_READONLY_ASSET_DIR)!=='')fail();
 const approved=await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock'));
 const current=await readFile(join(root,'crates/ddv-save-core/Cargo.lock'));
 if(sha(approved)!=='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c'||
  !approved.equals(current))fail();
 const cfg=JSON.parse(await readFile(join(root,'scripts/wasm-distribution/protected-release-inputs.json'),'utf8'));
 if(cfg.productConsumerEnabled!==false||cfg.writerEnabled!==false||
  cfg.publicReadonlyAssetsApproved!==true||
  cfg.releasePermission!=='OWNER_APPROVED_20261111_THREE_READONLY_PUBLIC_ASSETS_ONLY')fail();
 return head;
}
async function nullAnchor(){
 const text=await readFile(anchorFile,'utf8');
 if(!text.includes('export const PROTECTED_BAMBOO40700007_READONLY_ANCHOR=null;')||
   git('diff','--',anchorFile)!=='')fail();
}
async function mainCi(mode,head){
 if(!bambooProtectedPagesAllowed(process.env,head))fail();
 const token=process.env.WAND_GATE_READ_TOKEN;
 if(typeof token!=='string'||!token)fail();
 const key={repository:ACTIVE_RELEASE_TUPLE.repository,head,
  workflowBlob:git('rev-parse','HEAD:.github/workflows/ci.yml')};
 const get=createPublicJsonGetter(undefined,undefined,undefined,token);
 if(mode==='build'){
  const receipt=await inspectProtectedCi(key,get);
  if(receipt.status!=='PROTECTED_CI_PREDECESSOR_MATCH'||!process.env.GITHUB_OUTPUT)fail();
  appendFileSync(process.env.GITHUB_OUTPUT,'bamboo_ci_receipt='+JSON.stringify(receipt)+'\n');
 }else{
  const receipt=process.env.WAND_BAMBOO_CI_RECEIPT;
  if(typeof receipt!=='string'||receipt.length>4096||!receipt)fail();
  await revalidateProtectedCi(key,JSON.parse(receipt),get);
 }
}
async function protectStage(){
 if(await realpath(root)!==root||await realpath(join(root,'static'))!==join(root,'static'))fail();
 try{await lstat(staged);fail()}catch(e){if(e?.code!=='ENOENT')throw e}
 await mkdir(staged,{recursive:false});
 if(await realpath(staged)!==staged)fail();
}
async function run(){
 const mode=process.argv[2],head=process.env.WAND_SOURCE_HEAD;
 if(process.argv.length!==3||!['preflight','candidate','pages-stage','pages-seal','pages-check'].includes(mode))fail();
 await source(head);
 if(mode==='preflight'||mode==='candidate'){
  if(process.env.GITHUB_EVENT_NAME!=='pull_request')fail();
  await nullAnchor();
  if(mode==='candidate'){
   const pins=inspectBambooPublicPagesSubjects(await exactFiles(candidate),head);
   console.log('BAMBOO_PUBLIC_PAGES_SOURCE_CANDIDATE_VALID_UNSIGNED_OFF',JSON.stringify(pins));
  }else console.log('BAMBOO_PUBLIC_PAGES_SOURCE_PREFLIGHT_OFF');
  return;
 }
 if(!bambooProtectedPagesAllowed(process.env,head))fail();
 if(mode==='pages-stage'){
  await nullAnchor();
  const bytes=await exactFiles(candidate);
  const pins=inspectBambooPublicPagesSubjects(bytes,head);
  await mainCi('build',head);
  await protectStage();
  for(let i=0;i<3;i++)await writeFile(join(staged,names[i]),bytes[i],{flag:'wx',mode:0o644});
  if(!eq(inspectBambooPublicPagesSubjects(await exactFiles(staged),head),pins))fail();
  console.log('BAMBOO_PUBLIC_PAGES_THREE_BYTES_STAGED_UNSIGNED_NOT_DEPLOYED',JSON.stringify(pins));
 }else if(mode==='pages-seal'){
  await nullAnchor();
  await mainCi('recheck',head);
  const bundle=process.env.WAND_BAMBOO_SIGSTORE_BUNDLE;
  if(typeof bundle!=='string'||!bundle||!(await readFile(bundle)).length)fail();
  const pins=await verifySignedReleaseSubjects(staged,head,bundle,ACTIVE_RELEASE_TUPLE,inspectBambooPublicPagesSubjects);
  if(!eq(inspectBambooPublicPagesSubjects(await exactFiles(candidate),head),pins))fail();
  await mainCi('recheck',head);
  const a=bambooPublicAnchorFromVerifiedPins(pins);
  const tmp=anchorFile+'.tmp';
  try{
   await writeFile(tmp,'// GENERATED by protected Pages after real Sigstore3 verification. NEVER COMMIT.\n'+
    'const data='+JSON.stringify(a)+';\nObject.freeze(data.pins);\n'+
    'export const PROTECTED_BAMBOO40700007_READONLY_ANCHOR=Object.freeze(data);\n',{flag:'wx',mode:0o600});
   await rename(tmp,anchorFile);
  }finally{await rm(tmp,{force:true})}
  console.log('BAMBOO_PUBLIC_PAGES_SIGNED3_SEALED_AWAIT_BUILD_AND_DEPLOY',a.releaseId);
 }else{
  await mainCi('recheck',head);
  const pins=inspectBambooPublicPagesSubjects(await exactFiles(staged),head);
  const bundle=process.env.WAND_BAMBOO_SIGSTORE_BUNDLE;
  if(typeof bundle!=='string'||!bundle||!(await readFile(bundle)).length)fail();
  const signed=await verifySignedReleaseSubjects(staged,head,bundle,ACTIVE_RELEASE_TUPLE,inspectBambooPublicPagesSubjects);
  if(!eq(signed,pins)||!eq(pins,inspectBambooPublicPagesSubjects(await exactFiles(built),head)))fail();
  const mod=await import(pathToFileURL(anchorFile).href);
  const a=bambooPublicAnchorFromVerifiedPins(pins);
  if(!eq(mod.PROTECTED_BAMBOO40700007_READONLY_ANCHOR,a))fail();
  console.log('BAMBOO_PUBLIC_PAGES_SEALED3_BUILD_BYTES_EQUAL_DEPLOY_NOT_VERIFIED',a.releaseId);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 run().catch(()=>{console.error('BAMBOO_PUBLIC_PAGES_SIGNER_DENIED');process.exitCode=1});
