// 09P CODE: distinct exact Bamboo40700007 per-Operation Reader release.
// This is a distribution contract, NOT a signature, permission or new Engine.
import {ACTIVE_RELEASE_TUPLE,matchReleaseTuple,manifestMatchesRelease} from './product-rust-wasm-release-trust.mjs';
import {checkedFetch,compileVerifiedWorker} from './product-rust-wasm-candidate-loader.mjs';
import {PROTECTED_BAMBOO40700007_READONLY_ANCHOR as anchor} from './product-steam626-bamboo-readonly-anchor.mjs';
const fail=()=>{throw Error('BAMBOO40700007_READONLY_DELIVERY_DENIED')};
const exact=(o,ks)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join(',')===ks.split(',').sort().join(',');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex40=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const hex64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const size=(x,max)=>Number.isSafeInteger(x)&&x>0&&x<=max;
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const BAMBOO_READONLY_OPERATION='steam626.bamboo40700007.target.readonly@1';
export const BAMBOO_READONLY_ASSET_DIR='worker-wasm-steam626-bamboo-readonly';
export const BAMBOO_BUILD='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
export const BAMBOO_FEATURES=Object.freeze(['product-steam626-bamboo-readonly','worker-wasm']);
export const BAMBOO_METHODS=Object.freeze([
 'append_chunk','finish','read_core_version_witness','issue_typed_cursor','read_typed_page',
 'issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page',
 'read_steam626_bamboo_single_target','close'
]);
export const BAMBOO_WASM_EXPORTS=Object.freeze([
 'memory','__wbg_workerwasmsource_free','workerwasmsource_new',
 ...BAMBOO_METHODS.map(n=>'workerwasmsource_'+n),
 '__wbindgen_externrefs','__wbindgen_malloc','__externref_table_dealloc',
 '__wbindgen_realloc','__wbindgen_free','__wbindgen_start'
].sort());
const denied=/(?:dev_(?:stage|undo|redo|begin|take)|private_native|semantic_writer|read_steam626_singlefence_target|(?:stage|export|write|save|apply|undo|redo|grant|debit|mutate|delete|overwrite|commit|toggle|preview|begin|take)_[a-z0-9_]+|[a-z0-9_]+_(?:stage|export|write|save|apply|undo|redo|grant|debit|mutate|delete|overwrite))/i;
// The manifest's readOnly bit does not make arbitrary verified JavaScript read-only.
// Deny foreign Operation mutations even when not methods of WorkerWasmSource.
export function bambooReadJsSymbolsOk(js){
 return typeof js==='string'&&!denied.test(js);
}
const LOCK='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const CARGO='e4f2e2c5d4451baba2dea699fe497cb7b40668d4';
const file=(a,n,m)=>exact(a,'path,sizeBytes,sha256')&&a.path===n&&size(a.sizeBytes,m)&&hex64(a.sha256);
export function bambooReadPinsOk(p){
 return exact(p,'contract,sourceHead,manifestSha256,manifestSizeBytes,jsSha256,jsSizeBytes,wasmSha256,wasmSizeBytes')&&
 p.contract==='wand.bamboo40700007.pinned-digests@1'&&hex40(p.sourceHead)&&
 [p.manifestSha256,p.jsSha256,p.wasmSha256].every(hex64)&&
 size(p.manifestSizeBytes,65536)&&size(p.jsSizeBytes,2097152)&&size(p.wasmSizeBytes,20971520);
}
// A manifest/candidate is not an authorization. All trusted pins must come
// from a protected, independently signed and QA-accepted build-time anchor.
export function bambooReadManifestOk(m,p,tuple=ACTIVE_RELEASE_TUPLE){
 const t=matchReleaseTuple(tuple);
 if(!t||!bambooReadPinsOk(p)||!exact(m,t.basePath==='/web'?
   'contract,operation,source,assets,abi,release':'contract,operation,source,assets,abi,release,delivery')||
 m.contract!=='wand.bamboo40700007.public-readonly-candidate@1'||m.operation!==BAMBOO_READONLY_OPERATION||
 !manifestMatchesRelease(m,t))return false;
 const s=m.source,b=m.abi,r=m.release,a=m.assets;
 return exact(s,'repository,commit,buildId,platform,schema,cargoTomlGitBlob,cargoLockSha256,cargoLockOrigin,wasmBindgen,wasmTarget,profile,features,defaultFeatures,toolchain')&&
 s.repository===t.repository&&s.commit===p.sourceHead&&s.buildId===BAMBOO_BUILD&&
 s.platform==='SteamWindows'&&s.schema===626&&s.cargoTomlGitBlob===CARGO&&
 s.cargoLockSha256===LOCK&&s.cargoLockOrigin==='approved-repository-lock'&&
 s.wasmBindgen==='0.2.105'&&s.wasmTarget==='wasm32-unknown-unknown'&&
 s.profile==='release'&&s.defaultFeatures===false&&same(s.features,BAMBOO_FEATURES)&&
 typeof s.toolchain==='string'&&s.toolchain.startsWith('rustc 1.99.1 ')&&
 exact(a,'js,wasm')&&file(a.js,'ddv_save_core.js',2097152)&&file(a.wasm,'ddv_save_core_bg.wasm',20971520)&&
 a.js.sha256===p.jsSha256&&a.wasm.sha256===p.wasmSha256&&
 a.js.sizeBytes===p.jsSizeBytes&&a.wasm.sizeBytes===p.wasmSizeBytes&&
 exact(b,'exportClass,methods,itemId,platform,schema,buildId,readOnly,writerAuthorized,stageAuthorized,originalOverwriteAuthorized')&&
 b.exportClass==='WorkerWasmSource'&&same(b.methods,BAMBOO_METHODS)&&
 b.itemId===40700007&&b.platform==='SteamWindows'&&b.schema===626&&b.buildId===BAMBOO_BUILD&&
 b.readOnly===true&&b.writerAuthorized===false&&b.stageAuthorized===false&&
 b.originalOverwriteAuthorized===false&&
 exact(r,'candidateOnly,productConsumerEnabled,writerAuthorized,stageAuthorized,editedCopyAuthorized,autoUpload,originalOverwriteAuthorized')&&
 r.candidateOnly===true&&r.productConsumerEnabled===false&&r.writerAuthorized===false&&
 r.stageAuthorized===false&&r.editedCopyAuthorized===false&&r.autoUpload===false&&
 r.originalOverwriteAuthorized===false;
}
export function bambooWasmExportsOk(module){
 const exports=WebAssembly.Module.exports(module);
 return same(exports.map(x=>x.name).sort(),BAMBOO_WASM_EXPORTS)&&
 exports.every(x=>x.kind===(x.name==='memory'?'memory':x.name==='__wbindgen_externrefs'?'table':'function'));
}
// Only the trusted protected Pages sealer can write this identity into the
// uncommitted Worker build. Public URL/manifest/pins alone grant NOTHING.
export function bambooReadAnchorOk(a){
 return exact(a,'contract,repository,signerWorkflow,sourceRef,origin,basePath,operation,pins,mode,buildId,releaseId,attestationVerifiedAtBuild,readOnlyOperationAuthorized')&&
 a.contract==='wand.bamboo40700007.protected-readonly-release@1'&&
 a.operation===BAMBOO_READONLY_OPERATION&&matchReleaseTuple(a)===ACTIVE_RELEASE_TUPLE&&
 a.mode==='public-accepted'&&a.buildId===BAMBOO_BUILD&&
 a.attestationVerifiedAtBuild===true&&a.readOnlyOperationAuthorized===true&&
 bambooReadPinsOk(a.pins)&&hex64(a.releaseId);
}
export function bambooReadReleaseIdentityText(a){
 return JSON.stringify(['wand.bamboo40700007.protected-readonly-release@1',
  a.repository,a.signerWorkflow,a.sourceRef,a.origin,a.basePath,a.operation,
  a.pins.sourceHead,a.pins.manifestSha256,a.pins.manifestSizeBytes,
  a.pins.jsSha256,a.pins.jsSizeBytes,a.pins.wasmSha256,a.pins.wasmSizeBytes,
  a.mode,a.buildId,a.readOnlyOperationAuthorized]);
}
export async function validateBambooReadAnchor(a){
 if(!bambooReadAnchorOk(a)||await digest(new TextEncoder().encode(bambooReadReleaseIdentityText(a)))!==a.releaseId)fail();
 return true;
}
export function bambooReadDeliveryOk(a,where){
 return bambooReadAnchorOk(a)&&where?.origin===a.origin&&where.protocol==='https:'&&
 (!a.basePath||where.pathname.startsWith(a.basePath+'/'));
}
// No browser page can bypass the separately accepted Worker boundary. This
// validates immutable bytes; it does not mint an Owner session or CAS token.
export async function loadPinnedBambooReadonlyBytes({basePath,pins,releaseTuple=ACTIVE_RELEASE_TUPLE,fetcher=fetch}={}){
 if(typeof document!=='undefined'||typeof globalThis.self?.location==='undefined'||!bambooReadPinsOk(pins))fail();
 const t=matchReleaseTuple(releaseTuple),where=self.location;
 if(!t||t!==ACTIVE_RELEASE_TUPLE||basePath!==t.basePath||
  where.protocol!=='https:'||where.origin!==t.origin||
  (basePath&&!where.pathname.startsWith(basePath+'/')))fail();
 const base=new URL(where.origin+basePath+'/'+BAMBOO_READONLY_ASSET_DIR+'/');
 const url=n=>new URL(n,base);
 const manifestBytes=await checkedFetch(url('manifest.json'),pins.manifestSizeBytes,pins.manifestSha256,'application/json',fetcher);
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(manifestBytes))}catch{fail()}
 if(!bambooReadManifestOk(manifest,pins,t))fail();
 const [js,wasm]=await Promise.all([
  checkedFetch(url('ddv_save_core.js'),pins.jsSizeBytes,pins.jsSha256,'text/javascript',fetcher),
  checkedFetch(url('ddv_save_core_bg.wasm'),pins.wasmSizeBytes,pins.wasmSha256,'application/wasm',fetcher)
 ]);
 if(!bambooReadJsSymbolsOk(new TextDecoder('utf8',{fatal:true}).decode(js))||
 !bambooWasmExportsOk(new WebAssembly.Module(wasm)))fail();
 const WorkerWasmSource=await compileVerifiedWorker(js,wasm,{
  deniedSymbol:denied,requiredMethods:BAMBOO_METHODS,exactPrototype:true,exactWasmExports:BAMBOO_WASM_EXPORTS
 });
 return Object.freeze({WorkerWasmSource,sourceHead:pins.sourceHead,
  checkedBothJsAndWasm:true,sameOriginFetchOnly:true,
  writerAuthorized:false,stageAuthorized:false,productConsumerEnabled:false});
}
let attempted=false;
export async function loadProtectedBambooReadonlyWorker(){
 if(arguments.length!==0||attempted||typeof document!=='undefined'||
  typeof globalThis.self?.location==='undefined')fail();
 attempted=true;
 await validateBambooReadAnchor(anchor);
 if(!bambooReadDeliveryOk(anchor,self.location)||
  !self.location.pathname.startsWith(anchor.basePath+'/_app/'))fail();
 const loaded=await loadPinnedBambooReadonlyBytes({basePath:anchor.basePath,pins:anchor.pins,releaseTuple:anchor});
 if(loaded.sourceHead!==anchor.pins.sourceHead||loaded.writerAuthorized!==false||
  loaded.productConsumerEnabled!==false)fail();
 return Object.freeze({...loaded,operation:anchor.operation,releaseId:anchor.releaseId,
  attestationVerifiedAtBuild:true,readOnlyOperationAuthorized:true,
  writerAuthorized:false,stageAuthorized:false});
}
