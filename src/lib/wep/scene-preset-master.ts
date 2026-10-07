import { validatePublishablePreset } from './scene-preset-runtime';

export const SCENE_PRESET_MASTER_SCHEMA = 'dreamwish-wand-scene-preset-private-master@1';
export const SCENE_PRESET_MASTER_DB = 'dreamwishwand-scene-preset-private-masters';
export const SCENE_PRESET_MASTER_STORE = 'masters';

export interface ScenePresetPublicationRef {
  presetArtifactId: string;
  presetRevisionId: string;
  presetWorkId: string;
  presetWorkRevisionId: string;
  galleryWorkId: string;
  galleryRevisionId: string;
  revisionNumber: number;
  checksumSha256: string;
  byteSize: number;
  publishedAt: string;
}

export interface ScenePresetPrivateMaster {
  schema: typeof SCENE_PRESET_MASTER_SCHEMA;
  version: 1;
  masterId: string;
  provisionalTitle: string;
  authoredTitle: string;
  description: string;
  artifact: any;
  createdAt: string;
  updatedAt: string;
  changesNotPublished: boolean;
  currentPublication: ScenePresetPublicationRef | null;
  persistentWriteAuthorized: false;
  WORLD_PERSISTENT_WRITE_V125: false;
  PERSISTENT_WRITE: false;
  productApplyAuthorized: false;
  directSourceReplacementAuthorized: false;
}

function fail(code: string): never { throw new Error(code); }
function now(value?: string) {
  const d=new Date(value ?? Date.now());
  if(Number.isNaN(d.getTime())) fail('WEP_SCENE_MASTER_TIMESTAMP_INVALID');
  return d.toISOString();
}
function clone<T>(value:T):T { return structuredClone(value); }
function id(value?:string) {
  const v=String(value??'').trim();
  if(v) return v;
  if(!globalThis.crypto?.randomUUID) fail('WEP_SCENE_MASTER_UUID_UNAVAILABLE');
  return globalThis.crypto.randomUUID();
}
function validateArtifact(artifact: unknown) {
  const validation=validatePublishablePreset(artifact);
  if(!validation?.ok || validation.presetType!=='scene' || Number(validation.schemaVersion)!==1) {
    fail('WEP_SCENE_MASTER_ARTIFACT_INVALID');
  }
  return validation;
}
function safety() {
  return {
    persistentWriteAuthorized:false as const,
    WORLD_PERSISTENT_WRITE_V125:false as const,
    PERSISTENT_WRITE:false as const,
    productApplyAuthorized:false as const,
    directSourceReplacementAuthorized:false as const
  };
}

export function createScenePresetPrivateMaster({
  artifact,
  provisionalTitle='Untitled Preset',
  masterId,
  createdAt
}: {
  artifact:unknown;
  provisionalTitle?:string;
  masterId?:string;
  createdAt?:string;
}):ScenePresetPrivateMaster {
  validateArtifact(artifact);
  const stamp=now(createdAt);
  return Object.freeze({
    schema:SCENE_PRESET_MASTER_SCHEMA,
    version:1 as const,
    masterId:id(masterId),
    provisionalTitle:String(provisionalTitle||'Untitled Preset'),
    authoredTitle:'',
    description:'',
    artifact:clone(artifact),
    createdAt:stamp,
    updatedAt:stamp,
    changesNotPublished:true,
    currentPublication:null,
    ...safety()
  });
}

export function normalizeScenePresetPrivateMaster(value:unknown):ScenePresetPrivateMaster {
  if(!value||typeof value!=='object'||Array.isArray(value)) fail('WEP_SCENE_MASTER_INVALID');
  const v=value as any;
  if(v.schema!==SCENE_PRESET_MASTER_SCHEMA||Number(v.version)!==1) fail('WEP_SCENE_MASTER_SCHEMA_MISMATCH');
  validateArtifact(v.artifact);
  if(!String(v.masterId??'').trim()) fail('WEP_SCENE_MASTER_ID_REQUIRED');
  if(v.persistentWriteAuthorized!==false||v.WORLD_PERSISTENT_WRITE_V125!==false||
     v.PERSISTENT_WRITE!==false||v.productApplyAuthorized!==false||
     v.directSourceReplacementAuthorized!==false) fail('WEP_SCENE_MASTER_UNSAFE_FLAGS');
  let publication:ScenePresetPublicationRef|null=null;
  if(v.currentPublication!=null){
    const p=v.currentPublication;
    for(const key of ['presetArtifactId','presetRevisionId','presetWorkId','presetWorkRevisionId','galleryWorkId','galleryRevisionId']){
      if(!String(p?.[key]??'')) fail('WEP_SCENE_MASTER_PUBLICATION_ID_INVALID');
    }
    if(!Number.isSafeInteger(Number(p.revisionNumber))||Number(p.revisionNumber)<=0) fail('WEP_SCENE_MASTER_PUBLICATION_REVISION_INVALID');
    if(!/^[0-9a-f]{64}$/i.test(String(p.checksumSha256??''))) fail('WEP_SCENE_MASTER_PUBLICATION_CHECKSUM_INVALID');
    if(!Number.isSafeInteger(Number(p.byteSize))||Number(p.byteSize)<=0) fail('WEP_SCENE_MASTER_PUBLICATION_SIZE_INVALID');
    publication={
      presetArtifactId:String(p.presetArtifactId),
      presetRevisionId:String(p.presetRevisionId),
      presetWorkId:String(p.presetWorkId),
      presetWorkRevisionId:String(p.presetWorkRevisionId),
      galleryWorkId:String(p.galleryWorkId),
      galleryRevisionId:String(p.galleryRevisionId),
      revisionNumber:Number(p.revisionNumber),
      checksumSha256:String(p.checksumSha256).toLowerCase(),
      byteSize:Number(p.byteSize),
      publishedAt:now(String(p.publishedAt??''))
    };
  }
  return Object.freeze({
    schema:SCENE_PRESET_MASTER_SCHEMA,
    version:1 as const,
    masterId:String(v.masterId),
    provisionalTitle:String(v.provisionalTitle||'Untitled Preset'),
    authoredTitle:String(v.authoredTitle??''),
    description:String(v.description??''),
    artifact:clone(v.artifact),
    createdAt:now(String(v.createdAt??'')),
    updatedAt:now(String(v.updatedAt??'')),
    changesNotPublished:v.changesNotPublished!==false,
    currentPublication:publication,
    ...safety()
  });
}

