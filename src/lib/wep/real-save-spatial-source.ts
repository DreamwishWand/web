/** 01B -> 02 WEP, original-save spatial REFERENCE bridge.  NO writer, no fabricated 626 geometry. */
export const REAL_SAVE_SPATIAL_SOURCE_CONTRACT = 'ddv.real-save-spatial-source-read@1';
export const SWITCH_626 = Object.freeze({platform:'Nintendo Switch', gameVersion:'1.25.3', schema:626, bid:'9A239D3DB569756D'});
export const SWITCH_624 = Object.freeze({platform:'Nintendo Switch', gameVersion:'1.25.0', schema:624, bid:'52BD625D9B4E0053'});
export type SpatialSourceVersion = Readonly<{platform:string;gameVersion:string;schema:number;bid:string}>;
export type GridObjectAddress = Readonly<{gridId:number;gridObjectId:number;objectMapKey:string;editorId:string}>;
export type ReferenceIssue = Readonly<{code:string;gridId?:number;editorId?:string;detail?:string}>;
export type SpatialSourceObject = Readonly<{
  address:GridObjectAddress;itemId:number;gridId:number;
  serializedX:number;serializedY:number;serializedOrientation:number|string;
  relation:'AREA_ROOT'|'SUBGRID_CHILD'|'UNRESOLVED';parentAddress:GridObjectAddress|null;
  // This is NOT a validated 2D footprint or world-space transform.
  geometryAuthority:'NOT_ACCEPTED_FOR_626';
}>;
export type SpatialSourceGrid = Readonly<{
  gridId:number;kind:'GRIDS'|'DIFF_ONLY';sourceGridDataPath:string|null;
  areaRefs:ReadonlyArray<string>;parentAddress:GridObjectAddress|null;
  effectiveObjects:'SERIALIZED_ONLY'|'DEFAULT_LAYOUT_UNRESOLVED';
}>;
export type SpatialSourceRead = Readonly<{
  contract:typeof REAL_SAVE_SPATIAL_SOURCE_CONTRACT;
  version:typeof SWITCH_626;sourceRevision:string;sourceSha256:string;
  status:'READ_ONLY_REFERENCE_INDEX'|'REFERENCE_ERRORS_FAIL_CLOSED';
  objects:ReadonlyArray<SpatialSourceObject>;grids:ReadonlyArray<SpatialSourceGrid>;
  issues:ReadonlyArray<ReferenceIssue>;diffOnlyGridCount:number;
  geometryFor2d:'NOT_VERIFIED';nativePlacementVerified:false;
  persistentWriteAuthorized:false;productApplyAuthorized:false;directSourceReplacementAuthorized:false;
}>;
type R = Record<string,any>;
const isRec=(v:unknown):v is R=>v!==null && typeof v==='object' && !Array.isArray(v);
const uint=(v:unknown):v is number=>typeof v==='number' && Number.isSafeInteger(v)&&v>=0;
const canonicalId=(k:string):number|null=>/^(0|[1-9]\d*)$/.test(k) && Number.isSafeInteger(Number(k)) ? Number(k):null;
const addr=(gridId:number,id:number):GridObjectAddress=>Object.freeze({gridId,gridObjectId:id,objectMapKey:String(id),editorId:`g${gridId}:o${id}`});
// Inspector accepts only in-process source-minted indexes. Clones must be re-read
// from verified source; a caller-provided SHA/UI epoch alone is not an attestation.
const issued626Indices = new WeakSet<object>();
function sourceContext(ctx:R,expected:SpatialSourceVersion, profile:R){
  if(!isRec(ctx)||ctx.platform!==expected.platform||ctx.gameVersion!==expected.gameVersion||ctx.schema!==expected.schema||ctx.bid!==expected.bid)
    throw Error('SPATIAL_EXACT_VERSION_BID_SCHEMA_REQUIRED');
  if(!isRec(profile)||!isRec(profile.GameInfo)||Number(profile.GameInfo.Version)!==expected.schema||!isRec(profile.World))
    throw Error('SPATIAL_PROFILE_SCHEMA_MISMATCH');
  if(typeof ctx.sourceSha256!=='string'||!/^[0-9a-f]{64}$/i.test(ctx.sourceSha256)||typeof ctx.sourceRevision!=='string'||!ctx.sourceRevision)
    throw Error('SPATIAL_SOURCE_EPOCH_REQUIRED');
  // A passed SHA/epoch is a REFERENCE only, not a Core-minted attestation/CAS.
}
function objEntries(map:unknown,code:string):Array<[number,R]>{
  if(!isRec(map))throw Error(code);
  const out:Array<[number,R]>=[];
  for(const [k,v] of Object.entries(map)) {
    const id=canonicalId(k);
    if(id===null||!isRec(v)||!uint(v.ID)||v.ID!==id) throw Error(code);
    out.push([id,v]);
  }
  return out;
}
/** A real schema626 Save's exact native references, WITHOUT assigning 624 footprints or native XY-to-world transforms. */
export function read626SpatialReferences(profile:R, context:R):SpatialSourceRead {
  sourceContext(context,SWITCH_626,profile);
  const collection=profile.World.GridCollection;
  if(!isRec(collection))throw Error('SPATIAL_GRID_COLLECTION_REQUIRED');
  const rawGrids=objEntries(collection.Grids,'SPATIAL_GRID_ID_MISMATCH');
  const diffs=objEntries(collection.DiffGrids,'SPATIAL_DIFF_GRID_ID_MISMATCH');
  const grids=new Map(rawGrids), diffMap=new Map(diffs);
  const issues:ReferenceIssue[]=[];
  const areaRefs=new Map<number,string[]>();
  const villages=profile.World.Villages;
  if(!Array.isArray(villages))throw Error('SPATIAL_VILLAGE_ARRAY_REQUIRED');
  villages.forEach((v,vi)=>{
    if(!isRec(v)||!isRec(v.Areas))return;
    for(const [areaKey,ar] of Object.entries(v.Areas)){
      if(canonicalId(areaKey)===null||!isRec(ar)||!Array.isArray(ar.GridIDs)){
        issues.push({code:'SPATIAL_AREA_RECORD_INVALID',detail:`v${vi}:a${areaKey}`});continue;
      }
      for(const id of ar.GridIDs){
        if(!uint(id)||(!grids.has(id)&&!diffMap.has(id))){issues.push({code:'SPATIAL_AREA_GRID_REFERENCE_MISSING',detail:`v${vi}:a${areaKey}`});continue;}
        const entry=areaRefs.get(id)??[];entry.push(`v${vi}:a${areaKey}`);areaRefs.set(id,entry);
      }
    }
  });
  const parent=new Map<number,GridObjectAddress>();
  const objects:SpatialSourceObject[]=[];
  const MAX_STRUCTURAL_OBJECTS=100000; // fail closed instead of unbounded browser source projection
  for(const [gridId,grid] of rawGrids){
    if(!isRec(grid.Objects)){issues.push({code:'SPATIAL_OBJECT_MAP_MISSING',gridId});continue;}
    for(const [key,raw] of Object.entries(grid.Objects)){
      const id=canonicalId(key);
      if(id===null||!isRec(raw)||raw.ID!==id){issues.push({code:'SPATIAL_GRIDOBJECT_ID_MISMATCH',gridId});continue;}
      const a=addr(gridId,id);
      if(!uint(raw.ItemID)||!Number.isSafeInteger(raw.X)||!Number.isSafeInteger(raw.Y)){
        issues.push({code:'SPATIAL_OBJECT_SERIALIZED_VALUES_INVALID',gridId,editorId:a.editorId});continue;
      }
      const ori=raw.Orientation;
      if(!(typeof ori==='string'&&/^GridOrientation_/.test(ori)) && !(uint(ori)&&ori<16)){
        issues.push({code:'SPATIAL_OBJECT_ORIENTATION_UNKNOWN',gridId,editorId:a.editorId});continue;
      }
      const sub=raw.State?.SubGrid;
      if(sub!==undefined&&sub!==null){
        if(!isRec(sub)||!uint(sub.GridID)|| (sub.DesignID!==undefined && sub.DesignID!==null && sub.DesignID!==0)){
          issues.push({code:'SPATIAL_SUBGRID_STATE_UNSUPPORTED',gridId,editorId:a.editorId});
        }else if(!grids.has(sub.GridID)){
          issues.push({code:'SPATIAL_SUBGRID_TARGET_MISSING',gridId,editorId:a.editorId});
        }else if(parent.has(sub.GridID)){
          issues.push({code:'SPATIAL_SUBGRID_MULTIPLE_PARENTS',gridId,editorId:a.editorId});
        }else parent.set(sub.GridID,a);
      }
      if(objects.length >= MAX_STRUCTURAL_OBJECTS)throw Error('SPATIAL_STRUCTURAL_OBJECT_BUDGET_EXCEEDED');
      objects.push({address:a,gridId,itemId:raw.ItemID,serializedX:raw.X,serializedY:raw.Y,serializedOrientation:ori,
        relation:'UNRESOLVED',parentAddress:null,geometryAuthority:'NOT_ACCEPTED_FOR_626'});
    }
  }
  const outGrids:SpatialSourceGrid[]=[];
  for(const [id,g] of rawGrids){
    const areas=areaRefs.get(id)??[],p=parent.get(id)??null;
    if(areas.length>1)issues.push({code:'SPATIAL_AREA_GRID_MULTIPLE_OWNERS',gridId:id});
    if(p&&areas.length)issues.push({code:'SPATIAL_ROOT_SUBGRID_OWNERSHIP_CONFLICT',gridId:id});
    if(diffMap.has(id))issues.push({code:'SPATIAL_GRID_DIFF_OVERLAP_UNRESOLVED',gridId:id});
    outGrids.push({gridId:id,kind:'GRIDS',sourceGridDataPath:typeof g.GridDataPath==='string'?g.GridDataPath:null,
      areaRefs:areas,parentAddress:p,effectiveObjects:'SERIALIZED_ONLY'});
  }
  for(const [id,d] of diffs)if(!grids.has(id)){
    outGrids.push({gridId:id,kind:'DIFF_ONLY',sourceGridDataPath:typeof d.GridDataPath==='string'?d.GridDataPath:null,
      areaRefs:areaRefs.get(id)??[],parentAddress:null,effectiveObjects:'DEFAULT_LAYOUT_UNRESOLVED'});
    issues.push({code:'SPATIAL_DIFF_DEFAULT_LAYOUT_UNRESOLVED',gridId:id});
  }
  for(const id of parent.keys()){
    const seen=new Set<number>();let current=id;
    while(parent.has(current)){
      if(seen.has(current)){issues.push({code:'SPATIAL_SUBGRID_PARENT_CYCLE',gridId:id});break;}
      seen.add(current);current=parent.get(current)!.gridId;
    }
  }
  const byGrid=new Map(outGrids.map(g=>[g.gridId,g]));
  const objOut=objects.map(o=>{
    const grid=byGrid.get(o.gridId);
    const relation=grid?.parentAddress?'SUBGRID_CHILD':grid?.areaRefs.length===1?'AREA_ROOT':'UNRESOLVED';
    return Object.freeze({...o,relation,parentAddress:grid?.parentAddress??null});
  });
  const index:SpatialSourceRead=Object.freeze({contract:REAL_SAVE_SPATIAL_SOURCE_CONTRACT,version:SWITCH_626,
    sourceRevision:context.sourceRevision,sourceSha256:context.sourceSha256,
    status:issues.length?'REFERENCE_ERRORS_FAIL_CLOSED':'READ_ONLY_REFERENCE_INDEX',
    grids:Object.freeze(outGrids.map(g=>Object.freeze({...g,areaRefs:Object.freeze([...g.areaRefs])}))),
    objects:Object.freeze(objOut),issues:Object.freeze(issues.map(i=>Object.freeze({...i}))),
    diffOnlyGridCount:diffs.filter(([id])=>!grids.has(id)).length,
    geometryFor2d:'NOT_VERIFIED',nativePlacementVerified:false,persistentWriteAuthorized:false,
    productApplyAuthorized:false,directSourceReplacementAuthorized:false});
  issued626Indices.add(index);
  return index;
}
/** Bind existing 624 2D EditorDocument to original Save values; never converts a 626 Save. */
export function assert624ProjectedObjectsMatchSave(profile:R,doc:R,context:R) {
  sourceContext(context,SWITCH_624,profile);
  if(!isRec(doc)||doc.schema!=='dreamwish-wand-wep-editor-document'||doc.version!==1||!isRec(doc.target)||
    doc.target.gameVersion!==SWITCH_624.gameVersion||doc.target.profileSchemaVersion!==SWITCH_624.schema||
    doc.target.contractBuildIdentity!==SWITCH_624.bid||doc.target.platform!==SWITCH_624.platform||
    (doc.target.sourceBuildIdentity!=null&&doc.target.sourceBuildIdentity!==SWITCH_624.bid)||
    (doc.target.exactBuildKnown===true&&doc.target.sourceBuildIdentity!==SWITCH_624.bid)||
    doc.target.persistentWriteAuthorized!==false)
      throw Error('SPATIAL_624_EDITOR_BUILD_MISMATCH');
  const collection=profile.World.GridCollection;
  const grids=new Map(objEntries(collection?.Grids,'SPATIAL_624_GRID_ID_MISMATCH'));
  const root=doc.target.rootGridId;
  if(!uint(root)||!grids.has(root))throw Error('SPATIAL_624_ROOT_GRID_MISSING');
  if(grids.get(root)?.GridDataPath!==doc.target.gridDataPath)throw Error('SPATIAL_624_GRID_PATH_MISMATCH');
  const seen=new Set<string>();let count=0;
  function verify(o:R,gridId:number,relation:'ROOT'|'SUBGRID_CHILD',p:GridObjectAddress|null){
    if(!isRec(o)||!isRec(o.source)||o.source.gridId!==gridId||!uint(o.source.gridObjectId)||
      o.source.objectMapKey!==String(o.source.gridObjectId)||o.editorId!==`g${gridId}:o${o.source.gridObjectId}`||
      o.source.relation!==relation)throw Error('SPATIAL_624_PROJECTED_ID_MISMATCH');
    const key=o.editorId;if(seen.has(key))throw Error('SPATIAL_624_PROJECTED_DUPLICATE_ID');seen.add(key);
    const claim=o.source.parentAddress;
    if(p===null ? claim!==null && claim!==undefined : !isRec(claim)||claim.gridId!==p.gridId||claim.gridObjectId!==p.gridObjectId||claim.objectMapKey!==p.objectMapKey)
      throw Error('SPATIAL_624_PROJECTED_PARENT_MISMATCH');
    const g=grids.get(gridId),raw=g?.Objects?.[o.source.objectMapKey];
    if(!isRec(raw)||raw.ID!==o.source.gridObjectId||raw.ItemID!==o.itemId||raw.X!==o.x||raw.Y!==o.y)
      throw Error('SPATIAL_624_PROJECTED_SOURCE_CHANGED');
    if(Number.isInteger(raw.Orientation)&&raw.Orientation!==o.orientation)throw Error('SPATIAL_624_PROJECTED_ORIENTATION_CHANGED');
    if(typeof raw.Orientation==='string'){
      const names=['GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight','GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight','GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft','GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'];
      if(names.indexOf(raw.Orientation)!==o.orientation)throw Error('SPATIAL_624_PROJECTED_ORIENTATION_CHANGED');
    }
    count++;
  }
  if(!Array.isArray(doc.objects))throw Error('SPATIAL_624_ROOT_OBJECTS_REQUIRED');
  for(const o of doc.objects)verify(o,root,'ROOT',null);
  if(Object.keys(grids.get(root)?.Objects??{}).length!==doc.objects.length)
    throw Error('SPATIAL_624_ROOT_SOURCE_OBJECT_SET_INCOMPLETE');
  // The hierarchy must represent every native SubGrid edge within its exact containing Grid.
  // A link to an arbitrary ancestor is not an authoritative child transform.
  function checkChildLinks(parentGridId:number,children:R[]){
    const current=grids.get(parentGridId)?.Objects;
    if(!isRec(current))throw Error('SPATIAL_624_PARENT_OBJECT_MAP_MISSING');
    const expected=new Set<number>();
    for(const raw of Object.values(current)){
      const id=raw?.State?.SubGrid?.GridID;
      if(id===undefined||id===null)continue;
      if(!uint(id)||expected.has(id))throw Error('SPATIAL_624_SUBGRID_SOURCE_LINK_INVALID');
      expected.add(id);
    }
    if(children.length!==expected.size||children.some(h=>!isRec(h)||!expected.has(h.gridId)))
      throw Error('SPATIAL_624_SUBGRID_HIERARCHY_INCOMPLETE');
  }
  const seenGrids=new Set<number>([root]);
  function walk(h:R,ancestor:Set<number>,immediateParentGridId:number){
    if(!isRec(h)||!uint(h.gridId)||!grids.has(h.gridId)||ancestor.has(h.gridId)||seenGrids.has(h.gridId))
      throw Error('SPATIAL_624_SUBGRID_BOUNDARY_INVALID');
    const p=h.parentAddress;
    if(!isRec(p)||!uint(p.gridId)||!uint(p.gridObjectId)||p.objectMapKey!==String(p.gridObjectId))throw Error('SPATIAL_624_PARENT_ID_INVALID');
    if(p.gridId!==immediateParentGridId)throw Error('SPATIAL_624_SUBGRID_IMMEDIATE_PARENT_GRID_MISMATCH');
    const parentObj=grids.get(p.gridId)?.Objects?.[p.objectMapKey];
    if(!isRec(parentObj)||parentObj.ID!==p.gridObjectId||parentObj.State?.SubGrid?.GridID!==h.gridId)throw Error('SPATIAL_624_PARENT_NATIVE_LINK_INVALID');
    if(!Array.isArray(h.objects)||!Array.isArray(h.children))throw Error('SPATIAL_624_SUBGRID_MEMBERS_MISSING');
    if(grids.get(h.gridId)?.GridDataPath!==h.gridDataPath)throw Error('SPATIAL_624_CHILD_GRID_PATH_MISMATCH');
    const nativeObjects=grids.get(h.gridId)?.Objects;
    if(!isRec(nativeObjects)||Object.keys(nativeObjects).length!==h.objects.length)
      throw Error('SPATIAL_624_CHILD_SOURCE_OBJECT_SET_INCOMPLETE');
    seenGrids.add(h.gridId);
    for(const o of h.objects)verify(o,h.gridId,'SUBGRID_CHILD',p as GridObjectAddress);
    const next=new Set(ancestor);next.add(h.gridId);
    for(const ch of h.children)walk(ch,next,h.gridId);
    checkChildLinks(h.gridId,h.children);
  }
  const hi=doc.metadata?.subGridHierarchy;
  if(!Array.isArray(hi))throw Error('SPATIAL_624_HIERARCHY_REQUIRED');
  for(const h of hi)walk(h,new Set([root]),root);
  checkChildLinks(root,hi);
  if(!isRec(doc.metadata?.directRootProjection)||doc.metadata.directRootProjection.evidenceStatus!=='CONFIRMED')throw Error('SPATIAL_624_PROJECTION_AUTHORITY_MISSING');
  return Object.freeze({contract:REAL_SAVE_SPATIAL_SOURCE_CONTRACT,sourceRevision:context.sourceRevision,
    sourceSha256:context.sourceSha256,matchingSourceObjects:count,identityMatches:true,
    authorization:'READ_ONLY_PROJECTION_CHECK_ONLY' as const,persistentWriteAuthorized:false as const});
}
/** Inspector-only lookup: exact index epoch and source hash, no authority to paint/apply. */
export function inspect626SourceObjectAtRevision(index:SpatialSourceRead,editorId:string,expectedRevision:string,expectedSha256:string){
  if(!issued626Indices.has(index))throw Error('SPATIAL_SOURCE_INDEX_NOT_MINTED');
  if(index.contract!==REAL_SAVE_SPATIAL_SOURCE_CONTRACT||index.version!==SWITCH_626||
     index.sourceRevision!==expectedRevision||index.sourceSha256!==expectedSha256)
    throw Error('SPATIAL_SOURCE_REVISION_OR_HASH_STALE');
  const object=index.objects.find(o=>o.address.editorId===editorId);
  if(!object)throw Error('SPATIAL_SOURCE_OBJECT_NOT_FOUND');
  if(object.relation==='UNRESOLVED'||index.issues.some(i=>i.gridId===object.gridId))
    throw Error('SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED');
  return Object.freeze({address:object.address,itemId:object.itemId,
    gridLocalSerialized:{x:object.serializedX,y:object.serializedY,orientation:object.serializedOrientation},
    relation:object.relation,parentAddress:object.parentAddress,
    sourceRevision:index.sourceRevision,geometryFor2d:'NOT_VERIFIED' as const,
    persistentWriteAuthorized:false as const,productApplyAuthorized:false as const});
}
