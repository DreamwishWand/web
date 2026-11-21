import { matchProfileReadContract, ProfileReadCompatibilityStatus } from '../save/versioning.js';

export const COLLECTION_SAVE_READ_SCHEMA = 'ddv.collection-save-backed-readonly@1';
const SWITCH_1250 = '52BD625D9B4E0053';
const SWITCH_1253 = '9A239D3DB569756D';
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const positiveId = (x) => Number.isSafeInteger(x) && x > 0;
const nonnegative = (x) => Number.isSafeInteger(x) && x >= 0;
const sha = (x) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const decimal = (x) => typeof x === 'string' && /^(0|[1-9][0-9]*)$/.test(x) && Number.isSafeInteger(Number(x));
const freeze = (v) => Object.freeze(v);
const state = (status, code, extra={}) => freeze({schema:COLLECTION_SAVE_READ_SCHEMA,status,code,readOnly:true,persistentWriteAuthorized:false,productApplyAuthorized:false,...extra});

/**
 * Source platform must be independently known from original storage bytes.
 * LastSaveDeviceInfo cannot establish source/storage platform under cross-save.
 * Codec and owner evidence MUST come from a trusted private local loader.
 */
export function projectSaveBackedCollection({profile,saveIdentity,targetBuild,source,definitionBindings=[],knownItemIds=[],canonicalOwnership={},scope=null}={}) {
  if (!isObject(profile) || !isObject(profile.Player) || !isObject(profile.GameInfo) || !isObject(saveIdentity) || !isObject(targetBuild))
    return state('BLOCKED','COLLECTION_PROFILE_OR_PROVENANCE_MISSING');
  if (!sha(source?.rawSaveSha256) || source?.codecReadValidated !== true || source?.profileOwnerConfirmed !== true || source?.localOnly !== true)
    return state('BLOCKED','COLLECTION_TRUSTED_PRIVATE_SAVE_BOUNDARY_MISSING');
  if (profile.GameInfo.Version !== saveIdentity.profileGameInfoVersion)
    return state('BLOCKED','COLLECTION_GAMEINFO_IDENTITY_MISMATCH');
  const gate=matchProfileReadContract(saveIdentity,targetBuild);
  if(gate.status!==ProfileReadCompatibilityStatus.ExactAccepted)
    return state('BLOCKED','COLLECTION_READ_'+gate.status,{readCompatibility:gate.status});
  if(saveIdentity.sourcePlatform!==targetBuild.platform) return state('BLOCKED','COLLECTION_SOURCE_PLATFORM_MISMATCH');
  const p=freeze({platform:targetBuild.platform,gameVersion:gate.contract.gameVersion,buildId:targetBuild.value,profileSchema:gate.contract.profileGameInfoVersion,saveSha256:source.rawSaveSha256,sourcePlatform:saveIdentity.sourcePlatform,ownerScope:'CURRENT_AUTHORIZED_LOCAL_PROFILE',shareable:false});
  if(targetBuild.platform!=='switch' || ![SWITCH_1250,SWITCH_1253].includes(targetBuild.value))
    return state('BLOCKED','COLLECTION_PLATFORM_SEMANTICS_UNREVIEWED',{provenance:p});
  if (targetBuild.value===SWITCH_1253) {
    if(gate.contract.profileGameInfoVersion!==626)return state('BLOCKED','COLLECTION_SCHEMA_VERSION_MISMATCH',{provenance:p});
    return state('STRUCTURAL_ONLY','COLLECTION_626_SEMANTICS_NOT_PROMOTED',{
      provenance:p,collectionSetsPresent:Array.isArray(profile.Player.CollectionSets),
      listInventoriesPresent:isObject(profile.Player.ListInventories),
      entries:null,coverage:null,uniqueCoverage:null,owned:null,
      requiredEvidence:['v1.25.3 CollectionSet native semantic regression','v1.25.3 category binding/current-definition membership pack','v1.25.3 ListInventory canonical routing/ownership regression']
    });
  }
  if(gate.contract.profileGameInfoVersion!==624)return state('BLOCKED','COLLECTION_SCHEMA_VERSION_MISMATCH',{provenance:p});
  const sets=profile.Player.CollectionSets;
  if(!Array.isArray(sets))return state('BLOCKED','COLLECTION_SETS_MISSING',{provenance:p});
  if(!Array.isArray(definitionBindings)||!Array.isArray(knownItemIds)||!isObject(canonicalOwnership))
    return state('BLOCKED','COLLECTION_SOURCE_BINDINGS_INVALID',{provenance:p});
  const allowed=new Set(knownItemIds);
  if(allowed.size!==knownItemIds.length||knownItemIds.some(x=>!positiveId(x)))return state('BLOCKED','COLLECTION_ITEM_INDEX_INVALID',{provenance:p});
  const bindings=new Map();
  for(const b of definitionBindings){
    if(!positiveId(b?.collectionDefinitionId)||typeof b.categoryId!=='string'||!b.categoryId || !nonnegative(b.groupCount) ||
       b.evidenceVersion!=='1.25.0' || !sha(b.evidenceSha256) || bindings.has(b.collectionDefinitionId))
      return state('BLOCKED','COLLECTION_DEFINITION_BINDING_UNVERIFIED',{provenance:p});
    bindings.set(b.collectionDefinitionId,b);
  }
  const grouped=new Map(),excluded=[],categoryKeys=new Set(),seenDefinitions=new Set();
  for(const set of sets){
    const defId=set?.CollectionDefinitionID;
    if(!positiveId(defId) || seenDefinitions.has(defId))return state('BLOCKED','COLLECTION_DEFINITION_ID_DUPLICATE_OR_INVALID',{provenance:p});
    seenDefinitions.add(defId);
    const b=bindings.get(defId);
    if(!b){excluded.push({collectionDefinitionId:defId,reason:'DEFINITION_CATEGORY_BINDING_UNKNOWN'});continue;}
    categoryKeys.add(b.categoryId);
    if(!Array.isArray(set.GroupData)||set.GroupData.length!==b.groupCount)
      return state('BLOCKED','COLLECTION_GROUP_STRUCTURE_MISMATCH',{provenance:p,collectionDefinitionId:defId});
    for(let gi=0;gi<set.GroupData.length;gi++){
      const g=set.GroupData[gi],items=g?.GroupsCollectionItems;
      if(!isObject(items))return state('BLOCKED','COLLECTION_GROUP_ITEM_MAP_MISSING',{provenance:p,collectionDefinitionId:defId,groupIndex:gi});
      for(const [key,value] of Object.entries(items)){
        if(!decimal(key)||typeof value!=='boolean')return state('BLOCKED','COLLECTION_ENTRY_NONBOOLEAN_OR_BAD_ID',{provenance:p,collectionDefinitionId:defId,groupIndex:gi});
        const itemId=Number(key);
        if(!allowed.has(itemId)){excluded.push({collectionDefinitionId:defId,groupIndex:gi,itemId,reason:'ITEM_DEFINITION_UNRESOLVED_IN_PINNED_SOURCE'});continue;}
        const entryKey=b.categoryId+'\u0000'+itemId;
        const prior=grouped.get(entryKey);
        if(prior&&prior.collected!==value)return state('BLOCKED','COLLECTION_SAME_CATEGORY_CONFLICT',{provenance:p,categoryId:b.categoryId,itemId});
        if(prior){prior.rawOccurrences++;prior.sourceGroups.push([defId,gi]);}
        else grouped.set(entryKey,{categoryId:b.categoryId,itemId,collected:value,rawOccurrences:1,sourceGroups:[[defId,gi]]});
      }
    }
  }
  const entries=[...grouped.values()].sort((a,b)=>a.categoryId.localeCompare(b.categoryId)||a.itemId-b.itemId).map(x=>freeze({...x,sourceGroups:freeze(x.sourceGroups)}));
  const byItem=new Map();for(const e of entries){const xs=byItem.get(e.itemId)||[];xs.push(e);byItem.set(e.itemId,xs);}
  const unique=[...byItem].sort((a,b)=>a[0]-b[0]).map(([itemId,rows])=>freeze({itemId,state:rows.every(x=>x.collected)?'COLLECTED':rows.every(x=>!x.collected)?'MISSING':'PARTIAL',categories:freeze(rows.map(x=>x.categoryId))}));
  const filtered=scope?.categoryId?entries.filter(e=>e.categoryId===scope.categoryId):entries;
  const scopeItemIds=new Set(filtered.map(x=>x.itemId));
  const uniqueScoped=unique.filter(x=>scopeItemIds.has(x.itemId)).map(x=>{
    const rows=filtered.filter(y=>y.itemId===x.itemId);
    return freeze({itemId:x.itemId,state:rows.every(y=>y.collected)?'COLLECTED':rows.every(y=>!y.collected)?'MISSING':'PARTIAL'});
  });
  const complete=definitionBindings.length>0 && excluded.length===0 && definitionBindings.every(x=>seenDefinitions.has(x.collectionDefinitionId)) && source.currentDefinitionUniverseComplete===true && source.categoryManifestReviewed===true && sha(source.categoryManifestSha256);
  const numerator=filtered.filter(x=>x.collected).length;
  const metrics=freeze({complete,validEntries:filtered.length,collectedEntries:numerator,denominator:complete?filtered.length:null,coverage:complete?(filtered.length?numerator/filtered.length:0):null,emptyScope:complete&&filtered.length===0,unresolvedCount:excluded.length,sourceCategoryCount:categoryKeys.size});
  const uniqueMetrics=freeze({complete,totalUnique:uniqueScoped.length,collected:uniqueScoped.filter(x=>x.state==='COLLECTED').length,partial:uniqueScoped.filter(x=>x.state==='PARTIAL').length,missing:uniqueScoped.filter(x=>x.state==='MISSING').length,coverage:complete?(uniqueScoped.length?uniqueScoped.filter(x=>x.state==='COLLECTED').length/uniqueScoped.length:0):null});
  // Stock and category history are independent; canonical variation routing is mandatory.
  const inventories=profile.Player.ListInventories;
  const ownerRows=[];
  for(const u of uniqueScoped){
    const binding=canonicalOwnership[String(u.itemId)];
    let stock=freeze({itemId:u.itemId,status:'UNKNOWN',reason:'CANONICAL_OWNERSHIP_ROUTING_NOT_PROVEN'});
    if(binding && positiveId(binding.canonicalItemId) && nonnegative(binding.listInventoryId) && sha(binding.evidenceSha256) &&
       binding.platform==='switch' && binding.gameVersion==='1.25.0' &&
       isObject(inventories)){
      const inventory=inventories[String(binding.listInventoryId)];
      if(isObject(inventory) && isObject(inventory.Inventory) &&
         (binding.compatibleItemType===undefined || inventory.CompatibleItemType===binding.compatibleItemType)){
        const record=inventory.Inventory[String(binding.canonicalItemId)];
        if(record===undefined || (isObject(record) && nonnegative(record.Amount))){
          const amount=record?.Amount??0;
          stock=freeze({itemId:u.itemId,status:'KNOWN',canonicalItemId:binding.canonicalItemId,
            amount,owned:amount>0,mapEntryPresent:record!==undefined});
        }
      }
    }
    ownerRows.push(stock);
  }
  const owned=freeze({status:ownerRows.every(x=>x.status==='KNOWN')?'COMPLETE':'PARTIAL',states:freeze(ownerRows),
    discoveredIsNotOwned:true,notInferredFromReferenceCatalogue:true});
  return state(complete?'COMPLETE':'PARTIAL','COLLECTION_CATEGORY_ENTRY_SAVE_PROJECTION',{
    provenance:p,entries:freeze(filtered),unique:freeze(uniqueScoped),coverage:metrics,uniqueCoverage:uniqueMetrics,owned,
    unsupported:freeze(excluded),fieldsNotInferred:freeze(['available','unlocked','entitled','dlcOwned','premiumOwned','gameDisplayedPercentage']),
    privacy:freeze({exportContainsProfileDerivedCollectionState:true,backendPublishAllowed:false,publicShareAllowed:false})
  });
}
