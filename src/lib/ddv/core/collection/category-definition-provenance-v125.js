const codec = 'ddv.collection-definition-source-compact@1';
const sourceDigest = 'c01deb5c6d3859c4fc6e3ff5e18b825838c7a3a3d172f236a5251b76173752bb';
const itemDbDigest = 'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048';
const rawDefinitionDigest = 'e4887dc5729b8660caadc0d8f875a199a331973ccfeb97c740542a27ac44cc87';
const supportDigest = '537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9';
const bid = '52BD625D9B4E0053';
const expected = Object.freeze([[0,'Crop',7],[1,'Fish',2],[2,'Meals',3],[3,'FurnitureSets',63],[4,'ClothingSets',61],
  [6,'Memories',40],[7,'Characters',33],[8,'Foraging',2],[9,'Minerals',2],[10,'Crafting',4],
  [11,'TimeBending',5],[12,'BoardGame',16],[13,'Snippets',3],[14,'Stories',39],[15,'Companions',2],
  [16,'Mounts',5],[18,'QuestPuzzles',6]]);
const verifiedSources = new WeakMap();
const object = (v) => v!==null && typeof v==='object' && !Array.isArray(v);
const positive = (v) => Number.isSafeInteger(v)&&v>0;
const stopped=(code,extra={})=>Object.freeze({status:'BLOCKED',code,personalMetricAuthorized:false,privateCollectionPublishAuthorized:false,...extra});
const hex = (arr) => [...new Uint8Array(arr)].map(x=>x.toString(16).padStart(2,'0')).join('');

export const COLLECTION_DEFINITION_SOURCE_SHA256_V125 = sourceDigest;
export const COLLECTION_DEFINITION_SOURCE_PATH_V125 = 'ddv/core/collection/v1.25/collection-definition-source-compact-v125.json';

/**
 * Pin the complete raw bytes, NOT a self-declared sha256 field in a JSON object.
 * The returned capability exists only in memory. It does not authorize a personal metric.
 */
export async function verifyCollectionDefinitionSourceV125(rawBytes) {
  const bytes=typeof rawBytes==='string'?new TextEncoder().encode(rawBytes):rawBytes;
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==50078||!globalThis.crypto?.subtle)
    return stopped('COLLECTION_DEFINITION_SOURCE_BYTES_OR_CRYPTO_INVALID');
  const digest=hex(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  if(digest!==sourceDigest)return stopped('COLLECTION_DEFINITION_SOURCE_SHA256_MISMATCH',{digest});
  let pack;
  try{pack=JSON.parse(new TextDecoder().decode(bytes));}catch{return stopped('COLLECTION_DEFINITION_SOURCE_JSON_INVALID')}
  if(pack.schema!==codec||pack.target?.platform!=='Nintendo Switch'||pack.target?.gameVersion!=='1.25.0'||
     pack.target?.buildId!==bid||pack.target?.profileSchemaVersion!==624 ||
     pack.sourceRawSha256!==rawDefinitionDigest||pack.sourceSupportSha256!==supportDigest ||
     pack.itemDbSha256!==itemDbDigest||pack.itemDbCount!==17413 ||
     !Array.isArray(pack.records)||pack.records.length!==293||
     !Array.isArray(pack.categoryCounts)||pack.categoryCounts.length!==17)
    return stopped('COLLECTION_DEFINITION_SOURCE_CONTRACT_MISMATCH');
  for(let n=0;n<expected.length;n++){
    const [id,name,count]=expected[n], actual=pack.categoryCounts[n];
    if(JSON.stringify(actual)!==JSON.stringify([id,'CollectionSubMenu_'+name,count]))
      return stopped('COLLECTION_CATEGORY_ENUM_MISMATCH');
  }
  const counts=new Map(),seen=new Set(),selectors=new Set(),stats={included:0,excluded:0,typed:0,zeroSentinel:0};
  for(const row of pack.records){
    if(!Array.isArray(row)||row.length!==6||!positive(row[0])||seen.has(row[0])||
       !expected.some(x=>x[0]===row[1])||typeof row[2]!=='string'||!/^[0-9a-f]{64}$/.test(row[2])||
       typeof row[3]!=='string'||!Array.isArray(row[4])||!Array.isArray(row[5]))
      return stopped('COLLECTION_DEFINITION_ROW_MALFORMED');
    seen.add(row[0]);counts.set(row[1],(counts.get(row[1])||0)+1);
    for(const filter of row[4]){
      if(!Array.isArray(filter)||filter.length!==2||![0,1].includes(filter[0])||!Array.isArray(filter[1]))
        return stopped('COLLECTION_ITEM_FILTER_MALFORMED');
      for(const itemId of filter[1]){
        if(!Number.isSafeInteger(itemId)||itemId<0)return stopped('COLLECTION_ITEM_FILTER_ID_INVALID');
        stats[filter[0]===1?'excluded':'included']++;
        if(itemId===0){if(filter[0]!==1||row[0]!==2120000259)return stopped('COLLECTION_ITEM_ZERO_UNEXPECTED');stats.zeroSentinel++;}
      }
    }
    for(const filter of row[5]){
      if(!Array.isArray(filter)||filter.length!==3||typeof filter[0]!=='string'||
         !(object(filter[1])||(filter[0]==='CharacterUniverse'&&Number.isSafeInteger(filter[1])&&filter[1]>0))||![0,1].includes(filter[2]))
        return stopped('COLLECTION_TYPE_SELECTOR_MALFORMED');
      stats.typed++;selectors.add(filter[0]);
    }
  }
  if(expected.some(([id,_,count])=>counts.get(id)!==count)||stats.included!==150||
     stats.excluded!==273||stats.typed!==256||stats.zeroSentinel!==1||
     selectors.size!==8)return stopped('COLLECTION_SOURCE_COUNTS_MISMATCH');
  const capability=Object.freeze({status:'SOURCE_VERIFIED_STATIC_ONLY',
    gameVersion:'1.25.0',buildId:bid,profileSchema:624,categoryCount:17,definitionCount:293,
    explicitIncludedOccurrences:150,explicitExcludedOccurrences:273,typedSelectorOccurrences:256,
    manifestSha256:digest,personalMetricAuthorized:false,saveMembershipKnown:false});
  verifiedSources.set(capability,pack);
  return capability;
}

