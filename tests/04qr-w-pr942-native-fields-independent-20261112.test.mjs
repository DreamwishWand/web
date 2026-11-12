import test from 'node:test';
import assert from 'node:assert/strict';
import * as n from '../src/lib/ddv/core/items/steam626-native-fields.mjs';
import {describeTierARequest as plan,STEAM626,TIER_A_OPERATIONS,TIER_A_WRITER_ENABLED} from '../src/lib/ddv/core/items/tier-a-edit-requests.mjs';
const req=command=>({target:{...STEAM626},source:{originalEncryptedSha256:'a'.repeat(64)},session:{sessionId:'b'.repeat(32),revision:7,indexGeneration:2,decodedSha256:'c'.repeat(64)},command});
const inv=(id=31100001,type='ItemType_ActivityItem',old=50,next=49)=>({operation:'Inventory.ExistingAmountDecrease',inventoryId:2,canonicalItemId:id,compatibleItemType:type,expectedOldAmount:old,nextAmount:next,entryPresent:true});
const chest=(id=31100001,old=50,next=49)=>({operation:'Chest.ExistingSlotAmountDecrease',containerInventoryId:12,containerParentItemId:40000047,belongsToPlayer:true,size:16,slotCount:16,slotIndex:15,slotItemId:id,expectedOldAmount:old,nextAmount:next,itemStateReadsetSha256:'d'.repeat(64),activeReferenceCount:1});
const deny=c=>{const r=plan(req(c));assert.equal(r.status,'BLOCKED');assert.equal(r.writerAuthorized,false);assert.equal(r.exportAuthorized,false);assert.equal(r.productOperationEnabled,false);assert.equal(r.candidate,undefined)};
const inert=r=>{assert.equal(r.writerAuthorized,false);assert.equal(r.exportAuthorized,false);assert.equal(r.productOperationEnabled,false);assert.equal(r.authoritativeCoreValidationRequired,true);assert.equal(r.sourceIdentityProvenByThisModule,false);assert.equal(r.sessionAuthorizedByThisModule,false);assert.equal(r.canonicalItemRoutingProvenByThisModule,false);assert.equal(r.independentQaAccepted,false);assert.equal(r.editedCopyReopened,false);assert.ok(Object.values(r.releaseFlags).every(x=>x===false));assert.ok(Object.isFrozen(r.candidate.readSet));};
test('native signed type boundaries, no invented token, subtype distinct',()=>{
 for(const [id,type] of [[30000000,'ItemType_ActivityItem'],[39999999,'ItemType_ActivityItem'],[40000000,'ItemType_Furniture'],[49999999,'ItemType_Furniture'],[2147483647,'ItemType_Display']]) assert.equal(n.steam626ItemTypeOf(id),type);
 for(const id of [-2147483648,-1,0,9999999,90000000,2147483648,4294967295,NaN,Infinity,31100001.1,'31100001',null])assert.equal(n.steam626ItemTypeOf(id),null);
 assert.equal(n.STEAM626_ACTIVITY_SUBTYPES.ActivityItemType_Ingredient,11);
 assert.equal(n.steam626NativeSubItemType(31100001),11);
 for(const token of ['ItemType_Ingredient','ActivityItemType_Ingredient','__proto__','constructor','ItemType_Unknown'])assert.equal(n.isSteam626NativeItemType(token),false);
});
test('Inventory native matching prefix only, positive decrease, no rights or existence proof',()=>{
 for(const c of [inv(),inv(49999999,'ItemType_Furniture',2,1)]){const r=plan(req(c));assert.equal(r.status,'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING');inert(r);assert.equal(r.candidate.nativeDevCommand.expected_compatible_item_type,c.compatibleItemType);assert.deepEqual(r.candidate.exactAllowedPaths,[r.candidate.fieldPath]);}
 for(const c of [inv(40000001),inv(31100001,'ItemType_Furniture'),inv(2147483648),inv(-1),inv(31100001,'ItemType_Ingredient'),inv(31100001,'ActivityItemType_Ingredient'),inv(50000001,'ItemType_Clothing'),inv(80000001,'ItemType_Currency'),inv(170000001,'ItemType_Skin'),inv(31100001,'ItemType_ActivityItem',2,0),inv(31100001,'ItemType_ActivityItem',2,2),inv(31100001,'ItemType_ActivityItem',2,3)])deny(c);
});
test('Chest all packaged subtype caps and missing entries, no fabricated fallback',()=>{
 const bounds={0:50,2:50,3:50,4:50,8:50,10:50,11:50,12:99,14:1,15:50,16:50,17:99,18:50,19:50};
 for(let i=0;i<100;i++){const id=30000001+i*100000;const cap=bounds[i]??null;assert.equal(n.steam626PackagedChestStackBound(id),cap);
 if(cap===null){deny(chest(id,2,1));continue;}
 deny(chest(id,cap+1,cap));if(cap>1){const r=plan(req(chest(id,cap,cap-1)));assert.equal(r.status,'WAIT_STEAM626_GENUINE_CHEST_SLOT_AND_NATIVE_CONSUMER_EVIDENCE');inert(r);}else deny(chest(id,1,0));}
 assert.equal(n.STEAM626_PACKAGED_NATIVE_DATA.packagedItemStackExceptions,0);
 assert.match(n.STEAM626_NATIVE_QUANTITY_RULES.chestStack,/ITEM_EXCEPTION_BEFORE_ACTIVITY_SUBTYPE/);
 assert.match(n.STEAM626_NATIVE_QUANTITY_RULES.chestStack,/LIVE_TARGET_AND_CONFIG_REQUIRED/);
});
test('Chest State, capacity, parent, all-root reference and movement are deferred Core predicates',()=>{
 const r=plan(req(chest()));inert(r);const p='/Player/ContainerInventories/12';const rs=new Map(r.candidate.readSet.map(x=>[x.path,x]));
 assert.equal(rs.get(p+'/Inventory/15/State').expectedContentSha256,'d'.repeat(64));assert.equal(rs.has(p+'/Inventory/15/ItemState'),false);
 assert.equal(rs.get(p+'/ParentItemID').expectedValue,40000047);assert.equal(rs.get(p+'/BelongsToPlayer').expectedValue,true);
 assert.equal(rs.get(p+'/ExtraSize').required,'CORE_RESOLVE_SIZE_WITHOUT_EXTRAS');assert.equal(rs.get(p+'/BlockMoveTo').required,'CORE_PRESERVE_AND_CHECK');
 assert.equal(rs.get('/World/GridCollection').required,'CORE_COMPLETE_EFFECTIVE_ACTIVE_CONTAINER_REFERENCES_ALL_ROOTS');
 assert.deepEqual(r.candidate.exactAllowedPaths,[p+'/Inventory/15/Amount']);
 for(const patch of [{containerParentItemId:31100001},{containerParentItemId:2147483648},{belongsToPlayer:false},{slotIndex:16},{size:17},{slotCount:15},{activeReferenceCount:2},{slotItemId:40000001},{slotItemId:2147483648},{itemStateReadsetSha256:'bad'},{ExtraSize:1},{BlockMoveTo:false},{owned:true}])deny({...chest(),...patch});
});
test('packaged avatar boundaries, map field schema and immutable native-only evidence',()=>{
 for(const [field,count] of Object.entries({BodyType:6,FaceType:8,SkinColorIndex:17,HairColorIndex:90,HairHighlightColor:90,EyeColorIndex:75,MakeupColorIndex:75})){
 for(let v=0;v<count;v++)assert.equal(n.isSteam626PackagedAvatarIndex(field,v),true);
 for(const v of [-1,count,count+1,2147483647,NaN,Infinity,0.5,'1'])assert.equal(n.isSteam626PackagedAvatarIndex(field,v),false);}
 for(let v=17;v<30;v++)assert.equal(n.isSteam626PackagedAvatarIndex('SkinColorIndex',v),false);
 for(const field of ['DefaultSkinCategory','MonsterSkinCategory','constructor','__proto__','EyeballItemID','Clothes','SkinID'])assert.equal(n.isSteam626PackagedAvatarIndex(field,0),false);
 assert.deepEqual(Object.values(n.STEAM626_FACE_PARTS),[0,1,2,3]);assert.deepEqual(Object.values(n.STEAM626_CLOTHING_SLOTS),Array.from({length:18},(_,i)=>i));
 for(const f of n.STEAM626_NATIVE_FIELDS){assert.ok(Object.isFrozen(f));assert.equal(f.writerAuthorized,false);if(['Appearance','Wardrobe','OwnedSkin'].includes(f.domain))assert.equal(f.saveShape,'NATIVE_SCHEMA_ONLY');}
});
test('Wardrobe conflicts, skin target separation, no unknown/owned/entitlement grant',()=>{
 const t=n.STEAM626_NATIVE_SKIN_TARGETS;assert.deepEqual([t.Character.subtype,t.Castle.subtype,t.Plaza.subtype,t.Mount.subtype],[0,3,3,4]);assert.notEqual(t.Castle.value,t.Plaza.value);assert.notEqual(t.Character.definitionField,t.Mount.definitionField);
 const paths=n.STEAM626_NATIVE_FIELDS.filter(f=>f.domain==='Wardrobe').map(f=>f.path);
 assert.ok(paths.some(x=>x.includes('IncompatibleClothes')));assert.ok(paths.some(x=>x.includes('ClothingCustomization')));
 for(const name of ['Appearance.Change','Wardrobe.Change','OwnedSkin.Select','Ownership.Change','Variation.Change','Group.Change']){const row=TIER_A_OPERATIONS.find(x=>x.name===name);assert.equal(row.command,null);assert.equal(row.writerAuthorized,false);deny({operation:name,owned:true,itemId:170000001,entitlement:true});}
 for(const key of ['premium','dlc','entitlement','receipt','writerAuthorized','applyAuthorized','exportAuthorized','nativeV3Accepted'])deny({...inv(),[key]:true});
 assert.equal(TIER_A_WRITER_ENABLED,false);assert.equal(n.STEAM626_NATIVE_QUANTITY_RULES.nativeV3Accepted,false);assert.equal(n.STEAM626_PACKAGED_NATIVE_DATA.writerAuthorized,false);
});
