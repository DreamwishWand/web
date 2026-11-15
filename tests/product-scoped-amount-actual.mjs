// ACT916: actual generated Rust wasm + existing P1G Codec, synthetic only.
// This is the same Worker-owned session transport, not genuine product V2.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './helpers/p1g-fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {createP1gRustWorkerReadOnlyBridge} from '../src/lib/ddv/core/save/p1g-rust-worker-readonly-bridge.mjs';
const modulePath=process.env.WAND_SCOPED_WASM_MODULE;
if(!modulePath)throw Error('SCOPED_ACTUAL_WASM_REQUIRED');
const {WorkerWasmSource}=createRequire(import.meta.url)(modulePath);
const factory=async()=>({WorkerWasmSource});
const hash=b=>createHash('sha256').update(b).digest('hex');
const BUILD={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const doc=()=>({GameInfo:{Version:626},ConditionalEventHistory:{ActiveEvents:{}},
 World:{GridCollection:{Grids:{},DiffGrids:{}},MissionSlots:{},Villages:[]},
 Player:{ListInventories:{0:{ID:0,CompatibleItemType:'ItemType_Furniture',CompatibleFurnitureTypes:{List:['FurnitureItemType_Default']},Inventory:{40000048:{Amount:3,Marker:'ItemMarker_None'}}}},
 ContainerInventories:{},AchievementsData:[],EvolveStatesProfile:{EvolveProgressState:{}},DutySlots:{},
 BattlePassStates:{Progress:{},FtueProgress:{TasksProgress:[],WeeklyTasksProgress:[]}}},Unknown:{x:1}});
const chest=()=>{
 const d=doc(),p=d.Player;
 p.ListInventories[2]={ID:2,CompatibleItemType:'ItemType_ActivityItem',Inventory:{30200000:{Amount:2}}};
 const empty=()=>({ItemID:0,Amount:0,State:null});
 const slots=Array.from({length:48},empty);slots[0]={ItemID:30200000,Amount:50,State:null,Unknown:7};
 p.ContainerInventories={0:{ID:0,BelongsToPlayer:true,Size:1,ExtraSize:0,Inventory:[{ItemID:30200000,Amount:5,State:{}}]},
 1:{ID:1,BelongsToPlayer:true,Size:1,ExtraSize:0,Inventory:[empty()]},
 12:{ID:12,ParentItemID:40001680,BelongsToPlayer:true,BlockMoveTo:false,Size:48,ExtraSize:0,Inventory:slots}};
 p.BackpackOverflow={Items:[]};
 d.World.GridCollection.Grids[7]={ID:7,GridDefaultLayoutPath:'',Objects:{4:{ID:4,ItemID:40001680,State:{Storage:{ContainerInventoryID:12,DefaultContainerInventoryData:'',UnlockKeyItemID:0,UnlockLocId:'',DesignID:null}}}}};
 d.World.Villages=[{Areas:{2:{GridIDs:[7],Unlocked:true}}}];return d;
};
for(const [d,sel,apply] of [
 [doc(),{profile:'catalog0-furniture',id:0,selector:40000048,newAmount:2},x=>x.Player.ListInventories[0].Inventory[40000048].Amount=2],
 [chest(),{profile:'linked-crop-chest48',id:12,selector:0,newAmount:49},x=>x.Player.ContainerInventories[12].Inventory[0].Amount=49]
]){
 const source=makeSyntheticP1gProfile(d),originalSha256=hash(source);
 const file=new File([source],'synthetic.p1g');
 const backup=new File([source],'synthetic.p1g.original-backup.p1g');
 const b=createP1gRustWorkerReadOnlyBridge(factory,{allowScopedAmountSource:true});
 const opened=await b.openScopedEncrypted({file,build:BUILD,originalSha256});
 assert.deepEqual(opened,{sourceShaMatched:true,originalSizeMatched:true,fullDocumentValidated:true,writerAuthorized:false,editedCopyAuthorized:false});
 assert.throws(()=>b.previewScopedAmount(sel),/BACKUP_REQUIRED/);
 await assert.rejects(b.verifyScopedOriginalBackup(file));
 const wrong=source.slice();wrong[0]^=1;
 await assert.rejects(b.verifyScopedOriginalBackup(new File([wrong],'wrong.p1g')));
 assert.throws(()=>b.stageScopedAmount(),/BACKUP_REQUIRED/);
 const compared=await b.verifyScopedOriginalBackup(backup);
 assert.equal(compared.candidateBytesMatchOriginal,true);assert.equal(compared.persistedVerified,false);
 const preview=b.previewScopedAmount(sel);
 assert.equal(preview.oldAmount,sel.newAmount+1);assert.equal(preview.newAmount,sel.newAmount);
 assert.equal(preview.writerAuthorized,false);assert.equal('entrySha256' in preview,false);assert.equal('sessionId' in preview,false);
 assert.equal(b.stageScopedAmount().exactFieldChangedCount,1);
 assert.equal(b.toggleScopedAmount(false).applied,false);
 assert.equal(b.toggleScopedAmount(true).applied,true);
 const out=await b.exportScopedEditedCopy();
 assert.equal(out.name,'synthetic.p1g.edited-copy.p1g');assert.equal(hash(out.encryptedBytes),out.sha256);
 assert.equal(out.codecReopenVerified,true);assert.equal(out.independentProcessReopenVerified,false);
 assert.equal(out.writerAuthorized,false);assert.equal(out.originalOverwriteAuthorized,false);
 const reopened=await p1gPackagedProfileCodec.loadProfile(out.encryptedBytes);
 const expected=structuredClone(d);apply(expected);assert.equal(reopened.jsonText,JSON.stringify(expected));
 assert.equal(hash(new Uint8Array(await file.arrayBuffer())),originalSha256);
 await assert.rejects(b.exportScopedEditedCopy(),/OFF/);
 await b.openScopedEncrypted({file,build:BUILD,originalSha256});await b.verifyScopedOriginalBackup(backup);
 assert.throws(()=>b.previewScopedAmount({...sel,newAmount:sel.newAmount-1}),/DENIED/);
 assert.equal(b.getReceipt(),null);
 await b.openScopedEncrypted({file,build:BUILD,originalSha256});await b.verifyScopedOriginalBackup(backup);
 const pending=b.verifyScopedOriginalBackup(new File([source],'second.p1g'));
 const rejected=assert.rejects(pending);b.close();await rejected;
 assert.throws(()=>b.previewScopedAmount(sel),/OFF/);
 console.log('ACT916_ACTUAL_SYNTHETIC_P1G_SCOPED_TRANSPORT_PASS',sel.profile);
}