/**
 * Binds definitions to one caller-provided profile *structurally*.
 * No save membership or boolean is generated from the static selector definitions.
 * The caller must independently verify owner consent, original save/platform and
 * current ItemDB bytes before any later private projection.
 */
export function bindCollectionProfileDefinitionsV125({verifiedSource,profile,sourceIdentity}={}) {
  const manifest=object(verifiedSource)?verifiedSources.get(verifiedSource):null;
  if(!manifest)return stopped('COLLECTION_SOURCE_CAPABILITY_NOT_VERIFIED');
  if(sourceIdentity?.platform!=='switch'||sourceIdentity?.buildId!==bid||
     sourceIdentity?.schema!==624||sourceIdentity?.codecAccepted!==true||
     sourceIdentity?.ownerConsentVerified!==true||sourceIdentity?.privateLocalExecution!==true)
    return stopped('COLLECTION_PROFILE_PROVENANCE_NOT_AUTHENTICATED');
  if(profile?.GameInfo?.Version!==624||!Array.isArray(profile?.Player?.CollectionSets))
    return stopped('COLLECTION_PROFILE_624_STRUCTURE_UNSUPPORTED');
  const definitions=new Map(manifest.records.map(r=>[r[0],r]));
  const bindings=[],issues=[],seen=new Set(),observedCategories=new Set();
  for(const collection of profile.Player.CollectionSets){
    const id=collection?.CollectionDefinitionID;
    if(!positive(id)||seen.has(id))return stopped('COLLECTION_PROFILE_DEFINITION_ID_INVALID_OR_DUPLICATE');
    seen.add(id);
    const row=definitions.get(id);
    if(!row){issues.push({definitionId:id,code:'COLLECTION_SAVE_DEFINITION_NOT_IN_1250'});continue;}
    if(!Array.isArray(collection.GroupData)||collection.GroupData.length!==1)
      return stopped('COLLECTION_PROFILE_GROUP_COUNT_MISMATCH',{definitionId:id});
    const map=collection.GroupData[0]?.GroupsCollectionItems;
    if(!object(map))return stopped('COLLECTION_PROFILE_GROUP_BOOL_MAP_MISSING',{definitionId:id});
    for(const [itemId,flag] of Object.entries(map)){
      if(!/^[1-9][0-9]*$/.test(itemId)||!Number.isSafeInteger(Number(itemId))||typeof flag!=='boolean')
        return stopped('COLLECTION_PROFILE_ITEM_BOOL_INVALID',{definitionId:id});
    }
    observedCategories.add(row[1]);
    const cat=expected.find(x=>x[0]===row[1]);
    bindings.push(Object.freeze({
      collectionDefinitionId:id,categoryId:'CollectionSubMenu_'+cat[1],groupCount:1,
      evidenceVersion:'1.25.0',evidenceSha256:row[2],
      staticSelectorTypes:Object.freeze(row[5].map(v=>v[0])),
      sourceKeyVerified:true
    }));
  }
  return Object.freeze({status:issues.length?'PARTIAL_STATIC_BINDING':'BOUND_STATIC_DEFINITIONS',
    definitionBindings:Object.freeze(bindings),issues:Object.freeze(issues),
    observedSourceDefinitionCount:seen.size,observedCategoryCount:observedCategories.size,
    staticFullDefinitionCount:293,categoryCount:17,
    membershipSelectorsExpanded:false,personalMetricAuthorized:false,
    collectedFromProfileOnly:true,entryDenominator:null,uniqueDenominator:null,
    owned:null,available:null,unlocked:null,
    versionFence:'SWITCH_1.25.0_BID_'+bid+'_SCHEMA_624',
    requiredEvidence:Object.freeze(['trusted current ItemDB ItemID resolution (full 17413 ID index)','native-equivalent typed selector/Ignore evaluation','consented real owner save and source bytes','independent QR personal metric acceptance'])
  });
}
