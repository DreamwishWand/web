/**
 * 01D R08 Steam Windows 1.25.3 schema626 native field evidence, SOURCE_ONLY.
 * Derived from privately SHA-verified same-build IL2CPP definitions and x64 code.
 * Not a Save reader, ItemDB, runtime proof, entitlement check or Writer.
 */
export const STEAM626_NATIVE_ITEM_TYPES=Object.freeze({
  ItemType_None:0,ItemType_Character:1,ItemType_Building:2,ItemType_ActivityItem:3,
  ItemType_Furniture:4,ItemType_Clothing:5,ItemType_Environment:6,ItemType_AvatarFeature:7,
  ItemType_Currency:8,ItemType_TouchOfMagic:10,ItemType_Tool:11,ItemType_Companion:12,
  ItemType_MemoryShard:13,ItemType_Makeup:14,ItemType_Upgrade:15,ItemType_Trimming:16,
  ItemType_Skin:17,ItemType_BoardGame:18,ItemType_PhotoMode:19,ItemType_Story:20,
  ItemType_MountGear:21,ItemType_Profession:150,ItemType_Preference:151,
  ItemType_ConditionalEvent:152,ItemType_PointOfInterest:153,ItemType_Scene:154,
  ItemType_ItemCondition:155,ItemType_Tag:200,ItemType_RecurringEvent:201,
  ItemType_Dialogue:203,ItemType_Set:204,ItemType_ActivityData:205,ItemType_Mission:207,
  ItemType_Ftue:208,ItemType_LootTable:209,ItemType_Formula:210,ItemType_DutyAch:211,
  ItemType_CollectionSet:212,ItemType_Condition:213,ItemType_Display:214
});
export const STEAM626_ACTIVITY_SUBTYPES=Object.freeze({
  ActivityItemType_Default:0,ActivityItemType_Crop:2,ActivityItemType_Meal:3,
  ActivityItemType_Seed:4,ActivityItemType_Flower:8,ActivityItemType_Fish:10,
  ActivityItemType_Ingredient:11,ActivityItemType_RequestItem:12,
  ActivityItemType_Ephemeral:13,ActivityItemType_LootPresent:14,
  ActivityItemType_Consummable:15,ActivityItemType_Mineral:16,
  ActivityItemType_CraftingMaterial:17,ActivityItemType_BuffElixir:18,ActivityItemType_Manual:19
});
export const STEAM626_FACE_PARTS=Object.freeze({Eyes:0,Nose:1,Mouth:2,Jaw:3});
export const STEAM626_CLOTHING_SLOTS=Object.freeze({
  CloTopInner:0,CloBottomInner:1,CloFeet:2,AccHeadFace:3,AccHeadHat:4,BodHair:5,
  AccHand:6,CloTopOuter:7,AccBack:8,CloFullbody:9,AccHeadEar:10,AccWrist:11,
  AccNeckOuter:12,AccNeckInner:13,CloBottomHose:14,CloBottomOuter:15,
  FaceHairUpper:16,FaceHairLower:17
});
const entries=Object.entries(STEAM626_NATIVE_ITEM_TYPES);
// Item is a signed int32. Item.Type divides by ItemTypeFilter=10^7.
// This proves the type prefix, NOT the existence, canonical variation or rights.
export function steam626ItemTypeOf(itemId){
  if(!Number.isSafeInteger(itemId)||itemId<=0||itemId>2147483647)return null;
  const type=Math.floor(itemId/10000000);
  if(type===0)return null;
  return entries.find(([,value])=>value===type)?.[0]??null;
}
export function isSteam626NativeItemType(token){
  return typeof token==='string'&&Object.hasOwn(STEAM626_NATIVE_ITEM_TYPES,token);
}
export function isSteam626ExistingListAmountType(token,itemId){
  // Deliberately narrow product candidate subset. Clothing/skin ownership
  // and other types remain read-only until operation-specific proof.
  return (token==='ItemType_ActivityItem'||token==='ItemType_Furniture')&&
    steam626ItemTypeOf(itemId)===token;
}

