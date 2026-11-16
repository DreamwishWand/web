// Module-private brand; the fixed route never accepts a caller-provided runtime or mode.
import {getComp03MountInfo,getComp03SpatialMountInfo,getVaseAddMountInfo,getSwitchVaseAddMountInfo,getSteamBackpackMountInfo,getSwitchBackpackMountInfo,getSteamWardrobeMountInfo,getSwitchWardrobeMountInfo} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createLocalComp03DevPort,createLocalComp03SpatialDevPort,createLocalVaseDevPort,createLocalBackpackDevPort,createLocalWardrobeDevPort} from './local-scoped-edit-worker-port.mjs';
const fail=()=>{throw Error('PLACEMENT_PRODUCT_RUNTIME_DENIED')};
const exact=(r,k)=>r!==null&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const ports=new WeakMap();
export const productPlacementPortScope=port=>port&&ports.get(port)||null;
export function placementReadyOk(r,scope){return exact(r,'kind,releaseId,operation,mode,builds,writerAuthorized'+(scope.spatialPreviewEnabled===true?',spatialPreviewEnabled':''))&&(scope.spatialPreviewEnabled!==true||r.spatialPreviewEnabled===true)&&r.kind==='SCOPED_PLACEMENT_RUNTIME_READY'&&r.releaseId===scope.releaseId&&r.operation===scope.operation&&r.mode===scope.mode&&r.writerAuthorized===false&&JSON.stringify(r.builds)===JSON.stringify(scope.builds)}
export const createProductComp03Port=options=>create('comp03',options);
export const createProductComp03SpatialPort=options=>create('comp03-spatial',options);
export const createProductVaseAddPort=options=>create('vase',options);
export const createProductSwitchVaseAddPort=options=>create('vase-switch',options);
export const createProductSteamBackpackPort=options=>create('backpack-steam',options);
export const createProductSwitchBackpackPort=options=>create('backpack-switch',options);
export const createProductSteamWardrobePort=options=>create('wardrobe-steam',options);
export const createProductSwitchWardrobePort=options=>create('wardrobe-switch',options);
async function create(op,{signal,onFault=()=>{}}={}){
 if(typeof document==='undefined'||signal?.aborted||typeof onFault!=='function')fail();
 const scope=await (op==='comp03-spatial'?getComp03SpatialMountInfo():op==='comp03'?getComp03MountInfo():op==='vase'?getVaseAddMountInfo():op==='vase-switch'?getSwitchVaseAddMountInfo():op==='backpack-steam'?getSteamBackpackMountInfo():op==='backpack-switch'?getSwitchBackpackMountInfo():op==='wardrobe-steam'?getSteamWardrobeMountInfo():getSwitchWardrobeMountInfo());if(signal?.aborted)fail();
 const w=op==='comp03-spatial'?new Worker(new URL('./product-comp03-spatial.worker.mjs',import.meta.url),{type:'module'}):op==='comp03'?new Worker(new URL('./product-comp03.worker.mjs',import.meta.url),{type:'module'}):op==='vase'?new Worker(new URL('./product-vase-add.worker.mjs',import.meta.url),{type:'module'}):op==='vase-switch'?new Worker(new URL('./product-switch-vase-add.worker.mjs',import.meta.url),{type:'module'}):op==='backpack-steam'?new Worker(new URL('./product-steam-backpack.worker.mjs',import.meta.url),{type:'module'}):op==='backpack-switch'?new Worker(new URL('./product-switch-backpack.worker.mjs',import.meta.url),{type:'module'}):op==='wardrobe-steam'?new Worker(new URL('./product-steam-wardrobe.worker.mjs',import.meta.url),{type:'module'}):new Worker(new URL('./product-switch-wardrobe.worker.mjs',import.meta.url),{type:'module'});
 let port=null,settled=false,timer;
 const dispose=()=>{if(port){ports.delete(port);port.dispose();port=null}else try{w.terminate()}catch{}};
 try{
  await new Promise((resolve,reject)=>{
   const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);w.onmessage=null;w.onerror=null;w.onmessageerror=null;ok?resolve():reject(Error('PLACEMENT_PRODUCT_RUNTIME_DENIED'))};
   const abort=()=>finish(false);timer=setTimeout(()=>finish(false),30000);signal?.addEventListener('abort',abort,{once:true});w.onmessage=({data})=>finish(placementReadyOk(data,scope));w.onerror=()=>finish(false);w.onmessageerror=()=>finish(false);if(signal?.aborted)finish(false);
  });
  if(signal?.aborted)fail();
  const underlying=op==='comp03-spatial'?createLocalComp03SpatialDevPort(w):op==='comp03'?createLocalComp03DevPort(w):(op==='vase'||op==='vase-switch')?createLocalVaseDevPort(w):op.startsWith('wardrobe-')?createLocalWardrobeDevPort(w):createLocalBackpackDevPort(w);
  const wrapped=Object.freeze({...underlying,dispose:()=>{ports.delete(wrapped);underlying.dispose();if(port===wrapped)port=null}});
  port=wrapped;ports.set(port,Object.freeze({...scope,uiOperation:op==='comp03-spatial'?'comp03':op}));
  const fault=()=>{dispose();onFault()};w.addEventListener('error',fault);w.addEventListener('messageerror',fault);
  return port;
 }catch(e){dispose();throw e}
}
