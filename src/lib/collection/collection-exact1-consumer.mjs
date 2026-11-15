// ACT965 UI-only consumer of an existing local session. This provisional
// receipt contract does NOT mint a Core target, create a Worker, or enable
// product operations. Future trusted Worker adapter must bind actual ABI.
const fail=()=>{throw Error('COLLECTION_EXACT1_UI_DENIED')};
const keys=(r,k)=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===k.split(',').sort().join(',');
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const size=n=>Number.isSafeInteger(n)&&n>=16&&n<=128*1024*1024&&n%16===0;
const filename=s=>typeof s==='string'&&/^[A-Za-z0-9._-]+\.p1g$/.test(s);
const same=(a,b)=>a.normalize('NFC').toLowerCase()===b.normalize('NFC').toLowerCase();
const STEAM='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',SWITCH='9A239D3DB569756D';
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const buildOk=b=>keys(b,'platform,buildKind,buildId,schema,externallyConfirmed')&&b.schema===626&&b.externallyConfirmed===true&&
 ((b.platform==='steam-windows'&&b.buildKind==='steam-full-version'&&b.buildId===STEAM)||(b.platform==='switch'&&b.buildKind==='switch-bid'&&b.buildId===SWITCH));
const targetOk=(t,b)=>keys(t,'definitionId,groupIndex,itemId,oldValue,groupState,falseCount,coreMinted,eligibilityVerified')&&
 uint(t.definitionId)&&t.definitionId>0&&uint(t.groupIndex)&&uint(t.itemId)&&t.itemId>0&&t.oldValue===false&&
 t.groupState==='NotComplete'&&uint(t.falseCount)&&t.falseCount>=2&&(b.platform!=='steam-windows'||t.falseCount===3)&&
 t.coreMinted===true&&t.eligibilityVerified===true;
