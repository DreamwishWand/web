// W-CORE-004 / W-LOCAL-019: optional Worker-ONLY P1G -> existing single
// Rust ProductSession READ_METADATA bridge. No second codec, session, reader,
// Writer, filesystem path, network, Cloud or UI Save payload response.
// DEV_READY synthetic testing only. Not imported by production Worker/UI.
import {p1gPackagedProfileCodec} from './p1g-packaged-profile-codec.js';
import {compareOriginalBackupBytes,originalBackupFileName} from './local-original-backup.mjs';
import {
  createProductWasmReadOwner,
  PRODUCT_WASM_CHUNK_MAX_BYTES,
  PRODUCT_WASM_WORKER_MAX_BYTES
} from './product-wasm-read-owner.mjs';

const MAX_ENCRYPTED_BYTES=128*1024*1024;
const MAX_TEXT_CODE_UNITS=Math.floor(PRODUCT_WASM_CHUNK_MAX_BYTES/3)-1;
const utf8=new TextEncoder();
const fail=code=>{throw Error(code)};
const exact=(obj,keys)=>obj!==null&&typeof obj==='object'&&
  !Array.isArray(obj)&&Object.keys(obj).sort().join(',')===keys.split(',').sort().join(',');

// TextEncoder.encode on <=349,524 UTF-16 code units yields <=1MiB bytes,
// even for unknown multibyte text. Do not split a surrogate pair across chunks.
// No full UTF-8 re-encoding/JSON object clone or postMessage to UI.
async function* decodedUtf8Chunks(text){
  if(typeof text!=='string'||text.length===0)fail('P1G_WORKER_DECODED_TEXT_REQUIRED');
  let offset=0,total=0;
  while(offset<text.length){
    let end=Math.min(text.length,offset+MAX_TEXT_CODE_UNITS);
    if(end<text.length){
      const last=text.charCodeAt(end-1);
      if(last>=0xD800&&last<=0xDBFF)end--;
    }
    if(end<=offset)fail('P1G_WORKER_UTF8_BOUNDARY');
    const chunk=utf8.encode(text.slice(offset,end));
    if(chunk.length===0||chunk.length>PRODUCT_WASM_CHUNK_MAX_BYTES)
      fail('P1G_WORKER_UTF8_CHUNK_BOUNDS');
    total+=chunk.length;
    if(total>PRODUCT_WASM_WORKER_MAX_BYTES)
      fail('P1G_WORKER_DECODED_SIZE_DENIED');
    yield chunk;
    offset=end;
  }
}
export function createP1gRustWorkerReadOnlyBridge(wasmFactory,{allowScopedAmountSource=false,allowScopedCollectionSource=false,allowCollectionCandidateSource=false,allowSwitch626ChestSource=false,allowSteam626ChestSource=false,allowSwitch626Catalog0Source=false,placementScope=null,backpackScope=null,wardrobeScope=null,portableScope=null,readDurableOriginalBackup=null}={}){
  const amountEnabled=allowScopedAmountSource===true||allowSwitch626ChestSource===true||allowSteam626ChestSource===true||allowSwitch626Catalog0Source===true;
  const portableEnabled=portableScope!==null,placementEnabled=placementScope!==null,backpackEnabled=backpackScope!==null,wardrobeEnabled=wardrobeScope!==null;
  const scopedEnabled=amountEnabled||allowScopedCollectionSource===true||placementEnabled||backpackEnabled||wardrobeEnabled||portableEnabled;
  // Constructor itself enforces Worker-only (document must be absent).
  const rust=createProductWasmReadOwner(wasmFactory,{allowScopedAmountSource,allowScopedCollectionSource,allowCollectionCandidateSource,allowSwitch626ChestSource,allowSteam626ChestSource,allowSwitch626Catalog0Source,placementScope,backpackScope,wardrobeScope,portableScope});
  let epoch=0,scopedSource=null,scopedMetadata=null,backupMatched=false,scopedBusy=false,durableName=null,collectionCloseUnverified=false;
  const resetScoped=()=>{scopedSource=null;scopedMetadata=null;backupMatched=false;scopedBusy=false;durableName=null};
  const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
  const closeRust=()=>{
    try{const ack=rust.close();collectionCloseUnverified=false;return ack}
    catch(e){if(allowScopedCollectionSource===true||allowSwitch626ChestSource===true||allowSteam626ChestSource===true||allowSwitch626Catalog0Source===true||placementEnabled||backpackEnabled||wardrobeEnabled||portableEnabled)collectionCloseUnverified=true;throw e}
  };
  const close=()=>{
    epoch++;resetScoped();
    return closeRust();
  };
  const openEncrypted=async args=>{
    // A is synchronously invalidated before validating/decoding B.
    if(collectionCloseUnverified)fail('P1G_WORKER_COLLECTION_CLOSE_UNVERIFIED');
    const token=++epoch;
    resetScoped();closeRust();
    if(!exact(args,'build,encryptedBytes')||
       !(args.encryptedBytes instanceof Uint8Array)||
       args.encryptedBytes.byteLength===0||
       args.encryptedBytes.byteLength>MAX_ENCRYPTED_BYTES)
       fail('P1G_WORKER_INPUT_DENIED');
    const {build,encryptedBytes}=args;
    // This is an EXTERNAL candidate claim, never inferred from P1G schema.
    if(!build||build.externallyConfirmed!==true||build.schema!==626)
      fail('P1G_WORKER_EXTERNAL_BUILD_REQUIRED');
    const isolated=new Uint8Array(encryptedBytes);
    try{
      const decoded=await p1gPackagedProfileCodec.loadProfile(isolated);
      if(token!==epoch)fail('P1G_WORKER_OPEN_REVOKED');
      if(decoded.metadata?.profileVersion!==626)
        fail('P1G_WORKER_PROFILE_SCHEMA_MISMATCH');
      // Only the existing Rust owner creates/mints the authoritative
      // ProductSession and performs strict whole-document validation.
      const receipt=await rust.openDecoded({
        build,decodedChunks:decodedUtf8Chunks(decoded.jsonText)
      });
      if(token!==epoch)fail('P1G_WORKER_OPEN_REVOKED');
      if(receipt.schema!==626||
         receipt.fullDocumentJsonValidated!==true||
         receipt.allDomainReferencesVerified!==false||
         receipt.productReadAccepted!==false||
         receipt.writerAuthorized!==false||
         receipt.editedCopyAuthorized!==false||
         receipt.applyAuthorized!==false){
         close();
         fail('P1G_WORKER_RUST_GATE_VIOLATION');
      }
      if(scopedEnabled)scopedMetadata=decoded.metadata;
      return Object.freeze({
        ...receipt,
        decodedByExistingP1gCodec:true,
        sourceOperation:'DEV_READY_READ_ONLY',
        externalPhysicalBuildVerified:false
      });
    }catch(e){
      // A's stale rejection must never kill newer B.
      if(token===epoch)closeRust();
      if(e instanceof Error&&(/^P1G_WORKER_|^PRODUCT_WORKER_/).test(e.message))
        throw e;
      fail('P1G_WORKER_CODEC_OR_RUST_REJECTED');
    }finally{
      isolated.fill(0); // never zero the caller's original bytes
    }
  };
  const scopedReady=()=>{if(!scopedEnabled||!scopedSource||!scopedMetadata||scopedBusy)
    fail('P1G_WORKER_SCOPED_SOURCE_OFF');return scopedSource};
  // Explicit local File; ordinary public read-only API remains unchanged.
  const openScopedEncrypted=async args=>{
    if(collectionCloseUnverified)fail('P1G_WORKER_COLLECTION_CLOSE_UNVERIFIED');
    close();const token=epoch;
    if(!scopedEnabled||!exact(args,'file,build,originalSha256')||
       !(args.file instanceof File)||!(portableEnabled?args.build?.platform===(portableScope.startsWith('switch-')?'switch':'steam-windows'):wardrobeEnabled?args.build?.platform===(wardrobeScope==='switch'?'switch':'steam-windows'):backpackEnabled?args.build?.platform===(backpackScope==='switch'?'switch':'steam-windows'):(allowSwitch626ChestSource===true||allowSwitch626Catalog0Source===true||placementScope==='rm01')?args.build?.platform==='switch':(args.build?.platform==='steam-windows'||(allowScopedCollectionSource===true&&args.build?.platform==='switch')))||
       typeof args.originalSha256!=='string'||!(/^[0-9a-f]{64}$/).test(args.originalSha256))
      fail('P1G_WORKER_SCOPED_INPUT_DENIED');
    const {file,build,originalSha256}=args;
    const size=Object.getOwnPropertyDescriptor(Blob.prototype,'size').get.call(file);
    const name=Object.getOwnPropertyDescriptor(File.prototype,'name').get.call(file);
    if(size<16||size>MAX_ENCRYPTED_BYTES||size%16||!name.toLowerCase().endsWith('.p1g'))
      fail('P1G_WORKER_SCOPED_INPUT_DENIED');
    let bytes;
    try{
      bytes=new Uint8Array(await Blob.prototype.arrayBuffer.call(file));
      if(token!==epoch||bytes.length!==size||await hash(bytes)!==originalSha256||token!==epoch)
        fail('P1G_WORKER_SCOPED_INPUT_DENIED');
      const opened=openEncrypted({build,encryptedBytes:bytes}),opening=epoch;
      const receipt=await opened;
      if(opening!==epoch)fail('P1G_WORKER_OPEN_REVOKED');
      scopedSource=Object.freeze({file,sha:originalSha256,size,name});
      return Object.freeze({sourceShaMatched:true,originalSizeMatched:true,fullDocumentValidated:receipt.fullDocumentJsonValidated,
        writerAuthorized:false,editedCopyAuthorized:false});
    }finally{if(bytes)bytes.fill(0)}
  };
  const verifyScopedOriginalBackup=async candidate=>{
    const source=scopedReady(),token=epoch;backupMatched=false;scopedBusy=true;
    const current=()=>token===epoch&&scopedSource===source;
    try{
      if(!current())fail('P1G_WORKER_OPEN_REVOKED');
      await compareOriginalBackupBytes(source.file,candidate,current,MAX_ENCRYPTED_BYTES);
      if(!current())fail('P1G_WORKER_OPEN_REVOKED');
      backupMatched=true;
      return Object.freeze({candidateBytesMatchOriginal:true,persistedVerified:false,distinctDiskPathVerified:false,writerAuthorized:false});
    }finally{if(current())scopedBusy=false}
  };
  const requireBackup=()=>{scopedReady();if(!backupMatched)fail('P1G_WORKER_SCOPED_BACKUP_REQUIRED')};
  const scopedCall=fn=>{requireBackup();try{return fn()}catch(e){close();throw e}};
  const discoverScopedTargets=profile=>scopedCall(()=>rust.discoverScopedTargets(profile));
  const previewScopedAmount=selection=>scopedCall(()=>rust.previewScopedAmount(selection));
  const previewScopedPlacement=selection=>scopedCall(()=>rust.previewScopedPlacement(selection));
  const previewScopedBackpack=selection=>scopedCall(()=>rust.previewScopedBackpack(selection));
  const capturePortableBackup=t=>scopedCall(()=>rust.capturePortableBackup(t));
  const previewPortableRestore=(t,b)=>scopedCall(()=>rust.previewPortableRestore(t,b));
  const previewScopedWardrobe=(...args)=>scopedCall(()=>rust.previewScopedWardrobe(...args));
  // Fixed preview may inspect the active source before durable Backup; the
  // Stage/Undo/Redo/Export boundary below remains backup-gated.
  const inspectFixedCollection=selector=>{
    scopedReady();try{return rust.previewFixedCollection(selector)}catch(e){close();throw e}
  };
  const previewFixedCollection=selector=>scopedCall(()=>rust.previewFixedCollection(selector));
  // The provider is a trusted Worker constructor dependency, never a message
  // field. User-selected candidate bytes alone do not prove durable backup.
  const verifyDurable=async(source,current,expectedName=null)=>{
    if(typeof readDurableOriginalBackup!=='function'||!current())
      fail('P1G_WORKER_SCOPED_DURABLE_BACKUP_REQUIRED');
    const file=await readDurableOriginalBackup(Object.freeze({
      originalName:source.name,originalSha256:source.sha,originalSizeBytes:source.size}));
    if(!current()||!(file instanceof File))fail('P1G_WORKER_SCOPED_DURABLE_BACKUP_REQUIRED');
    const name=Object.getOwnPropertyDescriptor(File.prototype,'name').get.call(file);
    if(!/^[A-Za-z0-9._-]+\.p1g$/i.test(name)||name.toLowerCase()===source.name.toLowerCase()||
       (expectedName!==null&&name!==expectedName))fail('P1G_WORKER_SCOPED_DURABLE_BACKUP_REQUIRED');
    await compareOriginalBackupBytes(source.file,file,current,MAX_ENCRYPTED_BYTES);
    if(!current())fail('P1G_WORKER_OPEN_REVOKED');
    return name;
  };
  const stageScoped=async()=>{
    requireBackup();const source=scopedSource,token=epoch;scopedBusy=true;
    const current=()=>token===epoch&&scopedSource===source;
    try{
      const name=await verifyDurable(source,current);
      if(!current())fail('P1G_WORKER_OPEN_REVOKED');
      const r=portableEnabled?rust.stagePortableRestore():wardrobeEnabled?rust.stageScopedWardrobe():backpackEnabled?rust.stageScopedBackpack():placementEnabled?rust.stageScopedPlacement():allowScopedCollectionSource===true?rust.stageFixedCollection():rust.stageScopedAmount();durableName=name;return r;
    }catch(e){if(current())close();throw e}
    finally{if(current())scopedBusy=false}
  };
  const toggleScoped=redo=>scopedCall(()=>{
    if(!durableName)fail('P1G_WORKER_SCOPED_DURABLE_BACKUP_REQUIRED');
    return portableEnabled?rust.togglePortableRestore(redo):wardrobeEnabled?rust.toggleScopedWardrobe(redo):backpackEnabled?rust.toggleScopedBackpack(redo):placementEnabled?rust.toggleScopedPlacement(redo):allowScopedCollectionSource===true?rust.toggleFixedCollection(redo):rust.toggleScopedAmount(redo);
  });
  const exportScopedEditedCopy=async()=>{
    requireBackup();const source=scopedSource,metadata=scopedMetadata,token=epoch;
    scopedBusy=true;let decoded,encrypted;
    const current=()=>token===epoch&&scopedSource===source;
    try{
      if(!durableName)fail('P1G_WORKER_SCOPED_DURABLE_BACKUP_REQUIRED');
      await verifyDurable(source,current,durableName);
      if(!current())fail('P1G_WORKER_OPEN_REVOKED');
      const result=await (portableEnabled?rust.takePortableRestoreOutput():wardrobeEnabled?rust.takeScopedWardrobeOutput():backpackEnabled?rust.takeScopedBackpackOutput():placementEnabled?rust.takeScopedPlacementOutput():allowScopedCollectionSource===true?rust.takeFixedCollectionOutput():rust.takeScopedAmountOutput());decoded=result.decodedBytes;
      if(!current())fail('P1G_WORKER_OPEN_REVOKED');
      const text=new TextDecoder('utf-8',{fatal:true}).decode(decoded);
      encrypted=await p1gPackagedProfileCodec.createEncodedProfile(text,metadata);
      if(!current()||!(encrypted instanceof Uint8Array)||encrypted.length<16||encrypted.length>MAX_ENCRYPTED_BYTES)
        fail('P1G_WORKER_SCOPED_OUTPUT_DENIED');
      const reopened=await p1gPackagedProfileCodec.loadProfile(encrypted);
      const reopenedSha=await hash(new TextEncoder().encode(reopened.jsonText));
      const editedSha=await hash(encrypted);
      if(!current()||reopenedSha!==result.decodedSha256||editedSha===source.sha)
        fail('P1G_WORKER_SCOPED_OUTPUT_DENIED');
      if(!current())fail('P1G_WORKER_OPEN_REVOKED');
      const backupName=originalBackupFileName(source.name);
      const name=backupName.slice(0,-'.original-backup.p1g'.length)+'.edited-copy.p1g';
      if(name.toLowerCase()===source.name.toLowerCase()||name===backupName||name.toLowerCase()===durableName.toLowerCase())fail('P1G_WORKER_SCOPED_OUTPUT_DENIED');
      // Only encrypted bytes leave the Worker-private codec path. No public
      // router/automatic download. Same-process reopen != independent OS V2.
      const out=Object.freeze({name,encryptedBytes:encrypted,sha256:editedSha,sizeBytes:encrypted.length,decodedSha256:result.decodedSha256,
        codecReopenVerified:true,independentProcessReopenVerified:false,writerAuthorized:false,originalOverwriteAuthorized:false});
      // Never return an output receipt when final cleanup was unverified.
      if(current())close();encrypted=null;return out;
    }finally{if(decoded)decoded.fill(0);if(encrypted)encrypted.fill(0);if(current())close()}
  };
  return Object.freeze({
    openEncrypted,close,
    ...(scopedEnabled?{openScopedEncrypted,verifyScopedOriginalBackup,exportScopedEditedCopy}:{}),
    ...(amountEnabled?{discoverScopedTargets,previewScopedAmount,stageScopedAmount:stageScoped,toggleScopedAmount:toggleScoped}:{}),
    ...(portableEnabled?{capturePortableBackup,previewPortableRestore,stagePortableRestore:stageScoped,togglePortableRestore:toggleScoped}:{}),
    ...(wardrobeEnabled?{previewScopedWardrobe,stageScopedWardrobe:stageScoped,toggleScopedWardrobe:toggleScoped}:{}),
    ...(backpackEnabled?{previewScopedBackpack,stageScopedBackpack:stageScoped,toggleScopedBackpack:toggleScoped}:{}),
    ...(placementScope==='comp03-spatial'?{spatialPreview:(...args)=>scopedCall(()=>{if(args.length)fail('P1G_WORKER_SCOPED_PLACEMENT_ARGS');return rust.spatialPreview()})}:{}),
     ...(placementEnabled?{previewScopedPlacement,stageScopedPlacement:stageScoped,toggleScopedPlacement:toggleScoped}:{}),
    ...(allowScopedCollectionSource===true?{inspectFixedCollection,previewFixedCollection,stageFixedCollection:stageScoped,toggleFixedCollection:toggleScoped}:{}),
    ...(allowCollectionCandidateSource===true?{readCollectionCandidate:selector=>rust.readCollectionCandidate(selector)}:{}),
    readCoreVersion:scope=>rust.readCoreVersion(scope),
    issueTypedCursor:(scope,domain)=>rust.issueTypedCursor(scope,domain),
    readTypedPage:(scope,cursor)=>rust.readTypedPage(scope,cursor),
    // Internal Worker-only, sanitized Rust-sourced stored metadata; no raw body.
    issueSavedDiffGridsCursor:scope=>rust.issueSavedDiffGridsCursor(scope),
    readSavedDiffGridsPage:(scope,cursor)=>rust.readSavedDiffGridsPage(scope,cursor),
    getReceipt:()=>rust.getReceipt(),
    getCapabilities:()=>Object.freeze({
      ...rust.getCapabilities(),
      p1gWorkerReadOnlyBridge:true,
      productReadAccepted:false,writerAuthorized:false,
      canReadTypedMetadataInProduct:false,
      canExportEditedCopy:false,canApply:false
    })
  });
}
