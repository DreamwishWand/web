// Switch626 Chest fixed scope, same protected signer/verified-byte pipeline.
// Source contract only: the Switch-only Core feature/artifact requires 01A
// and affected QA acceptance. No mixed Steam/Collection WASM or authority.
// No second SaveSession/Engine, registry or alternate issuer.
import {ACTIVE_RELEASE_TUPLE,matchReleaseTuple,manifestMatchesRelease} from './product-rust-wasm-release-trust.mjs';
import {checkedFetch,compileVerifiedWorker} from './product-rust-wasm-candidate-loader.mjs';
import {PROTECTED_SCOPED_SWITCH_CHEST_RELEASE_ANCHOR as anchor} from './product-scoped-switch-chest-release-anchor.mjs';
const fail=()=>{throw Error('SCOPED_SWITCH_CHEST_RELEASE_DENIED')};
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const head=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const size=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export const SCOPED_SWITCH_CHEST_RELEASE_OP='switch626.chest.exact1';
export const SCOPED_SWITCH_CHEST_FEATURES=Object.freeze(['product-switch626-chest-scoped','worker-wasm']);
export const SCOPED_SWITCH_CHEST_METHODS=Object.freeze([
 'append_chunk','finish','read_core_version_witness','issue_typed_cursor','read_typed_page',
 'issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page','discover_switch626_chest',
 'preview_switch626_chest','stage_switch626_chest','toggle_scoped_edit','begin_scoped_edit_output','next_scoped_edit_output_chunk','close'
]);
// Expected exact public ABI (PR1422 Switch methods + existing neutral ledger).
// The Switch-only generated export census is a required later acceptance,
// not inferred actual proof. Steam and Collection aliases must be absent.
export const SCOPED_SWITCH_CHEST_WASM_EXPORTS=Object.freeze([
 'memory','__wbg_workerwasmsource_free','workerwasmsource_new',
 ...SCOPED_SWITCH_CHEST_METHODS.map(n=>'workerwasmsource_'+n),
 '__wbindgen_externrefs','__wbindgen_malloc','__externref_table_dealloc','__wbindgen_realloc','__wbindgen_free','__wbindgen_start'
].sort());
export function scopedSwitchChestWasmExportsOk(module){
 const actual=WebAssembly.Module.exports(module);
 return JSON.stringify(actual.map(x=>x.name).sort())===JSON.stringify(SCOPED_SWITCH_CHEST_WASM_EXPORTS)&&
  actual.every(x=>x.kind===(x.name==='memory'?'memory':x.name==='__wbindgen_externrefs'?'table':'function'));
}
const denied=/(?:dev_(?:stage|undo|redo|begin|take)|private_native|(?:discover|preview|stage|toggle)_scoped_amount|(?:begin_scoped_amount_output|next_scoped_amount_output_chunk)|preview_scoped_collection_candidate|(?:preview|stage)_fixed_collection)/i;
const lock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
export const SCOPED_SWITCH_CHEST_ASSET_DIR='worker-wasm-scoped-switch-chest';
const buildIds=Object.freeze({switch:'9A239D3DB569756D'});
const asset=(a,name,max)=>exact(a,'path,sizeBytes,sha256')&&a.path===name&&size(a.sizeBytes,max)&&sha(a.sha256);
export function scopedSwitchChestPinsOk(p){
 return exact(p,'contract,sourceHead,manifestSha256,manifestSizeBytes,jsSha256,jsSizeBytes,wasmSha256,wasmSizeBytes')&&
  p.contract==='wand.scoped-switch-chest.pinned-digests@1'&&head(p.sourceHead)&&
  [p.manifestSha256,p.jsSha256,p.wasmSha256].every(sha)&&size(p.manifestSizeBytes,64*1024)&&size(p.jsSizeBytes,2*1024*1024)&&size(p.wasmSizeBytes,20*1024*1024);
}
export function scopedSwitchChestManifestOk(m,p,tuple=ACTIVE_RELEASE_TUPLE){
 const t=matchReleaseTuple(tuple);
 if(!t||!scopedSwitchChestPinsOk(p)||!exact(m,t.basePath==='/web'?'contract,operation,source,assets,abi,release':'contract,operation,source,assets,abi,release,delivery')||
  m.contract!=='wand.scoped-switch-chest.runtime@1'||m.operation!==SCOPED_SWITCH_CHEST_RELEASE_OP||!manifestMatchesRelease(m,t))return false;
 const s=m.source,a=m.assets,b=m.abi,g=m.release;
 return exact(s,'repository,commit,cargoTomlSha256,cargoLockSha256,cargoLockOrigin,wasmBindgen,wasmTarget,profile,features,defaultFeatures,toolchain')&&
  s.commit===p.sourceHead&&sha(s.cargoTomlSha256)&&s.cargoLockSha256===lock&&s.cargoLockOrigin==='approved-repository-lock'&&
  s.wasmBindgen==='0.2.105'&&s.wasmTarget==='wasm32-unknown-unknown'&&s.profile==='release'&&s.defaultFeatures===false&&
  typeof s.toolchain==='string'&&s.toolchain.startsWith('rustc 1.99.1 ')&&same(s.features,SCOPED_SWITCH_CHEST_FEATURES)&&
  exact(a,'js,wasm')&&asset(a.js,'ddv_save_core.js',2*1024*1024)&&asset(a.wasm,'ddv_save_core_bg.wasm',20*1024*1024)&&
  a.js.sha256===p.jsSha256&&a.js.sizeBytes===p.jsSizeBytes&&a.wasm.sha256===p.wasmSha256&&a.wasm.sizeBytes===p.wasmSizeBytes&&
  exact(b,'exportClass,methods,writerAuthorized,originalOverwriteAuthorized')&&b.exportClass==='WorkerWasmSource'&&same(b.methods,SCOPED_SWITCH_CHEST_METHODS)&&
  b.writerAuthorized===false&&b.originalOverwriteAuthorized===false&&
  exact(g,'productConsumerEnabled,writerAuthorized,autoUpload,originalOverwriteAuthorized')&&
  g.productConsumerEnabled===false&&g.writerAuthorized===false&&g.autoUpload===false&&g.originalOverwriteAuthorized===false;
}
// Runtime validates signed identity + independently accepted product V2 scope.
// The protected sealer is the issuer; candidate manifest cannot activate it.
export function scopedSwitchChestAnchorShapeOk(a){
 if(!exact(a,'contract,repository,signerWorkflow,sourceRef,origin,basePath,operation,pins,mode,deliveryOrigin,builds,releaseId,attestationVerifiedAtBuild')||
   a.contract!=='wand.scoped-switch-chest.protected-release@1'||a.operation!==SCOPED_SWITCH_CHEST_RELEASE_OP||
   matchReleaseTuple(a)!==ACTIVE_RELEASE_TUPLE||a.attestationVerifiedAtBuild!==true||!scopedSwitchChestPinsOk(a.pins)||!sha(a.releaseId)||
   !Array.isArray(a.builds)||a.builds.length!==1)return false;
 const privateV2=a.mode==='private-product-v2';
 if(!privateV2&&a.mode!=='public-accepted')return false;
 // Private V2 runs the SAME built product route/loader with signed subjects
 // at a sealed loopback origin. It is never a public feature grant.
 if(privateV2){
  if(typeof a.deliveryOrigin!=='string'||!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(a.deliveryOrigin))return false;
  try{const u=new URL(a.deliveryOrigin);if(u.origin!==a.deliveryOrigin||Number(u.port)>65535)return false}catch{return false}
 }else if(a.deliveryOrigin!==a.origin)return false;
 const seen=new Set();
 for(const b of a.builds){
  if(!exact(b,'platform,buildId,productV2EvidenceSha256')||!Object.hasOwn(buildIds,b.platform)||b.buildId!==buildIds[b.platform]||
    (privateV2?b.productV2EvidenceSha256!==null:!sha(b.productV2EvidenceSha256))||seen.has(b.platform))return false;
  seen.add(b.platform);
 }
 return true;
}
export function scopedSwitchChestReleaseIdentityText(a){
 return JSON.stringify(['wand.scoped-switch-chest.protected-release@1',a.repository,a.signerWorkflow,a.sourceRef,a.origin,a.basePath,a.operation,
  a.pins.sourceHead,a.pins.manifestSha256,a.pins.manifestSizeBytes,a.pins.jsSha256,a.pins.jsSizeBytes,a.pins.wasmSha256,a.pins.wasmSizeBytes,a.mode,a.deliveryOrigin,
  a.builds.map(b=>[b.platform,b.buildId,b.productV2EvidenceSha256])]);
}
export async function validateScopedSwitchChestAnchor(a){
 if(!scopedSwitchChestAnchorShapeOk(a)||await digest(new TextEncoder().encode(scopedSwitchChestReleaseIdentityText(a)))!==a.releaseId)fail();
 return true;
}
// Source-pinned candidate path, no issuer trust or product activation.
export async function loadPinnedScopedSwitchChestBytes({basePath,trustedPins,releaseTuple=ACTIVE_RELEASE_TUPLE,fetcher=fetch}={}){
 if(typeof document!=='undefined'||typeof globalThis.self?.location==='undefined'||!scopedSwitchChestPinsOk(trustedPins))fail();
 const t=matchReleaseTuple(releaseTuple),where=self.location;
 if(!t||basePath!==t.basePath||!/^https?:$/.test(where.protocol)||
  (where.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(where.hostname))||
  (basePath&&!where.pathname.startsWith(basePath+'/')))fail();
 const base=new URL(where.origin+basePath+'/'+SCOPED_SWITCH_CHEST_ASSET_DIR+'/');
 const url=n=>new URL(n,base),p=trustedPins;
 const raw=await checkedFetch(url('manifest.json'),p.manifestSizeBytes,p.manifestSha256,'application/json',fetcher);
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{fail()}
 if(!scopedSwitchChestManifestOk(manifest,p,t))fail();
 const [js,wasm]=await Promise.all([checkedFetch(url('ddv_save_core.js'),p.jsSizeBytes,p.jsSha256,'text/javascript',fetcher),
  checkedFetch(url('ddv_save_core_bg.wasm'),p.wasmSizeBytes,p.wasmSha256,'application/wasm',fetcher)]);
 if(wasm[0]!==0||wasm[1]!==97||wasm[2]!==115||wasm[3]!==109)fail();
 const WorkerWasmSource=await compileVerifiedWorker(js,wasm,{deniedSymbol:denied,requiredMethods:SCOPED_SWITCH_CHEST_METHODS,exactPrototype:true,exactWasmExports:SCOPED_SWITCH_CHEST_WASM_EXPORTS});
 return Object.freeze({WorkerWasmSource,sourceHead:p.sourceHead,checkedBothJsAndWasm:true,sameOriginFetchOnly:true,writerAuthorized:false,productConsumerEnabled:false});
}
// No caller URL or mode can select the release. This pure predicate is also
// used by the page before any Worker construction or local file selection.
export function scopedSwitchChestDeliveryOk(a,where){
 return scopedSwitchChestAnchorShapeOk(a)&&!!where&&where.origin===a.deliveryOrigin&&
  where.protocol===(a.mode==='private-product-v2'?'http:':'https:')&&
  (!a.basePath||where.pathname.startsWith(a.basePath+'/'));
}
export async function getScopedSwitchChestMountInfo(){
 if(arguments.length!==0||typeof globalThis.location==='undefined')fail();
 await validateScopedSwitchChestAnchor(anchor);
 if(!scopedSwitchChestDeliveryOk(anchor,globalThis.location)||globalThis.location.pathname!==anchor.basePath+'/editor/chest/')fail();
 return Object.freeze({releaseId:anchor.releaseId,operation:anchor.operation,mode:anchor.mode,
  builds:Object.freeze(anchor.builds.map(b=>Object.freeze({...b})))});
}

let attempted=false;
export async function loadProtectedScopedSwitchChestRustWasm(){
 if(arguments.length!==0||attempted||typeof document!=='undefined'||typeof globalThis.self?.location==='undefined')fail();
 attempted=true;await validateScopedSwitchChestAnchor(anchor);
 const where=self.location;
 if(!scopedSwitchChestDeliveryOk(anchor,where)||!where.pathname.startsWith(anchor.basePath+'/_app/'))fail();
 const loaded=await loadPinnedScopedSwitchChestBytes({basePath:anchor.basePath,trustedPins:anchor.pins,releaseTuple:anchor});
 if(loaded.sourceHead!==anchor.pins.sourceHead||loaded.writerAuthorized!==false||loaded.productConsumerEnabled!==false)fail();
 return Object.freeze({...loaded,releaseId:anchor.releaseId,operation:anchor.operation,
  mode:anchor.mode,builds:Object.freeze(anchor.builds.map(b=>Object.freeze({...b}))),attestationVerifiedAtBuild:true});
}
