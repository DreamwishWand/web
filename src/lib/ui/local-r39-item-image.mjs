// Browser-only R39 preview. No game image is shipped with Wand, uploaded, or fetched.
// Exact SHA mapping is a separate versioned 01D evidence product; never guess ItemID identity.
import { writable, get } from 'svelte/store';

export const R39_MANIFEST_SHA256 = 'c619541497732e76441c52f6505b2ca2dbe1fd2baffdfda4fa4584b9819a7733';
export const LOCAL_IMAGE_MAP_SCHEMA = 'wand.r39.itemid-source-png-sha@1';
export const R39_VERSION = '1.24.13';
export const LOCAL_IMAGE_DB = 'wand-r39-local-image-preview-v1';
export const IMAGE_PREFERENCES = Object.freeze({ fit:'contain', size:56, density:'comfortable' });
const hex64 = /^[0-9a-f]{64}$/;
const validId = /^(0|[1-9][0-9]{0,12})$/;
const validSizes = new Set([36,48,56,64,80]);
const state0 = { ready:false, available:false, error:'', manifest:false, mapping:false, shardCount:0, thumbs:0,
  preferences:{...IMAGE_PREFERENCES}, revision:0, version:R39_VERSION };
export const localImageState = writable(state0);
let dbPromise = null;
let restorePromise = null;
let mapping = null;
let manifest = null;

