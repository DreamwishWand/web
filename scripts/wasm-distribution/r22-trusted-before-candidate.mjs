// 09P / R22: external protected-main source selector, never a signer or issuer.
// Run this FILE only from a separately checked-out, previously accepted protected
// main tree, before loading/checking out/running candidate-owned release code.
// The sole 09 INT lane must independently CAS the newest protected main SHA.
// This intentionally cannot make an untrusted candidate's own verifier safe.
import {execFileSync} from 'node:child_process';
import {lstatSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const SHA=/^[0-9a-f]{40}$/;
const deny=code=>{throw Error('R22_TRUSTED_SELECTION_'+code)};
const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
cleanEnv.GIT_NO_REPLACE_OBJECTS='1';
cleanEnv.GIT_CONFIG_NOSYSTEM='1';
cleanEnv.GIT_CONFIG_GLOBAL='/dev/null';
const git=(...args)=>execFileSync('git',args,{cwd:root,env:cleanEnv,
 encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();

// The source checkout is the trusted PRE-candidate authority; no candidate
// checkout or candidate JS may participate in deciding these path identities.
// A leaf with matching bytes is not trustworthy when any parent directory
// is a symlink/junction into another tree (including outside the repository).
// Validate every directory component BEFORE hashing or importing the module.
function assertTrustedCheckoutPath(path,blob){
 const components=path.split('/');
 const canonicalRoot=realpathSync(root);
 const rootStat=lstatSync(root);
 if(rootStat.isSymbolicLink()||!rootStat.isDirectory())
  deny('TRUSTED_ROOT_NOT_DIRECTORY');
 let current=root;
 for(let i=0;i<components.length;i++){
  current=join(current,components[i]);
  const info=lstatSync(current);
  if(info.isSymbolicLink())
   deny('TRUSTED_PATH_SYMLINK_'+components.slice(0,i+1).join('/'));
  if(i<components.length-1 ? !info.isDirectory() : !info.isFile())
   deny('TRUSTED_PATH_TYPE_'+path);
  if(realpathSync(current)!==join(canonicalRoot,...components.slice(0,i+1)))
   deny('TRUSTED_PATH_REALPATH_ESCAPE_'+path);
 }
 if(git('hash-object','--no-filters','--',path)!==blob)
  deny('TRUSTED_WORKTREE_DRIFT_'+path);
}

const trustedInputs=Object.freeze([
 'scripts/wasm-distribution/r22-trusted-before-candidate.mjs',
 'scripts/wasm-distribution/verify-protected-release.mjs',
 'scripts/wasm-distribution/r22-accepted-rust-scope.mjs',
 'scripts/wasm-distribution/r22-raw-rust-checkout.mjs',
 'scripts/wasm-distribution/protected-release-inputs.json',
 'scripts/int-selection-preflight.mjs',
 'scripts/int-candidate-tree.mjs',
 'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs',
 '.github/workflows/01a-protected-main-signed-wasm-release-off.yml',
 '.github/workflows/pages.yml'
]);

export async function verifyTrustedR22BeforeCandidate(base,source){
 if(!SHA.test(base??'')||!SHA.test(source??'')||base===source)
  deny('FIXED_BASE_AND_SOURCE_REQUIRED');
 if(git('rev-parse','HEAD')!==base)deny('NOT_EXECUTING_FROM_TRUSTED_BASE');
 if(git('rev-parse','refs/remotes/origin/main')!==base)
  deny('LOCAL_PROTECTED_BASE_CAS_MISMATCH');
 if(git('rev-parse','--show-toplevel')!==root)deny('WRONG_REPO_ROOT');
 git('merge-base','--is-ancestor',base,source);
 for(const path of trustedInputs){
  const blob=git('rev-parse','--verify',base+':'+path);
  if(!SHA.test(blob))deny('BASE_BLOB_'+path);
  const exact='100644 blob '+blob+String.fromCharCode(9)+path;
  const candidateEntry=git('ls-tree',source,'--',path);
  // The R22 Cargo-pin JSON is the eighth specifically reviewed product
  // change. Its EXACT before/after Git blobs are independently checked by
  // the trusted Rust selector; never treat it as an unchanged gate script.
  const approvedConfig='scripts/wasm-distribution/protected-release-inputs.json';
  if(git('ls-tree',base,'--',path)!==exact ||
     (path!==approvedConfig&&candidateEntry!==exact))
   deny('TRUSTED_PATH_CHANGED_'+path);
  assertTrustedCheckoutPath(path,blob);
 }
 // All imported policy modules are from the immutable protected-base tree.
 // inspectSelection and pinned source entries reject ANY ninth changed path.
 const {verifyAcceptedRustScope}=await import('./r22-accepted-rust-scope.mjs');
 const selected=verifyAcceptedRustScope(root,base,source);
 if(selected.entryCount!==8||selected.sourcePr!==2217||
    selected.coreBefore!=='b5416aa726caea9d311075599ac606e11285b295'||
    selected.coreAfter!=='42086449f9deef26ed48b21d7edab0f5685da7c2'||
    selected.cargoAfter!=='751a73da41d8b58f7de70643f50b97722a3c1260'||
    selected.r22InputAfter!=='30551c7cc566614f64c8ba04748c3aef44b419bb'||
    selected.mergeAuthorized!==false||selected.writerAuthorized!==false)
   deny('UNREVIEWED_R22_PRODUCT_SCOPE');
 return {status:'R22_TRUSTED_PRE_CANDIDATE_EXACT8_SCOPE_ONLY',
  base,source,entryCount:8,sourcePr:2217,sourceHead:selected.sourceHead,
  mergeAuthorized:false,writerAuthorized:false,operationOn:false,
  signatureChecked:false,publishedPages:false,remoteFreshnessVerified:false,
  protectedMainCASBy09INTRequired:true};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==4)deny('USAGE_BASE_AND_SOURCE');
  console.log(JSON.stringify(await verifyTrustedR22BeforeCandidate(process.argv[2],process.argv[3])));
 }catch(error){
  console.error('R22_TRUSTED_PRE_CANDIDATE_DENIED',error.message);
  process.exitCode=1;
 }
}