export function updateScenePresetPrivateMaster(
  master:ScenePresetPrivateMaster,
  changes:{artifact?:unknown;authoredTitle?:string;description?:string;updatedAt?:string}
):ScenePresetPrivateMaster {
  const current=normalizeScenePresetPrivateMaster(master);
  const artifact=changes.artifact===undefined?current.artifact:changes.artifact;
  validateArtifact(artifact);
  const contentChanged=changes.artifact!==undefined;
  const presentationChanged=changes.authoredTitle!==undefined||changes.description!==undefined;
  return normalizeScenePresetPrivateMaster({
    ...current,
    artifact:clone(artifact),
    authoredTitle:changes.authoredTitle===undefined?current.authoredTitle:String(changes.authoredTitle),
    description:changes.description===undefined?current.description:String(changes.description),
    updatedAt:now(changes.updatedAt),
    changesNotPublished:current.changesNotPublished||contentChanged||presentationChanged
  });
}

export function markScenePresetPublished(
  master:ScenePresetPrivateMaster,
  publication:Omit<ScenePresetPublicationRef,'publishedAt'> & {publishedAt?:string}
):ScenePresetPrivateMaster {
  const current=normalizeScenePresetPrivateMaster(master);
  return normalizeScenePresetPrivateMaster({
    ...current,
    currentPublication:{...publication,publishedAt:now(publication.publishedAt)},
    changesNotPublished:false,
    updatedAt:now()
  });
}

export function scenePresetPublishReadiness(
  master:ScenePresetPrivateMaster,
  mediaCount:number
){
  const current=normalizeScenePresetPrivateMaster(master);
  const blockers:string[]=[];
  if(!current.authoredTitle.trim()) blockers.push('PUBLIC_TITLE_REQUIRED');
  if(!Number.isSafeInteger(mediaCount)||mediaCount<1) blockers.push('PUBLIC_IMAGE_REQUIRED');
  if(mediaCount>10) blockers.push('PUBLIC_IMAGE_LIMIT');
  const validation=validatePublishablePreset(current.artifact);
  if(!validation?.ok) blockers.push('SCENE_ARTIFACT_INVALID');
  return Object.freeze({
    ready:blockers.length===0,
    blockers:Object.freeze(blockers),
    operation:current.currentPublication?'PUBLISH_UPDATE':'PUBLISH',
    persistentWriteAuthorized:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

type IDBLike = IDBFactory;

function openDb(indexedDb:IDBLike=indexedDB):Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDb.open(SCENE_PRESET_MASTER_DB,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(SCENE_PRESET_MASTER_STORE)){
        const store=db.createObjectStore(SCENE_PRESET_MASTER_STORE,{keyPath:'masterId'});
        store.createIndex('updatedAt','updatedAt');
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('WEP_SCENE_MASTER_DB_OPEN_FAILED'));
  });
}

function requestValue<T>(request:IDBRequest<T>,code:string):Promise<T>{
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error(code));
  });
}

export function createScenePresetMasterStore(indexedDb:IDBLike=indexedDB){
  return Object.freeze({
    async put(master:ScenePresetPrivateMaster){
      const value=normalizeScenePresetPrivateMaster(master);
      const db=await openDb(indexedDb);
      try{
        const tx=db.transaction(SCENE_PRESET_MASTER_STORE,'readwrite');
        await requestValue(tx.objectStore(SCENE_PRESET_MASTER_STORE).put(clone(value)),'WEP_SCENE_MASTER_DB_WRITE_FAILED');
        return value;
      }finally{db.close();}
    },
    async get(masterId:string){
      const db=await openDb(indexedDb);
      try{
        const raw=await requestValue<any>(db.transaction(SCENE_PRESET_MASTER_STORE,'readonly').objectStore(SCENE_PRESET_MASTER_STORE).get(String(masterId)),'WEP_SCENE_MASTER_DB_READ_FAILED');
        return raw?normalizeScenePresetPrivateMaster(raw):null;
      }finally{db.close();}
    },
    async list(){
      const db=await openDb(indexedDb);
      try{
        const rows=await requestValue<any[]>(db.transaction(SCENE_PRESET_MASTER_STORE,'readonly').objectStore(SCENE_PRESET_MASTER_STORE).getAll(),'WEP_SCENE_MASTER_DB_LIST_FAILED');
        return rows.map(normalizeScenePresetPrivateMaster).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
      }finally{db.close();}
    },
    async delete(masterId:string){
      const db=await openDb(indexedDb);
      try{
        await requestValue(db.transaction(SCENE_PRESET_MASTER_STORE,'readwrite').objectStore(SCENE_PRESET_MASTER_STORE).delete(String(masterId)),'WEP_SCENE_MASTER_DB_DELETE_FAILED');
      }finally{db.close();}
    }
  });
}
