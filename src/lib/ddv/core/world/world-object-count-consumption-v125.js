/* Dreamwish Wand DDV Core 01B — v1.25 world-object count consumption.
 * Read/model/counting only. No placement blocking and no persistent writer.
 */
'use strict';

export const WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA='ddv.world-object-count-consumption@1';
export const WORLD_OBJECT_COUNT_RESULT_SCHEMA='ddv.world-object-count-consumption-result@1';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';
export const TITLE_ID='0100D39012C1A000';

export const COUNT_PROFILE=Object.freeze({
  PRESET_VILLAGE_CONTRIBUTION:'PRESET_VILLAGE_GENERIC_CONTRIBUTION',
  NATIVE_VILLAGE:'NATIVE_VILLAGE_GENERIC_OBJECT_LIMIT',
  NATIVE_ROOM:'NATIVE_ROOM_GENERIC_OBJECT_LIMIT',
  NATIVE_FLOATING_ISLAND:'NATIVE_FLOATING_ISLAND_NO_OBJECT_LIMIT'
});

export const NATIVE_SCOPE=Object.freeze({
  VILLAGE:'VILLAGE',
  ROOM:'ROOM',
  FLOATING_ISLAND:'FLOATING_ISLAND',
  UNKNOWN:'UNKNOWN'
});

const ITEM_TYPE=Object.freeze({
  ACTIVITY_ITEM:3,
  FURNITURE:4
});
const ACTIVITY_SUBTYPE=Object.freeze({
  EPHEMERAL:13
});
const FURNITURE_SUBTYPE=Object.freeze({
  DEFAULT:0,
  GROUND_ALTERATION:1,
  LANDSCAPING:2,
  DOOR:3,
  REQUEST:5,
  BLOCKER:6,
  FENCE:7,
  ANCIENT_MACHINE:8,
  SNIPPET_TRAP:9
});
const ROOM_MANNEQUIN_ITEM_IDS=Object.freeze([
  40001920,40001921,40001922,40001923,40001924,40001925
]);
const PROFILES=new Set(Object.values(COUNT_PROFILE));

function clone(v){return structuredClone(v);}
function own(o,k){return Boolean(o&&Object.prototype.hasOwnProperty.call(o,String(k)));}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function uniq(xs){return [...new Set(xs)];}
function freezeRows(xs){return Object.freeze(xs.map(x=>Object.freeze(x)));}

function sourceBlockers(source){
  const out=[];
  if(source?.platform!=='Nintendo Switch')out.push('EXACT_SWITCH_PLATFORM_REQUIRED');
  if(source?.gameVersion!==GAME_VERSION)out.push('EXACT_V125_GAME_VERSION_REQUIRED');
  if(Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA)out.push('EXACT_SCHEMA_624_REQUIRED');
  if(source?.buildIdentity!==SWITCH_BID)out.push('EXACT_SWITCH_BID_REQUIRED');
  return out;
}

function definitionAt(definitionIndex,itemId){
  return definitionIndex?.[String(itemId)]??definitionIndex?.[itemId]??null;
}

function normalizeDefinition(raw,itemId){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){
    return {status:'UNKNOWN',reason:'DEFINITION_EVIDENCE_MISSING',itemId};
  }
  const recordItemId=int(raw.itemID??raw.itemId??itemId);
  const itemType=int(raw.itemType);
  const subtype=int(raw.subtype);
  if(recordItemId!==itemId){
    return {status:'UNKNOWN',reason:'DEFINITION_ITEM_ID_MISMATCH',itemId};
  }
  if(itemType===null){
    return {status:'UNKNOWN',reason:'DEFINITION_ITEM_TYPE_MISSING',itemId};
  }
  if((itemType===ITEM_TYPE.FURNITURE||itemType===ITEM_TYPE.ACTIVITY_ITEM)&&subtype===null){
    return {status:'UNKNOWN',reason:'DEFINITION_SUBTYPE_MISSING',itemId};
  }
  return {
    status:'KNOWN',
    itemId,
    itemType,
    itemTypeName:String(raw.itemTypeName??''),
    subtype,
    subtypeName:String(raw.subtypeName??''),
    concreteType:String(raw.concreteItemDataType??raw.concreteType??'')
  };
}