const clean=()=>({phase:'closed',sourceName:'',build:null,targets:[],preview:null,backupName:null,editedName:null});
export function createCollectionExact1Consumer(adapter,{trustedLocalHarness=false}={}){
 if(trustedLocalHarness!==true||!adapter)fail();
 for(const k of ['inspectCollectionTargets','backupOriginal','previewCollectionTarget','stageCollectionTarget','undo','redo','exportEditedCopy','downloadVerifiedCopy','close'])
  if(typeof adapter[k]!=='function')fail();
 let state=clean(),epoch=0,busy=false,closing=null,source=null,backup=null,edited=null,choice=null;
 const snapshot=()=>Object.freeze({...state,targets:Object.freeze([...state.targets]),build:state.build?Object.freeze({...state.build}):null});
 const set=p=>{state={...state,...p};return snapshot()};
 const reset=()=>{state=clean();source=null;backup=null;edited=null;choice=null};
 const close=()=>{
  epoch++;reset();busy=false;
  if(!closing){
   const p=Promise.resolve().then(()=>adapter.close()).catch(()=>null);
   closing=p;p.finally(()=>{if(closing===p)closing=null});
  }
  return closing.then(snapshot);
 };
 const run=async(phase,fn)=>{
  if(busy||closing||!phase.includes(state.phase))fail();
  const t=epoch;busy=true;
  const check=()=>{if(t!==epoch)fail()};
  try{const r=await fn(check);check();return r}
  catch(e){if(t===epoch)await close();throw e}
  finally{if(t===epoch)busy=false}
 };
 const sourceScope=r=>r.selection===source?.selection&&r.writerAuthorized===false&&r.originalOverwriteAuthorized===false;
 const mutation=(r,k)=>keys(r,'kind,selection,choice,exactFieldChangedCount,writerAuthorized,originalOverwriteAuthorized')&&
  sourceScope(r)&&r.kind===k&&r.choice===choice&&r.exactFieldChangedCount===1;
 const load=()=>run(['closed'],async check=>{
  const r=await adapter.inspectCollectionTargets();check();
  if(!keys(r,'selection,build,originalName,originalSha256,originalSizeBytes,targets,writerAuthorized,originalOverwriteAuthorized')||
    !uint(r.selection)||r.selection<1||!buildOk(r.build)||typeof r.originalName!=='string'||!r.originalName.toLowerCase().endsWith('.p1g')||
    !sha(r.originalSha256)||!size(r.originalSizeBytes)||!Array.isArray(r.targets)||r.targets.length>256||
    r.writerAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();
  const seen=new Set(),targets=r.targets.map(t=>{
   if(!targetOk(t,r.build))fail();const key=t.definitionId+':'+t.groupIndex+':'+t.itemId;
   if(seen.has(key))fail();seen.add(key);return Object.freeze({...t});
  });
  source=Object.freeze({selection:r.selection,name:r.originalName,sha:r.originalSha256,size:r.originalSizeBytes});
  return set({phase:'opened',sourceName:source.name,build:{...r.build},targets});
 });
 const backupOriginal=()=>run(['opened'],async check=>{
  const r=await adapter.backupOriginal(source.selection);check();
  if(!keys(r,'backupReadbackVerified,originalUnchanged,shaMatched,sizeMatched,separateName,originalName,originalSha256,originalSizeBytes,backupName')||
   r.backupReadbackVerified!==true||r.originalUnchanged!==true||r.shaMatched!==true||r.sizeMatched!==true||r.separateName!==true||
   r.originalName!==source.name||r.originalSha256!==source.sha||r.originalSizeBytes!==source.size||
   !filename(r.backupName)||same(r.backupName,source.name))fail();
  backup=Object.freeze({name:r.backupName,sha:source.sha,size:source.size});return set({phase:'ready',backupName:backup.name});
 });
 const preview=i=>run(['ready','previewed'],async check=>{
  if(!backup||!Number.isSafeInteger(i)||i<0||i>=state.targets.length)fail();
  const target=state.targets[i],r=await adapter.previewCollectionTarget(source.selection,i);check();
  if(!keys(r,'selection,choice,oldValue,newValue,groupState,remainingFalseCount,exactFieldChangedCount,writerAuthorized,originalOverwriteAuthorized')||
   !sourceScope(r)||r.choice!==i||r.oldValue!==false||r.newValue!==true||r.groupState!=='NotComplete'||
   r.remainingFalseCount!==target.falseCount-1||r.exactFieldChangedCount!==1)fail();
  choice=i;return set({phase:'previewed',preview:Object.freeze({choice:i,itemId:target.itemId,oldValue:false,newValue:true,remainingFalseCount:r.remainingFalseCount})});
 });
 const stage=()=>run(['previewed'],async check=>{
  if(!backup||choice===null)fail();const r=await adapter.stageCollectionTarget(source.selection,choice);check();
  if(!mutation(r,'STAGED'))fail();return set({phase:'staged'});
 });
 const undo=()=>run(['staged'],async check=>{const r=await adapter.undo(source.selection);check();if(!mutation(r,'UNDONE'))fail();return set({phase:'undone'})});
 const redo=()=>run(['undone'],async check=>{const r=await adapter.redo(source.selection);check();if(!mutation(r,'REDONE'))fail();return set({phase:'staged'})});
 const exportEditedCopy=()=>run(['staged'],async check=>{
  const r=await adapter.exportEditedCopy(source.selection);check();
  if(!keys(r,'kind,selection,editedCopyName,editedSha256,editedSizeBytes,backupName,editedCiphertextVerified,freshWorkerReopenVerified,independentProcessReopenVerified,originalUnchanged,writerAuthorized,originalOverwriteAuthorized')||
   r.kind!=='EXPORTED'||!sourceScope(r)||r.backupName!==backup.name||!filename(r.editedCopyName)||
   same(r.editedCopyName,source.name)||same(r.editedCopyName,backup.name)||!sha(r.editedSha256)||r.editedSha256===source.sha||!size(r.editedSizeBytes)||
   r.editedCiphertextVerified!==true||r.freshWorkerReopenVerified!==true||r.independentProcessReopenVerified!==false||r.originalUnchanged!==true)fail();
  edited=Object.freeze({name:r.editedCopyName,sha:r.editedSha256,size:r.editedSizeBytes});return set({phase:'exported',editedName:edited.name});
 });
 const downloadVerifiedCopy=which=>run(['ready','previewed','staged','undone','exported'],async check=>{
  const b=which==='backup'?backup:which==='edited'&&state.phase==='exported'?edited:null;if(!b)fail();
  const r=await adapter.downloadVerifiedCopy(source.selection,which);check();
  if(!keys(r,'kind,name,sha256,sizeBytes,encryptedBytes')||r.kind!=='VERIFIED_DOWNLOAD'||r.name!==b.name||r.sha256!==b.sha||r.sizeBytes!==b.size||
   !(r.encryptedBytes instanceof Uint8Array)||r.encryptedBytes.length!==b.size)fail();
  const bytes=new Uint8Array(r.encryptedBytes);
  try{if(await hash(bytes)!==b.sha)fail();check();return {name:b.name,encryptedBytes:bytes}}catch(e){bytes.fill(0);throw e}
 });
 return Object.freeze({snapshot,load,backupOriginal,preview,stage,undo,redo,exportEditedCopy,downloadVerifiedCopy,close});
}
