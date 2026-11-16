// Thin UI-only controller for two fixed placement routes. No Worker creation,
// raw Save JSON or caller-minted CAS; actual backup/codec/ledger stay in the
// existing local adapter. Only encrypted verified downloads leave the Worker.
import {COLLECTION_EXACT1_BUILDS} from '../collection/collection-exact1-consumer.mjs';
const fail=()=>{throw Error('LOCAL_PLACEMENT_UI_DENIED')};
const exact=(r,k)=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff,positive=n=>uint(n)&&n>0;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),size=n=>Number.isSafeInteger(n)&&n>=16&&n<=128*1024*1024&&n%16===0;
const name=s=>typeof s==='string'&&/^[A-Za-z0-9._-]+\.p1g$/.test(s),same=(a,b)=>a.normalize('NFC').toLowerCase()===b.normalize('NFC').toLowerCase();
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const baseReceipt='kind,ok,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized';
const safe=(r,k,extra='')=>exact(r,baseReceipt+extra)&&r.kind===k&&r.ok===true&&r.writerAuthorized===false&&r.nativeV3Verified===false&&r.originalOverwriteAuthorized===false;
const empty=()=>({phase:'closed',sourceName:'',backupName:null,preview:null,editedName:null});
const build=COLLECTION_EXACT1_BUILDS['steam-windows'];
export const STEAM626_PLACEMENT_BUILD=build;
export function createLocalPlacementDevWorkflow(adapter,{trustedLocalHarness=false,operation}={}){
 if(trustedLocalHarness!==true||!['comp03','vase','sr03'].includes(operation)||!adapter)fail();
 for(const k of ['open','backupOriginal','previewPlacement','stagePlacement','undo','redo','exportEditedCopy','downloadVerifiedCopy','close'])if(typeof adapter[k]!=='function')fail();
 const comp=operation==='comp03',sr03=operation==='sr03',count=comp?9:sr03?8:3;
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
  if(!backup||!(comp?exact(selector,'seedId')&&positive(selector.seedId):sr03?exact(selector,'gridId,retainedId,movedId')&&positive(selector.gridId)&&positive(selector.retainedId)&&positive(selector.movedId)&&selector.retainedId!==selector.movedId:exact(selector,'gridId,x,y')&&positive(selector.gridId)&&uint(selector.x)&&uint(selector.y)))fail();
  const r=await adapter.previewPlacement({...selector});check();
  const common='itemId,gridId,nextObjectId,oldAmount,newAmount,exactFieldChangedCount,scopedCandidate,writerAuthorized,editedCopyAuthorized';
  if(!exact(r,common+(comp?',seedId,inventoryDelta,retainSeed,addObjects':sr03?',retainedId,movedId,inventoryDelta,addObjects':',inventoryId,x,y,orientation,inventoryDelta,addObjects'))||
   r.itemId!==(comp?40100038:sr03?40100068:40000066)||!positive(r.gridId)||!positive(r.nextObjectId)||!positive(r.oldAmount)||!uint(r.newAmount)||r.exactFieldChangedCount!==count||
   r.scopedCandidate!==true||r.writerAuthorized!==false||r.editedCopyAuthorized!==false||
   !(comp?r.seedId===selector.seedId&&r.oldAmount===r.newAmount&&r.inventoryDelta===0&&r.retainSeed===1&&r.addObjects===8:sr03?r.gridId===selector.gridId&&r.retainedId===selector.retainedId&&r.movedId===selector.movedId&&r.oldAmount>=3&&r.newAmount===r.oldAmount-3&&r.inventoryDelta===-3&&r.addObjects===3&&r.nextObjectId>Math.max(r.retainedId,r.movedId)&&r.nextObjectId<=0xfffffffd:
    r.gridId===selector.gridId&&r.x===selector.x&&r.y===selector.y&&r.inventoryId===0&&r.orientation==='GridOrientation_Up'&&r.oldAmount===r.newAmount+1&&r.inventoryDelta===-1&&r.addObjects===1))fail();
  return set({phase:'previewed',preview:Object.freeze({...r})});
 });
 const stage=()=>run(['previewed'],async check=>{const r=await adapter.stagePlacement();check();if(!safe(r,'STAGED',',exactFieldChangedCount')||r.exactFieldChangedCount!==count)fail();return set({phase:'staged'})});
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
