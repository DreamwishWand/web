// 02 WEP: local, opt-in Scene Preset library. No Community, Moodboard, Save writer
// or legacy localStorage authority. One IndexedDB CAS row; Backup and primary
// are committed in the same readwrite transaction.
import {validatePublishablePreset} from './scene-preset-runtime.ts';
import {buildReadonlyLocalSceneReuseDraft} from './local-scene-reuse-readonly.ts';

export const WEP_LOCAL_SCENE_OPERATION='WEP_SCENE_PRESET_LOCAL_IDB_CAS_BACKUP_REOPEN_READONLY';
export const WEP_LOCAL_SCENE_DB='dreamwishwand:wep:scene-presets:local:v1';
export const WEP_LOCAL_SCENE_STORE='snapshots';
const SLOT='library',ROW_SCHEMA='wand.wep.scene-library-snapshot@1';
const DOC_SCHEMA='wand.wep.scene-library@1',MAX_SCENES=100,MAX_BYTES=4*1024*1024;
const fail=x=>{throw Error('WEP_LOCAL_SCENE_'+x);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,expected)=>plain(x)&&Object.keys(x).length===expected.length&&
 expected.every(k=>Object.prototype.hasOwnProperty.call(x,k));
const encode=x=>JSON.stringify(x);
const empty=()=>({schema:DOC_SCHEMA,version:1,entries:[]});
function checkArtifact(artifact){
 const v=validatePublishablePreset(artifact);
 if(!v.ok||v.presetType!=='scene')fail('PRESET_INVALID');
 // Topology/Native/SubGrid authority is never inferred for this local consumer.
 // Save-only is allowed only for topology-free captures; persistent placement OFF.
 if(artifact.networks?.roads!=null||artifact.networks?.fences!=null||
  artifact.requirements?.roadTopology!==false||
  artifact.requirements?.fenceTopology!==false)fail('NETWORK_AUTHORITY_UNVERIFIED');
 return artifact;
}
function parseDocument(raw){
 if(typeof raw!=='string'||raw.length>MAX_BYTES)fail('DOCUMENT_INVALID');
 let doc;
 try{doc=JSON.parse(raw);}catch{fail('DOCUMENT_INVALID');}
 if(!keys(doc,['schema','version','entries'])||doc.schema!==DOC_SCHEMA||doc.version!==1||
  !Array.isArray(doc.entries)||doc.entries.length>MAX_SCENES)fail('DOCUMENT_INVALID');
 const found=new Set();
 for(const entry of doc.entries){
  if(!keys(entry,['id','title','createdAt','artifact'])||
   typeof entry.id!=='string'||!/^scene_[0-9a-f-]{36}$/.test(entry.id)||found.has(entry.id)||
   typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>120||
   typeof entry.createdAt!=='string'||Number.isNaN(Date.parse(entry.createdAt)))fail('ENTRY_INVALID');
  found.add(entry.id);
  checkArtifact(entry.artifact);
 }
 return doc;
}
function parseRow(row){
 if(row===undefined)return {revision:0,primary:encode(empty()),backup:encode(empty()),
  backupRevision:0,document:empty()};
 if(!keys(row,['schema','revision','backupRevision','primary','backup'])||
  row.schema!==ROW_SCHEMA||!Number.isSafeInteger(row.revision)||row.revision<1||
  !Number.isSafeInteger(row.backupRevision)||row.backupRevision!==row.revision-1||
  typeof row.primary!=='string'||typeof row.backup!=='string')fail('SNAPSHOT_INVALID');
 const doc=parseDocument(row.primary);
 parseDocument(row.backup);
 return {...row,document:doc};
}
export function openLocalSceneDb({factory=globalThis.indexedDB,create=false}={}){
 if(!factory?.open) return Promise.reject(Error('WEP_LOCAL_SCENE_IDB_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  let request;
  try{request=factory.open(WEP_LOCAL_SCENE_DB,1);}catch(e){reject(e);return;}
  request.onupgradeneeded=()=>{
   if(!create){try{request.transaction.abort();}catch{};return;}
   const db=request.result;
   if(!db.objectStoreNames.contains(WEP_LOCAL_SCENE_STORE))db.createObjectStore(WEP_LOCAL_SCENE_STORE);
  };
  request.onerror=()=>reject(Error('WEP_LOCAL_SCENE_DB_UNAVAILABLE_OR_ABSENT'));
  request.onblocked=()=>reject(Error('WEP_LOCAL_SCENE_DB_BLOCKED'));
  request.onsuccess=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(WEP_LOCAL_SCENE_STORE)){
    db.close();reject(Error('WEP_LOCAL_SCENE_STORE_MISSING'));return;
   }
   db.onversionchange=()=>db.close();
   resolve(db);
  };
 });
}
function transaction(db,mode,action){
 return new Promise((resolve,reject)=>{
  let tx,outcome,error;
  try{
   tx=db.transaction(WEP_LOCAL_SCENE_STORE,mode);
   const store=tx.objectStore(WEP_LOCAL_SCENE_STORE);
   const request=store.get(SLOT);
   request.onsuccess=()=>{
    try{
     const result=action(parseRow(request.result));
     outcome=result.value;
     if('next' in result)store.put(result.next,SLOT);
    }catch(e){error=e;try{tx.abort();}catch{}}
   };
   tx.oncomplete=()=>resolve(outcome);
   tx.onabort=()=>reject(error||tx.error||Error('WEP_LOCAL_SCENE_ABORTED'));
   tx.onerror=()=>{if(!error)error=tx.error||Error('WEP_LOCAL_SCENE_TX_FAILED');};
  }catch(e){reject(e);}
 });
}
export async function reopenLocalScenes(factory=globalThis.indexedDB){
 const db=await openLocalSceneDb({factory,create:false});
 try{return await transaction(db,'readonly',row=>({value:row}));}
 finally{db.close();}
}
export async function saveLocalScene({
 factory=globalThis.indexedDB,artifact,title,expectedRevision,
 idFactory=()=>globalThis.crypto?.randomUUID?.(),
 now=new Date().toISOString()
}){
 if(typeof title!=='string'||!title.trim()||title.trim().length>120||
  !Number.isSafeInteger(expectedRevision)||expectedRevision<0)fail('INPUT_INVALID');
 if(typeof now!=='string'||Number.isNaN(Date.parse(now)))fail('TIMESTAMP_INVALID');
 const id='scene_'+String(idFactory()??'');
 if(!/^scene_[0-9a-f-]{36}$/.test(id))fail('ID_INVALID');
 // Canonical JSON preserves the exact portable artifact, no document mutation.
 let canonical;
 try{canonical=JSON.parse(JSON.stringify(artifact));}catch{fail('PRESET_INVALID');}
 checkArtifact(canonical);
 const db=await openLocalSceneDb({factory,create:true});
 try{
  const receipt=await transaction(db,'readwrite',row=>{
   if(row.revision!==expectedRevision)fail('STALE_REVISION');
   if(row.document.entries.length>=MAX_SCENES)fail('LIMIT_REACHED');
   const nextDoc={schema:DOC_SCHEMA,version:1,entries:[
    ...row.document.entries,{id,title:title.trim(),createdAt:now,artifact:canonical}
   ]};
   const primary=encode(nextDoc);
   if(primary.length>MAX_BYTES)fail('LIMIT_REACHED');
   const next={schema:ROW_SCHEMA,revision:row.revision+1,
    backupRevision:row.revision,primary,backup:row.primary};
   return {next,value:{id,revision:next.revision,primary,backup:row.primary}};
  });
  return receipt;
 }finally{db.close();}
}
// Never trust the optimistic in-memory CAS receipt alone. Separate transaction,
// exact primary/backup snapshot and revision equality before claiming Saved.
export async function verifiedReopenLocalScene(receipt,factory=globalThis.indexedDB){
 const row=await reopenLocalScenes(factory);
 if(!receipt||row.revision!==receipt.revision||
  row.primary!==receipt.primary||row.backup!==receipt.backup)fail('REOPEN_MISMATCH');
 const entry=row.document.entries.find(x=>x.id===receipt.id);
 if(!entry)fail('REOPEN_ENTRY_MISSING');
 return {revision:row.revision,entry:structuredClone(entry),row};
}
export async function readLocalSceneById(id,factory=globalThis.indexedDB){
 const row=await reopenLocalScenes(factory);
 const entry=row.document.entries.find(x=>x.id===id);
 if(!entry)fail('ENTRY_MISSING');
 return {revision:row.revision,entry:structuredClone(entry)};
}

