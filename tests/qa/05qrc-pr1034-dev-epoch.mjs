// Independent synthetic actual WASM/Codec. Delay real digest completion only.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,open,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createP1gRustWorkerReadOnlyBridge as create} from '../../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
import {p1gPackagedProfileCodec as codec} from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const pkg=resolve(process.argv[2]),glue=await import(pathToFileURL(join(pkg,'ddv_save_core.js')).href);
glue.initSync({module:new WebAssembly.Module(await readFile(join(pkg,'ddv_save_core_bg.wasm')))});
const sha=x=>createHash('sha256').update(x).digest('hex');
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const meta={codecVersion:'p1g-packaged-profile-codec@1',profileVersion:626,zip:{entryCount:1,profileEntryCount:1,archiveComment:new Uint8Array(),profileEntry:{compressType:0,extra:new Uint8Array(),comment:new Uint8Array(),flagBits:0,dosTime:0,dosDate:33,extractVersion:20,createSystem:0,createVersion:20,internalAttr:0,externalAttr:0}}};
const raw=String.raw`{"GameInfo":{"Version":626},"World":{},"Player":{"ListInventories":{"0":{"ID":0,"CompatibleItemType":"ItemType_Furniture","CompatibleFurnitureTypes":{"List":["FurnitureItemType_SnippetTrap"]},"Inventory":{"40000001":{"Amount":8},"40900001":{"Amount":12, "Unknown":[null,"🌿"]}}}}},"Unknown":{"Keep":true}}`;
const enc=await codec.createEncodedProfile(raw,meta),hash=sha(enc),cmd={kind:'InventoryExistingAmountDecrease',inventoryId:0,canonicalItemId:40900001,compatibleItemType:'ItemType_Furniture',expectedOldAmount:12,newAmount:11};
const scope=r=>({sessionId:r.sessionId,revision:r.revision,indexGeneration:r.indexGeneration,decodedSha256:r.decodedSha256});
const root=await mkdtemp(join(tmpdir(),'qa1034-'));const factory=async()=>({WorkerWasmSource:glue.WorkerWasmSource});
const make=()=>create(factory,{allowDevSemanticWriter:true,verifyDurableBackupDev:async({originalBytes,originalEncryptedSha256,originalEncryptedSizeBytes})=>{assert.equal(sha(originalBytes),originalEncryptedSha256);const p=join(root,'backup-'+originalEncryptedSha256);try{const f=await open(p,'wx',0o600);try{await f.writeFile(originalBytes);await f.sync()}finally{await f.close()}}catch(e){if(e.code!=='EEXIST')throw e}const d=await readFile(p);return {backupReadbackVerified:true,sha256:sha(d),sizeBytes:d.length,editedCopyWillUseDifferentName:true}}});
const op=(b,encryptedBytes=enc)=>b.openEncrypted({build,encryptedBytes});
const orig=crypto.subtle.digest.bind(crypto.subtle);
const pauseDigest=target=>{let release,reached;const hold=new Promise(r=>release=r),hit=new Promise(r=>reached=r);let seen=false;crypto.subtle.digest=async(alg,bytes)=>{if(!seen&&sha(bytes)===target){seen=true;reached();await hold}return orig(alg,bytes)};return {release,hit};};
const settle=p=>p.then(v=>({ok:true,v}),e=>({ok:false,error:e.message}));
const errors=[];
try{
 const b=make(),r=await op(b);
 assert.throws(()=>b.devStageTypedAmounts(scope(r),[{...cmd,canonicalItemId:40000001,expectedOldAmount:8,newAmount:7}]));
 const s=b.devStageTypedAmounts(scope(r),[cmd]),out=await b.devCreateEncodedEditedOnce(scope(s));
 assert.equal((await codec.loadProfile(out.editedCiphertext)).jsonText,raw.replace('"Amount":12','"Amount":11'));
 assert.equal(sha(enc),hash);assert.equal(sha(await readFile(join(root,'backup-'+hash))),hash);
 console.log('QA1034_POSITIVE_EXACT_TOKEN_BACKUP_PASS');
 const rawB=raw.replace('"Amount":12','"Amount":14'),encB=await codec.createEncodedProfile(rawB,meta),cmdB={...cmd,expectedOldAmount:14,newAmount:13};
 const a=make(),ar=await op(a),st=a.devStageTypedAmounts(scope(ar),[cmd]);
 const g=pauseDigest(out.editedSha256),pending=settle(a.devCreateEncodedEditedOnce(scope(st)));await g.hit;
 const br=await op(a,encB);g.release();const stale=await pending;crypto.subtle.digest=orig;
 let bstage;try{bstage=a.devStageTypedAmounts(scope(br),[cmdB])}catch(e){bstage=e.message}
 console.log('QA1034_EXPORT_RACE',JSON.stringify({staleReturned:stale.ok,newSessionStage:typeof bstage==='string'?bstage:'PASS',staleOriginalHashMatchesA:stale.ok&&stale.v.originalSha256===hash}));
 if(stale.ok||typeof bstage==='string')errors.push('EXPORT_FINAL_DIGEST_EPOCH');a.close();
 const q=make(),h=pauseDigest(sha(raw)),pa=settle(op(q));await h.hit;
 const rb=await op(q,encB);h.release();const late=await pa;crypto.subtle.digest=orig;
 let qb;try{qb=q.devStageTypedAmounts(scope(rb),[cmdB])}catch(e){qb=e.message}
 console.log('QA1034_OPEN_RACE',JSON.stringify({oldRejected:!late.ok,newSessionStage:typeof qb==='string'?qb:'PASS'}));
 if(late.ok||typeof qb==='string')errors.push('OPEN_DIGEST_STALE_CLEAR');q.close();
 assert.equal(sha(enc),hash);assert.deepEqual(errors,[],'QA1034_TRUE_RED '+errors.join(','));
}finally{crypto.subtle.digest=orig;await rm(root,{recursive:true,force:true})}
