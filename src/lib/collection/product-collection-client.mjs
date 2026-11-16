// Page-side entry for the existing fixed local RPC. The product port is
// branded only after the trusted dedicated Worker proves the same sealed
// release. A caller-supplied adapter/DEV boolean cannot enable production UI.
import {getScopedCollectionMountInfo} from '../ddv/core/save/product-scoped-collection-release.mjs';
import {createLocalCollectionDevPort} from '../dev/local-scoped-edit-worker-port.mjs';
const fail=()=>{throw Error('COLLECTION_PRODUCT_RUNTIME_DENIED')};
const exact=(r,k)=>r!==null&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const productPorts=new WeakMap();
export function productCollectionPortScope(port){return port&&productPorts.get(port)||null}
export function scopedCollectionReadyOk(r,scope){
 return exact(r,'kind,releaseId,operation,mode,builds,writerAuthorized')&&
 r.kind==='SCOPED_COLLECTION_RUNTIME_READY'&&r.releaseId===scope.releaseId&&r.operation===scope.operation&&r.mode===scope.mode&&
 r.writerAuthorized===false&&JSON.stringify(r.builds)===JSON.stringify(scope.builds);
}
export async function createProductCollectionPort({signal,onFault=()=>{}}={}){
 if(typeof document==='undefined'||signal?.aborted||typeof onFault!=='function')fail();
 const scope=await getScopedCollectionMountInfo();if(signal?.aborted)fail();
 const w=new Worker(new URL('./product-collection.worker.mjs',import.meta.url),{type:'module'});
 let port=null,settled=false,timer;
 const dispose=()=>{if(port){productPorts.delete(port);port.dispose();port=null}else try{w.terminate()}catch{}};
 try{
  await new Promise((resolve,reject)=>{
   const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);
    signal?.removeEventListener('abort',abort);w.onmessage=null;w.onerror=null;w.onmessageerror=null;
    if(ok)resolve();else reject(Error('COLLECTION_PRODUCT_RUNTIME_DENIED'));
   };
   const abort=()=>finish(false);
   timer=setTimeout(()=>finish(false),30000);
   signal?.addEventListener('abort',abort,{once:true});
   w.onmessage=({data})=>finish(scopedCollectionReadyOk(data,scope));
   w.onerror=()=>finish(false);w.onmessageerror=()=>finish(false);
   if(signal?.aborted)finish(false);
  });
  if(signal?.aborted)fail();
  const underlying=createLocalCollectionDevPort(w);
  // Exactly the existing RPC surface, with cleanup invalidating the brand.
  const wrapped=Object.freeze({...underlying,dispose:()=>{productPorts.delete(wrapped);underlying.dispose();if(port===wrapped)port=null}});
  port=wrapped;productPorts.set(port,scope);
  const fault=()=>{dispose();onFault()};
  w.addEventListener('error',fault);w.addEventListener('messageerror',fault);
  return port;
 }catch(e){dispose();throw e}
}
