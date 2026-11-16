// Existing accepted local Amount Worker RPC, extracted for one shared
// transport. Domain is fixed by a trusted constructor; no message mode,
// raw document, arbitrary command dispatch, or new Session/engine.
const fail=()=>{throw Error('LOCAL_DEV_WORKER_DENIED')};
const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=1&&n<=0xffffffff;
const which=v=>v==='backup'||v==='edited';
const placementMethods=Object.freeze({open:1,backupOriginal:0,previewPlacement:1,stagePlacement:0,undo:0,redo:0,exportEditedCopy:0,downloadVerifiedCopy:1,close:0});
const backpackMethods=Object.freeze({open:1,backupOriginal:0,previewBackpack:1,stageBackpack:0,undo:0,redo:0,exportEditedCopy:0,downloadVerifiedCopy:1,close:0});
const wardrobeMethods=Object.freeze({open:1,backupOriginal:0,previewWardrobe:0,stageWardrobe:0,undo:0,redo:0,exportEditedCopy:0,downloadVerifiedCopy:1,close:0});
const methods=Object.freeze({comp03:placementMethods,'comp03-spatial':Object.freeze({...placementMethods,spatialPreview:0}),vase:placementMethods,backpack:backpackMethods,wardrobe:wardrobeMethods,
 amount:Object.freeze({open:1,backupOriginal:0,listVerifiedTargets:0,stageTyped:1,undo:0,redo:0,exportEditedCopy:0,downloadVerifiedCopy:1,close:0}),
 collection:Object.freeze({open:1,inspectCollectionTargets:0,backupOriginal:1,previewCollectionTarget:2,stageCollectionTarget:2,undo:1,redo:1,exportEditedCopy:1,downloadVerifiedCopy:2,close:0})
});
const spec=mode=>{if(!Object.hasOwn(methods,mode))fail();return methods[mode]};
const closedAck=r=>exact(r,'kind,ok,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized')&&
 r.kind==='CLOSED'&&r.ok===true&&r.writerAuthorized===false&&r.nativeV3Verified===false&&r.originalOverwriteAuthorized===false;
