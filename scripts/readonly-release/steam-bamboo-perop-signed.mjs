// 09P CODE: exact Steam626 Bamboo40700007 signed proof-only WASM subjects.
// Existing protected Pages release and consumer flags remain byte-for-byte OFF.
import {readFile,writeFile,mkdir,readdir,lstat,realpath} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ACTIVE_RELEASE_TUPLE} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {verifySignedReleaseSubjects} from './seal.mjs';
import {inspectProtectedCi,revalidateProtectedCi,createPublicJsonGetter} from '../int-protected-ci-gate.mjs';
const root=resolve(import.meta.dirname,'../..');
const contract='wand.steam626.bamboo40700007.signed-proof-only@1';
const build='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const lockSha='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const cargoBlob='e4f2e2c5d4451baba2dea699fe497cb7b40668d4';
const features=['product-steam626-bamboo-readonly','worker-wasm'];
const names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const proofDir='tests/wasm-distribution/fixtures/steam626-bamboo-perop-proof';
const fail=()=>{throw Error('BAMBOO_PEROP_PROOF_DENIED')};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,ks)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&equal(Object.keys(o).sort(),ks.slice().sort());
const sha=b=>createHash('sha256').update(b).digest('hex');
const sha40=/^[a-f0-9]{40}$/;
const tuple=Object.freeze({...ACTIVE_RELEASE_TUPLE,signerWorkflow:ACTIVE_RELEASE_TUPLE.repository+'/.github/workflows/09p-steam626-bamboo-perop-proof.yml'});
const git=(...args)=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}}).trim()}catch{fail()}};
const requiredBlobs=Object.freeze({
 'crates/ddv-save-core/Cargo.toml':cargoBlob,
 'crates/ddv-save-core/src/wasm_steam_bamboo_readonly.rs':'26414572b41211076f1f83a3f8752eea2ab65142',
 'crates/ddv-save-core/src/worker_steam_bamboo_readonly.rs':'b3aa885d7668e6f8d3df9a20be4962d609ab6762',
 'crates/ddv-save-core/src/steam_bamboo_single_product_target.rs':'a5aef59173ee99454f7f108af58fa7c46dac6f19',
 'scripts/wasm-distribution/protected-release-inputs.json':'9a382ff6b669c1a7c00f0385373f030c69502a7e'
});
const policy=Object.freeze({proofOnly:true,publicAssets:false,productConsumerEnabled:false,writerAuthorized:false,stageAuthorized:false,editedCopyAuthorized:false,operationOn:false,autoUpload:false});
const abi=Object.freeze({exportClass:'WorkerWasmSource',method:'read_steam626_bamboo_single_target',itemId:40700007,readOnly:true,writerAuthorized:false,stageAuthorized:false,editedCopyAuthorized:false});
export function validateBambooProofManifest(m,bytes,source) {
 if(!sha40.test(source??'')||!Array.isArray(bytes)||bytes.length!==3||
 bytes.some((b,i)=>!Buffer.isBuffer(b)||!b.length||b.length>[65536,2097152,20971520][i])||
 !exact(m,['contract','kind','source','assets','release','abi'])||
 m.contract!==contract||m.kind!=='THREE_PROOF_SUBJECTS_NO_PUBLIC_DEPLOY'||
 !exact(m.source,['repository','commit','buildId','cargoTomlGitBlob','cargoLockSha256','rustcVersion','wasmBindgenCliVersion','features','defaultFeatures'])||
 !equal(m.source,{repository:tuple.repository,commit:source,buildId:build,cargoTomlGitBlob:cargoBlob,cargoLockSha256:lockSha,rustcVersion:'1.99.1',wasmBindgenCliVersion:'0.2.105',features,defaultFeatures:false})||
 !exact(m.release,Object.keys(policy))||!equal(m.release,policy)||
 !exact(m.abi,Object.keys(abi))||!equal(m.abi,abi)||!exact(m.assets,['js','wasm']))return false;
 for(const [k,i] of [['js',1],['wasm',2]])if(!exact(m.assets[k],['path','sizeBytes','sha256'])||
 m.assets[k].path!==names[i]||m.assets[k].sizeBytes!==bytes[i].length||m.assets[k].sha256!==sha(bytes[i]))return false;
 return true;
}
export function inspectBambooProofSubjects(bytes,source,issuer=tuple){
 if(!equal(issuer,tuple)||!Array.isArray(bytes)||bytes.length!==3)fail();
 let m;try{m=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes[0]))}catch{fail()}
 if(!validateBambooProofManifest(m,bytes,source))fail();
 let exports;try{exports=WebAssembly.Module.exports(new WebAssembly.Module(bytes[2]))}catch{fail()}
 const j=new TextDecoder('utf8',{fatal:true}).decode(bytes[1]);
 const forbidden=/(?:dev_(?:stage|undo|redo|begin|take)|private_native|semantic_writer|read_steam626_singlefence_target|(?:stage|export|write|save|apply|undo|redo|grant|debit|mutate|delete|overwrite|commit|toggle|preview|begin|take)_[a-z0-9_]+|[a-z0-9_]+_(?:stage|export|write|save|apply|undo|redo|grant|debit|mutate|delete|overwrite))/i;
 const knownMethods=['append_chunk','finish','read_core_version_witness','issue_typed_cursor',
 'read_typed_page','issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page',
 'read_steam626_bamboo_single_target','close'];