function exclusionForKnown(def,profile){
  if(profile===COUNT_PROFILE.NATIVE_ROOM){
    return null;
  }
  if(profile===COUNT_PROFILE.NATIVE_FLOATING_ISLAND){
    return {reason:'NATIVE_FLOATING_ISLAND_HAS_NO_OBJECT_LIMIT_PROVIDER',nativeNotApplicable:true};
  }
  // Current Village ObjectLimitData exclusions:
  // ActivityItem/Ephemeral, Furniture/GroundAlteration, Furniture/Fence.
  if(def.itemType===ITEM_TYPE.ACTIVITY_ITEM&&def.subtype===ACTIVITY_SUBTYPE.EPHEMERAL){
    return {reason:'VILLAGE_OBJECT_LIMIT_EXCLUSION_EPHEMERAL'};
  }
  if(def.itemType===ITEM_TYPE.FURNITURE&&def.subtype===FURNITURE_SUBTYPE.GROUND_ALTERATION){
    return {reason:'VILLAGE_OBJECT_LIMIT_EXCLUSION_GROUND_ALTERATION'};
  }
  if(def.itemType===ITEM_TYPE.FURNITURE&&def.subtype===FURNITURE_SUBTYPE.FENCE){
    return {reason:'VILLAGE_OBJECT_LIMIT_EXCLUSION_FENCE'};
  }
  return null;
}

export function classifyWorldObjectCountContributionV125({
  source,definition,profile=COUNT_PROFILE.PRESET_VILLAGE_CONTRIBUTION
}={}){
  const blockers=sourceBlockers(source);
  if(!PROFILES.has(profile))blockers.push('COUNT_PROFILE_UNSUPPORTED');
  const itemId=int(definition?.itemID??definition?.itemId);
  if(itemId===null||itemId<=0)blockers.push('ITEM_ID_REQUIRED');
  if(blockers.length){
    return Object.freeze({
      schema:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
      status:'UNKNOWN',
      contributesToTotalObjects:'UNKNOWN',
      contributesToDistinctObjectTypes:'UNKNOWN',
      reasonCodes:Object.freeze(uniq(blockers)),
      distinctGroupingKey:null
    });
  }
  const def=normalizeDefinition(definition,itemId);
  if(def.status!=='KNOWN'){
    return Object.freeze({
      schema:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
      status:'UNKNOWN',
      contributesToTotalObjects:'UNKNOWN',
      contributesToDistinctObjectTypes:'UNKNOWN',
      reasonCodes:Object.freeze([def.reason]),
      distinctGroupingKey:null
    });
  }
  const exclusion=exclusionForKnown(def,profile);
  if(exclusion?.nativeNotApplicable){
    return Object.freeze({
      schema:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
      status:'NOT_APPLICABLE',
      contributesToTotalObjects:'NO_NATIVE_COUNTER',
      contributesToDistinctObjectTypes:'NO_NATIVE_COUNTER',
      reasonCodes:Object.freeze([exclusion.reason]),
      distinctGroupingKey:null,
      definition:Object.freeze(def)
    });
  }
  if(exclusion){
    return Object.freeze({
      schema:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
      status:'VERIFIED_EXCLUDED',
      contributesToTotalObjects:'NO',
      contributesToDistinctObjectTypes:'NO',
      reasonCodes:Object.freeze([exclusion.reason]),
      distinctGroupingKey:null,
      definition:Object.freeze(def)
    });
  }
  return Object.freeze({
    schema:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
    status:'VERIFIED_INCLUDED',
    contributesToTotalObjects:'YES',
    contributesToDistinctObjectTypes:'YES',
    reasonCodes:Object.freeze([]),
    distinctGroupingKey:Object.freeze({kind:'ITEM_ID',value:itemId}),
    definition:Object.freeze(def)
  });
}

function normalizeRootObjects(objects){
  if(!Array.isArray(objects))throw Error('WORLD_OBJECT_COUNT_OBJECTS_REQUIRED');
  return objects;
}

function portableStateOf(raw){
  return raw?.portableState??raw?.state??null;
}

function flattenObject(raw,relation,path,out,blockers){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)){
    blockers.push({code:'PRESET_OBJECT_INVALID',path});
    return;
  }
  const itemId=int(raw.itemId??raw.ItemID);
  if(itemId===null||itemId<=0){
    blockers.push({code:'PRESET_OBJECT_ITEM_ID_INVALID',path});
    return;
  }
  out.push({
    occurrenceId:path,
    itemId,
    relation
  });

  const state=portableStateOf(raw);
  if(state==null)return;
  if(typeof state!=='object'||Array.isArray(state)){
    blockers.push({code:'PRESET_PORTABLE_STATE_INVALID',path});
    return;
  }
  const codec=String(state.codec??'');
  if(!codec||codec==='none'||codec==='subgrid.itemdata-default-empty-child@1')return;
  if(codec!=='subgrid.serialized-local-child@1'){
    blockers.push({code:'PRESET_PORTABLE_STATE_CODEC_UNKNOWN',path,codec});
    return;
  }
  const child=state.child;
  if(!child||typeof child!=='object'||!Array.isArray(child.objects)){
    blockers.push({code:'PRESET_SUBGRID_CHILD_INVALID',path});
    return;
  }
  child.objects.forEach((entry,index)=>{
    flattenObject(
      entry,
      'SUBGRID_DESCENDANT',
      `${path}/subgrid/${String(entry?.artifactObjectId??index)}`,
      out,
      blockers
    );
  });
}