const validArgs=(mode,m,args,allowed)=>{
 if(!Object.hasOwn(allowed,m)||!Array.isArray(args)||args.length!==allowed[m])return false;
 if(m==='downloadVerifiedCopy')return mode==='collection'?uint(args[0])&&which(args[1]):which(args[0]);
 if(m==='previewPlacement')return (mode==='comp03'||mode==='comp03-spatial')?exact(args[0],'seedId')&&uint(args[0].seedId):mode==='vase'&&exact(args[0],'gridId,x,y')&&uint(args[0].gridId)&&['x','y'].every(k=>Number.isSafeInteger(args[0][k])&&args[0][k]>=0&&args[0][k]<=0xffffffff);
 if(m==='previewBackpack')return mode==='backpack'&&exact(args[0],'sourceSlot,destinationSlot')&&['sourceSlot','destinationSlot'].every(k=>Number.isSafeInteger(args[0][k])&&args[0][k]>=0&&args[0][k]<256)&&args[0].sourceSlot!==args[0].destinationSlot;
 if(mode==='collection'&&['backupOriginal','undo','redo','exportEditedCopy'].includes(m))return uint(args[0]);
 if(mode==='collection'&&['previewCollectionTarget','stageCollectionTarget'].includes(m))return uint(args[0])&&Number.isSafeInteger(args[1])&&args[1]===0;
 return true;
};
function install(port,adapter,mode){
 if(!port||typeof port.postMessage!=='function'||!adapter)fail();
 const allowed=spec(mode);let lastId=0,active=null,closing=null,epoch=0,closeFailed=false;
 port.onmessage=async e=>{
  const v=e.data;
  const deny=()=>{try{port.postMessage({id:v?.id??0,ok:false,error:'DENIED'})}catch{}};
  if(!exact(v,'id,method,args')||!Number.isSafeInteger(v.id)||v.id<1||v.id<=lastId||
     typeof v.method!=='string'||!validArgs(mode,v.method,v.args,allowed)){deny();return}
  lastId=v.id; // accepted IDs consumed before invoking adapter, including busy.
  if(closing!==null||(closeFailed&&v.method!=='close')){deny();return}
  if(v.method==='close'){
   const token=++epoch;closing=v.id;
   try{
    const data=await adapter.close();
    if(token!==epoch||closing!==v.id||(mode!=='amount'&&!closedAck(data)))fail();
    closeFailed=false;port.postMessage({id:v.id,ok:true,data});
   }catch{if(mode!=='amount')closeFailed=true;deny()}
   finally{if(closing===v.id)closing=null}
   return;
  }
  if(active!==null){deny();return}
  const token=epoch;active=v.id;
  try{
   const data=await adapter[v.method](...v.args);
   if(token!==epoch){
    if(data?.encryptedBytes instanceof Uint8Array)data.encryptedBytes.fill(0);
    deny();return;
   }
   try{port.postMessage({id:v.id,ok:true,data})}finally{
    if(data?.encryptedBytes instanceof Uint8Array)data.encryptedBytes.fill(0);
   }
  }catch{deny()}
  finally{if(active===v.id)active=null}
 };
}
function createPort(worker,mode){
 if(!worker||typeof worker.postMessage!=='function'||typeof worker.terminate!=='function')fail();
 const allowed=spec(mode);let serial=0,dead=false;const pending=new Map();
 const stop=()=>{if(dead)return;dead=true;for(const p of pending.values())p.reject(Error('DEV_WORKER_CLOSED'));pending.clear();try{worker.terminate()}catch{}};
 worker.onmessage=e=>{
  const v=e.data,p=pending.get(v?.id);
  if(!p){if(v?.data?.encryptedBytes instanceof Uint8Array)v.data.encryptedBytes.fill(0);return}
  pending.delete(v.id);
  if(!exact(v,v.ok===true?'id,ok,data':'id,ok,error')||v.ok!==true){
   if(v?.data?.encryptedBytes instanceof Uint8Array)v.data.encryptedBytes.fill(0);
   p.reject(Error('DEV_WORKER_DENIED'));return;
  }
  p.resolve(v.data);
 };
 worker.onerror=stop;worker.onmessageerror=stop;
 const rpc=(method,...args)=>new Promise((resolve,reject)=>{
  if(dead||serial>=Number.MAX_SAFE_INTEGER||!validArgs(mode,method,args,allowed)){reject(Error('DEV_WORKER_DENIED'));return}
  const id=++serial;pending.set(id,{resolve,reject});
  try{worker.postMessage({id,method,args})}catch{pending.delete(id);reject(Error('DEV_WORKER_POST_DENIED'))}
 });
 return Object.freeze({...Object.fromEntries(Object.keys(allowed).map(m=>[m,(...args)=>rpc(m,...args)])),dispose:stop});
}
export const installLocalDevAmountWorker=(port,adapter)=>install(port,adapter,'amount');
export const createLocalAmountDevPort=worker=>createPort(worker,'amount');
export const installLocalCollectionDevWorker=(port,adapter)=>install(port,adapter,'collection');
export const createLocalCollectionDevPort=worker=>createPort(worker,'collection');

export const installLocalComp03DevWorker=(port,adapter)=>install(port,adapter,'comp03');
export const createLocalComp03DevPort=worker=>createPort(worker,'comp03');
export const installLocalVaseDevWorker=(port,adapter)=>install(port,adapter,'vase');
export const createLocalVaseDevPort=worker=>createPort(worker,'vase');

export const installLocalBackpackDevWorker=(port,adapter)=>install(port,adapter,'backpack');
export const createLocalBackpackDevPort=worker=>createPort(worker,'backpack');

export const installLocalWardrobeDevWorker=(port,adapter)=>install(port,adapter,'wardrobe');
export const createLocalWardrobeDevPort=worker=>createPort(worker,'wardrobe');

export const installLocalComp03SpatialDevWorker=(port,adapter)=>install(port,adapter,'comp03-spatial');
export const createLocalComp03SpatialDevPort=worker=>createPort(worker,'comp03-spatial');
