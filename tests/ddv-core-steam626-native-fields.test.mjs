import test from 'node:test';
import assert from 'node:assert/strict';
import {STEAM626_NATIVE_ITEM_TYPES,STEAM626_ACTIVITY_SUBTYPES,STEAM626_FACE_PARTS,
  STEAM626_CLOTHING_SLOTS,STEAM626_NATIVE_FIELDS,STEAM626_NATIVE_QUANTITY_RULES,
  steam626ItemTypeOf,isSteam626NativeItemType,isSteam626ExistingListAmountType,
  STEAM626_PACKAGED_NATIVE_DATA,STEAM626_PACKAGED_STACK_BY_ACTIVITY_SUBTYPE,
  STEAM626_PACKAGED_AVATAR_COUNTS,STEAM626_NATIVE_SKIN_TARGETS,steam626NativeSubItemType,
  steam626PackagedChestStackBound,isSteam626PackagedAvatarIndex}
  from '../src/lib/ddv/core/items/steam626-native-fields.mjs';
test('exact Steam626 native enum and Item.Type prefix, not item existence',()=>{
  assert.equal(STEAM626_NATIVE_ITEM_TYPES.ItemType_ActivityItem,3);
  assert.equal(STEAM626_ACTIVITY_SUBTYPES.ActivityItemType_Ingredient,11);
  assert.equal(isSteam626NativeItemType('ItemType_Ingredient'),false);
  assert.equal(isSteam626NativeItemType('ItemType_Currency'),true);
  assert.equal(steam626ItemTypeOf(30000001),'ItemType_ActivityItem');
  assert.equal(steam626ItemTypeOf(40000047),'ItemType_Furniture');
  for(const x of [0,-1,1,90000001,2147483648,'30000001',NaN,3.5])assert.equal(steam626ItemTypeOf(x),null);
  assert.equal(isSteam626ExistingListAmountType('ItemType_ActivityItem',40000047),false);
  assert.equal(isSteam626ExistingListAmountType('ItemType_Skin',170000001),false);
  assert.equal(isSteam626ExistingListAmountType('ItemType_Furniture',40000047),true);
});
test('native field contracts identify avatar variants and explicit slot enums without a writer',()=>{
  assert.deepEqual(Object.values(STEAM626_FACE_PARTS),[0,1,2,3]);
  assert.deepEqual(Object.values(STEAM626_CLOTHING_SLOTS),Array.from({length:18},(_,i)=>i));
  const lookup=(suffix)=>STEAM626_NATIVE_FIELDS.find(f=>f.path.endsWith(suffix));
  assert.equal(lookup('/BodyType').fieldNumber,8);
  assert.equal(lookup('/Clothes/{clothingSlot}').type,'map<uint32,int32>');
  assert.equal(lookup('/State').fieldNumber,3);
  assert.equal(lookup('/State').type,'ItemState message');
  assert.equal(lookup('/CastleSkinItemID').fieldNumber,39);
  assert.equal(lookup('/AvatarIsMale').type,'bool');
  assert.ok(STEAM626_NATIVE_FIELDS.every(f=>Object.isFrozen(f)&&f.writerAuthorized===false));
  assert.equal(STEAM626_NATIVE_FIELDS.filter(f=>f.saveShape==='REAL_SAVE_V2_E1172').length,3);
  assert.equal(STEAM626_NATIVE_QUANTITY_RULES.nativeV3Accepted,false);
  assert.equal(STEAM626_NATIVE_QUANTITY_RULES.writerAuthorized,false);
  assert.match(STEAM626_NATIVE_QUANTITY_RULES.listZero,/RETAINS_KEY/);
  assert.match(STEAM626_NATIVE_QUANTITY_RULES.chestZero,/RESETS/);
});

test('same-build packaged stack data has exact caps and no fabricated fallback',()=>{
  assert.equal(Object.keys(STEAM626_PACKAGED_STACK_BY_ACTIVITY_SUBTYPE).length,14);
  assert.equal(STEAM626_PACKAGED_NATIVE_DATA.packagedItemStackExceptions,0);
  assert.equal(steam626PackagedChestStackBound(30200000),50);
  assert.equal(steam626PackagedChestStackBound(31700001),99);
  assert.equal(steam626PackagedChestStackBound(31400001),1);
  for(const id of [31300001,40000047,80000001,2147483648,'30200000',null])assert.equal(steam626PackagedChestStackBound(id),null);
  assert.equal(steam626NativeSubItemType(50700002),7);
  assert.equal(steam626NativeSubItemType(70000001),0);
  assert.equal(steam626NativeSubItemType(170300000),3);
  assert.equal(STEAM626_NATIVE_SKIN_TARGETS.Character.definitionField,'CharacterItemID');
  assert.equal(STEAM626_NATIVE_SKIN_TARGETS.Castle.value,0);
  assert.equal(STEAM626_NATIVE_SKIN_TARGETS.Plaza.value,1);
  assert.equal(STEAM626_NATIVE_SKIN_TARGETS.Mount.definitionField,'MountItemID');
  assert.equal(STEAM626_PACKAGED_NATIVE_DATA.writerAuthorized,false);
});
test('packaged Avatar index bounds: nonnegative, known field, default skin only; no authority',()=>{
  for(const [field,count] of Object.entries({BodyType:6,FaceType:8,SkinColorIndex:17,HairColorIndex:90,HairHighlightColor:90,EyeColorIndex:75,MakeupColorIndex:75})){
    assert.equal(isSteam626PackagedAvatarIndex(field,0),true);
    assert.equal(isSteam626PackagedAvatarIndex(field,count-1),true);
    for(const v of [count,-1,1.5,'0',NaN])assert.equal(isSteam626PackagedAvatarIndex(field,v),false);
  }
  assert.equal(STEAM626_PACKAGED_AVATAR_COUNTS.SkinColorIndex,30);
  assert.equal(STEAM626_PACKAGED_AVATAR_COUNTS.MonsterSkinCategory,13);
  for(const key of ['DefaultSkinCategory','MonsterSkinCategory','unknown','__proto__'])assert.equal(isSteam626PackagedAvatarIndex(key,0),false);
});
