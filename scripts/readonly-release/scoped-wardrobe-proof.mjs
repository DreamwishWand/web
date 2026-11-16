// ACT1193: fixed two Build-specific Wardrobe scopes; reuse the existing browser contract
// and exact-subject verifier. No public seal, deploy, or new issuer.
import {readFile,writeFile,mkdir,rename,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ACTIVE_RELEASE_TUPLE as tuple,protectedPagesContextMatches,releaseDelivery} from '../../src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs';
import {STEAM_WARDROBE_RELEASE as steam,SWITCH_WARDROBE_RELEASE as sw,placementManifestOk,placementExportsOk,placementAnchorShapeOk,placementIdentityText} from '../../src/lib/ddv/core/save/product-scoped-placement-release.mjs';
import {verifySignedReleaseSubjects} from './seal.mjs';
const root=resolve(import.meta.dirname,'../..');
const names=['manifest.json','ddv_save_core.js','ddv_save_core_bg.wasm'];
const max=[64*1024,2*1024*1024,20*1024*1024];
const lockSha='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('SCOPED_WARDROBE_PROOF_DENIED')};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const head=/^[0-9a-f]{40}$/;
const anchorPath=join(root,'src/lib/ddv/core/save/product-scoped-wardrobe-release-anchor.mjs');
function known(s){if(s!==steam&&s!==sw)fail();return s}
export function fixedWardrobeProofScope(key){if(key===steam.key)return steam;if(key===sw.key)return sw;fail()}
const anchorName=s=>known(s)===steam?'PROTECTED_STEAM_WARDROBE_RELEASE_ANCHOR':'PROTECTED_SWITCH_WARDROBE_RELEASE_ANCHOR';
const deniedBase='dev_(?:stage|undo|redo|begin|take)|private_native|(?:discover|preview|stage|toggle)_scoped_amount|(?:begin_scoped_amount_output|next_scoped_amount_output_chunk)|preview_scoped_collection_candidate|(?:preview|stage)_fixed_collection|(?:discover|preview|stage)_(?:steam626|switch626)_chest|(?:discover|preview|stage)_switch626_catalog0|(?:preview|stage)_steam626_sr03';
const denySymbols=s=>new RegExp(deniedBase+'|(?:preview|stage)_steam626_(?:comp03|vase_add)|(?:preview|stage)_(?:steam626|switch626)_backpack_split|(?:preview|stage)_'+(known(s)===steam?'switch626':'steam626')+'_wardrobe','i');
export function inspectWardrobeSubjects(s,bytes,source,t=tuple){
 known(s);
 if(!head.test(source??'')||!Array.isArray(bytes)||bytes.length!==3||bytes.some((b,i)=>!Buffer.isBuffer(b)||!b.length||b.length>max[i]))fail();
 const [mf,js,wasm]=bytes;
 let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(mf))}catch{fail()}
 const p={contract:s.prefix+'.pinned-digests@1',sourceHead:source,manifestSha256:sha(mf),manifestSizeBytes:mf.length,jsSha256:sha(js),jsSizeBytes:js.length,wasmSha256:sha(wasm),wasmSizeBytes:wasm.length};
 if(!placementManifestOk(s,m,p,t)||!placementExportsOk(s,new WebAssembly.Module(wasm))||denySymbols(s).test(new TextDecoder('utf-8',{fatal:true}).decode(js)))fail();
 return Object.freeze(p);
}
export function privateWardrobeIdentity(s,pins,origin){
 known(s);
 const a={contract:s.prefix+'.protected-release@1',...tuple,operation:s.operation,pins,mode:'private-product-v2',deliveryOrigin:origin,
  builds:[{platform:s.platform,buildId:s.buildId,productV2EvidenceSha256:null}],attestationVerifiedAtBuild:true,releaseId:'0'.repeat(64)};
 if(!placementAnchorShapeOk(s,a))fail();
 return Object.freeze({...a,releaseId:sha(placementIdentityText(s,a))});
}
export function replacePrivateWardrobeAnchor(s,prior,a){
 const name=anchorName(s),other=anchorName(s===steam?sw:steam);
 const marker='export const '+name+'=null;',otherMarker='export const '+other+'=null;';
 if(!placementAnchorShapeOk(s,a)||a.mode!=='private-product-v2'||a.releaseId!==sha(placementIdentityText(s,a))||
  prior.split(marker).length!==2||prior.split(otherMarker).length!==2)fail();
 const variable=s===steam?'steamWardrobePrivateData':'switchWardrobePrivateData';
 const line='const '+variable+'='+JSON.stringify(a)+';\nObject.freeze('+variable+'.pins); '+variable+'.builds.forEach(Object.freeze); Object.freeze('+variable+'.builds);\nexport const '+name+'=Object.freeze('+variable+');';
 return prior.replace(marker,line);
}
async function absent(p){try{await lstat(p);fail()}catch(e){if(e?.code!=='ENOENT')throw e}}
async function noPublic(){
 for(const s of [steam,sw]){
  if(git('ls-files','static/'+s.assetDir)!=='')fail();
  await absent(join(root,'static',s.assetDir));await absent(join(root,'build',s.assetDir));
 }
 if(git('diff','--name-only','HEAD','--',anchorPath)!=='')fail();
 const prior=await readFile(anchorPath,'utf8');
 for(const s of [steam,sw])if(prior.split('export const '+anchorName(s)+'=null;').length!==2)fail();
}
async function protectedContext(source){
 if(!head.test(source??'')||process.env.WAND_PROOF_EXPECTED_SOURCE!==source||
  process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||!protectedPagesContextMatches(process.env,source,git('rev-parse','HEAD')))fail();
 await noPublic();
}
async function build(s,source){
 await protectedContext(source);
 const lock=await readFile(join(root,'crates/ddv-save-core/Cargo.lock')),approved=await readFile(join(root,'scripts/wasm-distribution/approved-Cargo.lock'));
 if(!lock.equals(approved)||sha(lock)!==lockSha)fail();
 const toolchain=execFileSync('rustc',['--version','--verbose'],{encoding:'utf8'}),bindgen=process.env.WAND_BINDGEN_CLI;
 if(!toolchain.startsWith('rustc 1.99.1 ')||!bindgen||execFileSync(bindgen,['--version'],{encoding:'utf8'}).trim()!=='wasm-bindgen 0.2.105')fail();
 const [js,wasm]=await Promise.all(names.slice(1).map(n=>readFile(join(root,'tests/stage-e/pkg',n))));
 const cargo=await readFile(join(root,'crates/ddv-save-core/Cargo.toml'));
 const m={contract:s.prefix+'.runtime@1',operation:s.operation,source:{repository:tuple.repository,commit:source,cargoTomlSha256:sha(cargo),cargoLockSha256:sha(lock),cargoLockOrigin:'approved-repository-lock',wasmBindgen:'0.2.105',wasmTarget:'wasm32-unknown-unknown',profile:'release',features:s.features,defaultFeatures:false,toolchain},...(tuple.basePath==='/web'?{}:{delivery:releaseDelivery(tuple)}),assets:{js:{path:names[1],sizeBytes:js.length,sha256:sha(js)},wasm:{path:names[2],sizeBytes:wasm.length,sha256:sha(wasm)}},abi:{exportClass:'WorkerWasmSource',methods:s.methods,writerAuthorized:false,originalOverwriteAuthorized:false},release:{productConsumerEnabled:false,writerAuthorized:false,autoUpload:false,originalOverwriteAuthorized:false}};
 const bytes=[Buffer.from(JSON.stringify(m,null,2)+'\n'),js,wasm],pins=inspectWardrobeSubjects(s,bytes,source);
 const dir=join(root,'tests/wasm-distribution/fixtures/scoped-'+s.key);
 await mkdir(dir,{recursive:false});
 for(let i=0;i<names.length;i++)await writeFile(join(dir,names[i]),bytes[i],{flag:'wx'});
 await writeFile(join(root,'tests/wasm-distribution/fixtures/scoped-'+s.key+'-pins.json'),JSON.stringify(pins),{flag:'wx'});
 await noPublic();console.log('SCOPED_WARDROBE_CANDIDATE_EXACT_THREE_OFF',JSON.stringify(pins));
}
async function verify(s,source,dir,bundle){
 if(!head.test(source??'')||git('rev-parse','HEAD')!==source||!dir||!bundle||!(await readFile(resolve(bundle))).length)fail();
 return verifySignedReleaseSubjects(resolve(dir),source,resolve(bundle),tuple,(bytes,h,t)=>inspectWardrobeSubjects(s,bytes,h,t));
}
async function seal(s,source,dir,bundle,origin){
 if(process.env.GITHUB_ACTIONS==='true'||git('status','--porcelain','--untracked-files=all')!=='')fail();
 await noPublic();
 if(!(await lstat(anchorPath)).isFile())fail();
 const prior=await readFile(anchorPath,'utf8'),pins=await verify(s,source,dir,bundle),a=privateWardrobeIdentity(s,pins,origin),out=replacePrivateWardrobeAnchor(s,prior,a);
 const bytes=await Promise.all(names.map(n=>readFile(join(resolve(dir),n))));
 if(!same(inspectWardrobeSubjects(s,bytes,source),pins))fail();
 const target=join(root,'static',s.assetDir),temp=anchorPath+'.private-v2.tmp';
 await mkdir(target,{recursive:false});let owned=false,committed=false;
 try{
  for(let i=0;i<names.length;i++)await writeFile(join(target,names[i]),bytes[i],{flag:'wx',mode:0o600});
  if(!same(inspectWardrobeSubjects(s,await Promise.all(names.map(n=>readFile(join(target,n)))),source),pins))fail();
  await writeFile(temp,out,{flag:'wx',mode:0o600});owned=true;
  if(await readFile(anchorPath,'utf8')!==prior||git('rev-parse','HEAD')!==source)fail();
  await rename(temp,anchorPath);owned=false;committed=true;
  console.log('SCOPED_WARDROBE_PRIVATE_SIGNED_SUBJECTS_SEALED_NO_PUBLIC_GRANT',a.releaseId);
 }finally{if(owned)await rm(temp,{force:true});if(!committed)await rm(target,{recursive:true,force:true})}
}
async function main(){
 const [cmd,key,source,dir,bundle,origin]=process.argv.slice(2),s=fixedWardrobeProofScope(key);
 if(cmd==='build'&&process.argv.length===5)return build(s,source);
 if(cmd==='verify-protected-candidate'&&process.argv.length===7){
  await protectedContext(source);const pins=await verify(s,source,dir,bundle);await noPublic();
  console.log('SCOPED_WARDROBE_PROTECTED_CANDIDATE_SIGNED_PROOF_ONLY',JSON.stringify(pins));return;
 }
 if(cmd==='seal-private-v2'&&process.argv.length===8)return seal(s,source,dir,bundle,origin);
 fail();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
