// 01A CORE / R22: protected-main signed wasm candidate preflight.
// No Pages upload, no public executable distribution, no product feature ON.
// This validator checks *actual* checked-out source and actual CI-generated
// JS+WASM+manifest+static output. A release signature is checked afterwards
// by GitHub Sigstore, not inferred from SHA equality here.
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const fail=s=>{throw Error('R22_PROTECTED_RELEASE_'+s)};
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const cmd=(name,args)=>execFileSync(name,args,{cwd:root,encoding:'utf8'}).trim();
const read=async path=>readFile(join(root,path)).catch(()=>fail('MISSING_'+path));
const config=JSON.parse((await read('scripts/wasm-distribution/protected-release-inputs.json')).toString('utf8'));
const expectedSource=process.env.WAND_SOURCE_HEAD;
const event=process.env.GITHUB_EVENT_NAME;
const stage=process.argv[2];
if(!['inputs','built'].includes(stage))fail('INVALID_STAGE');
if(!/^[0-9a-f]{40}$/.test(expectedSource??'')||
   git('rev-parse','HEAD')!==expectedSource)fail('SOURCE_HEAD_MISMATCH');
if(!['pull_request','push'].includes(event))fail('EVENT_NOT_ALLOWED');
if(event==='push'&&process.env.GITHUB_REF!=='refs/heads/main')
 fail('NOT_PROTECTED_MAIN_PUSH');
if(event==='pull_request'&&process.env.WAND_PR_BASE_SHA!==
   config.acceptedAncestorProtectedMain)fail('PR_BASE_NOT_FIXED_PROTECTED_MAIN');
if(config.contract!=='wand.r22.protected-main-signed-wasm-release-inputs@1'||
 config.releasePermission!=='HUMAN_GATE_NOT_GRANTED'||
 config.productConsumerEnabled!==false||config.writerEnabled!==false||
 config.rustcVersion!=='1.99.1'||config.wasmBindgenCliVersion!=='0.2.105'||
 config.wasmTarget!=='wasm32-unknown-unknown'||
 config.releaseProfile!=='release'||config.defaultFeatures!==false||
 JSON.stringify(config.features)!=='["indexed-read","worker-wasm"]')
 fail('INVALID_APPROVED_INPUTS');
if(git('rev-parse','HEAD:crates/ddv-save-core/Cargo.toml')!==
  config.cargoTomlGitBlob)fail('CARGO_TOML_CHANGE_NEEDS_SCOPE_QA');
if(git('rev-parse','HEAD:.github/workflows/pages.yml')!==
  config.originalPagesWorkflowGitBlob)fail('PAGES_DEPLOY_CHANGE_NOT_AUTHORIZED');
try{
 git('merge-base','--is-ancestor',config.acceptedAncestorProtectedMain,expectedSource);
 if(event==='pull_request'){
  // Accepted Rust Session must remain untouched by *this* release PR.
  execFileSync('git',['diff','--quiet',config.acceptedAncestorProtectedMain,
   expectedSource,'--','crates/ddv-save-core/'],{cwd:root});
 }
}catch{fail('ACCEPTED_RUST_ANCESTOR_CHANGED')}
const locked=await read('crates/ddv-save-core/Cargo.lock');
if(sha(locked)!==config.approvedCargoLockSha256)
 fail('CARGO_LOCK_SHA_DRIFT_NEEDS_NEW_REVIEW');
const rustc=cmd('rustc',['--version','--verbose']);
if(!rustc.startsWith('rustc 1.99.1 '))fail('RUSTC_VERSION_DRIFT');
if(!/^[0-9a-f]{64}$/.test(config.approvedCargoLockSha256))
 fail('LOCK_PIN_INVALID');
if(git('ls-files','static/worker-wasm').length!==0)
 fail('PUBLIC_WASM_BINARY_COMMITTED_UNAPPROVED');
