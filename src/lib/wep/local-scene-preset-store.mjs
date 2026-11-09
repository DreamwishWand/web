// 02 WEP: local, opt-in Scene Preset library. No Community, Moodboard, Save writer
// or legacy localStorage authority. One IndexedDB CAS row; Backup and primary
// are committed in the same readwrite transaction.
import {validatePublishablePreset} from './scene-preset-runtime.ts';

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
 try{canonical=JSON.parse(JSON.stringify(checkArtifact(artifact)));}catch(e){fail('PRESET_INVALID');}
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
