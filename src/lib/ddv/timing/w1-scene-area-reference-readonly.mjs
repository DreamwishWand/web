/**
 * 01E / W-NATIVE-005 — source-only SceneItemId -> candidate Area/GridIDs.
 *
 * This is a read-only structural projection for Switch 1.25.3/schema626.
 * It does NOT decode P1G, verify a caller's source SHA, infer the Native
 * VillageAreaType enum-to-save-key mapping, or authorize an edited-copy.
 * The upstream Rust SaveSession must own actual source identity and CAS.
 */
export const W1_SCENE_AREA_REFERENCE_CONTRACT = 'wand.01e.w1-scene-area-reference@1';

export const W1_SCENE_AREA_SOURCE = Object.freeze({
  platform: 'Nintendo Switch',
  gameVersion: '1.25.3',
  bid: '9A239D3DB569756D',
  schema: 626,
  sourceEventId: 2010000021,
  originalNativeVillageSceneId: 1540000000,
  nativeWetlandAreaEnum: 1,
  sourceSoftwoodItemId: 31700014
});

const freeze = Object.freeze;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const intId = v => Number.isSafeInteger(v) && v >= 0;
const canonical = k => /^(0|[1-9]\d*)$/.test(k) && Number.isSafeInteger(Number(k));
const sha = v => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const sourceRefusal = reason => freeze({
  contract: W1_SCENE_AREA_REFERENCE_CONTRACT,
  status: 'SOURCE_STRUCTURE_REJECTED',
  reason,
  sourceSceneReferenceMatched: false,
  actualWetlandAreaVerified: false,
  nativeEffectiveGridVerified: false,
  nativeSoftwoodQuotaVerified: false,
  nativeProducerConsumerVerified: false,
  inputAuthenticatedByThisReader: false,
  sourceRevisionCasVerified: false,
  productWriterAuthorized: false,
  productEditedCopyAuthorized: false,
  originalOverwriteAuthorized: false,
  automatic2126RepairAuthorized: false
});

// A clone alone is unsafe: structuredClone invokes enumerable getters on
// ordinary nested objects before deciding whether a value is cloneable.
// Traverse *all* own descriptors of the selected Areas subtree without reading
// their properties, and reject accessors, unsupported JSON shapes and cycles.
// The bounded walk is NOT an authentication oracle for original P1G bytes.
// Exotic Proxy ownKeys may lie here but structuredClone later rejects Proxy.
const plainAreaSubtree = root => {
  const queue=[root],seen=new WeakSet();
  let nodes=0,fields=0;
  while(queue.length){
    const current=queue.pop();
    if(!record(current) && !Array.isArray(current))return false;
    if(seen.has(current)||++nodes>16000)return false;
    seen.add(current);
    const array=Array.isArray(current);
    const prototype=Object.getPrototypeOf(current);
    if(prototype!==(array?Array.prototype:Object.prototype) && prototype!==null)
      return false;
    const keys=Reflect.ownKeys(current);
    if(fields+keys.length>40000)return false;
    fields+=keys.length;
    for(const key of keys){
      if(typeof key!=='string')return false;
      const desc=Object.getOwnPropertyDescriptor(current,key);
      if(!desc||!Object.hasOwn(desc,'value'))return false;
      if(array && key==='length'){
        if(desc.enumerable || !Number.isSafeInteger(desc.value) ||
           desc.value<0||desc.value>10000)return false;
        continue;
      }
      if(!desc.enumerable)return false;
      if(array && (!canonical(key)||Number(key)>=current.length))
        return false;
      const value=desc.value;
      if(value===null){
        continue;
      } else if(typeof value==='object'){
        queue.push(value);
      } else if(typeof value==='number'){
        if(!Number.isFinite(value))return false;
      } else if(typeof value!=='string' && typeof value!=='boolean'){
        return false;
      }
    }
  }
  return true;
};

