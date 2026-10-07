import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {SafeProfileEditSession} from '../src/lib/ddv/core/save/safe-edit-session.js';
import {createVerifiedWriteCandidate} from '../src/lib/ddv/core/save/transaction-foundation.js';
import {PlatformFamily,BuildIdentityKind} from '../src/lib/ddv/core/save/versioning.js';
import {
  ACTIVE_REFERENCE_EVIDENCE_CONTRACT,
  STORAGE_TRANSITION,
  compileStorageCrossGridMoveV125,
  compileStoragePutAwayNonemptyV125,
  compileStorageRePlaceNonemptyV125,
  compileStorageSameGridMoveV125,
  resolvePlacedStorageFurnitureV125,
  resolveStoredStorageContainerV125
} from '../src/lib/ddv/core/world/storage-container-v125.js';
import {
  STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT,
  buildStorageActiveReferenceIndexV125,
  selectStorageActiveReferenceEvidenceV125
} from '../src/lib/ddv/core/world/storage-active-reference-index-v125.js';
import {
  STORAGE_SAME_GRID_ADAPTER_ID,
  STORAGE_TRANSITION_ADAPTER_ID,
  STORAGE_TRANSACTION_BINDING_CONTRACT,
  bindStorageGridObjectTemplateEvidenceV125,
  buildStorageCrossGridMoveTransactionPlanV125,
  buildStoragePutAwayNonemptyTransactionPlanV125,
  buildStorageReplaceNonemptyTransactionPlanV125,
  buildStorageSameGridMoveTransactionPlanV125,
  storageStructuralTransitionAdapterV125
} from '../src/lib/ddv/core/world/storage-transition-binding-v125.js';
import {
  createVerifiedStorageBindingCandidateFromCurrentSaveV125,
  verifyStorageBindingCandidateFromCurrentSaveV125
} from '../src/lib/ddv/core/world/storage-binding-candidate-v125.js';

const ITEM=40001000,CONTAINER=21,LIST=2,BID='52BD625D9B4E0053';
const source={platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:BID};
const itemDefinition={itemId:ITEM,concreteType:'FurnitureItemData',interaction:'Container',defaultContainerSize:48};
const itemDefinitionsById={[ITEM]:itemDefinition};
const enc=new TextEncoder(),dec=new TextDecoder();

function storageObject(){return {ID:42,ItemID:ITEM,X:10,Y:20,Orientation:'GridOrientation_Up',State:{Storage:{ContainerInventoryID:CONTAINER,DefaultContainerInventoryData:'ContainerInventory/Storage/Large',UnlockKeyItemID:0,UnlockLocId:'',DesignID:null}},OpaqueObjectField:{preserve:'exact'}};}
function profile(){return {
  GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},Opaque:{keep:true}},
  Player:{
    ContainerInventories:{'21':{ID:21,Size:48,Inventory:[{ItemID:30000001,Amount:10,ItemState:null},{ItemID:30000002,Amount:2,ItemState:{Custom:'keep'}}],BelongsToPlayer:true,BlockMoveTo:false,ParentItemID:ITEM,ExtraSize:0,OpaqueContainer:{keep:true}}},
    NextContainerInventoryID:100,
    ListInventories:{'2':{ID:2,CompatibleItemType:'ItemType_Furniture',Inventory:{[ITEM]:{Amount:2,Marker:'Favorite'}},OpaqueList:{keep:true}}},
    OpaquePlayer:{keep:true}
  },
  World:{
    GridCollection:{Grids:{
      '3':{ID:3,NextGridObjectID:100,Objects:{'42':storageObject()},OpaqueGrid:{keep:'source'}},
      '7':{ID:7,NextGridObjectID:80,Objects:{'9':{ID:9,ItemID:40000001,X:1,Y:1,Orientation:'GridOrientation_Up',State:null}},OpaqueGrid:{keep:'destination'}}
    }},
    PlayerHouses:[{HouseItemID:20500005,Opaque:{keep:true}}],Stores:[{BuildingItemID:20200005,Opaque:{keep:true}}],
    ConditionalEventHistoryData:{Opaque:{keep:true}},OpaqueWorld:{keep:true}
  },Settings:{Language:'en'}
};}
function codec(){return {contract:'p1g-v0',async loadProfile(input){const text=dec.decode(input);return {inputType:'plain',jsonText:text,metadata:{version:JSON.parse(text)?.GameInfo?.Version??624}};},parseProfileText(text){return {metadata:{version:JSON.parse(text)?.GameInfo?.Version??624}};},async createEncodedProfile(text){return enc.encode(text);},getProfileVersion(m){return m.version;}};}
async function session(root){return SafeProfileEditSession.open({sourceBytes:enc.encode(JSON.stringify(root)),codec:codec(),sourcePlatform:PlatformFamily.Switch});}
function txInput(s){const c=s.getPreflightContext();return {platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:s.source.length,originalSha256:c.saveIdentity.sourceRawSha256,codecContract:c.codecContract,targetBuild:{platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:BID}};}
function placement(gridId,x,y,orientation){return {status:'VALID',valid:true,clearArea:false,gridId,itemId:ITEM,x,y,orientation};}
function activeIndex(root,defs=itemDefinitionsById){return buildStorageActiveReferenceIndexV125({source,profile:root,itemDefinitionsById:defs});}
function activeEvidence(root,count=1){return selectStorageActiveReferenceEvidenceV125({index:activeIndex(root),containerInventoryId:CONTAINER,expectedReferenceCount:count});}
function placed(root,evidence=activeEvidence(root)){return resolvePlacedStorageFurnitureV125({source,profile:root,gridId:3,gridObjectId:42,itemDefinition,activeReferenceEvidence:evidence,listInventoryId:LIST});}
async function snap(bytes){return (await SafeProfileEditSession.open({sourceBytes:bytes,codec:codec(),sourcePlatform:PlatformFamily.Switch})).getSnapshot();}

