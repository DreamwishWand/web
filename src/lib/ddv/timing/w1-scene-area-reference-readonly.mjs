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

/**
 * Requires already-opened original-source JSON, not UI cursors.
 * SourceContext {platform, gameVersion, bid, schema, sourceSha256,
 * sourceRevision} is checked for consistency only. No signature,
 * original P1G hash or Core-minted revision is verified here.
 *
 * Exact save source container refs are checked, but no game Native geometry,
 * default GridData, occupied Tree anchors or item quota are calculated.
 */
export function inspectW1SceneAreaReferences(profile, sourceContext) {
  if(!record(profile)||!record(profile.GameInfo)||!record(profile.World)||
     !record(sourceContext))return sourceRefusal('PROFILE_OR_CONTEXT_MISSING');
  if(profile.GameInfo.Version !== W1_SCENE_AREA_SOURCE.schema ||
     Object.entries(W1_SCENE_AREA_SOURCE).some(([k, v]) =>
       ['platform','gameVersion','bid','schema'].includes(k) && sourceContext[k] !== v))
    return sourceRefusal('EXACT_EXTERNAL_VERSION_BID_SCHEMA_REQUIRED');
  if(!sha(sourceContext.sourceSha256) ||
     typeof sourceContext.sourceRevision !== 'string' ||
     !sourceContext.sourceRevision)
    return sourceRefusal('SOURCE_PROVENANCE_REFERENCE_REQUIRED');

  const villages = profile.World.Villages;
  const collection = profile.World.GridCollection;
  if(!Array.isArray(villages) || villages.length === 0 || villages.length > 64 ||
     !record(collection) || !record(collection.Grids) || !record(collection.DiffGrids))
    return sourceRefusal('VILLAGE_ARRAY_OR_GRID_COLLECTION_INVALID');

  // The Native Scene ID is from independently accepted original RomFS/Scene,
  // not a user-selected village or the array position.
  const matches = [];
  for(let i=0; i<villages.length; i++){
    const village=villages[i];
    if(!record(village) || !intId(village.SceneItemId))
      return sourceRefusal('SCENE_ITEM_ID_INVALID');
    if(village.SceneItemId===W1_SCENE_AREA_SOURCE.originalNativeVillageSceneId)
      matches.push([i,village]);
  }
  if(matches.length!==1)
    return sourceRefusal(matches.length?'SCENE_ID_NOT_UNIQUE':'SCENE_ID_NOT_FOUND');

  const [villageIndex, village] = matches[0];
  if(!record(village.Areas) || Object.keys(village.Areas).length===0 ||
     Object.keys(village.Areas).length>512)
    return sourceRefusal('SCENE_AREAS_INVALID_OR_EXCESSIVE');

  let totalGridRefs=0;
  const candidates=[];
  for(const [areaKey, area] of Object.entries(village.Areas)){
    if(!canonical(areaKey)||!record(area)||
       typeof area.Unlocked !== 'boolean'||
       !Array.isArray(area.GridIDs)||area.GridIDs.length>2048)
      return sourceRefusal('AREA_KEY_UNLOCK_OR_GRIDIDS_INVALID');
    const seen=new Set();
    const refs=[];
    for(const gridId of area.GridIDs){
      if(!intId(gridId)||seen.has(gridId))
        return sourceRefusal('GRID_ID_INVALID_OR_DUPLICATED_WITHIN_AREA');
      seen.add(gridId);
      if(++totalGridRefs>10000)return sourceRefusal('SOURCE_GRID_REFERENCE_BUDGET_EXCEEDED');
      const key=String(gridId);
      const regular=Object.hasOwn(collection.Grids,key);
      const diff=Object.hasOwn(collection.DiffGrids,key);
      if(!regular&&!diff)return sourceRefusal('SOURCE_GRID_REFERENCE_MISSING');
      const g=regular?collection.Grids[key]:collection.DiffGrids[key];
      if(!record(g)||g.ID!==gridId)
        return sourceRefusal('SOURCE_GRID_MAP_ID_MISMATCH');
      refs.push(freeze({gridId,sourceKind:regular&&diff?'GRIDS_AND_DIFF_UNRESOLVED':
        regular?'GRIDS_ONLY':'DIFF_ONLY_DEFAULT_UNRESOLVED',
        effectiveGridVerified:false}));
    }
    candidates.push(freeze({
      saveAreaKey:areaKey,
      // Unlocked is a *saved boolean*, not proof that Native progression,
      // Quest, scene restriction and GetGridsFromScene will accept this area.
      savedUnlockedRaw:area.Unlocked,
      sourceGridRefs:freeze(refs),
      nativeWetlandMembershipVerified:false,
      nativeTreeEligibilityVerified:false,
      nativeSoftwoodQuotaVerified:false
    }));
  }
  candidates.sort((a,b)=>Number(a.saveAreaKey)-Number(b.saveAreaKey));
  return freeze({
    contract:W1_SCENE_AREA_REFERENCE_CONTRACT,
    status:'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY',
    sceneId:W1_SCENE_AREA_SOURCE.originalNativeVillageSceneId,
    villageIndex,sceneMatchCount:1,
    sourceCandidates:freeze(candidates),
    // The source Native VillageAreaType.Wetland=1 is NOT proved equal to
    // any saved Areas key, even if the string "1" happens to be present.
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
}
