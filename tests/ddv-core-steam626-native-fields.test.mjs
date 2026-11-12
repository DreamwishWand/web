import test from 'node:test';
import assert from 'node:assert/strict';
import {STEAM626_NATIVE_ITEM_TYPES,STEAM626_ACTIVITY_SUBTYPES,STEAM626_FACE_PARTS,
  STEAM626_CLOTHING_SLOTS,STEAM626_NATIVE_FIELDS,STEAM626_NATIVE_QUANTITY_RULES,
  steam626ItemTypeOf,isSteam626NativeItemType,isSteam626ExistingListAmountType}
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
