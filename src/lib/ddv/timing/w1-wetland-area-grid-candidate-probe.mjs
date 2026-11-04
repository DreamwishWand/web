/**
 * 01E / W-NATIVE-005 — source-only W1 Area/Grid reference candidates.
 *
 * Consumes the existing 01B read626SpatialReferences() output; never decodes a
 * P1G or invents an Area enum→Save area key mapping. This is an untrusted
 * structural diagnostic and MUST NOT be used to grant a Rust Core Writer.
 */
export const W1_AREA_GRID_SOURCE_PROBE = 'wand.01e.w1-area-grid-candidate-probe@1';
export const SOURCE_SPATIAL_INDEX = 'ddv.real-save-spatial-source-read@1';
export const W1_PROBE_BUILD = Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',
  bid:'9A239D3DB569756D',schema:626
});
const freeze = value => Object.freeze(value);
const rec = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeId = v => Number.isSafeInteger(v) && v >= 0;
const validHash = v => typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
const canonical = s => /^(0|[1-9]\d*)$/.test(s) && Number.isSafeInteger(Number(s));
const areaAddr = value => {
  if(typeof value !== 'string')return null;
  const m=/^v(0|[1-9]\d*):a(0|[1-9]\d*)$/.exec(value);
  if(!m || !canonical(m[1]) || !canonical(m[2]))return null;
  return {address:value,villageIndex:Number(m[1]),areaKey:m[2]};
};
const unavailable = reason => freeze({
  contract:W1_AREA_GRID_SOURCE_PROBE,status:'SOURCE_REFERENCE_UNAVAILABLE',reason,
  nativeAreaMappingVerified:false,originalSourceAuthenticated:false,
  sourceSessionCasVerified:false,actualNativeQuotaVerified:false,
  nativeRuntimeVerified:false,productWriterAuthorized:false,
  productEditedCopyAuthorized:false,automaticDateRepairAuthorized:false
});

/**
 * The caller-provided SHA/Revision is a display-provenance check, NOT a source
 * authentication: only the owning Core can verify the real encrypted P1G SHA,
 * decoded SHA, IndexGeneration and old-value CAS.
 */
