/* Dreamwish Wand DDV Core 01B — current-v1.25 world-object count-consumption semantics.
 * Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / profile schema 624.
 * Pure read/model API only. No placement blocker and no persistent writer authorization.
 */
'use strict';

export const WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA='ddv.world-object-count-consumption@1';
export const WORLD_OBJECT_COUNT_RESULT_SCHEMA='ddv.world-object-count-result@1';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';
export const TITLE_ID='0100D39012C1A000';
export const SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';

export const ITEM_TYPE=Object.freeze({
  NONE:0,
  CHARACTER:1,
  BUILDING:2,
  ACTIVITY_ITEM:3,
  FURNITURE:4,
  CLOTHING:5,
  ENVIRONMENT:6,
  AVATAR_FEATURE:7,
  CURRENCY:8
});

export const FURNITURE_ITEM_TYPE=Object.freeze({
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

export const ACTIVITY_ITEM_TYPE=Object.freeze({
  DEFAULT:0,
  EPHEMERAL:13
});

export const CONTENT_KIND=Object.freeze({
  GRID_OBJECT:'GRID_OBJECT',
  ROAD:'ROAD',
  FENCE:'FENCE',
  OFF_GRID_BUILDING:'OFF_GRID_BUILDING',
  ENVIRONMENT_STATE:'ENVIRONMENT_STATE'
});

export const SOURCE_LIMIT_SCOPE=Object.freeze({
  VILLAGE:'VILLAGE',
  PLAYER_HOUSE_ROOM:'PLAYER_HOUSE_ROOM',
  FLOATING_ISLAND:'FLOATING_ISLAND',
  NONE_OR_UNRESOLVED:'NONE_OR_UNRESOLVED'
});

const EXCLUSION_REASON=Object.freeze({
  EPHEMERAL_ACTIVITY:'OBJECT_LIMIT_EXCLUSION_ACTIVITY_EPHEMERAL',
  GROUND_ALTERATION:'OBJECT_LIMIT_EXCLUSION_FURNITURE_GROUND_ALTERATION',
  FENCE:'OBJECT_LIMIT_EXCLUSION_FURNITURE_FENCE',
  NOT_GRID_OBJECT:'NOT_GRIDCOLLECTION_GRID_OBJECT'
});

function clone(v){return structuredClone(v);}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
function freezeResult(v){return Object.freeze(v);}
function normalizedSubtype(entry){
  if(own(entry,'itemSubType'))return int(entry.itemSubType);
  if(own(entry,'subType'))return int(entry.subType);
  return null;
}

export function describeNativeLimitScopeV125({scope,extraLimitObject=false}={}){
  if(scope===SOURCE_LIMIT_SCOPE.VILLAGE){
    return freezeResult({
      scope,
      nativeObjectLimitProvider:true,
      aggregation:'WHOLE_VILLAGE_ALL_AREA_GRID_IDS_RECURSIVE_SUBGRIDS',
      uniqueLimit:extraLimitObject?1200:600,
      instanceLimit:extraLimitObject?6000:3000,
      limitVariant:extraLimitObject?'HIGH_END':'REGULAR',
      specificItemLimits:'OBJECT_LIMIT_DATA_DEPENDENT',
      genericMetricApplicable:true
    });
  }
  if(scope===SOURCE_LIMIT_SCOPE.PLAYER_HOUSE_ROOM){
    return freezeResult({
      scope,
      nativeObjectLimitProvider:true,
      aggregation:'ROOM_ALL_GRID_IDS_RECURSIVE_SUBGRIDS',
      uniqueLimit:-1,
      instanceLimit:-1,
      limitVariant:'ROOM_OBJECT_LIMIT',
      specificItemLimits:'PRESENT_SEPARATE_FROM_GENERIC_PAIR',
      genericMetricApplicable:true
    });
  }
  if(scope===SOURCE_LIMIT_SCOPE.FLOATING_ISLAND){
    return freezeResult({
      scope,
      nativeObjectLimitProvider:false,
      aggregation:null,
      uniqueLimit:null,
      instanceLimit:null,
      limitVariant:'NO_NATIVE_OBJECT_LIMIT_PROVIDER',
      specificItemLimits:null,
      genericMetricApplicable:false
    });
  }
  return freezeResult({
    scope:SOURCE_LIMIT_SCOPE.NONE_OR_UNRESOLVED,
    nativeObjectLimitProvider:false,
    aggregation:null,
    uniqueLimit:null,
    instanceLimit:null,
    limitVariant:'UNRESOLVED',
    specificItemLimits:null,
    genericMetricApplicable:false
  });
}

export function classifyWorldObjectCountContributionV125(entry={}){
  const kind=String(entry?.kind??CONTENT_KIND.GRID_OBJECT);
  const itemId=int(entry?.itemId);

  if(kind===CONTENT_KIND.ENVIRONMENT_STATE||kind===CONTENT_KIND.OFF_GRID_BUILDING){
    return freezeResult({
      status:'VERIFIED',
      kind,
      itemId,
      contributesToTotalObjects:false,
      contributesToDistinctObjectTypes:false,
      distinctGroupingKey:null,
      reason:EXCLUSION_REASON.NOT_GRID_OBJECT,
      rawPlacedContent:true,
      genericLimitCandidate:false
    });
  }

  if(kind===CONTENT_KIND.ROAD){
    return freezeResult({
      status:'VERIFIED',kind,itemId,
      contributesToTotalObjects:false,
      contributesToDistinctObjectTypes:false,
      distinctGroupingKey:null,
      reason:EXCLUSION_REASON.GROUND_ALTERATION,
      rawPlacedContent:true,
      genericLimitCandidate:false,
      nativeIdentity:{itemType:ITEM_TYPE.FURNITURE,itemSubType:FURNITURE_ITEM_TYPE.GROUND_ALTERATION}
    });
  }
  if(kind===CONTENT_KIND.FENCE){
    return freezeResult({
      status:'VERIFIED',kind,itemId,
      contributesToTotalObjects:false,
      contributesToDistinctObjectTypes:false,
      distinctGroupingKey:null,
      reason:EXCLUSION_REASON.FENCE,
      rawPlacedContent:true,
      genericLimitCandidate:false,
      nativeIdentity:{itemType:ITEM_TYPE.FURNITURE,itemSubType:FURNITURE_ITEM_TYPE.FENCE}
    });
  }

  if(kind!==CONTENT_KIND.GRID_OBJECT){
    return freezeResult({
      status:'UNKNOWN',kind,itemId,
      blocker:'WORLD_OBJECT_COUNT_CONTENT_KIND_UNKNOWN'
    });
  }
  if(itemId===null||itemId<=0){
    return freezeResult({
      status:'UNKNOWN',kind,itemId,
      blocker:'WORLD_OBJECT_COUNT_ITEM_ID_REQUIRED'
    });
  }

  const itemType=int(entry?.itemType);
  if(itemType===null){
    return freezeResult({
      status:'UNKNOWN',kind,itemId,
      blocker:'WORLD_OBJECT_COUNT_ITEM_TYPE_REQUIRED'
    });
  }

  const subType=normalizedSubtype(entry);
  if(itemType===ITEM_TYPE.FURNITURE){
    if(subType===null){
      return freezeResult({
        status:'UNKNOWN',kind,itemId,itemType,
        blocker:'WORLD_OBJECT_COUNT_FURNITURE_SUBTYPE_REQUIRED'
      });
    }
    if(subType===FURNITURE_ITEM_TYPE.GROUND_ALTERATION){
      return freezeResult({
        status:'VERIFIED',kind,itemId,itemType,itemSubType:subType,
        contributesToTotalObjects:false,
        contributesToDistinctObjectTypes:false,
        distinctGroupingKey:null,
        reason:EXCLUSION_REASON.GROUND_ALTERATION,
        rawPlacedContent:true,
        genericLimitCandidate:false
      });
    }
    if(subType===FURNITURE_ITEM_TYPE.FENCE){
      return freezeResult({
        status:'VERIFIED',kind,itemId,itemType,itemSubType:subType,
        contributesToTotalObjects:false,
        contributesToDistinctObjectTypes:false,
        distinctGroupingKey:null,
        reason:EXCLUSION_REASON.FENCE,
        rawPlacedContent:true,
        genericLimitCandidate:false
      });
    }
  }

  if(itemType===ITEM_TYPE.ACTIVITY_ITEM){
    if(subType===null){
      return freezeResult({
        status:'UNKNOWN',kind,itemId,itemType,
        blocker:'WORLD_OBJECT_COUNT_ACTIVITY_SUBTYPE_REQUIRED'
      });
    }
    if(subType===ACTIVITY_ITEM_TYPE.EPHEMERAL){
      return freezeResult({
        status:'VERIFIED',kind,itemId,itemType,itemSubType:subType,
        contributesToTotalObjects:false,
        contributesToDistinctObjectTypes:false,
        distinctGroupingKey:null,
        reason:EXCLUSION_REASON.EPHEMERAL_ACTIVITY,
        rawPlacedContent:true,
        genericLimitCandidate:false
      });
    }
  }

  return freezeResult({
    status:'VERIFIED',kind,itemId,itemType,itemSubType:subType,
    contributesToTotalObjects:true,
    contributesToDistinctObjectTypes:true,
    distinctGroupingKey:String(itemId),
    reason:'GENERIC_OBJECT_LIMIT_INCLUDED',
    rawPlacedContent:true,
    genericLimitCandidate:true
  });
}

function flattenContents(contents,out=[],parentPath='contents'){
  if(!Array.isArray(contents))throw Error('WORLD_OBJECT_COUNT_CONTENTS_ARRAY_REQUIRED');
  contents.forEach((entry,index)=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry)){
      out.push({path:`${parentPath}[${index}]`,entry:null,invalid:true});
      return;
    }
    const path=`${parentPath}[${index}]`;
    out.push({path,entry});
    if(own(entry,'children')){
      if(!Array.isArray(entry.children)){
        out.push({path:`${path}.children`,entry:null,invalid:true});
      }else{
        flattenContents(entry.children,out,`${path}.children`);
      }
    }
  });
  return out;
}

