// Synthetic-only DEV contract regression; no private Save, key, or generated binary.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createP1gRustWorkerReadOnlyBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const pkg=resolve(process.argv[2]??'tests/stage-e/pkg');
const glue=await import(pathToFileURL(join(pkg,'ddv_save_core.js')).href);
const wasm=await readFile(join(pkg,'ddv_save_core_bg.wasm'));
glue.initSync({module:new WebAssembly.Module(wasm)});
const sha=b=>createHash('sha256').update(b).digest('hex');
const build={platform:'steam-windows',buildKind:'steam-full-version',
 buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const metadata={codecVersion:'p1g-packaged-profile-codec@1',profileVersion:626,
 zip:{entryCount:1,profileEntryCount:1,archiveComment:new Uint8Array(),
 profileEntry:{compressType:0,extra:new Uint8Array(),comment:new Uint8Array(),flagBits:0,
 dosTime:0,dosDate:33,extractVersion:20,createSystem:0,createVersion:20,internalAttr:0,externalAttr:0}}};
const root={GameInfo:{Version:626},World:{},Player:{ListInventories:{
 '0':{ID:0,CompatibleItemType:'ItemType_Furniture',CompatibleFurnitureTypes:{List:['FurnitureItemType_Default']},
 Inventory:{'40000001':{Amount:7,Marker:'Keep',Unknown:{a:1}},'40700001':{Amount:5}}}}},
 Unknown:{keep:'🌿'}};
const originalText=JSON.stringify(root), input=await codec.createEncodedProfile(originalText,metadata), originalSha=sha(input);
const scope=r=>({sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const cmd={kind:'InventoryExistingAmountDecrease',inventoryId:0,canonicalItemId:40000001,
 compatibleItemType:'ItemType_Furniture',expectedOldAmount:7,newAmount:6};
const d=await mkdtemp(join(tmpdir(),'wand-official-zero-'));
try{
 const original=join(d,'original.p1g'),backup=join(d,'backup.p1g'),edited=join(d,'edited-copy.p1g');
 await writeFile(original,input,{flag:'wx',mode:0o600});
 let created=false,allowBackup=true;
 const bridge=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:glue.WorkerWasmSource}),{
  allowDevSemanticWriter:true,verifyDurableBackupDev:async({originalBytes,originalEncryptedSha256,originalEncryptedSizeBytes})=>{
   assert.equal(sha(originalBytes),originalSha);
   if(!allowBackup)return {backupReadbackVerified:false,sha256:originalEncryptedSha256,
    sizeBytes:originalEncryptedSizeBytes,editedCopyWillUseDifferentName:true};
   if(!created){const f=await open(backup,'wx',0o600);try{await f.writeFile(originalBytes);await f.sync()}finally{await f.close()}created=true;}
   const b=await readFile(backup);
   return {backupReadbackVerified:sha(b)===originalEncryptedSha256&&b.length===originalEncryptedSizeBytes,
    sha256:sha(b),sizeBytes:b.length,editedCopyWillUseDifferentName:true};
 }});
 const r=await bridge.openEncrypted({build,encryptedBytes:input});
 assert.equal(r.writerAuthorized,false);assert.equal(r.decodedSha256,sha(originalText));
 for(const bad of [
  {...cmd,inventoryId:-1},{...cmd,compatibleItemType:'ItemType_ActivityItem'},
  {...cmd,canonicalItemId:0},{...cmd,canonicalItemId:40700001,expectedOldAmount:5,newAmount:4},
  {...cmd,expectedOldAmount:8},{...cmd,newAmount:0},{...cmd,newAmount:8},
 ])assert.throws(()=>bridge.devStageTypedAmounts(scope(r),[bad]));
 assert.throws(()=>bridge.devStageTypedAmounts({...scope(r),revision:1},[cmd]));
 assert.throws(()=>bridge.devStageTypedAmounts({...scope(r),decodedSha256:'a'.repeat(64)},[cmd]));
 const wrong=createP1gRustWorkerReadOnlyBridge(async()=>({WorkerWasmSource:glue.WorkerWasmSource}));
 await assert.rejects(()=>wrong.openEncrypted({build:{...build,schema:624},encryptedBytes:input}));
 const st=bridge.devStageTypedAmounts(scope(r),[cmd]);assert.equal(st.operationCount,1);
 assert.equal(st.writerAuthorized,false);assert.throws(()=>bridge.devStageTypedAmounts(scope(r),[cmd]));
 const undo=bridge.devUndoTypedAmounts(scope(st));assert.equal(undo.applied,false);
 await assert.rejects(()=>bridge.devCreateEncodedEditedOnce(scope(undo)));
 const redo=bridge.devRedoTypedAmounts(scope(undo));assert.equal(redo.applied,true);
 allowBackup=false;await assert.rejects(()=>bridge.devCreateEncodedEditedOnce(scope(redo)));
 assert.equal(sha(await readFile(backup)),originalSha);allowBackup=true;
 const result=await bridge.devCreateEncodedEditedOnce(scope(redo));
 assert.equal(result.writerAuthorized,false);assert.equal(result.nativeV3Verified,false);
 const f=await open(edited,'wx',0o600);try{await f.writeFile(result.editedCiphertext);await f.sync()}finally{await f.close()}
 const disk=await readFile(edited);assert.equal(sha(disk),result.editedSha256);
 const decoded=await codec.loadProfile(disk);assert.equal(decoded.jsonText,originalText.replace('"Amount":7','"Amount":6'));
 const child=spawnSync(process.execPath,['--input-type=module','-e',
  "import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';const {p1gPackagedProfileCodec:c}=await import(process.argv[1]);const p=await c.loadProfile(await readFile(process.argv[2]));if(createHash('sha256').update(p.jsonText).digest('hex')!==process.argv[3])process.exit(4);console.log('FRESH_OS_REOPEN_PASS');",
  new URL('../src/lib/ddv/core/save/p1g-packaged-profile-codec.js',import.meta.url).href,edited,result.stagedDecodedSha256],
  {encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr);assert.match(child.stdout,/FRESH_OS_REOPEN_PASS/);
 assert.equal(sha(await readFile(backup)),originalSha);assert.equal(sha(await readFile(original)),originalSha);
 assert.equal(sha(input),originalSha);await assert.rejects(()=>bridge.devCreateEncodedEditedOnce(scope(redo)));
 console.log('ACT401_SYNTHETIC_ZERO_ROUTE_EXACT_ONE_TOKEN_CAS_UNDO_REDO_BACKUP_FRESH_OS_REOPEN_PASS');

 // Deterministic actual WebCrypto/Codec scheduling, never mock Rust/codec.
 const bText=originalText.replace('"Amount":7','"Amount":9');
 const bInput=await codec.createEncodedProfile(bText,metadata), bSha=sha(bInput);
 const bCmd={...cmd,expectedOldAmount:9,newAmount:8};
 const nativeDigest=crypto.subtle.digest.bind(crypto.subtle);
 const gate=()=>{let hit,release;const reached=new Promise(r=>hit=r),hold=new Promise(r=>release=r);return {hit,reached,release,hold}};
 const reached=async g=>{
   let timer;try{await Promise.race([g.reached,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('EPOCH_TEST_GATE_NOT_REACHED')),8000)})])}
   finally{clearTimeout(timer)}
 };
 const digestGate=(expected,nth=1)=>{
   const g=gate();let seen=0;
   crypto.subtle.digest=async(alg,bytes)=>{
     if(sha(bytes)===expected&&++seen===nth){g.hit();await g.hold}
     return nativeDigest(alg,bytes);
   };
   return g;
 };
 const settled=p=>p.then(v=>({ok:true,v}),e=>({ok:false,error:e.message}));
 const persist=async({originalBytes,originalEncryptedSha256,originalEncryptedSizeBytes})=>{
   assert.equal(sha(originalBytes),originalEncryptedSha256);
   const p=join(d,'race-backup-'+originalEncryptedSha256);
   try{const f=await open(p,'wx',0o600);try{await f.writeFile(originalBytes);await f.sync()}finally{await f.close()}}
   catch(e){if(e.code!=='EEXIST')throw e}
   const bytes=await readFile(p);
   assert.equal(bytes.length,originalEncryptedSizeBytes);
   return {backupReadbackVerified:true,sha256:sha(bytes),sizeBytes:bytes.length,editedCopyWillUseDifferentName:true};
 };
 const make=(verifyDurableBackupDev=persist)=>createP1gRustWorkerReadOnlyBridge(
   async()=>({WorkerWasmSource:glue.WorkerWasmSource}),{allowDevSemanticWriter:true,verifyDurableBackupDev});
 const openA=b=>b.openEncrypted({build,encryptedBytes:input});
 const openB=b=>b.openEncrypted({build,encryptedBytes:bInput});
 const finishB=async(b,r)=>{
   assert.equal(b.getReceipt().sessionId,r.sessionId);
   const s=b.devStageTypedAmounts(scope(r),[bCmd]);
   const out=await b.devCreateEncodedEditedOnce(scope(s));
   assert.equal(out.originalSha256,bSha);
   assert.equal((await codec.loadProfile(out.editedCiphertext)).jsonText,bText.replace('"Amount":9','"Amount":8'));
   assert.equal(sha(out.editedCiphertext),out.editedSha256);
   await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(s)));
 };
 const raceDigest=async({kind,digest,nth=1,replace})=>{
   const b=make();
   const s=kind==='export'?b.devStageTypedAmounts(scope(await openA(b)),[cmd]):null;
   const g=digestGate(digest,nth);
   let pending;
   try{
     pending=settled(kind==='open'?openA(b):b.devCreateEncodedEditedOnce(scope(s)));
     await reached(g);
     const rb=replace?await openB(b):(b.close(),null);
     g.release();
     const old=await pending;
     assert.equal(old.ok,false,'STALE_ASYNC_RESULT_ESCAPED');
     assert.match(old.error,/REVOKED|STALE/);
     crypto.subtle.digest=nativeDigest;
     if(rb)await finishB(b,rb);
     else{assert.equal(b.getReceipt(),null);await finishB(b,await openB(b))}
   }finally{g.release();crypto.subtle.digest=nativeDigest;b.close();if(pending)await pending}
 };
 try{
   // Both OPEN hash awaits: newer replacement and explicit close.
   for(const digest of [sha(originalText),originalSha]){
     await raceDigest({kind:'open',digest,replace:true});
     await raceDigest({kind:'open',digest,replace:false});
   }
   // Decoded hash, independent same-Worker reopen hash, final cipher hash.
   const changedText=originalText.replace('"Amount":7','"Amount":6');
   for(const [digest,nth] of [[sha(changedText),1],[sha(changedText),2],[result.editedSha256,1]]){
     await raceDigest({kind:'export',digest,nth,replace:true});
     await raceDigest({kind:'export',digest,nth,replace:false});
   }
   // A pending backup cannot consume or clear B.
   for(const replace of [true,false]){
     const g=gate();let first=true;
     const b=make(async args=>{if(first){first=false;g.hit();await g.hold}return persist(args)});
     const s=b.devStageTypedAmounts(scope(await openA(b)),[cmd]);
     const p=settled(b.devCreateEncodedEditedOnce(scope(s)));
     try{await reached(g);const rb=replace?await openB(b):(b.close(),null);g.release();
       const old=await p;assert.equal(old.ok,false);assert.match(old.error,/STALE/);
       if(rb)await finishB(b,rb);else{assert.equal(b.getReceipt(),null);await finishB(b,await openB(b))}
     }finally{g.release();await p;b.close()}
   }
   // Serialize same-epoch export, stage/undo/redo during backup, then retry
   // after a pre-consume denial without losing the valid pending session.
   const g=gate();let first=true;
   const b=make(async args=>{if(first){first=false;g.hit();await g.hold}return persist(args)});
   const s=b.devStageTypedAmounts(scope(await openA(b)),[cmd]);
   const p=settled(b.devCreateEncodedEditedOnce(scope(s)));
   try{await reached(g);
     await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(s)),/EXPORT_IN_PROGRESS/);
     assert.throws(()=>b.devUndoTypedAmounts(scope(s)),/EXPORT_IN_PROGRESS/);
     assert.throws(()=>b.devRedoTypedAmounts(scope(s)),/EXPORT_IN_PROGRESS/);
     assert.throws(()=>b.devStageTypedAmounts(scope(s),[cmd]),/EXPORT_IN_PROGRESS/);
     g.release();const done=await p;assert.equal(done.ok,true);
     assert.equal(done.v.originalSha256,originalSha);
     assert.equal((await codec.loadProfile(done.v.editedCiphertext)).jsonText,changedText);
     await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(s)));
   }finally{g.release();await p;b.close()}
   assert.equal(sha(input),originalSha);assert.equal(sha(bInput),bSha);
   assert.equal(sha(await readFile(join(d,'race-backup-'+originalSha))),originalSha);
   assert.equal(sha(await readFile(join(d,'race-backup-'+bSha))),bSha);
   console.log('ACT401_DEV_EPOCH_OPEN2_EXPORT3_BACKUP_CLOSE_REPLACE_CONCURRENT_PASS');
 }finally{crypto.subtle.digest=nativeDigest}

}finally{await rm(d,{recursive:true,force:true})}