/* Migration-only portable file: current library entries, never raw IDB rows,
 * Save bytes, backup/session/account state or executable placement authority.
 * The source and its Backup remain untouched. A target merge is one CAS commit.
 */
export const WEP_LOCAL_SCENE_PORTABLE_SCHEMA='wand.wep.scene-library-portable@1';
export const WEP_LOCAL_SCENE_PORTABLE_MAX_BYTES=MAX_BYTES;
const byteLength=s=>new TextEncoder().encode(s).length;
const boundedText=(v,n)=>typeof v==='string'&&v.length<=n;
// Match the detached readonly geometry contract, without its layer coercion.
const PORTABLE_LAYERS=new Set(['furniture','building','landscaping']);
function checkPortableEntry(entry){
 const a=entry.artifact;
 // Exact capture shape, not an arbitrary JSON carrier. SubGrid/portableState
 // is outside the existing detached-readonly reuse contract and fails closed.
 if(!keys(a,['schema','artifactVersion','type','title','source','bounds','originPolicy','objects','networks','requirements','normalization'])||
  a.schema!=='dreamwish-wand-preset'||a.artifactVersion!==1||a.type!=='scene'||
  !boundedText(a.title,120)||!keys(a.source,['gameVersion','platform','areaKey'])||
  !Object.values(a.source).every(v=>v===null||boundedText(v,256))||
  !keys(a.bounds,['w','h'])||!keys(a.networks,['roads','fences'])||
  a.networks.roads!==null||a.networks.fences!==null||
  !keys(a.requirements,['itemQuantities','roadTopology','fenceTopology'])||
  a.requirements.roadTopology!==false||a.requirements.fenceTopology!==false||
  !keys(a.normalization,['sourceGridIdsRemoved','sourceGridObjectIdsRemoved','dependencyClosureIncluded'])||
  Object.values(a.normalization).some(v=>v!==true)||
  !Array.isArray(a.objects)||a.objects.length<1||a.objects.length>4096)
  fail('PORTABLE_ARTIFACT_INVALID');
 const counts=Object.create(null);
 for(const o of a.objects){
  if(!keys(o,['artifactObjectId','itemId','layer','localX','localY','orientation','footprint','portableState','dependencyIds'])||
   typeof o.layer!=='string'||!PORTABLE_LAYERS.has(o.layer)||
   o.portableState!==null||!Array.isArray(o.footprint)||o.footprint.length>4096||
   !o.footprint.every(c=>keys(c,['x','y']))||
   !Array.isArray(o.dependencyIds)||o.dependencyIds.length>4096||
   !o.dependencyIds.every(d=>typeof d==='string')||
   !Number.isSafeInteger(o.itemId)||o.itemId<=0)fail('PORTABLE_OBJECT_INVALID');
  counts[String(o.itemId)]=(counts[String(o.itemId)]??0)+1;
 }
 if(!keys(a.requirements.itemQuantities,Object.keys(counts))||
  Object.keys(counts).some(k=>a.requirements.itemQuantities[k]!==counts[k]))fail('PORTABLE_QUANTITY_INVALID');
 // Same strict accepted detached geometry validator; never a Native/Writer grant.
 buildReadonlyLocalSceneReuseDraft({sceneId:entry.id,sourceRevision:1,artifact:a});
}
export function parseLocalScenePortableFile(raw){
 if(typeof raw!=='string'||raw.length>MAX_BYTES||byteLength(raw)>MAX_BYTES)fail('PORTABLE_LIMIT');
 let file;
 try{file=JSON.parse(raw);}catch{fail('PORTABLE_FILE_INVALID');}
 if(!keys(file,['schema','version','entries'])||file.schema!==WEP_LOCAL_SCENE_PORTABLE_SCHEMA||
  file.version!==1||!Array.isArray(file.entries)||!file.entries.length||file.entries.length>MAX_SCENES)
  fail('PORTABLE_FILE_INVALID');
 // Only the canonical file emitted by this exporter; duplicate JSON keys,
 // BOM, alternate formatting and unrecognized envelopes are rejected.
 if(encode(file)!==raw)fail('PORTABLE_NONCANONICAL');
 for(const entry of file.entries){
  if(!keys(entry,['id','title','createdAt','artifact']))fail('PORTABLE_ENTRY_INVALID');
  checkPortableEntry(entry);
 }
 return parseDocument(encode({schema:DOC_SCHEMA,version:1,entries:file.entries}));
}
export async function exportLocalScenePortableFile({factory=globalThis.indexedDB,expectedRevision}){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)fail('INPUT_INVALID');
 const row=await reopenLocalScenes(factory);
 if(row.revision!==expectedRevision)fail('STALE_REVISION');
 const raw=encode({schema:WEP_LOCAL_SCENE_PORTABLE_SCHEMA,version:1,entries:row.document.entries});
 parseLocalScenePortableFile(raw);
 return raw;
}
export async function importLocalScenePortableFile({factory=globalThis.indexedDB,raw,expectedRevision}){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)fail('INPUT_INVALID');
 // All input validation before any write/open; no replacement or automatic reset.
 const incoming=parseLocalScenePortableFile(raw);
 const db=await openLocalSceneDb({factory,create:expectedRevision===0});
 let receipt;
 try{
  receipt=await transaction(db,'readwrite',row=>{
   if(row.revision!==expectedRevision)fail('STALE_REVISION');
   const existing=new Set(row.document.entries.map(e=>e.id));
   if(incoming.entries.some(e=>existing.has(e.id)))fail('PORTABLE_ID_COLLISION');
   const entries=[...row.document.entries,...incoming.entries];
   if(entries.length>MAX_SCENES)fail('LIMIT_REACHED');
   const primary=encode({schema:DOC_SCHEMA,version:1,entries});
   if(primary.length>MAX_BYTES||byteLength(primary)>MAX_BYTES)fail('LIMIT_REACHED');
   parseDocument(primary);
   const next={schema:ROW_SCHEMA,revision:row.revision+1,backupRevision:row.revision,primary,backup:row.primary};
   return {next,value:{revision:next.revision,backupRevision:next.backupRevision,primary,backup:next.backup,
    importedCount:incoming.entries.length}};
  });
 }finally{db.close();}
 const reopened=await reopenLocalScenes(factory);
 if(reopened.revision!==receipt.revision||reopened.backupRevision!==receipt.backupRevision||
  reopened.primary!==receipt.primary||reopened.backup!==receipt.backup)fail('REOPEN_MISMATCH');
 return {...receipt,document:reopened.document};
}
