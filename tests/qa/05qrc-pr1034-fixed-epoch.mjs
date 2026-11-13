// Independent synthetic-only lifecycle integrity regression. Actual Rust WASM and official Codec.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,open,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createP1gRustWorkerReadOnlyBridge as create} from '../../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {p1gPackagedProfileCodec as codec} from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const pkg=resolve(process.argv[2]),glue=await import(pathToFileURL(join(pkg,'ddv_save_core.js')).href);
glue.initSync({module:new WebAssembly.Module(await readFile(join(pkg,'ddv_save_core_bg.wasm')))});
const sha=x=>createHash('sha256').update(x).digest('hex');
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const meta={codecVersion:'p1g-packaged-profile-codec@1',profileVersion:626,zip:{entryCount:1,profileEntryCount:1,archiveComment:new Uint8Array(),profileEntry:{compressType:0,extra:new Uint8Array(),comment:new Uint8Array(),flagBits:0,dosTime:0,dosDate:33,extractVersion:20,createSystem:0,createVersion:20,internalAttr:0,externalAttr:0}}};
const raw=n=>JSON.stringify({GameInfo:{Version:626},World:{},Player:{ListInventories:{'0':{ID:0,CompatibleItemType:'ItemType_Furniture',CompatibleFurnitureTypes:{List:['FurnitureItemType_Default']},Inventory:{'40000001':{Amount:n,Unknown:['🌿',null]},'40700001':{Amount:3}}}}},Unknown:{keep:'unchanged'}});
const inputs=await Promise.all([17,23,31].map(async n=>({n,text:raw(n),bytes:await codec.createEncodedProfile(raw(n),meta)})));
const cmd=n=>({kind:'InventoryExistingAmountDecrease',inventoryId:0,canonicalItemId:40000001,compatibleItemType:'ItemType_Furniture',expectedOldAmount:n,newAmount:n-1});
const scope=r=>({sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const gate=()=>{let hit,release;const reached=new Promise(r=>hit=r),hold=new Promise(r=>release=r);return {hit,reached,hold,release}};
const wait=async g=>{let timer;try{await Promise.race([g.reached,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('QA_GATE_TIMEOUT')),8000)})])}finally{clearTimeout(timer)}};
const settled=p=>p.then(v=>({ok:true,v}),e=>({ok:false,error:e.message}));
const d=await mkdtemp(join(tmpdir(),'qa1034-fixed-'));const factory=async()=>({WorkerWasmSource:glue.WorkerWasmSource});
const persist=async({originalBytes,originalEncryptedSha256,originalEncryptedSizeBytes})=>{
 assert.equal(sha(originalBytes),originalEncryptedSha256);assert.equal(originalBytes.length,originalEncryptedSizeBytes);
 const p=join(d,'backup-'+originalEncryptedSha256);
 try{const f=await open(p,'wx',0o600);try{await f.writeFile(originalBytes);await f.sync()}finally{await f.close()}}catch(e){if(e.code!=='EEXIST')throw e}
 const b=await readFile(p);return {backupReadbackVerified:true,sha256:sha(b),sizeBytes:b.length,editedCopyWillUseDifferentName:true};
};
const make=(verifyDurableBackupDev=persist)=>create(factory,{allowDevSemanticWriter:true,verifyDurableBackupDev});
const op=(b,i)=>b.openEncrypted({build,encryptedBytes:inputs[i].bytes});
const finish=async(b,i,r)=>{const s=b.devStageTypedAmounts(scope(r),[cmd(inputs[i].n)]);const out=await b.devCreateEncodedEditedOnce(scope(s));assert.equal(out.originalSha256,sha(inputs[i].bytes));assert.equal(out.editedSha256,sha(out.editedCiphertext));assert.equal((await codec.loadProfile(out.editedCiphertext)).jsonText,raw(inputs[i].n-1));assert.equal(out.writerAuthorized,false);assert.equal(out.independentProcessReopenVerified,false);await assert.rejects(()=>b.devCreateEncodedEditedOnce(scope(s)));return out};
const digest=crypto.subtle.digest.bind(crypto.subtle);
try{
 // Three independent epochs: A pending backup rejects late, B invalidated by C; C retains exact own receipt.
 const g=gate();let first=true;const a=make(async x=>{if(first){first=false;g.hit();await g.hold;throw Error('SYNTHETIC_BACKUP_CANCELLED')}return persist(x)});
 const ar=await op(a,0),as=a.devStageTypedAmounts(scope(ar),[cmd(17)]),p=settled(a.devCreateEncodedEditedOnce(scope(as)));
 try{await wait(g);const br=await op(a,1);const cr=await op(a,2);assert.notEqual(br.sessionId,cr.sessionId);g.release();
 const late=await p;assert.equal(late.ok,false);assert.match(late.error,/STALE/);assert.equal(a.getReceipt().sessionId,cr.sessionId);
 assert.throws(()=>a.devStageTypedAmounts(scope(br),[cmd(23)]));
 const out=await finish(a,2,cr);const path=join(d,'edited-distinct.p1g');const fd=await open(path,'wx',0o600);try{await fd.writeFile(out.editedCiphertext);await fd.sync()}finally{await fd.close()}
 const child=spawnSync(process.execPath,['--input-type=module','-e',"import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';const {p1gPackagedProfileCodec:c}=await import(process.argv[1]);const r=await c.loadProfile(await readFile(process.argv[2]));if(createHash('sha256').update(r.jsonText).digest('hex')!==process.argv[3])process.exit(4);",new URL('../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js',import.meta.url).href,path,out.stagedDecodedSha256],{timeout:10000,encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);console.log('QA1034_FIXED_THREE_EPOCH_LATE_BACKUP_REJECTION_REOPEN_PASS');
 }finally{g.release();await p;a.close()}
 // Actual final digest input: stale ciphertext is wiped after explicit close, no stale result escapes.
 const b=make(),r=await op(b,0),s=b.devStageTypedAmounts(scope(r),[cmd(17)]);
 const target=sha(await codec.createEncodedProfile(raw(16),meta));const h=gate();let captured=null;
 crypto.subtle.digest=async(alg,bytes)=>{if(!captured&&sha(bytes)===target){captured=bytes;const result=await digest(alg,bytes);h.hit();await h.hold;return result}return digest(alg,bytes)};
 const pending=settled(b.devCreateEncodedEditedOnce(scope(s)));
 try{await wait(h);assert(captured instanceof Uint8Array);assert(captured.some(v=>v!==0));b.close();h.release();const late=await pending;assert.equal(late.ok,false);assert.match(late.error,/STALE/);assert(captured.every(v=>v===0));assert.equal(b.getReceipt(),null);crypto.subtle.digest=digest;await finish(b,1,await op(b,1));console.log('QA1034_FIXED_STALE_CIPHERTEXT_WIPE_CLOSE_PASS')}
 finally{h.release();crypto.subtle.digest=digest;await pending;b.close()}
 // Invalid scope / failed backup before consume can retry exactly once; lock persists through asynchronous backup.
 const j=gate();let mode='deny',firstBackup=true;const c=make(async x=>{const receipt=await persist(x);if(mode==='deny')return {...receipt,sizeBytes:receipt.sizeBytes+1};if(firstBackup){firstBackup=false;j.hit();await j.hold}return receipt});
 const cr=await op(c,1),cs=c.devStageTypedAmounts(scope(cr),[cmd(23)]);
 await assert.rejects(()=>c.devCreateEncodedEditedOnce(scope(cs)),/BACKUP_NOT_CONFIRMED/);
 mode='ok';const cp=settled(c.devCreateEncodedEditedOnce({...scope(cs),revision:0}));
 try{await wait(j);await assert.rejects(()=>c.devCreateEncodedEditedOnce(scope(cs)),/EXPORT_IN_PROGRESS/);assert.throws(()=>c.devUndoTypedAmounts(scope(cs)),/EXPORT_IN_PROGRESS/);j.release();assert.equal((await cp).ok,false);assert.equal(c.getReceipt().revision,cs.revision);
 const out=await c.devCreateEncodedEditedOnce(scope(cs));assert.equal((await codec.loadProfile(out.editedCiphertext)).jsonText,raw(22));await assert.rejects(()=>c.devCreateEncodedEditedOnce(scope(cs)));console.log('QA1034_FIXED_PRECONSUME_RETRY_SERIAL_PASS')
 }finally{j.release();await cp;c.close()}
 for(const i of inputs){assert.equal(sha(i.bytes),sha(await codec.createEncodedProfile(i.text,meta)));const p=join(d,'backup-'+sha(i.bytes));assert.equal(sha(await readFile(p)),sha(i.bytes))}
 console.log('QA1034_FIXED_INDEPENDENT_3_GROUPS_PASS');
}finally{crypto.subtle.digest=digest;await rm(d,{recursive:true,force:true})}
