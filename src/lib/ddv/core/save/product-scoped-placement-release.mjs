// Two independent fixed placement artifact identities; shared existing byte
// verification and protected issuer. No general placement/runtime registry.
// Feature and export lists are Source contracts pending real Core census.
import {ACTIVE_RELEASE_TUPLE,matchReleaseTuple,manifestMatchesRelease} from './product-rust-wasm-release-trust.mjs';
import {checkedFetch,compileVerifiedWorker} from './product-rust-wasm-candidate-loader.mjs';
import {PROTECTED_COMP03_RELEASE_ANCHOR,PROTECTED_VASE_ADD_RELEASE_ANCHOR} from './product-scoped-placement-release-anchor.mjs';
import {PROTECTED_SR03_RELEASE_ANCHOR} from './product-scoped-sr03-release-anchor.mjs';
import {PROTECTED_RM01_RELEASE_ANCHOR} from './product-scoped-rm01-release-anchor.mjs';
import {PROTECTED_STEAM_BACKPACK_RELEASE_ANCHOR,PROTECTED_SWITCH_BACKPACK_RELEASE_ANCHOR} from './product-scoped-backpack-release-anchor.mjs';
import {PROTECTED_STEAM_WARDROBE_RELEASE_ANCHOR,PROTECTED_SWITCH_WARDROBE_RELEASE_ANCHOR} from './product-scoped-wardrobe-release-anchor.mjs';
import {PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR} from './product-scoped-comp03-spatial-release-anchor.mjs';
import {PROTECTED_HAIR_RELEASE_ANCHOR,PROTECTED_SKIN_RELEASE_ANCHOR} from './product-scoped-appearance-release-anchor.mjs';
const fail=()=>{throw Error('SCOPED_PLACEMENT_RELEASE_DENIED')};
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),head=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const size=(n,max)=>Number.isSafeInteger(n)&&n>0&&n<=max;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const lock='e58486d673df79bfe7e72b80449e39389e57010fe4051edcdcff9b53c2da898c';
const buildId='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
function spec(key,operation,feature,preview,stage,path,platform='steam-windows',build=buildId,extraMethods=[]){
 const methods=Object.freeze(['append_chunk','finish','read_core_version_witness','issue_typed_cursor','read_typed_page','issue_saved_diffgrids_typed_cursor','read_saved_diffgrids_typed_page',preview,stage,...extraMethods,'toggle_scoped_edit','begin_scoped_edit_output','next_scoped_edit_output_chunk','close']);
 const exports=Object.freeze(['memory','__wbg_workerwasmsource_free','workerwasmsource_new',...methods.map(n=>'workerwasmsource_'+n),'__wbindgen_externrefs','__wbindgen_malloc','__externref_table_dealloc','__wbindgen_realloc','__wbindgen_free','__wbindgen_start'].sort());
 return Object.freeze({key,operation,platform,buildId:build,features:Object.freeze([feature,'worker-wasm']),methods,exports,path,assetDir:'worker-wasm-scoped-'+key,prefix:'wand.scoped-'+key});
}
export const COMP03_RELEASE=spec('steam626-comp03','steam626.comp03.layout.exact9','product-steam626-comp03-scoped','preview_steam626_comp03','stage_steam626_comp03','/editor/world/comp03/');
export const COMP03_SPATIAL_RELEASE=spec('steam626-comp03-spatial',COMP03_RELEASE.operation,'product-steam626-comp03-spatial-preview','preview_steam626_comp03','stage_steam626_comp03',COMP03_RELEASE.path,'steam-windows',buildId,['preview_steam626_comp03_spatial']);
export const VASE_ADD_RELEASE=spec('steam626-vase-add','steam626.vase.add.exact3','product-steam626-vase-add-scoped','preview_steam626_vase_add','stage_steam626_vase_add','/editor/world/vase/');
// Dedicated Build features only; generic or dual-feature artifacts cannot be sealed.
export const STEAM_BACKPACK_RELEASE=spec('steam626-backpack-split','steam626.backpack.fruit-split.exact3','product-steam626-backpack-scoped','preview_steam626_backpack_split','stage_steam626_backpack_split','/editor/backpack/steam/');
export const SWITCH_BACKPACK_RELEASE=spec('switch626-backpack-split','switch626.backpack.fruit-split.exact3','product-switch626-backpack-scoped','preview_switch626_backpack_split','stage_switch626_backpack_split','/editor/backpack/switch/','switch','9A239D3DB569756D');
export const STEAM_WARDROBE_RELEASE=spec('steam626-wardrobe','steam626.wardrobe.same-slot.exact1','product-steam626-wardrobe-scoped','preview_steam626_wardrobe','stage_steam626_wardrobe','/editor/wardrobe/steam/');
export const SWITCH_WARDROBE_RELEASE=spec('switch626-wardrobe','switch626.wardrobe.same-slot.exact1','product-switch626-wardrobe-scoped','preview_switch626_wardrobe','stage_switch626_wardrobe','/editor/wardrobe/switch/','switch','9A239D3DB569756D');
export const SR03_RELEASE=spec('steam626-sr03','steam626.sr03.mixed-q5.exact8','product-steam626-sr03-scoped','preview_steam626_sr03','stage_steam626_sr03','/editor/world/sr03/');
export const RM01_RELEASE=spec('switch626-rm01','switch626.rm01.mixed-q5.exact8','product-switch626-rm01-scoped','preview_switch626_rm01','stage_switch626_rm01','/editor/world/rm01/switch/','switch','9A239D3DB569756D');
export const HAIR_RELEASE=spec('steam626-hair','steam626.hair.exact1','product-steam626-hair-scoped','preview_steam626_hair','stage_steam626_hair','/editor/appearance/hair/steam/');
export const SKIN_RELEASE=spec('steam626-skin','steam626.skin.exact1','product-steam626-skin-scoped','preview_steam626_skin','stage_steam626_skin','/editor/appearance/skin/steam/');
const known=s=>s===HAIR_RELEASE||s===SKIN_RELEASE||s===RM01_RELEASE||s===SR03_RELEASE||s===COMP03_RELEASE||s===COMP03_SPATIAL_RELEASE||s===VASE_ADD_RELEASE||s===STEAM_BACKPACK_RELEASE||s===SWITCH_BACKPACK_RELEASE||s===STEAM_WARDROBE_RELEASE||s===SWITCH_WARDROBE_RELEASE;
const asset=(a,n,max)=>exact(a,'path,sizeBytes,sha256')&&a.path===n&&size(a.sizeBytes,max)&&sha(a.sha256);
export function placementPinsOk(s,p){return known(s)&&exact(p,'contract,sourceHead,manifestSha256,manifestSizeBytes,jsSha256,jsSizeBytes,wasmSha256,wasmSizeBytes')&&p.contract===s.prefix+'.pinned-digests@1'&&head(p.sourceHead)&&[p.manifestSha256,p.jsSha256,p.wasmSha256].every(sha)&&size(p.manifestSizeBytes,64*1024)&&size(p.jsSizeBytes,2*1024*1024)&&size(p.wasmSizeBytes,20*1024*1024)}
export function placementManifestOk(s,m,p,tuple=ACTIVE_RELEASE_TUPLE){
 const t=matchReleaseTuple(tuple);
 if(!t||!placementPinsOk(s,p)||!exact(m,t.basePath==='/web'?'contract,operation,source,assets,abi,release':'contract,operation,source,assets,abi,release,delivery')||m.contract!==s.prefix+'.runtime@1'||m.operation!==s.operation||!manifestMatchesRelease(m,t))return false;
 const c=m.source,a=m.assets,b=m.abi,g=m.release;
 return exact(c,'repository,commit,cargoTomlSha256,cargoLockSha256,cargoLockOrigin,wasmBindgen,wasmTarget,profile,features,defaultFeatures,toolchain')&&c.commit===p.sourceHead&&sha(c.cargoTomlSha256)&&c.cargoLockSha256===lock&&c.cargoLockOrigin==='approved-repository-lock'&&c.wasmBindgen==='0.2.105'&&c.wasmTarget==='wasm32-unknown-unknown'&&c.profile==='release'&&c.defaultFeatures===false&&typeof c.toolchain==='string'&&c.toolchain.startsWith('rustc 1.99.1 ')&&same(c.features,s.features)&&
  exact(a,'js,wasm')&&asset(a.js,'ddv_save_core.js',2*1024*1024)&&asset(a.wasm,'ddv_save_core_bg.wasm',20*1024*1024)&&a.js.sha256===p.jsSha256&&a.js.sizeBytes===p.jsSizeBytes&&a.wasm.sha256===p.wasmSha256&&a.wasm.sizeBytes===p.wasmSizeBytes&&
  exact(b,'exportClass,methods,writerAuthorized,originalOverwriteAuthorized')&&b.exportClass==='WorkerWasmSource'&&same(b.methods,s.methods)&&b.writerAuthorized===false&&b.originalOverwriteAuthorized===false&&
  exact(g,'productConsumerEnabled,writerAuthorized,autoUpload,originalOverwriteAuthorized')&&g.productConsumerEnabled===false&&g.writerAuthorized===false&&g.autoUpload===false&&g.originalOverwriteAuthorized===false;
}
export function placementAnchorShapeOk(s,a){
 if(!known(s)||!exact(a,'contract,repository,signerWorkflow,sourceRef,origin,basePath,operation,pins,mode,deliveryOrigin,builds,releaseId,attestationVerifiedAtBuild')||a.contract!==s.prefix+'.protected-release@1'||a.operation!==s.operation||matchReleaseTuple(a)!==ACTIVE_RELEASE_TUPLE||a.attestationVerifiedAtBuild!==true||!placementPinsOk(s,a.pins)||!sha(a.releaseId)||!Array.isArray(a.builds)||a.builds.length!==1)return false;
 const privateV2=a.mode==='private-product-v2';if(!privateV2&&a.mode!=='public-accepted')return false;
 if(privateV2){if(typeof a.deliveryOrigin!=='string'||!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(a.deliveryOrigin))return false;try{const u=new URL(a.deliveryOrigin);if(u.origin!==a.deliveryOrigin||Number(u.port)>65535)return false}catch{return false}}
 else if(a.deliveryOrigin!==a.origin)return false;
 const b=a.builds[0];return exact(b,'platform,buildId,productV2EvidenceSha256')&&b.platform===s.platform&&b.buildId===s.buildId&&(privateV2?b.productV2EvidenceSha256===null:sha(b.productV2EvidenceSha256));
}
export function placementIdentityText(s,a){
 if(!known(s))fail();
 return JSON.stringify([s.prefix+'.protected-release@1',a.repository,a.signerWorkflow,a.sourceRef,a.origin,a.basePath,a.operation,a.pins.sourceHead,a.pins.manifestSha256,a.pins.manifestSizeBytes,a.pins.jsSha256,a.pins.jsSizeBytes,a.pins.wasmSha256,a.pins.wasmSizeBytes,a.mode,a.deliveryOrigin,a.builds.map(b=>[b.platform,b.buildId,b.productV2EvidenceSha256])]);
}
export async function validatePlacementAnchor(s,a){if(!placementAnchorShapeOk(s,a)||await digest(new TextEncoder().encode(placementIdentityText(s,a)))!==a.releaseId)fail();return true}
export function placementDeliveryOk(s,a,where){return placementAnchorShapeOk(s,a)&&!!where&&where.origin===a.deliveryOrigin&&where.protocol===(a.mode==='private-product-v2'?'http:':'https:')&&(!a.basePath||where.pathname.startsWith(a.basePath+'/'))}
export function placementExportsOk(s,module){if(!known(s))return false;const e=WebAssembly.Module.exports(module);return same(e.map(x=>x.name).sort(),s.exports)&&e.every(x=>x.kind===(x.name==='memory'?'memory':x.name==='__wbindgen_externrefs'?'table':'function'))}
const baseDenied='dev_(?:stage|undo|redo|begin|take)|private_native|(?:discover|preview|stage|toggle)_scoped_amount|(?:begin_scoped_amount_output|next_scoped_amount_output_chunk)|preview_scoped_collection_candidate|(?:preview|stage)_fixed_collection|(?:discover|preview|stage)_switch626_chest';
async function load(s,a){
 const where=self.location;if(!placementDeliveryOk(s,a,where)||!where.pathname.startsWith(a.basePath+'/_app/'))fail();
 const p=a.pins,base=new URL(where.origin+a.basePath+'/'+s.assetDir+'/'),url=n=>new URL(n,base);
 const raw=await checkedFetch(url('manifest.json'),p.manifestSizeBytes,p.manifestSha256,'application/json',fetch);
 let m;try{m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{fail()}
 if(!placementManifestOk(s,m,p,a))fail();
 const [js,wasm]=await Promise.all([checkedFetch(url('ddv_save_core.js'),p.jsSizeBytes,p.jsSha256,'text/javascript',fetch),checkedFetch(url('ddv_save_core_bg.wasm'),p.wasmSizeBytes,p.wasmSha256,'application/wasm',fetch)]);
 if(wasm[0]!==0||wasm[1]!==97||wasm[2]!==115||wasm[3]!==109)fail();
 const backpack=s===STEAM_BACKPACK_RELEASE||s===SWITCH_BACKPACK_RELEASE,wardrobe=s===STEAM_WARDROBE_RELEASE||s===SWITCH_WARDROBE_RELEASE;
 const comp03=s===COMP03_RELEASE||s===COMP03_SPATIAL_RELEASE;
 const denied=new RegExp(baseDenied+'|(?:discover|preview|stage)_switch626_catalog0|(?:preview|stage)_steam626_'+(backpack||wardrobe?'(?:comp03|vase_add|sr03)':comp03?'(?:vase_add|sr03)':s===VASE_ADD_RELEASE?'(?:comp03|sr03)':'(?:comp03|vase_add)')+'|(?:preview|stage)_'+(backpack?(s===STEAM_BACKPACK_RELEASE?'switch626':'steam626'):'(?:steam626|switch626)')+'_backpack_split'+'|(?:preview|stage)_'+(wardrobe?(s===STEAM_WARDROBE_RELEASE?'switch626':'steam626'):'(?:steam626|switch626)')+'_wardrobe'+(s===COMP03_SPATIAL_RELEASE?'':'|preview_steam626_comp03_spatial')+(s===RM01_RELEASE?'|(?:preview|stage)_steam626_sr03':'|(?:preview|stage)_switch626_rm01')+'|(?:preview|stage)_steam626_'+(s===HAIR_RELEASE?'skin':s===SKIN_RELEASE?'hair':'(?:hair|skin)'),'i');
 const WorkerWasmSource=await compileVerifiedWorker(js,wasm,{deniedSymbol:denied,requiredMethods:s.methods,exactPrototype:true,exactWasmExports:s.exports});
 return Object.freeze({WorkerWasmSource,sourceHead:p.sourceHead,checkedBothJsAndWasm:true,sameOriginFetchOnly:true,writerAuthorized:false,productConsumerEnabled:false,attestationVerifiedAtBuild:true,...scope(s,a)});
}
const scope=(s,a)=>Object.freeze({releaseId:a.releaseId,operation:a.operation,mode:a.mode,builds:Object.freeze(a.builds.map(b=>Object.freeze({...b}))),...(s===COMP03_SPATIAL_RELEASE?{spatialPreviewEnabled:true}:{})});
function fixed(s,a){
 let attempted=false;
 return Object.freeze({
  async mount(...args){if(args.length||typeof globalThis.location==='undefined')fail();await validatePlacementAnchor(s,a);if(!placementDeliveryOk(s,a,location)||location.pathname!==a.basePath+s.path)fail();return scope(s,a)},
  async runtime(...args){if(args.length||attempted||typeof document!=='undefined'||typeof self?.location==='undefined')fail();attempted=true;await validatePlacementAnchor(s,a);return load(s,a)}
 });
}
const comp=fixed(COMP03_RELEASE,PROTECTED_COMP03_RELEASE_ANCHOR),vase=fixed(VASE_ADD_RELEASE,PROTECTED_VASE_ADD_RELEASE_ANCHOR);
export const getComp03MountInfo=comp.mount,loadProtectedComp03RustWasm=comp.runtime,getVaseAddMountInfo=vase.mount,loadProtectedVaseAddRustWasm=vase.runtime;

const steamBackpack=fixed(STEAM_BACKPACK_RELEASE,PROTECTED_STEAM_BACKPACK_RELEASE_ANCHOR),switchBackpack=fixed(SWITCH_BACKPACK_RELEASE,PROTECTED_SWITCH_BACKPACK_RELEASE_ANCHOR);
export const getSteamBackpackMountInfo=steamBackpack.mount,loadProtectedSteamBackpackRustWasm=steamBackpack.runtime,getSwitchBackpackMountInfo=switchBackpack.mount,loadProtectedSwitchBackpackRustWasm=switchBackpack.runtime;

const steamWardrobe=fixed(STEAM_WARDROBE_RELEASE,PROTECTED_STEAM_WARDROBE_RELEASE_ANCHOR),switchWardrobe=fixed(SWITCH_WARDROBE_RELEASE,PROTECTED_SWITCH_WARDROBE_RELEASE_ANCHOR);
export const getSteamWardrobeMountInfo=steamWardrobe.mount,loadProtectedSteamWardrobeRustWasm=steamWardrobe.runtime,getSwitchWardrobeMountInfo=switchWardrobe.mount,loadProtectedSwitchWardrobeRustWasm=switchWardrobe.runtime;

const sr03=fixed(SR03_RELEASE,PROTECTED_SR03_RELEASE_ANCHOR);
export const getSr03MountInfo=sr03.mount,loadProtectedSr03RustWasm=sr03.runtime;
const rm01=fixed(RM01_RELEASE,PROTECTED_RM01_RELEASE_ANCHOR);
export const getRm01MountInfo=rm01.mount,loadProtectedRm01RustWasm=rm01.runtime;

// Explicit optional identity; never selected by legacy method discovery.
const spatial=fixed(COMP03_SPATIAL_RELEASE,PROTECTED_COMP03_SPATIAL_RELEASE_ANCHOR);
export const getComp03SpatialMountInfo=spatial.mount,loadProtectedComp03SpatialRustWasm=spatial.runtime;

const hair=fixed(HAIR_RELEASE,PROTECTED_HAIR_RELEASE_ANCHOR),skin=fixed(SKIN_RELEASE,PROTECTED_SKIN_RELEASE_ANCHOR);
export const getHairMountInfo=hair.mount,loadProtectedHairRustWasm=hair.runtime,getSkinMountInfo=skin.mount,loadProtectedSkinRustWasm=skin.runtime;