async function sameGridFixture(){const root=profile(),s=await session(root),e=activeEvidence(root),r=placed(root,e),t=compileStorageSameGridMoveV125({resolved:r,profile:root,destination:{x:12,y:23,orientation:'GridOrientation_Up'},placementEvidence:placement(3,12,23,'GridOrientation_Up')}),p=buildStorageSameGridMoveTransactionPlanV125({transition:t,resolved:r,profile:root,transactionInput:txInput(s),activeReferenceEvidence:e});return {root,s,e,r,t,p};}
async function crossFixture(){const root=profile(),s=await session(root),e=activeEvidence(root),r=placed(root,e),t=compileStorageCrossGridMoveV125({resolved:r,profile:root,destination:{gridId:7,x:30,y:40,orientation:'GridOrientation_Right'},placementEvidence:placement(7,30,40,'GridOrientation_Right')}),p=buildStorageCrossGridMoveTransactionPlanV125({transition:t,resolved:r,profile:root,transactionInput:txInput(s),activeReferenceEvidence:e});return {root,s,e,r,t,p};}
async function putFixture(){const root=profile(),s=await session(root),e=activeEvidence(root),r=placed(root,e),t=compileStoragePutAwayNonemptyV125({resolved:r}),p=buildStoragePutAwayNonemptyTransactionPlanV125({transition:t,resolved:r,profile:root,transactionInput:txInput(s),activeReferenceEvidence:e});return {root,s,e,r,t,p};}

test('active-reference index proves COMPLETE_CURRENT_SAVE and exact selected reference',()=>{const root=profile(),i=activeIndex(root);assert.equal(i.contract,STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT);assert.equal(i.status,'COMPLETE_CURRENT_SAVE');assert.equal(i.completeCurrentSave,true);assert.deepEqual(i.byContainer['21'],[{gridId:3,gridObjectId:42,itemId:ITEM}]);assert.deepEqual(activeEvidence(root),{contract:ACTIVE_REFERENCE_EVIDENCE_CONTRACT,status:'COMPLETE_CURRENT_SAVE',containerInventoryId:21,references:[{gridId:3,gridObjectId:42,itemId:ITEM}]});});

