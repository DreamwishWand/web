// Build-time release anchor sealer. Actual cryptographic verification happens
// via GitHub CLI; a manifest, hash, caller boolean or successful build alone
// is never sufficient. Only the protected Pages job can emit the anchor.
import {readFile,writeFile,mkdtemp,rm,rename,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {readonlyReleaseIdentityText} from '../../src/lib/ddv/core/save/product-rust-wasm-release-loader.mjs';

const root=resolve(import.meta.dirname,'../..');
const names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const sourceRef='refs/heads/main',repository='DreamwishWand/web';
const signerWorkflow=repository+'/.github/workflows/pages.yml';
const liveOrigin='https://dreamwishwand.github.io',liveBase='/web';
const anchorPath=join(root,'src/lib/ddv/core/save/product-rust-wasm-release-anchor.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error('R22_RELEASE_SEAL_'+code)};
const hex40=/^[0-9a-f]{40}$/;
const hex64=/^[0-9a-f]{64}$/;
const max=[64*1024,2*1024*1024,20*1024*1024];
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

async function snapshot(dir){
 const files=(await readdir(dir)).sort();
 if(JSON.stringify(files)!==JSON.stringify([...names].sort()))fail('EXACT_THREE_FILES');
 const bytes=await Promise.all(names.map(n=>readFile(join(dir,n))));
 if(bytes.some((b,i)=>!b.length||b.length>max[i]))fail('ASSET_BOUNDS');
 return bytes;
}
function inspect(bytes,source){
 if(!hex40.test(source??''))fail('SOURCE_HEAD');
 const [mf,js,wasm]=bytes;
 let m;
 try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mf))}
 catch{fail('MANIFEST_JSON')}
 if(m?.contract!=='wand.r22.rust-wasm-source-provenance-candidate@1'||
  m.kind!=='PUBLIC_READONLY_SIGNED_ASSET_ONLY_UI_OFF'||
  m.source?.repository!==repository||m.source?.commit!==source||
  m.source?.wasmBindgen!=='0.2.105'||m.source?.wasmTarget!=='wasm32-unknown-unknown'||
  m.source?.profile!=='release'||m.source?.defaultFeatures!==false||
  JSON.stringify(m.source?.features)!=='["indexed-read","worker-wasm"]'||
  m.source?.cargoLockSha256!=='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c'||
  !hex64.test(m.source?.cargoTomlSha256??'')||
  !m.source?.toolchain?.startsWith('rustc 1.99.1 ')||
  m.release?.publishedPages!==true||m.release?.productConsumerEnabled!==false||
  m.release?.writerAuthorized!==false||m.release?.autoUpload!==false||
  m.signature?.status!=='UNKNOWN'||m.signature?.verified!==false||
  m.abi?.exportClass!=='WorkerWasmSource'||m.abi?.maxPageRecords!==8||
  m.abi?.nativeV3!==false||m.abi?.writerAuthorized!==false||
  JSON.stringify(m.abi?.methods)!=='["append_chunk","finish","issue_saved_diffgrids_typed_cursor","read_saved_diffgrids_typed_page","close"]'||
  m.assets?.js?.path!==names[1]||m.assets?.wasm?.path!==names[2]||
  m.assets?.js?.sizeBytes!==js.length||m.assets?.wasm?.sizeBytes!==wasm.length||
  m.assets?.js?.sha256!==sha(js)||m.assets?.wasm?.sha256!==sha(wasm))
   fail('MANIFEST_BUILD_ABI_OR_BYTES');
 const module=new WebAssembly.Module(wasm);
 const dev=/(?:dev_(?:stage|undo|redo|begin|take)|semantic_writer|private_native)/i;
 if(WebAssembly.Module.exports(module).some(x=>dev.test(x.name))||
   dev.test(new TextDecoder('utf-8',{fatal:true}).decode(js)))fail('DEV_EXPORT_DENIED');
 return Object.freeze({contract:'wand.r22.candidate-pinned-digests@1',sourceHead:source,
  manifestSha256:sha(mf),manifestSizeBytes:mf.length,
  jsSha256:sha(js),jsSizeBytes:js.length,wasmSha256:sha(wasm),wasmSizeBytes:wasm.length,
  sourceProvenanceOnly:true,verifiedSignature:false});
}
// Pure byte inspection; NOT signature verification or authorization.
export async function inspectReleasePins(dir,source){return inspect(await snapshot(dir),source)}
async function verifySigned(dir,source,bundle){
 const bytes=await snapshot(dir),pins=inspect(bytes,source);
 const work=await mkdtemp(join(tmpdir(),'wand-release-signature-'));
 try{
  // Verify an immutable snapshot of each exact subject; then compare the
  // original directory again before sealing. No trust in manifest self-pins.
  for(let i=0;i<names.length;i++){
   const file=join(work,names[i]);await writeFile(file,bytes[i],{mode:0o600,flag:'wx'});
   const args=['attestation','verify',file,'--repo',repository,
    '--signer-workflow',signerWorkflow,'--source-ref',sourceRef,
    '--source-digest',source,'--deny-self-hosted-runners',
    '--predicate-type','https://slsa.dev/provenance/v1'];
   if(bundle)args.push('--bundle',bundle);
   try{execFileSync('gh',args,{stdio:['ignore','inherit','inherit']})}
   catch{fail('SIGNATURE_VERIFICATION_DENIED')}
   if(sha(await readFile(file))!==sha(bytes[i]))fail('SNAPSHOT_CHANGED');
  }
  const after=await snapshot(dir);
  if(after.some((b,i)=>!b.equals(bytes[i])))fail('ASSET_CHANGED_DURING_VERIFY');
  return pins;
 }finally{await rm(work,{recursive:true,force:true})}
}
function protectedContext(){
 const e=process.env,s=e.WAND_SOURCE_HEAD;
 if(!hex40.test(s??'')||e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!==repository||
  e.GITHUB_REF!==sourceRef||e.GITHUB_SHA!==s||e.GITHUB_WORKFLOW_SHA!==s||
  e.GITHUB_WORKFLOW_REF!==signerWorkflow+'@'+sourceRef||
  !['push','workflow_dispatch'].includes(e.GITHUB_EVENT_NAME)||
  e.WAND_PUBLIC_READONLY_ASSET_GATE!=='OWNER_APPROVED_THREE_FILES_20261111'||
  git('rev-parse','HEAD')!==s)
   fail('PROTECTED_PAGES_CONTEXT_REQUIRED');
 return s;
}
function identity(pins){
 const a={contract:'wand.r22.protected-readonly-release@1',repository,signerWorkflow,
  sourceRef,origin:liveOrigin,basePath:liveBase,pins,attestationVerifiedAtBuild:true};
 return Object.freeze({...a,releaseId:sha(readonlyReleaseIdentityText(a))});
}
async function main(){
 const cmd=process.argv[2];
 if(cmd==='verify-only'){
  // Historical fixed signed release audit: NO anchor emitted, NO deployment.
  const [source,dir,bundle]=process.argv.slice(3);
  if(!dir||process.argv.length>6)fail('VERIFY_ONLY_ARGUMENTS');
  const pins=await verifySigned(resolve(dir),source,bundle?resolve(bundle):undefined);
  console.log('R22_EXACT_PROTECTED_SIGNED_SUBJECTS_VERIFIED',JSON.stringify(pins));
  return;
 }
 const source=protectedContext();
 const dir=join(root,'static/worker-wasm');
 if(cmd==='seal'){
  const bundle=process.env.WAND_SIGSTORE_BUNDLE;
  if(!bundle||!(await readFile(bundle)).length)fail('ATTESTATION_BUNDLE_REQUIRED');
  const prior=await readFile(anchorPath,'utf8');
  if(!prior.includes('PROTECTED_READONLY_RELEASE_ANCHOR=null;')||
    git('diff','--',anchorPath)!=='')fail('ANCHOR_NOT_CLEAN_DEFAULT');
  const pins=await verifySigned(dir,source,resolve(bundle));
  const a=identity(pins);
  const output='// GENERATED in protected Pages checkout; do not commit.\n'+
   'const data='+JSON.stringify(a)+';\nObject.freeze(data.pins);\n'+
   'export const PROTECTED_READONLY_RELEASE_ANCHOR=Object.freeze(data);\n';
  const temp=anchorPath+'.tmp';
  try{await writeFile(temp,output,{flag:'wx',mode:0o600});await rename(temp,anchorPath)}
  finally{await rm(temp,{force:true})}
  console.log('R22_BUILD_SEALED_PROTECTED_RELEASE',a.releaseId);
 }else if(cmd==='check-built'){
  const {PROTECTED_READONLY_RELEASE_ANCHOR:a}=await import(pathToFileURL(anchorPath).href);
  const p=await inspectReleasePins(dir,source);
  const b=await inspectReleasePins(join(root,'build/worker-wasm'),source);
  if(!a||JSON.stringify(a)!==JSON.stringify(identity(p))||
    JSON.stringify(b)!==JSON.stringify(p))fail('BUILT_ANCHOR_OR_SUBJECT_DRIFT');
  console.log('R22_BUILD_SEALED_ANCHOR_MATCHES_EXACT_THREE_BYTES',a.releaseId);
 }else fail('UNKNOWN_MODE');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