export function inspectW1WetlandGridCandidates(spatial, expected) {
  if(!rec(spatial)||spatial.contract!==SOURCE_SPATIAL_INDEX ||
     !rec(spatial.version)||!rec(expected))return unavailable('SOURCE_INDEX_OR_CONTEXT_MISSING');
  for(const [key,value] of Object.entries(W1_PROBE_BUILD)){
    if(spatial.version[key]!==value)return unavailable('WRONG_PLATFORM_VERSION_BID_SCHEMA');
  }
  if(!validHash(expected.sourceSha256)||!validHash(spatial.sourceSha256)||
     spatial.sourceSha256!==expected.sourceSha256||
     typeof expected.sourceRevision!=='string'||!expected.sourceRevision||
     spatial.sourceRevision!==expected.sourceRevision)return unavailable('SOURCE_HASH_OR_REVISION_MISMATCH');
  if(!['READ_ONLY_REFERENCE_INDEX','REFERENCE_ERRORS_FAIL_CLOSED'].includes(spatial.status)||
     !Array.isArray(spatial.grids)||!Array.isArray(spatial.objects)||
     !Array.isArray(spatial.issues)||spatial.grids.length>100000||
     spatial.objects.length>100000)return unavailable('SPATIAL_REFERENCE_INDEX_INVALID_OR_OVERSIZE');

  const risks=new Set();
  const grids=new Map();
  const areas=new Map();
  for(const grid of spatial.grids){
    if(!rec(grid)||!safeId(grid.gridId)||grids.has(grid.gridId)||
       !['GRIDS','DIFF_ONLY'].includes(grid.kind)||
       !Array.isArray(grid.areaRefs)||grid.areaRefs.length>10000)
      return unavailable('GRID_ID_OR_KIND_OR_REFS_INVALID');
    grids.set(grid.gridId,grid);
    if(grid.kind==='DIFF_ONLY')risks.add('DIFF_ONLY_DEFAULT_LAYOUT_UNVERIFIED');
    if(typeof grid.sourceGridDataPath!=='string'||!grid.sourceGridDataPath.trim())
      risks.add('DEFAULT_GRID_LAYOUT_SOURCE_SHA_UNKNOWN');
    if(grid.parentAddress!==null&&grid.parentAddress!==undefined)
      risks.add('ROOT_SUBGRID_RELATION_REQUIRES_NATIVE_PROOF');
    if(grid.areaRefs.length>1)risks.add('GRID_AREA_OWNERSHIP_AMBIGUOUS');
    const visited=new Set();
    for(const addr of grid.areaRefs){
      const parsed=areaAddr(addr);
      if(!parsed)return unavailable('NONCANONICAL_AREA_REFERENCE');
      if(visited.has(addr))return unavailable('DUPLICATE_GRID_AREA_REFERENCE');
      visited.add(addr);
      if(!areas.has(addr))areas.set(addr,{...parsed,gridIds:[],gridsOnlySoftwoodCount:0,
        diffOnlyGridIds:[],unverifiedLayoutGridIds:[]});
      const row=areas.get(addr);
      row.gridIds.push(grid.gridId);
      if(grid.kind==='DIFF_ONLY')row.diffOnlyGridIds.push(grid.gridId);
      if(typeof grid.sourceGridDataPath!=='string'||!grid.sourceGridDataPath.trim())
        row.unverifiedLayoutGridIds.push(grid.gridId);
    }
  }
  for(const object of spatial.objects){
    if(!rec(object)||!safeId(object.gridId)||!safeId(object.itemId))
      return unavailable('GRID_OBJECT_ID_OR_ITEM_INVALID');
    const grid=grids.get(object.gridId);
    if(!grid)return unavailable('GRID_OBJECT_PARENT_GRID_MISSING');
    if(object.itemId===31700014 && grid.kind==='GRIDS'){
      for(const addr of grid.areaRefs){
        const row=areas.get(addr);
        if(row)row.gridsOnlySoftwoodCount++;
      }
    }
  }
  for(const issue of spatial.issues){
    if(!rec(issue)||typeof issue.code!=='string'||!issue.code.startsWith('SPATIAL_'))
      return unavailable('SPATIAL_ISSUE_INVALID');
    risks.add(issue.code);
  }
  if(spatial.status!=='READ_ONLY_REFERENCE_INDEX'||spatial.issues.length)
    risks.add('SOURCE_SPATIAL_INDEX_HAS_UNRESOLVED_REFERENCES');
  if(!areas.size)risks.add('NO_SOURCE_AREA_GRID_CANDIDATES');
  // The W1 event source uses VillageAreaType.Wetland=1, but NO accepted proof
  // equates that native enum with any saved numeric area-key or village index.
  risks.add('WETLAND_ENUM_TO_SAVE_AREA_ID_UNPROVEN');
  risks.add('TREE_TAG_POSITION_AND_SOFTWOOD_QUOTA_UNPROVEN');
  risks.add('CLOCK_ACTUALIZE_EXECUTE_LAST_NEXT_COLD_LOAD_UNPROVEN');

  const candidates=[...areas.values()].map(a=>freeze({
    address:a.address,villageIndex:a.villageIndex,areaKey:a.areaKey,
    referencedGridIds:freeze(a.gridIds.slice().sort((x,y)=>x-y)),
    diffOnlyGridIds:freeze(a.diffOnlyGridIds.slice().sort((x,y)=>x-y)),
    unverifiedLayoutGridIds:freeze(a.unverifiedLayoutGridIds.slice().sort((x,y)=>x-y)),
    // Objects from serialized Grids only; no Default+DiffGrid, no producer
    // identity and NO Native GetMaximumAmount or owner-group quota semantics.
    serializedGridsOnlySoftwoodCount:a.gridsOnlySoftwoodCount,
    sourceReferenceOnly:true,nativeWetlandMembershipVerified:false,
    nativeSoftwoodQuotaVerified:false
  })).sort((x,y)=>x.villageIndex-y.villageIndex||
                    Number(x.areaKey)-Number(y.areaKey));
  return freeze({
    contract:W1_AREA_GRID_SOURCE_PROBE,
    status:'SOURCE_AREA_CANDIDATES_NOT_NATIVE_VERIFIED',
    sourceRevision:expected.sourceRevision,sourceSha256:expected.sourceSha256,
    sourceBuild:W1_PROBE_BUILD,sourceVillageAreaEnumWetland:1,
    candidates:freeze(candidates),riskCodes:freeze([...risks].sort()),
    // Deliberately NO selection of a guessed area or grid. Source values,
    // even with a matching caller hash, never authenticate a SaveSession.
    selectedNativeWetlandArea:null,actualNativeQuota:null,
    nativeAreaMappingVerified:false,originalSourceAuthenticated:false,
    sourceSessionCasVerified:false,actualNativeQuotaVerified:false,
    nativeRuntimeVerified:false,productWriterAuthorized:false,
    productEditedCopyAuthorized:false,automaticDateRepairAuthorized:false
  });
}
