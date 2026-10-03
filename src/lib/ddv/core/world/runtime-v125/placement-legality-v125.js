/* Dreamwish Wand DDV Core 01B — current v1.25 structured native placement legality.
 * Read/preflight only. No world/save mutation.
 *
 * Scope intentionally matches the existing ordinary placement subset:
 *   - same root Grid
 *   - ordinary geometry-backed object
 *   - cardinal orientation 0/4/8/12
 *   - non-wall GridArea
 *   - ClearArea=false
 *   - automaticSpawning=false
 *
 * Native conflict model (Switch v1.25): GridCellConflict
 *   None=0, Void=1, FloorType=2, GridObjects=4, Clearable=8, All=15.
 *
 * Clearability is item/state/policy-sensitive. This module never guesses it.
 * A caller may bind an independently approved native-equivalent clearabilityResolver;
 * otherwise colliding ordinary-object placements remain NATIVE_UNKNOWN_UNVERIFIED.
 */
(function(root,factory){
  const placement=(typeof module==='object'&&module.exports)?require('./core-world-v125-placement.js'):(root&&root.DdvCoreWorldV125Placement);
  const api=factory(placement);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DdvCoreWorldV125PlacementLegality=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(P){
'use strict';
if(!P)throw Error('V125_PLACEMENT_DEPENDENCY_REQUIRED');
const CONFLICT=Object.freeze({None:0,Void:1,FloorType:2,GridObjects:4,Clearable:8,All:15});
const NATIVE_CLASS=Object.freeze({
  VALID_CLEAR:'NATIVE_VALID_CLEAR',
  VALID_REPLACES_OR_REMOVES_EXISTING:'NATIVE_VALID_REPLACES_OR_REMOVES_EXISTING',
  INVALID:'NATIVE_INVALID',
  UNKNOWN:'NATIVE_UNKNOWN_UNVERIFIED'
});
const CLEARABILITY=Object.freeze({CLEARABLE:'CLEARABLE',NOT_CLEARABLE:'NOT_CLEARABLE',UNKNOWN:'UNKNOWN'});
const WALL=0x800;
const FLOOR_SEMANTIC_MASK=0x07fbffff; // every current GridFloorType semantic bit except BlockAutomaticSpawning 0x40000
// Preserve numeric orientation handling even if a caller uses the canonical enum labels.
function orientationIndex(v){
  const n=Number(v);if(Number.isSafeInteger(n))return n;
  const s=String(v);
  const canonical=['GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight','GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight','GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft','GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'];
  return canonical.indexOf(s);
}
function int(v,label){const n=Number(v);if(!Number.isSafeInteger(n))throw Error(`V125_LEGALITY_${label}`);return n;}
function geometryGet(index,itemId){return index?.[itemId]??index?.[String(itemId)]??null;}
function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function objectRect(o,g,gridT){const ori=orientationIndex(o.orientation??o.Orientation),s=P.cardinalSize(g,ori,gridT);if(!s)return null;return {x:int(o.x??o.X,'OBJ_X'),y:int(o.y??o.Y,'OBJ_Y'),w:s.w,h:s.h};}
function unique(arr){return [...new Set(arr)];}
function baseResult(nativeClass,reasonCodes,extra={}){
  return Object.freeze({
    schema:'ddv.native-placement-legality@1',
    platform:'NINTENDO_SWITCH',
    gameVersion:'1.25.0',
    nativeClass,
    reasonCodes:Object.freeze(unique(reasonCodes)),
    nativeConflictFlags:extra.nativeConflictFlags??null,
    nativeConflictFlagsResolved:extra.nativeConflictFlagsResolved??false,
    nativeWithoutClearingAccepted:extra.nativeWithoutClearingAccepted??null,
    nativeWithClearingAccepted:extra.nativeWithClearingAccepted??null,
    cells:Object.freeze(extra.cells??[]),
    conflicts:Object.freeze(extra.conflicts??[]),
    footprint:extra.footprint??null,
    clearabilityResolved:extra.clearabilityResolved??true,
    wandPreserveOverlap:extra.wandPreserveOverlap??Object.freeze({status:'NOT_APPLICABLE',authorized:false}),
    persistentWriteAuthorized:false
  });
}
function normalizeClearabilityResult(v){
  if(v===true)return {status:CLEARABILITY.CLEARABLE};
  if(v===false)return {status:CLEARABILITY.NOT_CLEARABLE};
  if(v==null)return {status:CLEARABILITY.UNKNOWN};
  if(typeof v==='string'&&Object.values(CLEARABILITY).includes(v))return {status:v};
  if(typeof v==='object'&&Object.values(CLEARABILITY).includes(v.status))return v;
  return {status:CLEARABILITY.UNKNOWN};
}
function classifyOrdinaryCardinalNativePlacement({
  gridData,geometryIndex,objects,candidate,gridTessellationFactor=1,excludeEditorId=null,
  clearArea=false,automaticSpawning=false,clearabilityResolver=null
}){
  const cells=[],conflicts=[],reasons=[];
  if(clearArea||automaticSpawning)return baseResult(NATIVE_CLASS.UNKNOWN,[clearArea?'CLEAR_AREA_NATIVE_POLICY_UNSUPPORTED':null,automaticSpawning?'AUTOMATIC_SPAWNING_NATIVE_POLICY_UNSUPPORTED':null].filter(Boolean),{clearabilityResolved:false});
  if(!gridData||!Number.isInteger(gridData.sizeX)||!Number.isInteger(gridData.sizeY))return baseResult(NATIVE_CLASS.UNKNOWN,['GRID_DATA_REQUIRED'],{clearabilityResolved:false});
  const g=geometryGet(geometryIndex,candidate?.itemId??candidate?.ItemID);
  if(!g)return baseResult(NATIVE_CLASS.UNKNOWN,['CANDIDATE_GEOMETRY_UNRESOLVED'],{clearabilityResolved:false});
  const ori=orientationIndex(candidate.orientation??candidate.Orientation);
  if(!P.CARDINAL.has(ori))return baseResult(NATIVE_CLASS.UNKNOWN,['NON_CARDINAL_NATIVE_MAPPING_UNSUPPORTED'],{clearabilityResolved:false});
  const floorFlag=Number(g.acceptedFloorTypesFlag)>>>0;
  if((floorFlag&WALL)!==0)return baseResult(NATIVE_CLASS.UNKNOWN,['WALL_GRIDAREA_NATIVE_POLICY_UNSUPPORTED'],{clearabilityResolved:false});
  const gridT=int(gridTessellationFactor,'GRID_TESS'),x=int(candidate.x??candidate.X,'X'),y=int(candidate.y??candidate.Y,'Y');
  const size=P.cardinalSize(g,ori,gridT);
  if(!size)return baseResult(NATIVE_CLASS.UNKNOWN,['FOOTPRINT_MAPPING_UNRESOLVED'],{clearabilityResolved:false});
  if(x<0||y<0||x+size.w>gridData.sizeX*gridT||y+size.h>gridData.sizeY*gridT){
    return baseResult(NATIVE_CLASS.INVALID,['AREA_OUTSIDE_GRID'],{nativeConflictFlags:null,nativeConflictFlagsResolved:true,nativeWithoutClearingAccepted:false,nativeWithClearingAccepted:false,footprint:size});
  }
  if(g.strideOverride!==null&&g.strideOverride!==undefined){
    const stride=int(g.strideOverride,'STRIDE')*gridT;
    if(stride>0&&(x%stride!==0||y%stride!==0))return baseResult(NATIVE_CLASS.INVALID,['STRIDE_OVERRIDE_MISMATCH'],{nativeConflictFlags:0,nativeConflictFlagsResolved:true,nativeWithoutClearingAccepted:false,nativeWithClearingAccepted:false,footprint:size});
  }
  const candidateRect={x,y,w:size.w,h:size.h},occupancy=[];
  for(const o of objects||[]){
    if(excludeEditorId!==null&&String(o.editorId)===String(excludeEditorId))continue;
    const og=geometryGet(geometryIndex,o.itemId??o.ItemID);
    if(!og)return baseResult(NATIVE_CLASS.UNKNOWN,[`OCCUPANCY_GEOMETRY_UNRESOLVED:${o.editorId??o.ID??'unknown'}`],{footprint:size,clearabilityResolved:false});
    const oo=orientationIndex(o.orientation??o.Orientation),r=objectRect(o,og,gridT);
    if(!r)return baseResult(NATIVE_CLASS.UNKNOWN,[`OCCUPANCY_NONCARDINAL:${o.editorId??o.ID??'unknown'}`],{footprint:size,clearabilityResolved:false});
    if(rectsOverlap(candidateRect,r))occupancy.push({object:o,geometry:og,orientation:oo,rect:r});
  }
  let aggregate=0,clearabilityUnknown=false,anyObjectCollision=false,anyNonClearable=false;
  const clearCache=new Map();
  for(let dx=0;dx<size.w;dx++)for(let dy=0;dy<size.h;dy++){
    const layer=P.layerAt(g,ori,dx,dy,gridT);
    if(layer===null)return baseResult(NATIVE_CLASS.UNKNOWN,['LOCAL_CELL_MAPPING_FAILED'],{footprint:size,cells,conflicts,clearabilityResolved:false});
    if(layer===0)continue;
    const wx=x+dx,wy=y+dy,cx=Math.trunc(wx/gridT),cy=Math.trunc(wy/gridT),floor=P.floorAt(gridData,cx,cy);
    let flags=0;
    if(floor===null){flags|=CONFLICT.Void;reasons.push('VOID_OR_OUTSIDE_CELL');}
    else{
      if(((floor>>>0)&FLOOR_SEMANTIC_MASK)===0){flags|=CONFLICT.Void;reasons.push('VOID_CELL');}
      if(((floor>>>0)&floorFlag)===0){flags|=CONFLICT.FloorType;reasons.push('FLOOR_TYPE_MISMATCH');}
    }
    const cellHits=[];
    for(const e of occupancy){
      const ox=wx-int(e.object.x??e.object.X,'OBJ_X'),oy=wy-int(e.object.y??e.object.Y,'OBJ_Y');
      if(ox<0||oy<0||ox>=e.rect.w||oy>=e.rect.h)continue;
      const existingLayer=P.layerAt(e.geometry,e.orientation,ox,oy,gridT);
      if(existingLayer===null)continue;
      if(!P.layersCollide(layer,existingLayer))continue;
      anyObjectCollision=true;flags|=CONFLICT.GridObjects;
      const key=String(e.object.editorId??e.object.ID??`${e.object.itemId??e.object.ItemID}:${e.rect.x}:${e.rect.y}`);
      let cr=clearCache.get(key);
      if(!cr){
        cr=clearabilityResolver?normalizeClearabilityResult(clearabilityResolver({existingObject:e.object,candidate,existingGeometry:e.geometry,candidateGeometry:g,cell:{x:wx,y:wy}})):{status:CLEARABILITY.UNKNOWN};
        clearCache.set(key,cr);
      }
      if(cr.status===CLEARABILITY.CLEARABLE){flags|=CONFLICT.Clearable;}
      else if(cr.status===CLEARABILITY.NOT_CLEARABLE){anyNonClearable=true;}
      else clearabilityUnknown=true;
      const hit=Object.freeze({x:wx,y:wy,editorId:e.object.editorId??null,itemId:Number(e.object.itemId??e.object.ItemID),candidateLayer:Number(layer)>>>0,existingLayer:Number(existingLayer)>>>0,clearability:cr.status,evidence:cr.evidence??null});
      conflicts.push(hit);cellHits.push(hit);
    }
    cells.push(Object.freeze({x:wx,y:wy,coarseX:cx,coarseY:cy,floorType:floor===null?null:Number(floor)>>>0,requiredFloorType:floorFlag,conflictFlags:flags,hits:Object.freeze(cellHits)}));
    aggregate|=flags;
  }
  // Native VerifyConflicts clears aggregate Clearable when any object-conflict cell is not clearable.
  if(anyNonClearable)aggregate&=~CONFLICT.Clearable;
  if(anyObjectCollision){
    if(clearabilityUnknown)reasons.push('GRID_OBJECT_CLEARABILITY_UNVERIFIED');
    else if((aggregate&CONFLICT.Clearable)!==0&&!anyNonClearable)reasons.push('GRID_OBJECT_COLLISION_CLEARABLE');
    else reasons.push('GRID_OBJECT_COLLISION_NON_CLEARABLE');
  }
  const definitiveInvalid=(aggregate&(CONFLICT.Void|CONFLICT.FloorType))!==0||anyNonClearable;
  const overlapState=anyObjectCollision?Object.freeze({status:'UNVERIFIED',authorized:false,reason:'PRESERVE_OVERLAP_PERSISTENCE_NOT_PROVEN_FOR_OBJECT_CLASS'}):Object.freeze({status:'NOT_APPLICABLE',authorized:false});
  if(definitiveInvalid)return baseResult(NATIVE_CLASS.INVALID,reasons,{nativeConflictFlags:aggregate,nativeConflictFlagsResolved:!clearabilityUnknown,nativeWithoutClearingAccepted:false,nativeWithClearingAccepted:false,cells,conflicts,footprint:size,clearabilityResolved:!clearabilityUnknown,wandPreserveOverlap:overlapState});
  if(anyObjectCollision&&clearabilityUnknown)return baseResult(NATIVE_CLASS.UNKNOWN,reasons,{nativeConflictFlags:aggregate,nativeConflictFlagsResolved:false,nativeWithoutClearingAccepted:false,nativeWithClearingAccepted:null,cells,conflicts,footprint:size,clearabilityResolved:false,wandPreserveOverlap:overlapState});
  if(anyObjectCollision){
    const nativeWithClearingAccepted=aggregate=== (CONFLICT.GridObjects|CONFLICT.Clearable);
    if(nativeWithClearingAccepted)return baseResult(NATIVE_CLASS.VALID_REPLACES_OR_REMOVES_EXISTING,reasons,{nativeConflictFlags:aggregate,nativeConflictFlagsResolved:true,nativeWithoutClearingAccepted:false,nativeWithClearingAccepted:true,cells,conflicts,footprint:size,clearabilityResolved:true,wandPreserveOverlap:overlapState});
    return baseResult(NATIVE_CLASS.INVALID,reasons,{nativeConflictFlags:aggregate,nativeConflictFlagsResolved:true,nativeWithoutClearingAccepted:false,nativeWithClearingAccepted:false,cells,conflicts,footprint:size,clearabilityResolved:true,wandPreserveOverlap:overlapState});
  }
  return baseResult(NATIVE_CLASS.VALID_CLEAR,reasons,{nativeConflictFlags:aggregate,nativeConflictFlagsResolved:true,nativeWithoutClearingAccepted:true,nativeWithClearingAccepted:true,cells,conflicts,footprint:size,clearabilityResolved:true});
}
return Object.freeze({
  revision:'V125_NATIVE_PLACEMENT_LEGALITY_STRUCTURED_1',
  schema:'ddv.native-placement-legality@1',CONFLICT,NATIVE_CLASS,CLEARABILITY,FLOOR_SEMANTIC_MASK,
  classifyOrdinaryCardinalNativePlacement,
  persistentWriteAuthorized:false
});
});
