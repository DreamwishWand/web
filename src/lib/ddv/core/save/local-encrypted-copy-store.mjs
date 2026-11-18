// Worker-private local encrypted copy store. Derived from the accepted
// DEV adapter's writeChecked/readBoundEncryptedCopy (PR1261); one storage
// abstraction, no Save parsing, paths from UI, network or original writes.
const fail=()=>{throw Error('LOCAL_ENCRYPTED_COPY_DENIED')};
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const size=n=>Number.isSafeInteger(n)&&n>0&&n<=128*1024*1024;
const safe=n=>typeof n==='string'&&/^[A-Za-z0-9._-]+\.p1g$/.test(n);
const same=(a,b)=>a.normalize('NFC').toLowerCase()===b.normalize('NFC').toLowerCase();
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const bytesOf=async f=>new Uint8Array(await Blob.prototype.arrayBuffer.call(f));
const fileName=f=>Object.getOwnPropertyDescriptor(File.prototype,'name').get.call(f);
export function createLocalEncryptedCopyStore({getDirectory=()=>navigator.storage.getDirectory()}={}){
 if(typeof document!=='undefined'||typeof getDirectory!=='function')fail();
 let epoch=0,source=null,root=null,bound={};
 const close=()=>{epoch++;source=null;root=null;bound={}};
 const current=(t,s)=>{if(t!==epoch||source!==s)fail()};
 async function open(file,expectedSha){
  close();const t=epoch;
  if(!(file instanceof File)||!sha(expectedSha))fail();
  const n=fileName(file),len=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get.call(file);
  if(!size(len)||len%16||!n.toLowerCase().endsWith('.p1g'))fail();
  const bytes=await bytesOf(file);
  try{
   if(t!==epoch||bytes.length!==len||await digest(bytes)!==expectedSha||t!==epoch)fail();
   const dir=await getDirectory();if(t!==epoch)fail();
   source=Object.freeze({file,name:n,sha:expectedSha,size:len});root=dir;
  }finally{bytes.fill(0)}
 }
 async function read(which){
  const t=epoch,s=source,b=bound[which],dir=root;
  if(!s||!b||!dir)fail();current(t,s);
  const f=await (await dir.getFileHandle(b.name)).getFile();current(t,s);
  if(!(f instanceof File)||fileName(f)!==b.name)fail();
  const bytes=await bytesOf(f);
  try{
   if(bytes.length!==b.size||await digest(bytes)!==b.sha)fail();
   current(t,s);if(bound[which]!==b)fail();
   return {file:f,name:b.name,sha256:b.sha,sizeBytes:b.size};
  }finally{bytes.fill(0)}
 }
 async function write(which,bytes,expectedSha){
  const t=epoch,s=source,dir=root;
  if(!s||!dir||bound[which]||!['backup','edited'].includes(which)||
    !(bytes instanceof Uint8Array)||!size(bytes.length)||!sha(expectedSha))fail();
  if(await digest(bytes)!==expectedSha)fail();current(t,s);
  if(which==='backup'&&(expectedSha!==s.sha||bytes.length!==s.size))fail();
  if(which==='edited'&&(!bound.backup||expectedSha===s.sha))fail();
  // Per-operation random name, collision checked; never open original.
  const name='wand-'+(which==='backup'?'original-backup':'edited-copy')+'-'+nonce()+'.p1g';
  if(!safe(name)||same(name,s.name)||Object.values(bound).some(b=>same(b.name,name)))fail();
  // Same-origin cooperative lock prevents competing Wand writers from
  // opening the same name between existence check and create.
  const perform=async()=>{
   current(t,s);
   try{await dir.getFileHandle(name);fail()}catch(e){if(e?.name!=='NotFoundError')throw e}
   current(t,s);
   const handle=await dir.getFileHandle(name,{create:true});let writer;
   try{
    current(t,s);writer=await handle.createWritable();current(t,s);
    await writer.write(bytes);current(t,s);await writer.close();writer=null;current(t,s);
    const f=await handle.getFile();current(t,s);
    const readback=await bytesOf(f);
    try{if(fileName(f)!==name||readback.length!==bytes.length||await digest(readback)!==expectedSha)fail();current(t,s)}
    finally{readback.fill(0)}
    const b=Object.freeze({name,sha:expectedSha,size:bytes.length});
    if(bound[which])fail();bound[which]=b;return b;
   }catch(e){
    if(writer)try{await writer.abort()}catch{}
    // A completed original backup is never deleted on close or later error.
    // Only this uncommitted newly allocated name is eligible for cleanup.
    if(!bound[which]||bound[which].name!==name)try{await dir.removeEntry(name)}catch{}
    throw e;
   }
  };
  if(!globalThis.navigator?.locks?.request)fail();
  return navigator.locks.request('wand-encrypted-copy:'+name,perform);
 }
 async function backupOriginal(){
  const t=epoch,s=source;if(!s)fail();const bytes=await bytesOf(s.file);
  try{current(t,s);return await write('backup',bytes,s.sha)}finally{bytes.fill(0)}
 }
 async function durable(binding){
  const t=epoch,s=source;
  if(!s||!binding||Object.keys(binding).sort().join(',')!=='originalName,originalSha256,originalSizeBytes'||
   binding.originalName!==s.name||binding.originalSha256!==s.sha||binding.originalSizeBytes!==s.size)fail();
  const r=await read('backup');current(t,s);return r.file;
 }
 async function download(which){
  const t=epoch,s=source;const r=await read(which);current(t,s);
  const encryptedBytes=await bytesOf(r.file);
  try{
   current(t,s);
   if(encryptedBytes.length!==r.sizeBytes||await digest(encryptedBytes)!==r.sha256)fail();
   current(t,s);
   // Ownership transfers only after final generation/receipt verification.
   return {kind:'VERIFIED_DOWNLOAD',name:r.name,sha256:r.sha256,sizeBytes:r.sizeBytes,encryptedBytes};
  }catch(e){
   // Late stale epoch, digest error, or size/SHA mismatch never returns
   // this Worker-private allocation to the caller's existing cleanup.
   encryptedBytes.fill(0);
   throw e;
  }
 }
 return Object.freeze({open,close,backupOriginal,durable,writeEdited:(bytes,sha)=>write('edited',bytes,sha),download});
}