// Derived only from the SHA-pinned private same-build packaged data; no asset bytes.
// Live overrides, actual ItemDB membership, ownership and session legality remain Core-owned.
export const STEAM626_PACKAGED_NATIVE_DATA=Object.freeze({
  protoDbSha256:'1912bb552abddac8b112fa5a781a0401672add38a62276d6c9174db39b899ae1',
  stackEntrySha256:'fab3a692d5e54bb2a03695b241600f0018a8918571759cbf193c6eec88c3deaa',
  resourcesSha256:'7ecdb997d1bc2f451b5609bdc26292fd5f390a27c524da12ec9f14b60a395b29',
  avatarBundleSha256:'d5d12176081a598ed87352ccb4dc90833238b6b89c2317192daf7aebcda4b60d',
  catalogCounts:Object.freeze({ActivityItem:3716,Furniture:6233,Clothing:1900,AvatarFeature:43,Skin:146,Makeup:67}),
  packagedItemStackExceptions:0,writerAuthorized:false
});
export const STEAM626_PACKAGED_STACK_BY_ACTIVITY_SUBTYPE=Object.freeze({
  0:50,2:50,3:50,4:50,8:50,10:50,11:50,12:99,14:1,15:50,16:50,17:99,18:50,19:50
});
export const STEAM626_PACKAGED_AVATAR_COUNTS=Object.freeze({
  BodyType:6,FaceType:8,SkinColorIndex:30,HairColorIndex:90,HairHighlightColor:90,
  EyeColorIndex:75,MakeupColorIndex:75,DefaultSkinCategory:17,MonsterSkinCategory:13
});
export const STEAM626_NATIVE_SKIN_TARGETS=Object.freeze({
  Character:Object.freeze({subtype:0,definitionField:'CharacterItemID',fieldNumber:10}),
  Castle:Object.freeze({subtype:3,definitionField:'SkinAssetType',fieldNumber:6,value:0}),
  Plaza:Object.freeze({subtype:3,definitionField:'SkinAssetType',fieldNumber:6,value:1}),
  Mount:Object.freeze({subtype:4,definitionField:'MountItemID',fieldNumber:10})
});
// Same-build typed subitems divide the ID remainder by 10^5. This is
// classification only, not existence or compatibility with a specific target.
export function steam626NativeSubItemType(itemId){
  if(!steam626ItemTypeOf(itemId))return null;
  return Math.floor((itemId%10000000)/100000);
}
export function steam626PackagedChestStackBound(itemId){
  if(steam626ItemTypeOf(itemId)!=='ItemType_ActivityItem')return null;
  const subtype=steam626NativeSubItemType(itemId);
  return Object.hasOwn(STEAM626_PACKAGED_STACK_BY_ACTIVITY_SUBTYPE,subtype)
    ?STEAM626_PACKAGED_STACK_BY_ACTIVITY_SUBTYPE[subtype]:null;
}
// A conservative source-only nonnegative index check, not a right to equip.
// Monster skin indices deliberately excluded; no negative/sentinel support.
export function isSteam626PackagedAvatarIndex(field,index){
  if(typeof field!=='string'||!Object.hasOwn(STEAM626_PACKAGED_AVATAR_COUNTS,field)||
    field==='DefaultSkinCategory'||field==='MonsterSkinCategory'||
    !Number.isSafeInteger(index)||index<0)return false;
  return index<(field==='SkinColorIndex'?STEAM626_PACKAGED_AVATAR_COUNTS.DefaultSkinCategory:
    STEAM626_PACKAGED_AVATAR_COUNTS[field]);
}