// A Source inspector can receive untrusted JS caller objects, not only JSON.parse.
// One own, enumerable data descriptor per field prevents inherited metadata,
// getter-side time-of-check/time-of-use and hidden variant promotion.
const ownData = (obj,key) => {
  if(!record(obj) && !Array.isArray(obj))return null;
  const descriptor=Object.getOwnPropertyDescriptor(obj,key);
  return descriptor && descriptor.enumerable &&
    Object.hasOwn(descriptor,'value') ? descriptor : null;
};

/**
 * Requires already-opened original-source JSON, not UI cursors.
 * External BID/SHA/Revision strings are UNTRUSTED hints, not a Rust-issued
 * source identity or CAS. Snapshot all source values once from own JSON-style
 * data descriptors; rejection on unsupported proxy/accessor/hidden shapes.
 */
export function inspectW1SceneAreaReferences(profile, sourceContext) {
  try {
    const gameInfo=ownData(profile,'GameInfo')?.value;
    const world=ownData(profile,'World')?.value;
    if(!record(gameInfo)||!record(world)||!record(sourceContext))
      return sourceRefusal('PROFILE_OR_CONTEXT_MISSING');
    if(ownData(gameInfo,'Version')?.value!==W1_SCENE_AREA_SOURCE.schema ||
       Object.entries(W1_SCENE_AREA_SOURCE).some(([k,v])=>
         ['platform','gameVersion','bid','schema'].includes(k) &&
         ownData(sourceContext,k)?.value!==v))
      return sourceRefusal('EXACT_EXTERNAL_VERSION_BID_SCHEMA_REQUIRED');
    const sourceSha=ownData(sourceContext,'sourceSha256')?.value;
    const sourceRevision=ownData(sourceContext,'sourceRevision')?.value;
    if(!sha(sourceSha)||typeof sourceRevision!=='string'||!sourceRevision)
      return sourceRefusal('SOURCE_PROVENANCE_REFERENCE_REQUIRED');

    const villages=ownData(world,'Villages')?.value;
    const collection=ownData(world,'GridCollection')?.value;
    const grids=ownData(collection,'Grids')?.value;
    const diffGrids=ownData(collection,'DiffGrids')?.value;
    if(!Array.isArray(villages)||villages.length<1||villages.length>64||
       !record(grids)||!record(diffGrids))
      return sourceRefusal('VILLAGE_ARRAY_OR_GRID_COLLECTION_INVALID');

    // A scene may be matched only by its own serialized SceneItemId, never a
    // getter read twice or an inherited ID. The index isn't a Native Area ID.
    const matches=[];
    for(let i=0;i<villages.length;i++){
      const village=ownData(villages,String(i))?.value;
      const sceneId=ownData(village,'SceneItemId')?.value;
      if(!record(village)||!intId(sceneId))
        return sourceRefusal('SCENE_ITEM_ID_INVALID');
      if(sceneId===W1_SCENE_AREA_SOURCE.originalNativeVillageSceneId)
        matches.push([i,village]);
    }
    if(matches.length!==1)
      return sourceRefusal(matches.length?'SCENE_ID_NOT_UNIQUE':'SCENE_ID_NOT_FOUND');

    const [villageIndex,village]=matches[0];
    const areas=ownData(village,'Areas')?.value;
    if(!record(areas))return sourceRefusal('SCENE_AREAS_INVALID_OR_EXCESSIVE');
    const areaKeys=Reflect.ownKeys(areas);
    if(areaKeys.length===0||areaKeys.length>512||
       areaKeys.some(key=>typeof key!=='string'))
      return sourceRefusal('SCENE_AREAS_INVALID_OR_EXCESSIVE');

    const candidates=[];
    let totalGridRefs=0;
    for(const areaKey of areaKeys){
      const area=ownData(areas,areaKey)?.value;
      const savedUnlocked=ownData(area,'Unlocked')?.value;
      const gridIDs=ownData(area,'GridIDs')?.value;
      if(!canonical(areaKey)||!record(area)||typeof savedUnlocked!=='boolean'||
         !Array.isArray(gridIDs)||gridIDs.length>2048)
        return sourceRefusal('AREA_KEY_UNLOCK_OR_GRIDIDS_INVALID');
      const seen=new Set(),refs=[];
      for(let i=0;i<gridIDs.length;i++){
        const gridId=ownData(gridIDs,String(i))?.value;
        if(!intId(gridId)||seen.has(gridId))
          return sourceRefusal('GRID_ID_INVALID_OR_DUPLICATED_WITHIN_AREA');
        seen.add(gridId);
        if(++totalGridRefs>10000)
          return sourceRefusal('SOURCE_GRID_REFERENCE_BUDGET_EXCEEDED');

        const key=String(gridId);
        const regularDesc=Object.getOwnPropertyDescriptor(grids,key);
        const diffDesc=Object.getOwnPropertyDescriptor(diffGrids,key);
        const regular=regularDesc!==undefined;
        const diff=diffDesc!==undefined;
        if(!regular&&!diff)return sourceRefusal('SOURCE_GRID_REFERENCE_MISSING');
        // Validate each map's own *data* ID independently. A good Grids entry
        // cannot mask a stale DiffGrids entry with the same map key.
        const regularRow=regular?ownData(grids,key)?.value:null;
        const diffRow=diff?ownData(diffGrids,key)?.value:null;
        if((regular&&(!record(regularRow)||ownData(regularRow,'ID')?.value!==gridId))||
           (diff&&(!record(diffRow)||ownData(diffRow,'ID')?.value!==gridId)))
          return sourceRefusal('SOURCE_GRID_MAP_ID_MISMATCH');
        refs.push(freeze({
          gridId,sourceKind:regular&&diff?'GRIDS_AND_DIFF_UNRESOLVED':
            regular?'GRIDS_ONLY':'DIFF_ONLY_DEFAULT_UNRESOLVED',
          effectiveGridVerified:false
        }));
      }
      candidates.push(freeze({
        saveAreaKey:areaKey,savedUnlockedRaw:savedUnlocked,
        sourceGridRefs:freeze(refs),
        nativeWetlandMembershipVerified:false,
        nativeTreeEligibilityVerified:false,
        nativeSoftwoodQuotaVerified:false
      }));
    }
    // Own-key/descriptor checks alone cannot distinguish a plain parsed
    // Areas map from a standards-conforming Proxy that conceals or invents
    // configurable keys. structuredClone rejects Proxy exotic objects.
    // Clone ONLY the selected Village's Areas subtree, never the whole Save,
    // and fail closed if this local check is unsupported or uncloneable.
    // This does not authenticate the original encrypted P1G or Rust CAS.
    if(typeof structuredClone!=='function' || !plainAreaSubtree(areas))
      return sourceRefusal('SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
    try {
      structuredClone(areas);
    } catch {
      return sourceRefusal('SOURCE_AREA_PLAIN_SNAPSHOT_REQUIRED');
    }
    candidates.sort((a,b)=>Number(a.saveAreaKey)-Number(b.saveAreaKey));
    return freeze({
      contract:W1_SCENE_AREA_REFERENCE_CONTRACT,
      status:'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY',
      sceneId:W1_SCENE_AREA_SOURCE.originalNativeVillageSceneId,
      villageIndex,sceneMatchCount:1,
      sourceCandidates:freeze(candidates),
      nativeWetlandAreaEnum:W1_SCENE_AREA_SOURCE.nativeWetlandAreaEnum,
      selectedNativeWetlandAreaKey:null,
      actualWetlandAreaVerified:false,
      nativeEffectiveGridVerified:false,
      nativeTreeEligibilityVerified:false,
      nativeSoftwoodQuotaVerified:false,
      nativeClockLastNextVerified:false,
      nativeProducerConsumerVerified:false,
      sourceSceneReferenceMatched:true,
      inputAuthenticatedByThisReader:false,
      sourceRevisionCasVerified:false,
      productWriterAuthorized:false,
      productEditedCopyAuthorized:false,
      originalOverwriteAuthorized:false,
      automatic2126RepairAuthorized:false
    });
  } catch {
    // Revoked Proxy/descriptor traps cannot supply a trusted Source witness.
    return sourceRefusal('SOURCE_OBJECT_DESCRIPTOR_UNSAFE');
  }
}
