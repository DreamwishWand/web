// Module-private brand; the fixed route never accepts a caller-provided runtime or mode.
import {getComp03MountInfo,getVaseAddMountInfo,COMP03_RELEASE,VASE_ADD_RELEASE} from '../ddv/core/save/product-scoped-placement-release.mjs';
import {createLocalComp03DevPort,createLocalVaseDevPort} from './local-scoped-edit-worker-port.mjs';
const fail=()=>{throw Error('PLACEMENT_PRODUCT_RUNTIME_DENIED')};
const exact=(r,k)=>r!==null&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const ports=new WeakMap();
export const productPlacementPortScope=port=>port&&ports.get(port)||null;
export function placementReadyOk(r,scope){return exact(r,'kind,releaseId,operation,mode,builds,writerAuthorized')&&r.kind==='SCOPED_PLACEMENT_RUNTIME_READY'&&r.releaseId===scope.releaseId&&r.operation===scope.operation&&r.mode===scope.mode&&r.writerAuthorized===false&&JSON.stringify(r.builds)===JSON.stringify(scope.builds)}
export const createProductComp03Port=options=>create(true,options);
export const createProductVaseAddPort=options=>create(false,options);
async function create(comp,{signal,onFault=()=>{}}={}){
 if(typeof document==='undefined'||signal?.aborted||typeof onFault!=='function')fail();
 const scope=await (comp?getComp03MountInfo():getVaseAddMountInfo());if(signal?.aborted)fail();
 const w=comp?new Worker(new URL('./product-comp03.worker.mjs',import.meta.url),{type:'module'}):new Worker(new URL('./product-vase-add.worker.mjs',import.meta.url),{type:'module'});
 let port=null,settled=false,timer;
 const dispose=()=>{if(port){ports.delete(port);port.dispose();port=null}else try{w.terminate()}catch{}};
 try{
  await new Promise((resolve,reject)=>{
   const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);w.onmessage=null;w.onerror=null;w.onmessageerror=null;ok?resolve():reject(Error('PLACEMENT_PRODUCT_RUNTIME_DENIED'))};
   const abort=()=>finish(false);timer=setTimeout(()=>finish(false),30000);signal?.addEventListener('abort',abort,{once:true});w.onmessage=({data})=>finish(placementReadyOk(data,scope));w.onerror=()=>finish(false);w.onmessageerror=()=>finish(false);if(signal?.aborted)finish(false);
  });
  if(signal?.aborted)fail();
  const underlying=comp?createLocalComp03DevPort(w):createLocalVaseDevPort(w);
  const wrapped=Object.freeze({...underlying,dispose:()=>{ports.delete(wrapped);underlying.dispose();if(port===wrapped)port=null}});
  port=wrapped;ports.set(port,Object.freeze({...scope,uiOperation:comp?'comp03':'vase'}));
  const fault=()=>{dispose();onFault()};w.addEventListener('error',fault);w.addEventListener('messageerror',fault);
  return port;
 }catch(e){dispose();throw e}
}