export function validateR39Manifest(m) {
  if (!m || typeof m!=='object' || m.schemaVersion!==1 || m.artifact!=='DDV_GAME_THUMBNAIL_DERIVATIVE_MANIFEST' ||
      m.platform!=='Switch'||m.gameVersion!==R39_VERSION||m.policy?.identity!=='source PNG SHA-256 -> derivative path'||
      m.policy?.format!=='WebP'||m.coverage?.uniqueThumbnails!==12082||
      m.coverage?.shards!==32||m.coverage?.totalShardBytes!==85464564||
      !Array.isArray(m.shards)||m.shards.length!==32) throw new Error('Unsupported R39 manifest or version.');
  const all=new Set();let bytes=0;
  for(const s of m.shards) {
    if(!/^(0[0-9a-f]|1[0-9a-f])$/.test(s.shard)||all.has(s.shard)||
       s.file!==`DDV_GAME_THUMBNAILS_WEBP_v1.24.13_shard_${s.shard}.zip`||
       !hex64.test(s.sha256)||!Number.isSafeInteger(s.bytes)||s.bytes<10000||s.bytes>8000000||
       !Number.isSafeInteger(s.uniqueThumbnails)||s.uniqueThumbnails<1||s.uniqueThumbnails>1000) throw new Error('Invalid R39 shard declaration.');
    all.add(s.shard);bytes+=s.bytes;
  }
  if(bytes!==85464564||m.shards.reduce((n,s)=>n+s.uniqueThumbnails,0)!==12082) throw new Error('Incomplete R39 pack coverage.');
  return m;
}
export function validateLocalImageMap(source) {
  if(!source||source.schema!==LOCAL_IMAGE_MAP_SCHEMA||source.platform!=='Switch'||
    source.gameVersion!==R39_VERSION||source.manifestSha256!==R39_MANIFEST_SHA256||
    typeof source.items!=='object'||!source.items||Array.isArray(source.items)) throw new Error('Unsupported ItemID to source-SHA mapping; requires 01D v1.24.13 exact evidence.');
  const entries=Object.entries(source.items);
  if(!entries.length||entries.length>30000) throw new Error('Invalid map size.');
  for(const [key,sha] of entries) if(!validId.test(key)||typeof sha!=='string'||!hex64.test(sha)) throw new Error('Unverified ItemID/source SHA pair.');
  return source;
}
export function validateLocalImagePreferences(value) {
  if(!value||!['contain','cover'].includes(value.fit)||!validSizes.has(value.size)||
    !['compact','comfortable'].includes(value.density)) throw new Error('Invalid local image preferences.');
  return {fit:value.fit,size:value.size,density:value.density};
}
export async function sha256(bytes) {
  const buffer=bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');
}
function openDB() {
  if(typeof indexedDB==='undefined') return Promise.reject(new Error('IndexedDB not available: use an eligible HTTPS browser.'));
  if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(LOCAL_IMAGE_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta');
      if(!db.objectStoreNames.contains('thumbs'))db.createObjectStore('thumbs');
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB unavailable.'));
    req.onblocked=()=>reject(new Error('Local image storage blocked by another tab.'));
  }).catch(e=>{dbPromise=null;throw e;});
  return dbPromise;
}
async function readDB(store,key) {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(store,'readonly').objectStore(store).get(key);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function writeDB(store,values) {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite'),obj=tx.objectStore(store);
    for(const [key,value] of values)obj.put(value,key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Local storage write failed.'));
    tx.onabort=()=>reject(tx.error||new Error('Local storage quota exceeded.'));
  });
}
function updateState(partial) { localImageState.update(s=>({...s,...partial,revision:s.revision+1})); }
export function restoreLocalImages() {
  if(restorePromise)return restorePromise;
  restorePromise=(async()=>{
    try{
      await openDB();
      const [storedManifest,storedMap,prefs,shards]=await Promise.all([
        readDB('meta','manifest'),readDB('meta','mapping'),readDB('meta','preferences'),readDB('meta','shards')
      ]);
      manifest=storedManifest ? validateR39Manifest(storedManifest):null;
      mapping=storedMap ? validateLocalImageMap(storedMap):null;
      const preferences=prefs ? validateLocalImagePreferences(prefs) : {...IMAGE_PREFERENCES};
      updateState({ready:true,available:true,error:'',manifest:Boolean(manifest),mapping:Boolean(mapping),
        shardCount:Array.isArray(shards)?shards.length:0,preferences});
    }catch(e){
      manifest=null;mapping=null;updateState({ready:true,available:false,error:String(e?.message||e),manifest:false,mapping:false});
    }
  })();
  return restorePromise;
}
export async function importR39Manifest(file) {
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength>1000000||await sha256(bytes)!==R39_MANIFEST_SHA256) throw new Error('R39 manifest SHA256 mismatch; no import performed.');
  const value=validateR39Manifest(JSON.parse(new TextDecoder().decode(bytes)));
  await writeDB('meta',[['manifest',value]]);
  manifest=value;updateState({manifest:true,error:''});
}
export async function importR39ItemMapping(file) {
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength>5000000)throw new Error('Image ItemID mapping exceeds safe limit.');
  const value=validateLocalImageMap(JSON.parse(new TextDecoder().decode(bytes)));
  if(!manifest)throw new Error('Import the exact R39 manifest before the ItemID mapping.');
  await writeDB('meta',[['mapping',value]]);
  mapping=value;updateState({mapping:true,error:''});
}
export function sourceHashForItem(itemId) {
  if(!mapping||!manifest||!validId.test(String(itemId)))return null;
  return mapping.items[String(itemId)]||null;
}
function safeZipEntries(bytes,expectedShard) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const len=bytes.byteLength;let eocd=-1;
  for(let i=len-22;i>=Math.max(0,len-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
  if(eocd<0||view.getUint16(eocd+4,true)!==0||view.getUint16(eocd+6,true)!==0) throw new Error('ZIP central directory missing or unsupported.');
  const count=view.getUint16(eocd+10,true),tableBytes=view.getUint32(eocd+12,true),offset=view.getUint32(eocd+16,true);
  if(!count||count>1000||offset+tableBytes>eocd)throw new Error('ZIP bounds or entry count invalid.');
  const result=[];let pos=offset,total=0;const seen=new Set();
  for(let i=0;i<count;i++){
    if(pos+46>len||view.getUint32(pos,true)!==0x02014b50)throw new Error('Invalid central ZIP entry.');
    const flag=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),
      compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true),
      nameLen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),
      comment=view.getUint16(pos+32,true),local=view.getUint32(pos+42,true);
    if(flag&1||![0,8].includes(method)||size>512000||compressed>512000||pos+46+nameLen+extra+comment>len)throw new Error('Unsupported ZIP flags or size.');
    const path=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(pos+46,pos+46+nameLen));
    pos+=46+nameLen+extra+comment;
    if(path.endsWith('/'))continue;
    if(path.startsWith('/')||path.includes('..')||path.includes('\\')||path.includes('\0'))throw new Error('Unsafe ZIP path.');
    const name=path.split('/').at(-1)||'';
    const m=/^([0-9a-f]{64})\.webp$/.exec(name);
    if(!m||seen.has(m[1]))throw new Error('Unexpected/noncanonical R39 thumbnail path.');
    const shard=(parseInt(m[1].slice(0,2),16)>>3).toString(16).padStart(2,'0');
    if(shard!==expectedShard)throw new Error('WebP SHA belongs to a different shard.');
    seen.add(m[1]);total+=size;
    if(local+30>len||view.getUint32(local,true)!==0x04034b50)throw new Error('Invalid ZIP local header.');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(start+compressed>len||total>16000000)throw new Error('ZIP decompression bound exceeded.');
    result.push({sha:m[1],method,compressed:bytes.slice(start,start+compressed),size});
  }
  return result;
}
async function decompress(entry) {
  const raw=entry.compressed;
  let out=raw;
  if(entry.method===8) {
    if(typeof DecompressionStream==='undefined')throw new Error('ZIP deflate unsupported by this browser.');
    const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    out=new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if(out.byteLength!==entry.size||out.byteLength<16||out[0]!==82||out[1]!==73||out[2]!==70||out[3]!==70||
    out[8]!==87||out[9]!==69||out[10]!==66||out[11]!==80)throw new Error('Invalid R39 WebP signature or size.');
  return new Blob([out],{type:'image/webp'});
}
export async function importR39Shards(files) {
  if(!manifest)throw new Error('Import exact R39 manifest before shard ZIPs.');
  const selected=Array.from(files||[]);
  if(!selected.length||selected.length>32)throw new Error('Select 1–32 local shard ZIPs.');
  const known=new Map(manifest.shards.map(s=>[s.file,s]));
  const tracked=await readDB('meta','shards')||[];
  const added=new Set(tracked);
  for(const file of selected){
    const expected=known.get(file.name);
    if(!expected||file.size!==expected.bytes||file.size>8000000)throw new Error('Unrecognized shard name or size.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(await sha256(bytes)!==expected.sha256)throw new Error('R39 shard SHA mismatch; no data from that shard imported.');
    const entries=safeZipEntries(bytes,expected.shard);
    if(entries.length!==expected.uniqueThumbnails)throw new Error('R39 ZIP thumbnail coverage mismatch.');
    const blobs=[];
    for(const entry of entries)blobs.push([entry.sha,await decompress(entry)]);
    await writeDB('thumbs',blobs);
    added.add(expected.shard);
    await writeDB('meta',[['shards',[...added].sort()]]);
    updateState({shardCount:added.size,thumbs:get(localImageState).thumbs+blobs.length,error:''});
  }
  return {shards:added.size};
}
export async function loadLocalImage(itemId) {
  const sha=sourceHashForItem(itemId);
  if(!sha)return null;
  const blob=await readDB('thumbs',sha);
  if(!(blob instanceof Blob)||blob.type!=='image/webp')return null;
  return URL.createObjectURL(blob);
}
export async function setLocalImagePreferences(value){
  const preferences=validateLocalImagePreferences(value);
  await writeDB('meta',[['preferences',preferences]]);
  updateState({preferences,error:''});
}
export async function clearLocalImagePreview(){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['meta','thumbs'],'readwrite');
    tx.objectStore('meta').clear();tx.objectStore('thumbs').clear();
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
  });
  mapping=null;manifest=null;restorePromise=null;
  updateState({...state0,ready:true,available:true,preferences:{...IMAGE_PREFERENCES}});
}
export function noteLocalImageError(err){updateState({error:String(err?.message||err||'Unknown local image error')});}
