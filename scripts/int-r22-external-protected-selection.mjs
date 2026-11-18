// 09 INT: independent protected-main R22 exact8 Git-object preflight.
// Execute FROM trusted protected main (pull_request_target), never source checkout.
// This is a fail-closed source-selection receipt, NOT QA/merge/signer/Writer authority.
import {readFileSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {inspectSelection} from './int-selection-preflight.mjs';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const MANIFEST=new URL('../ops/int-r22-switch626-makeup-reviewed-exact8.json',import.meta.url);
const SHA=/^[0-9a-f]{40}$/;
const deny=s=>{throw Error('INT_R22_EXTERNAL_'+s)};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',
  env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'},maxBuffer:16*1024*1024}).trim();
export function validateTrustedExact8Manifest(m){
  if(!exact(m,['schema','repositoryId','productPr','productSourceHead',
      'proposedGateSourceHead','releaseRights','newOperationOn','writerAuthorized','entries'])||
    m.schema!=='wand.int.r22-protected-external-exact8@1'||
    m.repositoryId!==1371485649||m.productPr!==2217||
    !SHA.test(m.productSourceHead)||!SHA.test(m.proposedGateSourceHead)||
    m.releaseRights!=='OWNER_APPROVED_20261111_THREE_READONLY_PUBLIC_ASSETS_ONLY'||
    m.newOperationOn!==false||m.writerAuthorized!==false||
    !Array.isArray(m.entries)||m.entries.length!==8)deny('MANIFEST_INVALID');
  const seen=new Set();
  for(const e of m.entries){
    if(!exact(e,['path','before','after'])||typeof e.path!=='string'||
       !/^[a-zA-Z0-9_./-]+$/.test(e.path)||e.path.includes('..')||seen.has(e.path)||
       !exact(e.after,['mode','blob'])||e.after.mode!=='100644'||!SHA.test(e.after.blob)||
       (e.before!==null&&(!exact(e.before,['mode','blob'])||
         e.before.mode!=='100644'||!SHA.test(e.before.blob))))
      deny('ENTRY_INVALID');
    seen.add(e.path);
  }
  if(!seen.has('crates/ddv-save-core/Cargo.toml')||
     !seen.has('scripts/wasm-distribution/protected-release-inputs.json')||
     !seen.has('crates/ddv-save-core/src/worker_switch626_makeup_color1.rs')||
     !seen.has('crates/ddv-save-core/src/wasm_switch626_makeup_color1.rs'))
    deny('SOURCE_CLOSURE_INCOMPLETE');
  return m;
}
const pinned=validateTrustedExact8Manifest(JSON.parse(readFileSync(MANIFEST,'utf8')));
export function inspectTrustedR22Source(cwd,{base,source,main},contract=pinned){
  const fixed=validateTrustedExact8Manifest(contract);
  if(!SHA.test(base??'')||!SHA.test(source??'')||!SHA.test(main??'')||base!==main)
    deny('PROTECTED_MAIN_CAS_INVALID');
  const result=inspectSelection(cwd,{base,source,main,paths:fixed.entries.map(x=>x.path)});
  const actual=new Map(result.entries.map(x=>[x.path,x]));
  for(const e of fixed.entries){
    const a=actual.get(e.path);
    if(!a||JSON.stringify(a.before)!==JSON.stringify(e.before)||
       JSON.stringify(a.after)!==JSON.stringify(e.after))
      deny('EXACT_GIT_BLOB_MODE_MISMATCH:'+e.path);
  }
  return {status:'PROTECTED_MAIN_SOURCE_EXACT8_PREFLIGHT_PASS_ONLY',base,source,
    count:8,acceptedProductSource:fixed.productSourceHead,
    mergeAuthorized:false,writerAuthorized:false,operationOn:false,
    signatureVerified:false,publicPagesVerified:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==2||
      process.env.GITHUB_EVENT_NAME!=='pull_request_target'||
      process.env.GITHUB_REPOSITORY_ID!=='1371485649'||
      process.env.WAND_HEAD_REPO_ID!=='1371485649'||
      process.env.GITHUB_BASE_REF!=='main')
      deny('TRUSTED_PROTECTED_EVENT_REQUIRED');
    const base=process.env.WAND_PROTECTED_BASE_SHA,source=process.env.WAND_UNTRUSTED_SOURCE_SHA;
    if(!SHA.test(base??'')||!SHA.test(source??'')||
      git(ROOT,'rev-parse','HEAD')!==base||
      git(ROOT,'rev-parse','refs/remotes/origin/main')!==base)
      deny('PROTECTED_MAIN_NOT_LIVE_BASE');
    for(const p of ['scripts/int-r22-external-protected-selection.mjs',
        'scripts/int-selection-preflight.mjs',
        'ops/int-r22-switch626-makeup-reviewed-exact8.json']){
      const f=join(ROOT,p);
      if(!lstatSync(f).isFile()||lstatSync(f).isSymbolicLink()||
        git(ROOT,'hash-object','--no-filters','--',p)!==
        git(ROOT,'rev-parse',base+':'+p)||
        git(ROOT,'ls-tree',base,'--',p).split(' ')[0]!=='100644')
        deny('TRUSTED_CHECKER_DISK_OR_MODE_DRIFT');
    }
    console.log(JSON.stringify(inspectTrustedR22Source(ROOT,{base,source,main:base})));
  }catch(e){console.error('INT_R22_EXTERNAL_DENIED',e.message);process.exitCode=1;}
}
