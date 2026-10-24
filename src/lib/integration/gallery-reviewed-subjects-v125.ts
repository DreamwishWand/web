import tomSource from '../../../static/ddv/core/gallery/v1.25/reviewed-tom-base-items-v125.json' with {type:'json'};

/**
 * 09 INT evidence-only extension of PR #113. 03 COMM PR #118 still owns the
 * allowlisted public lookup; nothing here authorizes ownership, writes, or
 * retirement. Pinned to Switch 1.25.0 BID 52BD625D9B4E0053 / schema 624.
 */
export const REVIEWED_GALLERY_V125_CONTRACT = 'ddv.gallery-v125-reviewed-subject-extension@1';
const SOURCE = 'DDV_GAME_DATABASE_LOSSLESS_v1.25.0.json.gz';
const GRID_ROLE_SOURCE = 'static/ddv/core/world/v1.25/grid-role-authority-v125.json';
const GRID_ROLE_SHA = 'fce2b8a5e4c554758c48281d233d3cf838744672cebd25e8500dab8c6840d06e';
const AREAS = Object.freeze([1,4,5,7] as const);
export const BIOME_V125_REVIEWED_AREAS = AREAS;
export const TOM_V125_REVIEWED_AUDIT = Object.freeze(tomSource.audit);
export const TOM_V125_SOURCE_HASH = tomSource.source.sha256;

export function encodeReviewedBiomeV125(sceneItemId:number, villageAreaType:number):string {
  if(sceneItemId!==1540000000 || !AREAS.some(x=>x===villageAreaType))
    throw new Error('GALLERY_BIOME_COMPOSITE_UNREVIEWED');
  return String(sceneItemId)+':'+String(villageAreaType);
}
export function decodeReviewedBiomeV125(value:string) {
  if(typeof value!=='string' || !/^1540000000:(1|4|5|7)$/.test(value))
    throw new Error('GALLERY_BIOME_COMPOSITE_NONCANONICAL');
  const [rawScene,rawArea]=value.split(':');
  const sceneItemId=Number(rawScene),villageAreaType=Number(rawArea);
  if(encodeReviewedBiomeV125(sceneItemId,villageAreaType)!==value)
    throw new Error('GALLERY_BIOME_COMPOSITE_NONCANONICAL');
  return Object.freeze({sceneItemId,villageAreaType});
}

export const REVIEWED_BIOME_ALIASES_V125 = Object.freeze([
  {villageAreaType:1,gridDataPath:'GridData/Villages/Village04-WetlandsLevel-GridData.json',areaName:'Wetland'},
  {villageAreaType:4,gridDataPath:'GridData/Villages/Village04-SavannahLevel-GridData.json',areaName:'Savannah'},
  {villageAreaType:5,gridDataPath:'GridData/Villages/Village04-ForestLevel-GridData.json',areaName:'Forest'},
  {villageAreaType:7,gridDataPath:'GridData/Villages/Village04-SnowLevel-GridData.json',areaName:'Cliff'}
] as const);

export const VERIFIED_ADDITIONAL_GALLERY_IDENTITIES_V125 = Object.freeze([
  ...REVIEWED_BIOME_ALIASES_V125.map(row=>Object.freeze({
    galleryKind:'outdoor',subjectType:'biome',
    canonicalTargetId:encodeReviewedBiomeV125(1540000000,row.villageAreaType),
    baseItemId:null,
    semanticIdentityCodec:'ddv.outdoor-location-ref@1',
    evidenceRef:GRID_ROLE_SOURCE+'#/explicitAliasesByGridDataPath/'+row.gridDataPath.replaceAll('~','~0').replaceAll('/','~1'),
    evidenceSourceSha256:GRID_ROLE_SHA,
    evidenceClass:'CONFIRMED_V125_EXPLICIT_GRIDDATA_DERIVATION',
    scope:'Only four reviewed Village04 aliases; full Biome denominator remains UNKNOWN'
  })),
  ...tomSource.records.map(row=>{
    const furniture=row.concreteType==='FurnitureItemData';
    const clothing=row.concreteType==='ClothingItemData';
    if((!furniture&&!clothing) || !Number.isSafeInteger(row.itemId) ||
       Math.trunc(row.itemId/10000000)!==(furniture?4:5) ||
       !Number.isSafeInteger(row.losslessItemsIndex) || row.losslessItemsIndex<0 ||
       !/^[a-f0-9]{64}$/.test(row.rawPayloadSha256) ||
       !(row.canAddDecals===true||row.canChangeColor===true))
      throw new Error('GALLERY_TOM_REVIEWED_MANIFEST_INVALID');
    const subjectType=furniture?'tom_furniture':'tom_clothing';
    return Object.freeze({
      galleryKind:subjectType,subjectType,
      canonicalTargetId:String(row.itemId),baseItemId:row.itemId,
      semanticIdentityCodec:'ddv.tom-base-item@1',
      evidenceRef:SOURCE+'#/items/'+row.losslessItemsIndex+'/itemID',
      evidenceSourceSha256:tomSource.source.sha256,
      rawPayloadSha256:row.rawPayloadSha256,
      concreteItemDataType:row.concreteType,
      canAddDecals:row.canAddDecals,
      canChangeColor:row.canChangeColor,
      evidenceClass:'CONFIRMED_V125_TYPED_ITEMDATA_NATIVE_OR_PREDICATE',
      scope:'Exact typed v1.25.0 Base Item only; not Motif, Design.Id, ownership, entitlement or native writer'
    });
  })
]);

/** Countable *reviewed* subjects, not an assertion that every Biome is known. */
export function reviewedV125AdditionalGallerySubjectCandidates(){
  const target=tomSource.target;
  return VERIFIED_ADDITIONAL_GALLERY_IDENTITIES_V125.map(row=>Object.freeze({...target,...row}));
}
/** Room is inherently private save/account scoped until a separate Community
 * owner+linked-profile publication identity contract is approved. */
export function validateRoomPublicEnrollmentV125(_candidate:unknown) {
  return Object.freeze({ok:false,verificationState:'pending',
    code:'GALLERY_ROOM_OWNER_PROFILE_SCOPE_UNPROVEN'});
}