function networkSummary(networks){
  const roads=networks?.roads??null;
  const fences=networks?.fences??null;
  return {
    roadsPresent:roads!==null&&roads!==undefined,
    fencesPresent:fences!==null&&fences!==undefined,
    roadLogicalCount:Array.isArray(roads)?roads.length:(roads?1:0),
    fenceLogicalCount:Array.isArray(fences)?fences.length:(fences?1:0)
  };
}

function nativeScopeMetadata(scope){
  switch(scope){
    case NATIVE_SCOPE.VILLAGE:
      return {
        scope:'VILLAGE',
        provider:'ObjectLimitData',
        aggregateBoundary:'PER_VILLAGE_ACROSS_RELATED_ROOT_GRIDS_AND_RECURSIVE_SUBGRIDS',
        normalLimits:{uniqueLimit:600,instanceLimit:3000},
        highEndLimits:{uniqueLimit:1200,instanceLimit:6000},
        exclusions:['ActivityItem/Ephemeral','Furniture/GroundAlteration','Furniture/Fence']
      };
    case NATIVE_SCOPE.ROOM:
      return {
        scope:'ROOM',
        provider:'HouseExpansion.Interior.RoomObjectLimit',
        aggregateBoundary:'PER_PLAYER_HOUSE_ROOM_RELATED_GRIDS_AND_RECURSIVE_SUBGRIDS',
        genericLimits:{uniqueLimit:-1,instanceLimit:-1},
        exclusions:[],
        specificItemLimits:[{
          itemIds:[...ROOM_MANNEQUIN_ITEM_IDS],
          instanceLimit:5,
          locId:'menu.editmode_limit_mannequin_total_reach'
        }]
      };
    case NATIVE_SCOPE.FLOATING_ISLAND:
      return {
        scope:'FLOATING_ISLAND',
        provider:null,
        aggregateBoundary:'NO_NATIVE_OBJECT_LIMIT_PROVIDER_IN_WORLD_ISLIMITEDGRID',
        genericLimits:null,
        exclusions:null
      };
    default:
      return {
        scope:'UNKNOWN',
        provider:null,
        aggregateBoundary:'UNKNOWN',
        genericLimits:null,
        exclusions:null
      };
  }
}

