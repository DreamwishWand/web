// Thin UI-only controller for two fixed placement routes. No Worker creation,
// raw Save JSON or caller-minted CAS; actual backup/codec/ledger stay in the
// existing local adapter. Only encrypted verified downloads leave the Worker.
import {COLLECTION_EXACT1_BUILDS} from '../collection/collection-exact1-consumer.mjs';
import {fitViewport} from '../wep/canvas-runtime.ts';
import {projectComp03PreviewMarkers} from '../wep/comp03-spatial-preview.ts';
const fail=()=>{throw Error('LOCAL_PLACEMENT_UI_DENIED')};
const exact=(r,k)=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff,positive=n=>uint(n)&&n>0;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),size=n=>Number.isSafeInteger(n)&&n>=16&&n<=128*1024*1024&&n%16===0;
const name=s=>typeof s==='string'&&/^[A-Za-z0-9._-]+\.p1g$/.test(s),same=(a,b)=>a.normalize('NFC').toLowerCase()===b.normalize('NFC').toLowerCase();
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const baseReceipt='kind,ok,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized';
const safe=(r,k,extra='')=>exact(r,baseReceipt+extra)&&r.kind===k&&r.ok===true&&r.writerAuthorized===false&&r.nativeV3Verified===false&&r.originalOverwriteAuthorized===false;
const empty=()=>({phase:'closed',sourceName:'',backupName:null,preview:null,editedName:null});
export const STEAM626_PLACEMENT_BUILD=COLLECTION_EXACT1_BUILDS['steam-windows'];
export const SWITCH626_BACKPACK_BUILD=COLLECTION_EXACT1_BUILDS.switch;
const backpackSlot=n=>uint(n)&&n<256;
const backpackSelector=s=>exact(s,'sourceSlot,destinationSlot')&&backpackSlot(s.sourceSlot)&&backpackSlot(s.destinationSlot)&&s.sourceSlot!==s.destinationSlot;
export function createLocalWardrobeDevWorkflow(adapter,{trustedLocalHarness=false,platform}={}){
 if(!['steam-windows','switch'].includes(platform))fail();
 return createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness,operation:platform==='switch'?'wardrobe-switch':'wardrobe-steam'});
}
export function createLocalBackpackDevWorkflow(adapter,{trustedLocalHarness=false,platform}={}){
 if(!['steam-windows','switch'].includes(platform))fail();
 return createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness,operation:platform==='switch'?'backpack-switch':'backpack-steam'});
}
// UI-only read view of a separately trusted companion receipt. Fit the
// supplied anchors, not a guessed native Grid size/footprint or topology.
function spatialReview(r,p){
 if(!exact(r,'rootSceneItemId,gridId,seedId,nextObjectId,anchors,writerAuthorized,editedCopyAuthorized')||
  r.rootSceneItemId!==1540000150||r.gridId!==p.gridId||r.seedId!==p.seedId||r.nextObjectId!==p.nextObjectId||
  r.writerAuthorized!==false||r.editedCopyAuthorized!==false||!Array.isArray(r.anchors)||r.anchors.length!==9)fail();
 const anchors=r.anchors.map((a,i)=>{
  if(!exact(a,'objectId,x,y,role')||!positive(a.objectId)||!uint(a.x)||!uint(a.y)||a.x>260||a.y>260||
   a.objectId!==(i===0?p.seedId:p.nextObjectId+i-1)||a.role!==(i===0?'retained':'proposed'))fail();
  return Object.freeze({objectId:a.objectId,x:a.x,y:a.y,role:a.role});
 });
 const xs=anchors.map(a=>a.x),ys=anchors.map(a=>a.y),x=Math.min(...xs),y=Math.min(...ys);
 const area={x,y,w:Math.max(...xs)-x+1,h:Math.max(...ys)-y+1};
 const view=fitViewport(area,480,320,{paddingPx:24,minZoom:.1,maxZoom:128});
 const overlay=projectComp03PreviewMarkers(r.gridId,anchors,view);
 return Object.freeze({gridId:r.gridId,seedId:r.seedId,markers:overlay.markers});
}
export function createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness=false,operation,spatialPreviewEnabled=false}={}){
 if(trustedLocalHarness!==true||!['comp03','vase','backpack-steam','backpack-switch','wardrobe-steam','wardrobe-switch','sr03','rm01','r01'].includes(operation)||!adapter)fail();
 const backpack=operation==='backpack-steam'||operation==='backpack-switch',wardrobe=operation==='wardrobe-steam'||operation==='wardrobe-switch';
 const previewMethod=wardrobe?'previewWardrobe':backpack?'previewBackpack':'previewPlacement',stageMethod=wardrobe?'stageWardrobe':backpack?'stageBackpack':'stagePlacement';
 for(const k of ['open','backupOriginal',previewMethod,stageMethod,'undo','redo','exportEditedCopy','downloadVerifiedCopy','close'])if(typeof adapter[k]!=='function')fail();
 const r01=operation==='r01',comp=operation==='comp03',sr03=operation==='sr03'||operation==='rm01',count=wardrobe?1:comp?9:sr03?8:r01?4:3,build=operation==='backpack-switch'||operation==='wardrobe-switch'||operation==='rm01'||r01?SWITCH626_BACKPACK_BUILD:STEAM626_PLACEMENT_BUILD;
 if(typeof spatialPreviewEnabled!=='boolean'||(spatialPreviewEnabled&&(!comp||typeof adapter.spatialPreview!=='function')))fail();
 let epoch=0,busy=false,closing=null,state=empty(),source=null,backup=null,edited=null;
 const snapshot=()=>Object.freeze({...state});
 const set=p=>{state={...state,...p};return snapshot()};
 const reset=()=>{state=empty();source=null;backup=null;edited=null};
 const close=()=>{
  epoch++;reset();
  if(!closing){
   const p=Promise.resolve().then(()=>adapter.close()).then(r=>{if(!safe(r,'CLOSED'))fail()}).catch(e=>{set({phase:'close-failed'});throw e});
   closing=p;const settled=()=>{if(closing===p)closing=null};p.then(settled,settled);
  }
  return closing.then(snapshot);
 };
 const run=async(allowed,fn)=>{
  if(busy||closing||!allowed.includes(state.phase))fail();
  const t=epoch;busy=true;const check=()=>{if(t!==epoch)fail()};
  try{const r=await fn(check);check();return r}catch(e){if(t===epoch)await close();throw e}finally{busy=false}
 };
 const openFile=({file,buildConfirmed}={})=>run(['closed'],async check=>{
  if(buildConfirmed!==true||!(file instanceof File))fail();
  const n=Object.getOwnPropertyDescriptor(File.prototype,'name').get.call(file),len=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get.call(file);
  if(!n.toLowerCase().endsWith('.p1g')||!size(len))fail();
  const b=new Uint8Array(await Blob.prototype.arrayBuffer.call(file));let digest;
  try{check();if(b.length!==len)fail();digest=await hash(b);check()}finally{b.fill(0)}
  const r=await adapter.open({file,build,originalSha256:digest});check();if(!safe(r,'OPEN'))fail();
  source=Object.freeze({name:n,sha:digest,size:len});return set({phase:'opened',sourceName:n});
 });
 const backupOriginal=()=>run(['opened'],async check=>{
  const r=await adapter.backupOriginal();check();
  if(!exact(r,'backupReadbackVerified,originalUnchanged,shaMatched,sizeMatched,separateName,originalName,originalSha256,originalSizeBytes,backupName')||
   !['backupReadbackVerified','originalUnchanged','shaMatched','sizeMatched','separateName'].every(k=>r[k]===true)||
   r.originalName!==source.name||r.originalSha256!==source.sha||r.originalSizeBytes!==source.size||!name(r.backupName)||same(r.backupName,source.name))fail();
  backup=Object.freeze({name:r.backupName,sha:source.sha,size:source.size});return set({phase:'ready',backupName:backup.name});
 });
 const preview=selector=>run(['ready','previewed'],async check=>{
  if(!backup||!(wardrobe?selector===undefined:backpack?backpackSelector(selector):comp?exact(selector,'seedId')&&positive(selector.seedId):sr03?exact(selector,'gridId,retainedId,movedId')&&positive(selector.gridId)&&positive(selector.retainedId)&&positive(selector.movedId)&&selector.retainedId!==selector.movedId:exact(selector,'gridId,x,y')&&positive(selector.gridId)&&uint(selector.x)&&uint(selector.y)))fail();
  const r=await (wardrobe?adapter[previewMethod]():adapter[previewMethod]({...selector}));check();
  if(wardrobe){
   if(!exact(r,'slot,oldItemId,newItemId,exactFieldChangedCount,writerAuthorized,editedCopyAuthorized,originalOverwriteAuthorized')||r.slot!==0||r.oldItemId!==50000352||r.newItemId!==50000214||r.exactFieldChangedCount!==1||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();
   return set({phase:'previewed',preview:Object.freeze({...r})});
  }
  if(backpack){
   if(!exact(r,'containerId,sourceSlot,destinationSlot,itemId,oldAmount,newSourceAmount,newDestinationAmount,quantity,effectiveStackBound,exactFieldChangedCount,writerAuthorized,editedCopyAuthorized,originalOverwriteAuthorized')||
    r.containerId!==0||r.sourceSlot!==selector.sourceSlot||r.destinationSlot!==selector.destinationSlot||r.itemId!==30200001||!uint(r.oldAmount)||r.oldAmount<2||r.oldAmount>50||r.newSourceAmount!==r.oldAmount-1||r.newDestinationAmount!==1||r.quantity!==1||r.effectiveStackBound!==50||r.exactFieldChangedCount!==3||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();
   return set({phase:'previewed',preview:Object.freeze({...r})});
  }
  const common='itemId,gridId,nextObjectId,oldAmount,newAmount,exactFieldChangedCount,scopedCandidate,writerAuthorized,editedCopyAuthorized';
  if(!exact(r,common+(comp?',seedId,inventoryDelta,retainSeed,addObjects':sr03?',retainedId,movedId,inventoryDelta,addObjects':r01?',x,y,inventoryDelta,addObjects':',inventoryId,x,y,orientation,inventoryDelta,addObjects'))||
   r.itemId!==(comp?40100038:(sr03||r01)?40100068:40000066)||!positive(r.gridId)||!positive(r.nextObjectId)||!positive(r.oldAmount)||!uint(r.newAmount)||r.exactFieldChangedCount!==count||
   r.scopedCandidate!==true||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||
   !(comp?r.seedId===selector.seedId&&r.oldAmount===r.newAmount&&r.inventoryDelta===0&&r.retainSeed===1&&r.addObjects===8:sr03?r.gridId===selector.gridId&&r.retainedId===selector.retainedId&&r.movedId===selector.movedId&&r.oldAmount>=3&&r.newAmount===r.oldAmount-3&&r.inventoryDelta===-3&&r.addObjects===3&&r.nextObjectId>Math.max(r.retainedId,r.movedId)&&r.nextObjectId<=0xfffffffd:r01?r.gridId===selector.gridId&&r.x===selector.x&&r.y===selector.y&&r.oldAmount===r.newAmount&&r.inventoryDelta===0&&r.addObjects===3&&r.nextObjectId<=0xfffffffc:
    r.gridId===selector.gridId&&r.x===selector.x&&r.y===selector.y&&r.inventoryId===0&&r.orientation==='GridOrientation_Up'&&r.oldAmount===r.newAmount+1&&r.inventoryDelta===-1&&r.addObjects===1))fail();
  const p=Object.freeze({...r});
  // Opt-in is supplied by the branded product scope, never method discovery.
  // Run atomically with the same preview; on any failure run() closes/reset.
  if(spatialPreviewEnabled){
   const spatial=await adapter.spatialPreview();check();
   return set({phase:'previewed',preview:p,spatialPreview:spatialReview(spatial,p)});
  }
  return set({phase:'previewed',preview:p});
 });
 const stage=()=>run(['previewed'],async check=>{const r=await adapter[stageMethod]();check();if(!safe(r,'STAGED',',exactFieldChangedCount')||r.exactFieldChangedCount!==count)fail();return set(spatialPreviewEnabled?{phase:'staged',spatialPreview:null}:{phase:'staged'})});
 const undo=()=>run(['staged'],async check=>{const r=await adapter.undo();check();if(!safe(r,'UNDONE'))fail();return set({phase:'undone'})});
 const redo=()=>run(['undone'],async check=>{const r=await adapter.redo();check();if(!safe(r,'REDONE'))fail();return set({phase:'staged'})});
 const exportEditedCopy=()=>run(['staged'],async check=>{
  const r=await adapter.exportEditedCopy();check();
  if(!safe(r,'EXPORTED',',backupName,editedCopyName,editedSha256,editedSizeBytes,editedCiphertextVerified,freshWorkerReopenVerified,independentProcessReopenVerified,originalUnchanged')||
   r.backupName!==backup.name||!name(r.editedCopyName)||same(r.editedCopyName,source.name)||same(r.editedCopyName,backup.name)||!sha(r.editedSha256)||r.editedSha256===source.sha||!size(r.editedSizeBytes)||
   r.editedCiphertextVerified!==true||r.freshWorkerReopenVerified!==true||r.independentProcessReopenVerified!==false||r.originalUnchanged!==true)fail();
  edited=Object.freeze({name:r.editedCopyName,sha:r.editedSha256,size:r.editedSizeBytes});return set({phase:'exported',editedName:edited.name});
 });
 const downloadVerifiedCopy=which=>run(['ready','previewed','staged','undone','exported'],async check=>{
  const bound=which==='backup'?backup:which==='edited'&&state.phase==='exported'?edited:null;if(!bound)fail();
  const r=await adapter.downloadVerifiedCopy(which);check();
  if(!exact(r,'kind,name,sha256,sizeBytes,encryptedBytes')||r.kind!=='VERIFIED_DOWNLOAD'||r.name!==bound.name||r.sha256!==bound.sha||r.sizeBytes!==bound.size||!(r.encryptedBytes instanceof Uint8Array)||r.encryptedBytes.length!==bound.size)fail();
  const b=new Uint8Array(r.encryptedBytes);try{if(await hash(b)!==bound.sha)fail();check();return {name:bound.name,encryptedBytes:b}}catch(e){b.fill(0);throw e}
 });
 return Object.freeze({snapshot,openFile,backupOriginal,preview,stage,undo,redo,exportEditedCopy,downloadVerifiedCopy,close});
}
