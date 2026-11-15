// Synthetic actual Chrome OPFS + real opt-in Rust/P1G adapter. No UI/router or
// product authorization. Uses existing Stage F Chrome harness and fixture.
import {createProductScopedAmountLocalAdapter} from '../../src/lib/ddv/core/save/product-scoped-amount-local-adapter.mjs';
import {p1gPackagedProfileCodec} from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
const ensure=(x,c)=>{if(!x)throw Error('SCOPED_OPFS_'+c)};
const deny=async f=>{try{await f()}catch{return}throw Error('SCOPED_OPFS_UNEXPECTED_ACCEPT')};
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
export async function runScopedProductOpfs(WorkerWasmSource){
 let positive=0,negative=0;
 const root=await navigator.storage.getDirectory();
 for(const profile of ['catalog0-furniture','linked-crop-chest48']){
  const [p,j]=await Promise.all([fetch('./fixtures/'+profile+'.p1g'),fetch('./fixtures/'+profile+'.json')]);
  ensure(p.ok&&j.ok,'FIXTURE');const source=new Uint8Array(await p.arrayBuffer()),meta=await j.json();
  const file=new File([source],'synthetic.p1g'),s=meta.sel,chest=profile==='linked-crop-chest48';
  const id=chest?30200000:s.selector;
  const command=chest?{kind:'ChestExistingSlotAmountDecrease',containerId:s.id,slotIndex:s.selector,expectedItemId:id,expectedOldAmount:s.newAmount+1,newAmount:s.newAmount}:
   {kind:'InventoryExistingAmountDecrease',inventoryId:0,canonicalItemId:id,compatibleItemType:'ItemType_Furniture',expectedOldAmount:s.newAmount+1,newAmount:s.newAmount};
  const args={file,build,originalSha256:meta.originalSha256};
  const make=()=>createProductScopedAmountLocalAdapter({wasmFactory:async()=>({WorkerWasmSource}),
   discoverScopedTargets:async ({receipt})=>{
    ensure(receipt.schema===626&&receipt.writerAuthorized===false,'DISCOVERY_SCOPE');
    return [{profile,id:s.id,selector:s.selector,itemId:id,oldAmount:s.newAmount+1}];
   }});
  const a=make();await a.open(args);
  await deny(()=>a.stageTyped([command]));negative++;
  const backup=await a.backupOriginal();
  const rows=await a.listVerifiedTargets();ensure(rows.targets.length===1&&rows.targets[0].itemId===id,'TARGET');
  ensure((await a.stageTyped([command])).kind==='STAGED','STAGE');
  await a.undo();await deny(()=>a.exportEditedCopy());negative++;await a.redo();
  const exported=await a.exportEditedCopy();
  ensure(exported.freshWorkerReopenVerified===true&&exported.independentProcessReopenVerified===false&&exported.writerAuthorized===false,'REOPEN');
  const b=await a.downloadVerifiedCopy('backup'),e=await a.downloadVerifiedCopy('edited');
  ensure(b.name===backup.backupName&&e.name===exported.editedCopyName&&b.name!==e.name&&b.name!==file.name,'NAMES');
  ensure(await digest(b.encryptedBytes)===meta.originalSha256,'BACKUP_SHA');
  ensure((await p1gPackagedProfileCodec.loadProfile(e.encryptedBytes)).jsonText===meta.expected,'EXACT_DIFF');
  await a.close();
  const persisted=await (await root.getFileHandle(b.name)).getFile();
  ensure(await digest(await persisted.arrayBuffer())===meta.originalSha256,'BACKUP_PERSISTS');
  ensure(await digest(await file.arrayBuffer())===meta.originalSha256,'ORIGINAL');
  await root.removeEntry(b.name);await root.removeEntry(e.name);positive++;
  const t=make();await t.open(args);const tamper=await t.backupOriginal();await t.listVerifiedTargets();
  const handle=await root.getFileHandle(tamper.backupName),writer=await handle.createWritable();
  const wrong=source.slice();wrong[0]^=1;await writer.write(wrong);await writer.close();
  await deny(()=>t.stageTyped([command]));negative++;
  await t.close();await root.removeEntry(tamper.backupName);
 }
 return {profiles:2,positive,negative,actualOpfs:true,freshCodecWorker:true,writerAuthorized:false};
}