const field=(domain,path,type,fieldNumber,limit,saveShape='NATIVE_SCHEMA_ONLY')=>Object.freeze({
  domain,path,type,fieldNumber,limit,saveShape,writerAuthorized:false
});
const avatar='/Player/{FemaleAvatar|MaleAvatar}';
export const STEAM626_NATIVE_FIELDS=Object.freeze([
  field('Inventory','/Player/ListInventories/{inventoryId}/Inventory/{canonicalItemId}/Amount','int32',1,'EXISTING_POSITIVE_DECREASE_ONLY_DEV_1_TO_9999','REAL_SAVE_V2_E1172'),
  field('Inventory','/Player/ListInventories/{inventoryId}/CompatibleItemType','ItemType enum string',3,'EXACT_NATIVE_TOKEN_AND_ITEM_ID_TYPE','REAL_SAVE_V2_E1172'),
  field('Inventory','/Player/ListInventories/{inventoryId}/Inventory/{canonicalItemId}/Marker','ItemMarker enum',2,'PRESERVE'),
  field('Chest','/Player/ContainerInventories/{containerId}/Inventory/{slot}/Amount','int32',2,'EXISTING_POSITIVE_DECREASE_ONLY_DEV_1_TO_9999','REAL_SAVE_V2_E1172'),
  field('Chest','/Player/ContainerInventories/{containerId}/Inventory/{slot}/State','ItemState message',3,'PRESERVE_EXACT_PRESENT_OR_ABSENT'),
  field('Chest','/Player/ContainerInventories/{containerId}/Inventory/{slot}/ItemID','int32',1,'EXISTING_ITEM_ID'),
  field('Chest','/Player/ContainerInventories/{containerId}/ID','uint32',1,'MAP_KEY_ID_MATCH'),
  field('Chest','/Player/ContainerInventories/{containerId}/Size','int32',2,'CAPACITY_NOT_SLOT_ARRAY_LENGTH'),
  field('Chest','/Player/ContainerInventories/{containerId}/BelongsToPlayer','bool',4,'REQUIRE_TRUE'),
  field('Chest','/Player/ContainerInventories/{containerId}/BlockMoveTo','bool',5,'PRESERVE_AND_CORE_CHECK'),
  field('Chest','/Player/ContainerInventories/{containerId}/ParentItemID','nullable int32',6,'RESOLVE_ACTUAL_PARENT_AND_ACTIVE_REFS'),
  field('Chest','/Player/ContainerInventories/{containerId}/ExtraSize','int32',7,'SIZE_WITHOUT_EXTRAS_EQUALS_SIZE_MINUS_EXTRA_SIZE'),
  field('Appearance','/Player/AvatarIsMale','bool',14,'SELECT_EXISTING_AVATAR_NO_GENDER_CHANGE'),
  field('Appearance',avatar+'/BodyType','int32',8,'PACKAGED_0_TO_5_BOTH_GENDERS_CORE_ALLOWED_SET_REQUIRED'),
  field('Appearance',avatar+'/SkinColorIndex','int32',4,'PACKAGED_0_TO_29_DEFAULT_0_TO_16_ONLY_CANDIDATE_CORE_ALLOWED_SET_REQUIRED'),
  field('Appearance',avatar+'/HairColorIndex','int32',6,'PACKAGED_0_TO_89_CORE_ALLOWED_SET_REQUIRED'),
  field('Appearance',avatar+'/HairHighlightColor','int32',7,'PACKAGED_0_TO_89_CORE_ALLOWED_SET_REQUIRED'),
  field('Appearance',avatar+'/FaceType/{facePart}','map<uint32,int32>',9,'FACE_PART_0_TO_3_AND_PACKAGED_INDEX_0_TO_7_CORE_ALLOWED_SET_REQUIRED'),
  field('Appearance',avatar+'/Eyeball/EyeballItemID','int32',1,'AVATAR_FEATURE_EYEBALL_AND_OWNED'),
  ...[1,2,3].map(n=>field('Appearance',avatar+'/Eyeball/ColorIndex'+n,'int32',n+1,'PACKAGED_0_TO_74_CORE_ALLOWED_SET_REQUIRED')),
  field('Appearance',avatar+'/Makeup/{slot}','map<uint32,Makeup>',10,'OWNED_MAKEUP_AND_PACKAGED_PALETTE_0_TO_74_CORE_ALLOWED_SET_REQUIRED'),
  field('Wardrobe',avatar+'/Clothes/{clothingSlot}','map<uint32,int32>',2,'SLOT_0_TO_17_AND_ACTUAL_OWNED_COMPATIBLE_CLOTHING'),
  field('Wardrobe',avatar+'/IncompatibleClothes/{clothingSlot}','map<uint32,int32>',3,'PRESERVE_NATIVE_CONFLICTS'),
  field('Wardrobe',avatar+'/ClothingCustomization/{itemId}','map<int32,int32>',11,'PRESERVE_DESIGN_REFERENCE'),
  field('OwnedSkin','/World/Characters/{index}/SkinID','int32',23,'CHARACTER_TARGET_AND_OWNED_SKIN'),
  field('OwnedSkin','/World/CastleSkinItemID','int32',39,'CASTLE_TARGET_AND_OWNED_SKIN'),
  field('OwnedSkin','/World/PlazaSkinItemID','int32',41,'PLAZA_TARGET_AND_OWNED_SKIN'),
  field('OwnedSkin','/Player/Mounts/{index}/SkinItemID','int32',3,'MOUNT_TARGET_AND_OWNED_SKIN')
]);
export const STEAM626_NATIVE_QUANTITY_RULES=Object.freeze({
  listZero:'NATIVE_REMOVE_SUBTRACTS_EXISTING_AMOUNT_RETAINS_KEY_AND_MARKER',
  chestZero:'NATIVE_REMOVE_RESETS_AMOUNT_ITEM_ID_AND_STATE_AT_ZERO',
  chestStack:'ITEM_EXCEPTION_BEFORE_ACTIVITY_SUBTYPE; PACKAGED_STACK_CONFIRMED; LIVE_TARGET_AND_CONFIG_REQUIRED',
  chestCapacity:'SIZE_MINUS_EXTRA_SIZE; NATIVE_GET_SLOT_CAN_MATERIALIZE',
  devBounds:'POSITIVE_DECREASE_1_TO_9999_NOT_NATIVE_CAP',
  nativeV3Accepted:false,writerAuthorized:false,
  authority:'01A_SINGLE_PRODUCTSESSION_MUST_RESOLVE_TARGET_AND_01E_CONSUMER_DEPENDENCIES'
});