test('active-reference index fails closed on malformed, unknown and HomeStorage reference states',()=>{for(const mutate of [r=>{r.World.GridCollection.Grids['3'].Objects['42'].State.Storage=null;},r=>{},r=>{}]){const root=profile();mutate(root);let defs=itemDefinitionsById;if(mutate.toString()==='r=>{}'){}const i=activeIndex(root,defs);if(mutate!==undefined&&root.World.GridCollection.Grids['3'].Objects['42'].State.Storage===null){assert.equal(i.status,'INCOMPLETE_CURRENT_SAVE');assert.ok(i.reasonCodes.includes('MALFORMED_STORAGE_STATE'));break;}}
  const unknown=activeIndex(profile(),{});assert.equal(unknown.status,'INCOMPLETE_CURRENT_SAVE');assert.ok(unknown.reasonCodes.includes('STORAGE_ITEM_DEFINITION_UNKNOWN'));
  const home=activeIndex(profile(),{[ITEM]:{...itemDefinition,interaction:'HomeStorage'}});assert.equal(home.status,'INCOMPLETE_CURRENT_SAVE');assert.ok(home.reasonCodes.includes('HOME_STORAGE_UNSUPPORTED'));
});

test('selected duplicate active references fail closed',()=>{const root=profile();root.World.GridCollection.Grids['7'].Objects['80']={...storageObject(),ID:80,X:50,Y:50};const i=activeIndex(root);assert.equal(i.status,'COMPLETE_CURRENT_SAVE');assert.deepEqual(i.duplicateContainerInventoryIds,[21]);assert.throws(()=>selectStorageActiveReferenceEvidenceV125({index:i,containerInventoryId:21}),/STORAGE_ACTIVE_REFERENCE_DUPLICATE/);});

test('SAME_GRID_MOVE binds WRITE_CANDIDATE to X/Y only and independently verifies preservation',async()=>{const f=await sameGridFixture();assert.equal(f.p.capabilityRequired,'WRITE_CANDIDATE');assert.equal(f.p.target.kind,'GRID_OBJECT');assert.equal(f.p.mutationAdapter.id,STORAGE_SAME_GRID_ADAPTER_ID);assert.deepEqual(f.p.allowedChanges.map(x=>x.path),['/World/GridCollection/Grids/3/Objects/42/X','/World/GridCollection/Grids/3/Objects/42/Y']);const made=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:f.s,plan:f.p,itemDefinitionsById});const v=await verifyStorageBindingCandidateFromCurrentSaveV125({candidate:made.candidate,codec:codec(),itemDefinitionsById});assert.equal(v.status,'PASS');assert.deepEqual(v.verification.exactChangedPaths,['/World/GridCollection/Grids/3/Objects/42/X','/World/GridCollection/Grids/3/Objects/42/Y']);const after=await snap(made.candidate.candidateBytes),b=f.root.World.GridCollection.Grids['3'].Objects['42'],a=after.World.GridCollection.Grids['3'].Objects['42'];assert.equal(a.ID,b.ID);assert.equal(a.ItemID,b.ItemID);assert.equal(a.Orientation,b.Orientation);assert.deepEqual(a.State,b.State);assert.deepEqual(after.Player.ContainerInventories,f.root.Player.ContainerInventories);assert.deepEqual(after.Player.ListInventories,f.root.Player.ListInventories);assert.equal(after.Player.NextContainerInventoryID,f.root.Player.NextContainerInventoryID);});

test('same-grid canonical candidate entrypoint rejects fabricated COMPLETE_CURRENT_SAVE evidence',async()=>{const f=await sameGridFixture();const bad=structuredClone(f.p);bad.intent.activeReferenceEvidence.references=[];await assert.rejects(()=>createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:f.s,plan:bad,itemDefinitionsById}),/STORAGE_ACTIVE_REFERENCE_PLAN_BINDING_MISMATCH/);});