if(stage==='inputs'){
 console.log('R22_RELEASE_INPUTS_ONLY_SOURCE_PINNED',{
  sourceHead:expectedSource,acceptedAncestor:config.acceptedAncestorProtectedMain,
  cargoLockSha256:sha(locked),rustc:rustc.split('\n')[0],
  signatureChecked:false,publishedPages:false,productEnabled:false
 });
 process.exit(0);
}
const files=['ddv_save_core.js','ddv_save_core_bg.wasm','manifest.json','Cargo.lock'];
const sourceBytes=await Promise.all(files.map(n=>read('static/worker-wasm/'+n)));
const builtBytes=await Promise.all(files.map(n=>read('build/worker-wasm/'+n)));
for(let i=0;i<files.length;i++){
 const name=files[i],src=sourceBytes[i],built=builtBytes[i];
 if(src.length!==built.length||sha(src)!==sha(built))
  fail('PUBLIC_BUILD_BYTES_DIFFER_FROM_SIGNED_SUBJECT_'+name);
 if((await stat(join(root,'build/worker-wasm',name))).size!==src.length)
  fail('PUBLIC_BUILD_BYTE_LENGTH_DIFFERENT_'+name);
}
const manifest=JSON.parse(sourceBytes[2].toString('utf8'));
if(manifest.contract!=='wand.r22.rust-wasm-source-provenance-candidate@1'||
 manifest.source?.commit!==expectedSource||
 manifest.source?.repository!=='DreamwishWand/web'||
 manifest.source?.cargoLockSha256!==sha(locked)||
 manifest.source?.wasmBindgen!=='0.2.105'||
 !manifest.source?.toolchain?.startsWith('rustc 1.99.1 ')||
 manifest.source?.profile!=='release'||
 manifest.source?.wasmTarget!=='wasm32-unknown-unknown'||
 manifest.source?.defaultFeatures!==false||
 JSON.stringify(manifest.source?.features)!=='["indexed-read","worker-wasm"]'||
 manifest.abi?.exportClass!=='WorkerWasmSource'||
 JSON.stringify(manifest.abi?.methods)!==
 '["append_chunk","finish","issue_saved_diffgrids_typed_cursor","read_saved_diffgrids_typed_page","close"]'||
 manifest.abi?.maxPageRecords!==8||
 manifest.abi?.nativeV3!==false||
 manifest.abi?.writerAuthorized!==false||
 manifest.release?.publishedPages!==false||
 manifest.release?.productConsumerEnabled!==false||
 manifest.release?.writerAuthorized!==false||
 manifest.signature?.verified!==false||
 manifest.signature?.status!=='UNKNOWN')
 fail('MANIFEST_RELEASE_GATE_OR_PROVENANCE_INVALID');
if(manifest.assets?.js?.sizeBytes!==sourceBytes[0].length||
 manifest.assets?.wasm?.sizeBytes!==sourceBytes[1].length||
 manifest.assets?.js?.sha256!==sha(sourceBytes[0])||
 manifest.assets?.wasm?.sha256!==sha(sourceBytes[1])||
 sourceBytes[0].length>2*1024*1024||
 sourceBytes[1].length>20*1024*1024)
 fail('TWO_GENERATED_ASSET_HASH_SIZE_MISMATCH');
const pins=JSON.parse((await read('tests/wasm-distribution/fixtures/ci-pins.json')).toString('utf8'));
if(pins.contract!=='wand.r22.candidate-pinned-digests@1'||
 pins.sourceHead!==expectedSource||
 pins.jsSha256!==sha(sourceBytes[0])||
 pins.wasmSha256!==sha(sourceBytes[1])||
 pins.manifestSha256!==sha(sourceBytes[2])||
 pins.manifestSizeBytes!==sourceBytes[2].length||
 pins.jsSizeBytes!==sourceBytes[0].length||
 pins.wasmSizeBytes!==sourceBytes[1].length||
 pins.verifiedSignature!==false||pins.sourceProvenanceOnly!==true)
 fail('TRIPLE_INDEPENDENT_TEST_PIN_MISMATCH');
if(sha(sourceBytes[3])!==config.approvedCargoLockSha256)
 fail('CARGO_LOCK_COPY_MISMATCH');
const basePath=process.env.WAND_RELEASE_BASE_PATH;
if(basePath!=='/web'&&basePath!=='')
 fail('BASE_PATH_NOT_EXPLICIT');
console.log('R22_PROTECTED_RELEASE_STATIC_BYTES_EQ_SOURCE_SIGNED_SUBJECT',{
 event,sourceHead:expectedSource,basePath,
 manifest:{size:sourceBytes[2].length,sha256:sha(sourceBytes[2])},
 js:{size:sourceBytes[0].length,sha256:sha(sourceBytes[0])},
 wasm:{size:sourceBytes[1].length,sha256:sha(sourceBytes[1])},
 signatureCheckedSeparately:false,publicDeployed:false,consumerEnabled:false
});