export function countWorldObjectConsumptionV125({
  source,
  objects,
  networks=null,
  definitionIndex,
  profile=COUNT_PROFILE.PRESET_VILLAGE_CONTRIBUTION,
  sourceNativeScope=NATIVE_SCOPE.UNKNOWN
}={}){
  const blockers=sourceBlockers(source).map(code=>({code}));
  if(!PROFILES.has(profile))blockers.push({code:'COUNT_PROFILE_UNSUPPORTED'});
  const occurrences=[];
  try{
    normalizeRootObjects(objects).forEach((entry,index)=>{
      flattenObject(
        entry,
        'ROOT',
        String(entry?.artifactObjectId??entry?.editorId??`root:${index}`),
        occurrences,
        blockers
      );
    });
  }catch(error){
    blockers.push({code:error instanceof Error?error.message:'WORLD_OBJECT_COUNT_OBJECTS_INVALID'});
  }

  const counted=[];
  const excluded=[];
  const unknown=[];
  const groups=new Set();

  for(const occ of occurrences){
    const rawDef=definitionAt(definitionIndex,occ.itemId);
    const def=normalizeDefinition(rawDef,occ.itemId);
    if(def.status!=='KNOWN'){
      const row={...occ,code:def.reason};
      unknown.push(row);
      continue;
    }
    const classification=classifyWorldObjectCountContributionV125({
      source,
      definition:{
        itemID:def.itemId,
        itemType:def.itemType,
        itemTypeName:def.itemTypeName,
        subtype:def.subtype,
        subtypeName:def.subtypeName,
        concreteItemDataType:def.concreteType
      },
      profile
    });
    if(classification.status==='UNKNOWN'||classification.status==='NOT_APPLICABLE'){
      unknown.push({
        ...occ,
        code:classification.reasonCodes[0]??'COUNT_CLASSIFICATION_UNKNOWN'
      });
      continue;
    }
    if(classification.status==='VERIFIED_EXCLUDED'){
      excluded.push({
        ...occ,
        reason:classification.reasonCodes[0],
        definition:def
      });
      continue;
    }
    groups.add(occ.itemId);
    counted.push({
      ...occ,
      groupingKey:occ.itemId,
      definition:def
    });
  }

  const ns=networkSummary(networks);
  if(ns.roadsPresent){
    excluded.push({
      occurrenceId:'networks/roads',
      relation:'NETWORK',
      itemId:null,
      reason:'VILLAGE_OBJECT_LIMIT_EXCLUSION_GROUND_ALTERATION',
      logicalNetworkCount:ns.roadLogicalCount
    });
  }
  if(ns.fencesPresent){
    excluded.push({
      occurrenceId:'networks/fences',
      relation:'NETWORK',
      itemId:null,
      reason:'VILLAGE_OBJECT_LIMIT_EXCLUSION_FENCE',
      logicalNetworkCount:ns.fenceLogicalCount
    });
  }

  blockers.push(...unknown.map(x=>({
    code:'UNKNOWN_COUNT_CONSUMPTION',
    occurrenceId:x.occurrenceId,
    itemId:x.itemId,
    detail:x.code
  })));
  const uniqueBlockers=uniq(blockers.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x));
  const verified=uniqueBlockers.length===0;

  const rootCount=occurrences.filter(x=>x.relation==='ROOT').length;
  const childCount=occurrences.length-rootCount;
  return Object.freeze({
    schema:WORLD_OBJECT_COUNT_RESULT_SCHEMA,
    status:verified?'VERIFIED':'BLOCKED',
    countProfile:profile,
    distinctObjectTypes:verified?groups.size:null,
    totalObjects:verified?counted.length:null,
    rawPresetContents:Object.freeze({
      rootGridObjectNodes:rootCount,
      subGridDescendantNodes:childCount,
      gridObjectNodes:occurrences.length,
      roadLogicalContents:ns.roadLogicalCount,
      fenceLogicalContents:ns.fenceLogicalCount,
      combinedRawObjectCountIntentionallyUndefined:true
    }),
    countedOccurrences:freezeRows(counted.map(clone)),
    excludedNonConsumingContents:freezeRows(excluded.map(clone)),
    unknownBlockers:freezeRows(uniqueBlockers.map(clone)),
    sourceNativeScope:Object.freeze(nativeScopeMetadata(sourceNativeScope)),
    metadata:Object.freeze({
      platform:'Nintendo Switch',
      gameVersion:GAME_VERSION,
      buildId:SWITCH_BID,
      profileSchemaVersion:PROFILE_SCHEMA,
      distinctGroupingIdentity:'EXACT_ITEM_ID',
      duplicateInstanceBehavior:'EACH_INCLUDED_OCCURRENCE_INCREMENTS_TOTAL; FIRST_ITEM_ID_OCCURRENCE_ONLY_INCREMENTS_DISTINCT',
      subGridBehavior:'PARENT_GRID_OBJECT_COUNTS_BY_OWN_ITEM; DESCENDANT_GRID_OBJECTS_RECURSE_AND_COUNT_INDEPENDENTLY',
      presetReportingSemantics:'VILLAGE_GENERIC_LIMIT_CONTRIBUTION_NOT_RAW_SERIALIZED_NODE_COUNT',
      placementBlockingImplemented:false,
      persistentWriteAuthorized:false,
      WORLD_PERSISTENT_WRITE_V125:false,
      PERSISTENT_WRITE:false,
      productApplyAuthorized:false,
      directSourceReplacementAuthorized:false
    })
  });
}

export function buildDefinitionIndexFromCurrentGameDbItemsV125(items=[]){
  const out={};
  for(const raw of items){
    const itemId=int(raw?.itemID);
    if(itemId===null||itemId<=0)continue;
    const itemType=int(raw?.itemType);
    const subtype=int(raw?.subtype);
    if(itemType===null)continue;
    out[String(itemId)]=Object.freeze({
      itemID:itemId,
      itemType,
      itemTypeName:String(raw?.itemTypeName??''),
      subtype,
      concreteItemDataType:String(raw?.concreteItemDataType??'')
    });
  }
  return Object.freeze(out);
}

export const CURRENT_V125_ROOM_MANNEQUIN_ITEM_IDS=ROOM_MANNEQUIN_ITEM_IDS;
export const CURRENT_V125_ITEM_TYPES=Object.freeze({ITEM_TYPE,ACTIVITY_SUBTYPE,FURNITURE_SUBTYPE});