test('Case A CROSS_GRID_MOVE representative verified candidate is constructible',async()=>{const f=await crossFixture();assert.equal(f.p.target.kind,'STORAGE_FURNITURE_TRANSITION');assert.equal(f.p.target.mode,'CROSS_GRID_MOVE');assert.equal(f.p.mutationAdapter.id,STORAGE_TRANSITION_ADAPTER_ID);const made=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:f.s,plan:f.p,itemDefinitionsById});const v=await verifyStorageBindingCandidateFromCurrentSaveV125({candidate:made.candidate,codec:codec(),itemDefinitionsById});assert.equal(v.status,'PASS');assert.deepEqual(v.verification.exactChangedPaths,['/World/GridCollection/Grids/3/Objects/42','/World/GridCollection/Grids/7/NextGridObjectID','/World/GridCollection/Grids/7/Objects/80'].sort());const after=await snap(made.candidate.candidateBytes);assert.equal(after.World.GridCollection.Grids['3'].Objects['42'],undefined);const moved=after.World.GridCollection.Grids['7'].Objects['80'];assert.equal(moved.ID,80);assert.equal(moved.State.Storage.ContainerInventoryID,21);const bx=structuredClone(f.root.World.GridCollection.Grids['3'].Objects['42']),ax=structuredClone(moved);for(const k of ['ID','X','Y','Orientation']){delete bx[k];delete ax[k];}assert.deepEqual(ax,bx);assert.equal(after.World.GridCollection.Grids['7'].NextGridObjectID,81);assert.deepEqual(after.Player.ContainerInventories,f.root.Player.ContainerInventories);assert.deepEqual(after.Player.ListInventories,f.root.Player.ListInventories);});

test('PUT_AWAY_NONEMPTY candidate removes outer reference, increments only Amount, preserves Marker/container',async()=>{const f=await putFixture(),made=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:f.s,plan:f.p,itemDefinitionsById}),v=await verifyStorageBindingCandidateFromCurrentSaveV125({candidate:made.candidate,codec:codec(),itemDefinitionsById});assert.equal(v.status,'PASS');assert.deepEqual(v.verification.exactChangedPaths,[`/Player/ListInventories/2/Inventory/${ITEM}/Amount`,'/World/GridCollection/Grids/3/Objects/42'].sort());const after=await snap(made.candidate.candidateBytes);assert.equal(after.World.GridCollection.Grids['3'].Objects['42'],undefined);assert.equal(after.Player.ListInventories['2'].Inventory[String(ITEM)].Amount,3);assert.equal(after.Player.ListInventories['2'].Inventory[String(ITEM)].Marker,'Favorite');assert.deepEqual(after.Player.ContainerInventories,f.root.Player.ContainerInventories);assert.equal(activeEvidence(after,0).references.length,0);});

test('Case B PUT_AWAY -> explicit same-save REPLACE representative chain is constructible',async()=>{const put=await putFixture(),putMade=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:put.s,plan:put.p,itemDefinitionsById});await verifyStorageBindingCandidateFromCurrentSaveV125({candidate:putMade.candidate,codec:codec(),itemDefinitionsById});const storedSession=await SafeProfileEditSession.open({sourceBytes:putMade.candidate.candidateBytes,codec:codec(),sourcePlatform:PlatformFamily.Switch}),storedProfile=storedSession.getSnapshot(),input=txInput(storedSession),zero=activeEvidence(storedProfile,0);const template=bindStorageGridObjectTemplateEvidenceV125({transactionInput:input,itemId:ITEM,containerInventoryId:CONTAINER,gridObject:storageObject()});assert.equal(template.sourceSha256,input.originalSha256);const resolved=resolveStoredStorageContainerV125({source,profile:storedProfile,containerInventoryId:CONTAINER,itemDefinition,activeReferenceEvidence:zero,listInventoryId:LIST,gridObjectTemplateEvidence:template});assert.equal(resolved.status,'READY');const t=compileStorageRePlaceNonemptyV125({resolvedStored:resolved,profile:storedProfile,destination:{gridId:7,x:50,y:60,orientation:'GridOrientation_Right'},placementEvidence:placement(7,50,60,'GridOrientation_Right')}),p=buildStorageReplaceNonemptyTransactionPlanV125({transition:t,resolvedStored:resolved,profile:storedProfile,transactionInput:input,activeReferenceEvidence:zero});assert.equal(p.target.gridObjectTemplateEvidence.sourceSha256,input.originalSha256);const made=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:storedSession,plan:p,itemDefinitionsById}),v=await verifyStorageBindingCandidateFromCurrentSaveV125({candidate:made.candidate,codec:codec(),itemDefinitionsById});assert.equal(v.status,'PASS');const after=await snap(made.candidate.candidateBytes),replaced=after.World.GridCollection.Grids['7'].Objects['80'];assert.equal(replaced.State.Storage.ContainerInventoryID,21);assert.equal(after.Player.ListInventories['2'].Inventory[String(ITEM)].Amount,2);assert.deepEqual(after.Player.ContainerInventories,storedProfile.Player.ContainerInventories);assert.deepEqual(activeEvidence(after).references,[{gridId:7,gridObjectId:80,itemId:ITEM}]);});