const knownWasm=new Set(['memory','__wbg_workerwasmsource_free','workerwasmsource_new',
 ...knownMethods.map(x=>'workerwasmsource_'+x),
 '__wbindgen_externrefs','__wbindgen_malloc','__externref_table_dealloc',
 '__wbindgen_realloc','__wbindgen_free','__wbindgen_start',
 // Keep the previous synthetic one-method positive readable by QA, but
 // never permit a second foreign WASM function alongside it.
 'read_steam626_bamboo_single_target']);
if(!j.includes(abi.method)||forbidden.test(j)||
 exports.some(x=>forbidden.test(x.name)||!knownWasm.has(x.name))||
 !exports.some(x=>x.kind==='function'&&x.name.includes(abi.method)))fail();
 return Object.freeze({contract:'wand.steam626.bamboo.perop.proof-pins@1',sourceHead:source,
 manifestSha256:sha(bytes[0]),manifestSizeBytes:bytes[0].length,
 jsSha256:sha(bytes[1]),jsSizeBytes:bytes[1].length,wasmSha256:sha(bytes[2]),wasmSizeBytes:bytes[2].length,
 verifiedSignature:false,publicAssets:false,productConsumerEnabled:false,writerAuthorized:false,operationOn:false});
}
async function sourceCheck(protectedMain=false) {
 const source=process.env.WAND_PROOF_EXPECTED_SOURCE;
 if(!sha40.test(source??'')||git('rev-parse','HEAD')!==source||
 process.env.GITHUB_REPOSITORY!=='DreamwishWand/web'||process.env.GITHUB_REPOSITORY_ID!=='1371485649')fail();
 if(protectedMain&&(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_REF!=='refs/heads/main'||
 process.env.GITHUB_SHA!==source||process.env.GITHUB_WORKFLOW_SHA!==source||
 process.env.GITHUB_WORKFLOW_REF!==tuple.signerWorkflow+'@'+tuple.sourceRef))fail();
 for(const [path,blob] of Object.entries(requiredBlobs))if(git('rev-parse','HEAD:'+path)!==blob)fail();
 const cfg=JSON.parse(await readFile(join(root,'scripts/wasm-distribution/protected-release-inputs.json'),'utf8'));
 if(cfg.cargoTomlGitBlob!==cargoBlob||cfg.approvedCargoLockSha256!==lockSha||cfg.writerEnabled!==false||
 cfg.productConsumerEnabled!==false||cfg.publicReadonlyAssetsApproved!==true||
 cfg.releasePermission!=='OWNER_APPROVED_20261111_THREE_READONLY_PUBLIC_ASSETS_ONLY'||
 !equal(cfg.features,['indexed-read','worker-wasm'])||cfg.defaultFeatures!==false)fail();
 if(sha(await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock')))!==lockSha)fail();
 for(const d of ['static/worker-wasm-steam626-bamboo-perop','build/worker-wasm-steam626-bamboo-perop']){
  if(git('ls-files',d)!=='')fail();
  try{await lstat(join(root,d));fail()}catch(e){if(e?.code!=='ENOENT')throw e}
 }
 return source;
}
async function secureDir(create=false){
 if(await realpath(root)!==root)fail();
 let at=root;
 for(const [i,part] of ['tests','wasm-distribution','fixtures'].entries()){
  at=join(at,part);let stat;
  try{stat=await lstat(at)}catch(e){
   if(!create||i!==2||e?.code!=='ENOENT')fail();
   try{await mkdir(at,{recursive:false});stat=await lstat(at)}catch{fail()}
  }
  if(stat.isSymbolicLink()||!stat.isDirectory()||await realpath(at)!==at)fail();
 }
 const out=join(root,proofDir);
 if(create)try{await mkdir(out,{recursive:false})}catch{fail()}
 let stat;try{stat=await lstat(out)}catch{fail()}
 if(stat.isSymbolicLink()||!stat.isDirectory()||await realpath(out)!==out)fail();
 return out;
}
async function readProof() {
 const dir=await secureDir();
 if(!equal((await readdir(dir)).sort(),names.slice().sort()))fail();
 return Promise.all(names.map(n=>readFile(join(dir,n))));
}
async function generate(source){
 const rustc=execFileSync('rustc',['--version'],{encoding:'utf8'}).trim();
 const bin=process.env.WAND_BINDGEN_CLI;
 if(!rustc.startsWith('rustc 1.99.1 ')||!bin||
 execFileSync(bin,['--version'],{encoding:'utf8'}).trim()!=='wasm-bindgen 0.2.105')fail();
 const lock=await readFile(join(root,'crates/ddv-save-core/Cargo.lock'));
 if(sha(lock)!==lockSha||!lock.equals(await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock'))))fail();
 const [js,wasm]=await Promise.all(names.slice(1).map(n=>readFile(join(root,'tests/stage-e/pkg',n))));
 const m={contract,kind:'THREE_PROOF_SUBJECTS_NO_PUBLIC_DEPLOY',
 source:{repository:tuple.repository,commit:source,buildId:build,cargoTomlGitBlob:cargoBlob,cargoLockSha256:lockSha,rustcVersion:'1.99.1',wasmBindgenCliVersion:'0.2.105',features,defaultFeatures:false},
 assets:{js:{path:names[1],sizeBytes:js.length,sha256:sha(js)},wasm:{path:names[2],sizeBytes:wasm.length,sha256:sha(wasm)}},release:policy,abi};
 const bytes=[Buffer.from(JSON.stringify(m,null,2)+'\n'),js,wasm];
 const pins=inspectBambooProofSubjects(bytes,source),out=await secureDir(true);
 for(let i=0;i<3;i++)await writeFile(join(out,names[i]),bytes[i],{flag:'wx',mode:0o600});
 if(!equal(pins,inspectBambooProofSubjects(await readProof(),source)))fail();
 console.log('BAMBOO_PROOF_THREE_REAL_UNSIGNED_SUBJECTS_NO_PUBLIC_ON',JSON.stringify(pins));
}
async function protectedCi(phase,source){
 const token=process.env.WAND_GATE_READ_TOKEN;
 if(typeof token!=='string'||!token)fail();
 const ci={repository:tuple.repository,head:source,workflowBlob:git('rev-parse','HEAD:.github/workflows/ci.yml')};
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
 console.log('BAMBOO_PROOF_EXACT_PROTECTED_MAIN_CI_PASS');
}
async function main(){
 const mode=process.argv[2];
 if(process.argv.length!==3||!['preflight','candidate','ci-build','ci-recheck','verify-signed'].includes(mode))fail();
 const protectedMain=['ci-build','ci-recheck','verify-signed'].includes(mode)||
 process.env.GITHUB_EVENT_NAME==='workflow_dispatch';
 const source=await sourceCheck(protectedMain);
 if(mode==='preflight')return console.log('BAMBOO_PROOF_EXACT_SOURCE_PUBLIC_OFF');
 if(mode==='candidate')return generate(source);
 if(mode==='ci-build'||mode==='ci-recheck')return protectedCi(mode,source);
 const bundle=process.env.WAND_PROOF_BUNDLE;
 if(typeof bundle!=='string'||!bundle||(await readFile(bundle)).length===0)fail();
 const dir=await secureDir();
 const pins=await verifySignedReleaseSubjects(dir,source,bundle,tuple,inspectBambooProofSubjects);
 if(!equal(pins,inspectBambooProofSubjects(await readProof(),source)))fail();
 console.log('BAMBOO_PROOF_THREE_SIGNED_SUBJECTS_VERIFIED_PROOF_ONLY',JSON.stringify(pins));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(()=>{console.error('BAMBOO_PEROP_PROOF_DENIED');process.exitCode=1});
