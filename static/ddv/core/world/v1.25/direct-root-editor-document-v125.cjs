/* Dreamwish Wand DDV Core 01B — current-v1.25 direct-root EditorDocument projection.
 * Read/model/preflight infrastructure only. No persistent world writer.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DdvCoreDirectRootEditorDocumentV125=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const CURRENT_GAME_VERSION='1.25.0';
const CURRENT_PROFILE_SCHEMA=624;
const CURRENT_PLATFORM='Nintendo Switch';
const CURRENT_BUILD_ID='52BD625D9B4E0053';
const GRIDDATA_DIMENSIONS_SHA256='75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa';
const RESULT_SCHEMA='ddv.direct-root-editor-document-result@1';
const CONTRACT_SCHEMA='ddv.direct-root-editor-document@1';
const EDITOR_SCHEMA='dreamwish-wand-wep-editor-document';
const SUPPORTED_LOCATION_KIND='FLOATING_ISLAND';
const clone=v=>JSON.parse(JSON.stringify(v));
const asObject=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
const safeInt=v=>{const n=Number(v);return Number.isSafeInteger(n)?n:null;};
const positiveInt=v=>{const n=safeInt(v);return n!==null&&n>0?n:null;};
const unique=xs=>[...new Set(xs)];
function ok(extra){return {schema:RESULT_SCHEMA,contract:CONTRACT_SCHEMA,status:'RESOLVED',persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,...extra};}
function blocked(code,details={},status='UNSUPPORTED'){return {schema:RESULT_SCHEMA,contract:CONTRACT_SCHEMA,status,persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,document:null,blockers:[{code,...clone(details)}]};}
function sameJson(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function geometryRecord(index,itemId){return index?.[itemId]??index?.[String(itemId)]??null;}
function scopeRecord(index,itemId){return index?.[itemId]??index?.[String(itemId)]??null;}
function layerFor(concrete,stateKind){if(stateKind==='HouseData'||stateKind==='BuildingWithSkinData'||concrete==='BuildingItemData')return 'building';if(concrete==='FurnitureItemData')return 'furniture';return 'static';}
function classifyObject(raw,{worldApi,geometryIndex,scopeIndex}){
 const itemId=safeInt(raw?.ItemID);if(itemId===null)return {status:'UNSUPPORTED',code:'DIRECT_ROOT_OBJECT_ITEM_ID_INVALID'};
 const g=geometryRecord(geometryIndex,itemId),scope=scopeRecord(scopeIndex,itemId);
 const kind=worldApi.stateKind(raw?.State),concrete=g?.concreteType||scope?.concreteType||null,reasons=[];let editability='readonly';
 if(!g)reasons.push('GEOMETRY_UNRESOLVED');
 if(concrete==='FenceAndRoadItemData')reasons.push('ROAD_FENCE_DELEGATED_01C');
 else if(kind==='HouseData')reasons.push('HOUSE_DATA_READ_ONLY');
 else if(kind==='BuildingWithSkinData'||concrete==='BuildingItemData')reasons.push('BUILDING_READ_ONLY');
 else if(concrete!=='FurnitureItemData')reasons.push('NON_FURNITURE_WORLD_CLASS');
 else if(!scope)reasons.push('FURNITURE_POLICY_MISSING');
 else if(scope.isMissionItem)reasons.push('MISSION_ITEM_READ_ONLY');
 else if(scope.explicitGridEditRestriction)reasons.push('GRID_EDIT_RESTRICTION_PRESENT');
 else if(Array.isArray(scope.nativePresetKnownRejectReasons)&&scope.nativePresetKnownRejectReasons.length)reasons.push(...scope.nativePresetKnownRejectReasons.map(x=>`NATIVE_REJECT_${x}`));
 else if(kind!=='NONE'&&kind!=='SubGrid')reasons.push(`STATE_${kind}_UNSUPPORTED`);
 else editability='editable';
 return {status:'RESOLVED',itemId,g,scope,stateKind:kind,concreteType:concrete,layer:layerFor(concrete,kind),editability,reasons};
}
function footprintFor(raw,grid,{worldApi,geometryIndex}){
 const itemId=safeInt(raw?.ItemID),g=geometryRecord(geometryIndex,itemId);
 if(!g)return null;
 try{
  const orientation=worldApi.orientationIndex(raw?.Orientation);
  const size=worldApi.orientedFootprintSize(g,orientation,grid?.TessellationFactor||1);
  return {orientation,size,footprint:worldApi.rectangularFootprint(size)};
 }catch{return null;}
}
function dimensionsFor(grid,gridDataDimensions){
 const path=typeof grid?.GridDataPath==='string'?grid.GridDataPath:null;if(!path)return null;
 const d=gridDataDimensions?.[path];if(!d)return null;
 const sx=positiveInt(d.sizeX),sy=positiveInt(d.sizeY),t=positiveInt(grid.TessellationFactor);
 if(sx===null||sy===null||t===null||typeof d.sourceSha256!=='string'||!d.sourceSha256)return null;
 return {path,sizeX:sx,sizeY:sy,tessellationFactor:t,width:sx*t,height:sy*t,sourceSha256:d.sourceSha256};
}
function projectObject(raw,key,grid,ctx,relation,parentAddress){
 if(!raw||typeof raw!=='object')return {error:'DIRECT_ROOT_OBJECT_INVALID'};
 const oid=safeInt(raw.ID);if(oid===null)return {error:'DIRECT_ROOT_OBJECT_ID_INVALID'};
 if(String(oid)!==String(key))return {error:'DIRECT_ROOT_OBJECT_KEY_ID_MISMATCH',details:{objectMapKey:String(key),gridObjectId:oid}};
 const cls=classifyObject(raw,ctx);if(cls.status!=='RESOLVED')return {error:cls.code};
 if(cls.stateKind==='UNKNOWN'||cls.stateKind==='MULTI_OR_UNKNOWN')return {error:'DIRECT_ROOT_OBJECT_STATE_UNSUPPORTED',details:{gridObjectId:oid,stateKind:cls.stateKind}};
 const geom=footprintFor(raw,grid,ctx);if(!geom)return {error:'DIRECT_ROOT_OBJECT_GEOMETRY_UNRESOLVED',details:{gridObjectId:oid,itemId:cls.itemId}};
 const x=safeInt(raw.X),y=safeInt(raw.Y);if(x===null||y===null)return {error:'DIRECT_ROOT_OBJECT_COORDINATE_INVALID',details:{gridObjectId:oid}};
 const gid=safeInt(grid.ID);if(gid===null)return {error:'DIRECT_ROOT_GRID_ID_INVALID'};
 return {object:{
  editorId:`g${gid}:o${oid}`,itemId:cls.itemId,layer:cls.layer,x,y,orientation:geom.orientation,footprint:geom.footprint,
  source:{gridId:gid,gridObjectId:oid,objectMapKey:String(key),relation,parentAddress:parentAddress?clone(parentAddress):null},
  portableState:null,dependencyIds:[],editability:cls.editability,
  metadata:{worldClass:cls.concreteType||'UNKNOWN',stateKind:cls.stateKind,reasons:clone(cls.reasons),geometryStatus:'RESOLVED',footprintMode:'ORIENTED_BOUNDING_RECT',footprintSize:geom.size,gridTessellationFactor:Number(grid.TessellationFactor||1),rawState:clone(raw.State),sourceGridDataPath:grid.GridDataPath||null,internalName:cls.g?.internalName||cls.scope?.internalName||null,acceptedFloorTypesFlag:cls.g?.acceptedFloorTypesFlag??cls.scope?.acceptedFloorTypesFlag??null,projectionAuthorization:'NONE'}
 }};
}
function buildHierarchyForGrid(gridId,ctx,parentAddress,stack){
 if(stack.has(gridId))return {error:'DIRECT_ROOT_SUBGRID_CYCLE',details:{gridId}};
 const grid=ctx.grids?.[String(gridId)]??ctx.grids?.[gridId]??null;
 if(!grid)return {error:'DIRECT_ROOT_SUBGRID_GRID_MISSING',details:{gridId}};
 if(safeInt(grid.ID)!==gridId)return {error:'DIRECT_ROOT_SUBGRID_GRID_KEY_ID_MISMATCH',details:{gridId,recordId:grid.ID}};
 const dim=dimensionsFor(grid,ctx.gridDataDimensions);if(!dim)return {error:'DIRECT_ROOT_SUBGRID_BOUNDS_UNRESOLVED',details:{gridId,gridDataPath:grid.GridDataPath||null}};
 stack.add(gridId);
 try{
  const objects=[],children=[];
  for(const [key,raw] of Object.entries(grid.Objects||{}).sort((a,b)=>Number(a[0])-Number(b[0]))){
   const p=projectObject(raw,key,grid,ctx,'SUBGRID_CHILD',parentAddress);if(p.error)return p;objects.push(p.object);
   if(p.object.metadata.stateKind==='SubGrid'){
    const sub=raw?.State?.SubGrid;
    if(!sub||typeof sub!=='object'||(sub.DesignID!==null&&sub.DesignID!==undefined&&sub.DesignID!==0))return {error:'DIRECT_ROOT_SUBGRID_NESTED_STATE_UNSUPPORTED',details:{gridId,gridObjectId:p.object.source.gridObjectId}};
    const childId=safeInt(sub.GridID);if(childId===null)return {error:'DIRECT_ROOT_SUBGRID_CHILD_ID_INVALID',details:{gridId,gridObjectId:p.object.source.gridObjectId}};
    const nested=buildHierarchyForGrid(childId,ctx,{gridId,gridObjectId:p.object.source.gridObjectId},stack);if(nested.error)return nested;children.push(nested.node);
   }
  }
  return {node:{gridId,gridDataPath:dim.path,tessellationFactor:dim.tessellationFactor,bounds:{x:0,y:0,w:dim.width,h:dim.height,status:'AUTHORITATIVE_GRIDDATAPATH'},dimensionSourceSha256:dim.sourceSha256,parentAddress:clone(parentAddress),objects,children}};
 }finally{stack.delete(gridId);}
}
function compatiblePortableSubGrid(raw,ctx,stack=new Set()){
 const sub=raw?.State?.SubGrid;if(!sub||typeof sub!=='object'||(sub.DesignID!==null&&sub.DesignID!==undefined&&sub.DesignID!==0))return null;
 const childId=safeInt(sub.GridID);if(childId===null||stack.has(childId))return null;
 const grid=ctx.grids?.[String(childId)]??ctx.grids?.[childId]??null;if(!grid)return null;
 const dim=dimensionsFor(grid,ctx.gridDataDimensions);if(!dim)return null;
 stack.add(childId);try{
  const objects=[];
  for(const [key,c] of Object.entries(grid.Objects||{}).sort((a,b)=>Number(a[0])-Number(b[0]))){
   const cls=classifyObject(c,ctx);if(cls.status!=='RESOLVED'||cls.editability!=='editable')return null;
   const geom=footprintFor(c,grid,ctx);if(!geom)return null;
   let state={codec:'none'};
   if(cls.stateKind==='SubGrid'){state=compatiblePortableSubGrid(c,ctx,stack);if(!state)return null;}
   else if(cls.stateKind!=='NONE')return null;
   const x=safeInt(c.X),y=safeInt(c.Y),oid=safeInt(c.ID);if(x===null||y===null||oid===null||String(oid)!==String(key))return null;
   objects.push({objectKey:`grid:${childId}:object:${key}`,itemId:Number(c.ItemID),localX:x,localY:y,orientation:geom.orientation,footprint:geom.footprint,state,sourceDiagnostics:{sourceGridId:childId,sourceGridObjectId:oid,sourceGridDataPath:grid.GridDataPath||null}});
  }
  return {codec:'subgrid.serialized-local-child@1',child:{width:dim.width,height:dim.height,tessellationFactor:dim.tessellationFactor,objects}};
 }finally{stack.delete(childId);}
}
function semanticRole(locationRef){return locationRef?.kind===SUPPORTED_LOCATION_KIND?'FLOATING_ISLAND_DIRECT_ROOT':null;}
function createProjector(config={}){
 const locationApi=config.locationApi,worldApi=config.worldApi;
 if(!locationApi||locationApi.CURRENT_GAME_VERSION!==CURRENT_GAME_VERSION||locationApi.CURRENT_PROFILE_SCHEMA!==CURRENT_PROFILE_SCHEMA||locationApi.LOCATION_CODEC!=='ddv.outdoor-location-ref@1'||locationApi.DIRECT_GRID_ROUTE_CODEC!=='ddv.direct-grid-route@1')throw Error('DIRECT_ROOT_LOCATION_API_CONTRACT_MISMATCH');
 if(!worldApi||worldApi.CURRENT_GAME_VERSION!==CURRENT_GAME_VERSION||worldApi.CURRENT_PROFILE_SCHEMA!==CURRENT_PROFILE_SCHEMA||typeof worldApi.stateKind!=='function'||typeof worldApi.orientationIndex!=='function'||typeof worldApi.orientedFootprintSize!=='function'||typeof worldApi.rectangularFootprint!=='function')throw Error('DIRECT_ROOT_WORLD_API_CONTRACT_MISMATCH');
 if(config.gridDataDimensionsSha256!==GRIDDATA_DIMENSIONS_SHA256)throw Error('DIRECT_ROOT_GRIDDATA_DIMENSIONS_HASH_MISMATCH');
 const gridDataDimensions=config.gridDataDimensions||{},geometryIndex=config.geometryIndex||{},scopeIndex=config.scopeIndex||{};
 const ctxBase={locationApi,worldApi,gridDataDimensions,geometryIndex,scopeIndex};
 function project(profile,{locationRef,directRootRoute,source}={}){
  if(!source||source.gameVersion!==CURRENT_GAME_VERSION)return blocked('DIRECT_ROOT_VERSION_UNSUPPORTED',{gameVersion:source?.gameVersion??null});
  if(source.platform!==CURRENT_PLATFORM)return blocked('DIRECT_ROOT_PLATFORM_UNSUPPORTED',{platform:source?.platform??null});
  if(source.profileSchemaVersion!==undefined&&Number(source.profileSchemaVersion)!==CURRENT_PROFILE_SCHEMA)return blocked('DIRECT_ROOT_PROFILE_SCHEMA_UNSUPPORTED',{profileSchemaVersion:source.profileSchemaVersion});
  if(locationRef?.codec!=='ddv.outdoor-location-ref@1')return blocked('DIRECT_ROOT_LOCATION_CODEC_UNSUPPORTED');
  const role=semanticRole(locationRef);if(!role)return blocked('DIRECT_ROOT_SEMANTIC_ROLE_UNSUPPORTED',{kind:locationRef?.kind??null});
  if(directRootRoute?.codec!=='ddv.direct-grid-route@1'||typeof directRootRoute.gridDataPath!=='string'||!directRootRoute.gridDataPath)return blocked('DIRECT_ROOT_ROUTE_INVALID');
  const resolved=locationApi.resolveDestinationDirectRoot(profile,locationRef,directRootRoute);
  if(resolved?.status!=='RESOLVED'){
   const code=resolved?.blockers?.[0]?.code||'DIRECT_ROOT_ROUTE_UNRESOLVED';
   return blocked(code,{locationStatus:resolved?.status??'UNKNOWN',route:clone(directRootRoute)},resolved?.status==='AMBIGUOUS_FAIL_CLOSED'?'AMBIGUOUS_FAIL_CLOSED':'UNRESOLVED');
  }
  const gridId=safeInt(resolved.destinationGridId);if(gridId===null)return blocked('DIRECT_ROOT_GRID_ID_UNRESOLVED');
  const grids=asObject(profile?.World?.GridCollection?.Grids);if(!grids)return blocked('DIRECT_ROOT_GRID_COLLECTION_MISSING');
  const grid=grids[String(gridId)]??grids[gridId]??null;if(!grid)return blocked('DIRECT_ROOT_GRID_MISSING',{gridId});
  if(safeInt(grid.ID)!==gridId)return blocked('DIRECT_ROOT_GRID_KEY_ID_MISMATCH',{gridId,recordId:grid.ID});
  if(grid.GridDataPath!==directRootRoute.gridDataPath)return blocked('DIRECT_ROOT_GRID_PATH_MISMATCH',{gridId,expected:directRootRoute.gridDataPath,actual:grid.GridDataPath??null});
  const reverse=locationApi.resolveLocationFromGrid(profile,gridId);
  if(reverse?.status!=='RESOLVED')return blocked('DIRECT_ROOT_OWNERSHIP_UNRESOLVED',{gridId,ownershipStatus:reverse?.status??'UNKNOWN'});
  if(!sameJson(reverse.locationRef,locationRef)||reverse.directRootRoute?.gridDataPath!==directRootRoute.gridDataPath||safeInt(reverse.sourceDiagnostics?.directRootGridId)!==gridId)return blocked('DIRECT_ROOT_ROUTE_IDENTITY_CONFLICT',{gridId});
  const dim=dimensionsFor(grid,gridDataDimensions);if(!dim)return blocked('DIRECT_ROOT_BOUNDS_UNRESOLVED',{gridId,gridDataPath:grid.GridDataPath||null});
  if(dim.tessellationFactor!==2)return blocked('DIRECT_ROOT_TESSELLATION_INCONSISTENT',{gridId,tessellationFactor:dim.tessellationFactor});
  const ctx={...ctxBase,grids};
  const objects=[],subGridHierarchy=[];
  for(const [key,raw] of Object.entries(grid.Objects||{}).sort((a,b)=>Number(a[0])-Number(b[0]))){
   const p=projectObject(raw,key,grid,ctx,'ROOT',null);if(p.error)return blocked(p.error,p.details||{gridId});
   const o=p.object;
   if(o.metadata.stateKind==='SubGrid'){
    const sub=raw?.State?.SubGrid;
    if(!sub||typeof sub!=='object'||(sub.DesignID!==null&&sub.DesignID!==undefined&&sub.DesignID!==0))return blocked('DIRECT_ROOT_SUBGRID_STATE_UNSUPPORTED',{gridId,gridObjectId:o.source.gridObjectId});
    const childId=safeInt(sub.GridID);if(childId===null)return blocked('DIRECT_ROOT_SUBGRID_CHILD_ID_INVALID',{gridId,gridObjectId:o.source.gridObjectId});
    const h=buildHierarchyForGrid(childId,ctx,{gridId,gridObjectId:o.source.gridObjectId},new Set([gridId]));if(h.error)return blocked(h.error,h.details||{gridId,gridObjectId:o.source.gridObjectId});
    subGridHierarchy.push(h.node);
    o.metadata.subGridBinding={gridId:childId,gridDataPath:h.node.gridDataPath,hierarchyPreserved:true};
    o.portableState=compatiblePortableSubGrid(raw,ctx);
    if(!o.portableState)o.metadata.reasons=unique([...o.metadata.reasons,'SUBGRID_PORTABILITY_NOT_AUTHORIZED_BY_PROJECTION']);
   }
   objects.push(o);
  }
  const document={
   schema:EDITOR_SCHEMA,version:1,
   target:{gameVersion:CURRENT_GAME_VERSION,platform:CURRENT_PLATFORM,contractBuildIdentity:CURRENT_BUILD_ID,sourceBuildIdentity:source.buildIdentity||null,exactBuildKnown:source.buildIdentity===CURRENT_BUILD_ID,profileSchemaVersion:CURRENT_PROFILE_SCHEMA,locationRef:clone(locationRef),directRootRoute:clone(directRootRoute),directRootRole:role,rootGridId:gridId,gridDataPath:dim.path,tessellationFactor:dim.tessellationFactor,rootGridRole:{status:'SEMANTIC_DIRECT_ROOT_READ_MODEL',semanticRole:role,mutationAuthorized:false,evidenceStatus:'CONFIRMED_CURRENT_V125_LOCATION_ROUTE'},persistentWriteAuthorized:false},
   objects,networks:{roads:null,fences:null},
   capabilities:{worldGridRead:'supported',worldDirectRootRoute:'supported',worldAreaRoute:'not-applicable-direct-root',worldSubGridRead:'supported',worldGeometry:'supported',worldPlacementValidate:'external-core-preflight-required',worldDryRunMutation:'not-authorized-by-projector',worldPersistentWrite:'unsupported',worldCrossRootMove:'unsupported',worldBuildingMutation:'unsupported',worldPlayerHouseMutation:'unsupported',worldEnvironmentMutation:'unsupported',roadTopologyEdit:'unsupported',fenceTopologyEdit:'unsupported'},
   metadata:{directRootProjection:{schema:CONTRACT_SCHEMA,evidenceStatus:'CONFIRMED',semanticRole:role,locationRef:clone(locationRef),directRootRoute:clone(directRootRoute),rootIdentity:{gridId,gridDataPath:dim.path},boundsAuthority:{artifact:'DDV-BUILDING-V125-V1_7-GRIDDATA-DIMENSIONS',sha256:GRIDDATA_DIMENSIONS_SHA256,recordSourceSha256:dim.sourceSha256},subGridPolicy:'PRESERVE_EXACT_HIERARCHY_FAIL_CLOSED',operationAuthorization:'NONE'},rootGrid:{sourceGridId:gridId,gridDataPath:dim.path,gridDefaultLayoutPath:grid.GridDefaultLayoutPath||'',tessellationFactor:dim.tessellationFactor,nextGridObjectId:Number(grid.NextGridObjectID||0),role:{status:'SEMANTIC_DIRECT_ROOT_READ_MODEL',semanticRole:role,mutationAuthorized:false,evidenceStatus:'CONFIRMED_CURRENT_V125_LOCATION_ROUTE'}},rootGridBounds:{x:0,y:0,w:dim.width,h:dim.height,status:'AUTHORITATIVE_GRIDDATAPATH'},subGridHierarchy,diagnostics:[]}
  };
  return ok({document,evidenceStatus:'CONFIRMED',semanticRole:role,rootIdentity:{locationRef:clone(locationRef),directRootRoute:clone(directRootRoute),gridId,gridDataPath:dim.path},writerAuthorized:false});
 }
 return Object.freeze({project});
}
return Object.freeze({CURRENT_GAME_VERSION,CURRENT_PROFILE_SCHEMA,CURRENT_PLATFORM,CURRENT_BUILD_ID,GRIDDATA_DIMENSIONS_SHA256,RESULT_SCHEMA,CONTRACT_SCHEMA,EDITOR_SCHEMA,SUPPORTED_LOCATION_KIND,createProjector});
});