test('REPLACE rejects template evidence bound to another source hash',async()=>{const put=await putFixture(),putMade=await createVerifiedStorageBindingCandidateFromCurrentSaveV125({session:put.s,plan:put.p,itemDefinitionsById}),storedSession=await SafeProfileEditSession.open({sourceBytes:putMade.candidate.candidateBytes,codec:codec(),sourcePlatform:PlatformFamily.Switch}),storedProfile=storedSession.getSnapshot(),input=txInput(storedSession),zero=activeEvidence(storedProfile,0),bad={contract:'ddv.storage-grid-object-template-evidence@1',provenance:'SAME_SAVE_HASH_BOUND',sourceSha256:'f'.repeat(64),itemId:ITEM,containerInventoryId:CONTAINER,gridObject:storageObject()},resolved=resolveStoredStorageContainerV125({source,profile:storedProfile,containerInventoryId:CONTAINER,itemDefinition,activeReferenceEvidence:zero,listInventoryId:LIST,gridObjectTemplateEvidence:bad});const t=compileStorageRePlaceNonemptyV125({resolvedStored:resolved,profile:storedProfile,destination:{gridId:7,x:50,y:60,orientation:'GridOrientation_Right'},placementEvidence:placement(7,50,60,'GridOrientation_Right')});assert.throws(()=>buildStorageReplaceNonemptyTransactionPlanV125({transition:t,resolvedStored:resolved,profile:storedProfile,transactionInput:input,activeReferenceEvidence:zero}),/STORAGE_EXACT_SAME_SAVE_TEMPLATE_BINDING_REQUIRED/);});

test('promoted verifier rejects structural adapter that mutates ContainerInventory slots',async()=>{const f=await putFixture(),evil={...storageStructuralTransitionAdapterV125,apply(draft,intent,p){storageStructuralTransitionAdapterV125.apply(draft,intent,p);draft.Player.ContainerInventories['21'].Inventory[0].Amount=999;}};await assert.rejects(()=>createVerifiedWriteCandidate({session:f.s,plan:f.p,adapter:evil}),/(TX_MUTATION_OR_SERIALIZATION_FAILED|TX_STORAGE_CONTAINER_INVENTORIES_CHANGED|not allowed|allowed)/i);});

test('binding and active-reference machine contracts remain exact and hard flags false',async()=>{const binding=JSON.parse(await readFile(new URL('../static/ddv/core/save/v1.25/storage-furniture-transaction-binding-v125.json',import.meta.url),'utf8')),refs=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25/storage-active-reference-index-v125.json',import.meta.url),'utf8')),runtime=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25/storage-container-01e-runtime-request-v125.json',import.meta.url),'utf8'));assert.equal(binding.schema,STORAGE_TRANSACTION_BINDING_CONTRACT);assert.equal(binding.adapters.sameGridMove.id,STORAGE_SAME_GRID_ADAPTER_ID);assert.equal(binding.adapters.structural.id,STORAGE_TRANSITION_ADAPTER_ID);assert.deepEqual(binding.adapters.structural.modes,['CROSS_GRID_MOVE','PUT_AWAY_NONEMPTY','REPLACE_NONEMPTY']);assert.equal(refs.schema,STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT);assert.equal(refs.scan.statusRequiredForWriteBinding,'COMPLETE_CURRENT_SAVE');for(const v of Object.values(binding.hardFlags))assert.equal(v,false);for(const v of Object.values(refs.hardFlags))assert.equal(v,false);assert.equal(runtime.requestId,'01B-TO-01E-STORAGE-CONTAINER-TRANSITION-V125-V1');assert.deepEqual(runtime.protocol.map(x=>x.case),['A_CROSS_GRID_MOVE','B_PUT_AWAY_THEN_EXPLICIT_REPLACE']);});