export function countWorldObjectLimitContributionV125({
  contents,
  sourceScope=SOURCE_LIMIT_SCOPE.NONE_OR_UNRESOLVED,
  extraLimitObject=false,
  source=null
}={}){
  const sourceBlockers=[];
  if(source){
    if(source.platform!=='Nintendo Switch'||source.gameVersion!==GAME_VERSION||Number(source.profileSchemaVersion)!==PROFILE_SCHEMA||source.buildIdentity!==SWITCH_BID){
      sourceBlockers.push('EXACT_SWITCH_V125_BUILD_REQUIRED');
    }
  }

  const flattened=flattenContents(contents??[]);
  const excluded=[];
  const blockers=[...sourceBlockers.map(code=>({path:'source',code}))];
  const counted=[];
  const distinct=new Set();
  let rawPlacedContentCount=0;

  for(const node of flattened){
    if(node.invalid){
      blockers.push({path:node.path,code:'WORLD_OBJECT_COUNT_CONTENT_INVALID'});
      continue;
    }
    const classification=classifyWorldObjectCountContributionV125(node.entry);
    if(classification.rawPlacedContent===true)rawPlacedContentCount+=1;
    if(classification.status!=='VERIFIED'){
      blockers.push({path:node.path,code:classification.blocker??'WORLD_OBJECT_COUNT_UNKNOWN'});
      continue;
    }
    if(classification.contributesToTotalObjects){
      counted.push({path:node.path,itemId:classification.itemId,distinctGroupingKey:classification.distinctGroupingKey});
      distinct.add(classification.distinctGroupingKey);
    }else{
      excluded.push({
        path:node.path,
        kind:classification.kind,
        itemId:classification.itemId,
        reason:classification.reason
      });
    }
  }

  const scope=describeNativeLimitScopeV125({scope:sourceScope,extraLimitObject});
  const verified=blockers.length===0;
  return freezeResult({
    schema:WORLD_OBJECT_COUNT_RESULT_SCHEMA,
    contract:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
    target:Object.freeze({platform:'Nintendo Switch',gameVersion:GAME_VERSION,buildId:SWITCH_BID,profileSchemaVersion:PROFILE_SCHEMA}),
    status:verified?'VERIFIED':'BLOCKED_UNKNOWN',
    verified,
    metricSemantics:'GENERIC_OBJECT_LIMIT_ITEM_CONTRIBUTION',
    distinctGroupingIdentity:'EXACT_ITEM_ID',
    rawPreset:Object.freeze({
      rawPlacedContentCount,
      flattenedEntryCount:flattened.length
    }),
    vanillaAligned:Object.freeze({
      distinctObjectTypes:verified?distinct.size:null,
      totalObjects:verified?counted.length:null,
      counted:Object.freeze(counted.map(clone)),
      excluded:Object.freeze(excluded.map(clone))
    }),
    sourceLimitScope:scope,
    unknownBlockers:Object.freeze(blockers.map(clone)),
    notes:Object.freeze([
      'Roads/Fences remain raw Preset contents but do not contribute to the generic Unique/Instance pair.',
      'SubGrid descendants must be supplied recursively; parent and each descendant are evaluated independently.',
      'Floating Island has no native ObjectLimit provider in current v1.25, but item-level generic contribution remains descriptive Preset capacity metadata.'
    ]),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

export function worldObjectCountConsumptionContractV125(){
  return freezeResult({
    schema:WORLD_OBJECT_COUNT_CONSUMPTION_SCHEMA,
    target:{platform:'Nintendo Switch',gameVersion:GAME_VERSION,buildId:SWITCH_BID,profileSchemaVersion:PROFILE_SCHEMA},
    nativeGenericExclusions:Object.freeze([
      {itemType:ITEM_TYPE.ACTIVITY_ITEM,itemSubType:ACTIVITY_ITEM_TYPE.EPHEMERAL,reason:EXCLUSION_REASON.EPHEMERAL_ACTIVITY},
      {itemType:ITEM_TYPE.FURNITURE,itemSubType:FURNITURE_ITEM_TYPE.GROUND_ALTERATION,reason:EXCLUSION_REASON.GROUND_ALTERATION},
      {itemType:ITEM_TYPE.FURNITURE,itemSubType:FURNITURE_ITEM_TYPE.FENCE,reason:EXCLUSION_REASON.FENCE}
    ]),
    distinctGroupingIdentity:'EXACT_ITEM_ID',
    unknownPolicy:'FAIL_CLOSED',
    persistentWriteAuthorized:false
  });
}
