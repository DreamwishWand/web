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
export const COLLECTION_EXACT1_BUILDS=Object.freeze({
 'steam-windows':Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',buildId:STEAM,schema:626,externallyConfirmed:true}),
 switch:Object.freeze({platform:'switch',buildKind:'switch-bid',buildId:SWITCH,schema:626,externallyConfirmed:true})
});
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
 // Same exact CLOSED receipt contract as accepted scoped Amount UI.
 const closedReceipt=r=>keys(r,'kind,ok,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized')&&
  r.kind==='CLOSED'&&r.ok===true&&r.writerAuthorized===false&&r.nativeV3Verified===false&&r.originalOverwriteAuthorized===false;
 const close=()=>{
  epoch++;reset();busy=false;
  if(!closing){
   const p=Promise.resolve().then(()=>adapter.close()).then(r=>{
    if(!closedReceipt(r))fail();
   }).catch(e=>{set({phase:'close-failed'});throw e});
   closing=p;const settled=()=>{if(closing===p)closing=null};p.then(settled,settled);
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
 const inspect=async(check,expected=null)=>{
  const r=await adapter.inspectCollectionTargets();check();
  if(!keys(r,'selection,build,originalName,originalSha256,originalSizeBytes,targets,writerAuthorized,originalOverwriteAuthorized')||
    !uint(r.selection)||r.selection<1||!buildOk(r.build)||typeof r.originalName!=='string'||!r.originalName.toLowerCase().endsWith('.p1g')||
    !sha(r.originalSha256)||!size(r.originalSizeBytes)||!Array.isArray(r.targets)||r.targets.length>256||
    r.writerAuthorized!==false||r.originalOverwriteAuthorized!==false)fail();
  if(expected&&(r.originalName!==expected.name||r.originalSha256!==expected.sha||r.originalSizeBytes!==expected.size||
    Object.keys(expected.build).some(k=>r.build[k]!==expected.build[k])))fail();
  const seen=new Set(),targets=r.targets.map(t=>{
   if(!targetOk(t,r.build))fail();const key=t.definitionId+':'+t.groupIndex+':'+t.itemId;
   if(seen.has(key))fail();seen.add(key);return Object.freeze({...t});
  });
  source=Object.freeze({selection:r.selection,name:r.originalName,sha:r.originalSha256,size:r.originalSizeBytes});
  return set({phase:'opened',sourceName:source.name,build:{...r.build},targets});
 };
 const load=()=>run(['closed'],check=>inspect(check));
 // Local file hash is computed only in the UI process; the existing Worker
 // independently validates original ciphertext and the external Build claim.
 // Never infer Steam/Switch or a BuildID from schema or filename.
 const openFile=args=>run(['closed'],async check=>{
  if(typeof adapter.open!=='function'||!keys(args,'file,build')||!(args.file instanceof File)||!buildOk(args.build))fail();
  const file=args.file,build=Object.freeze({...args.build});
  const name=Object.getOwnPropertyDescriptor(File.prototype,'name').get.call(file);
  const len=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get.call(file);
  if(!name.toLowerCase().endsWith('.p1g')||!size(len))fail();
  const bytes=new Uint8Array(await Blob.prototype.arrayBuffer.call(file));let originalSha256;
  try{check();if(bytes.length!==len)fail();originalSha256=await hash(bytes);check()}finally{bytes.fill(0)}
  const r=await adapter.open(Object.freeze({file,build,originalSha256}));check();
  if(!keys(r,'kind,ok,writerAuthorized,nativeV3Verified,originalOverwriteAuthorized')||r.kind!=='OPEN'||r.ok!==true||
    r.writerAuthorized!==false||r.nativeV3Verified!==false||r.originalOverwriteAuthorized!==false)fail();
  return inspect(check,{name,sha:originalSha256,size:len,build});
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
  const r=await adapter.downloadVerifiedCopy(source.selection,which),transient=r?.encryptedBytes;
  let bytes;
  try{
   check();
   if(!keys(r,'kind,name,sha256,sizeBytes,encryptedBytes')||r.kind!=='VERIFIED_DOWNLOAD'||r.name!==b.name||r.sha256!==b.sha||r.sizeBytes!==b.size||
    !(transient instanceof Uint8Array)||transient.length!==b.size)fail();
   bytes=new Uint8Array(transient);
  }finally{if(transient instanceof Uint8Array)Uint8Array.prototype.fill.call(transient,0)}
  try{if(await hash(bytes)!==b.sha)fail();check();return {name:b.name,encryptedBytes:bytes}}catch(e){bytes.fill(0);throw e}
 });
 return Object.freeze({snapshot,load,openFile,backupOriginal,preview,stage,undo,redo,exportEditedCopy,downloadVerifiedCopy,close});
}
