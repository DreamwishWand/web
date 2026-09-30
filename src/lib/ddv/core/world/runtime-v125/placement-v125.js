/* Dreamwish Wand DDV Core 01B — current v1.25 ordinary placement validator.
 * Native-equivalent subset only:
 *   - same root Grid
 *   - ordinary geometry-backed objects
 *   - cardinal orientation 0/4/8/12
 *   - non-wall GridArea (FloorType bit 0x800 clear)
 *   - ClearArea=false
 *   - automaticSpawning=false
 * No save/world mutation.
 * Evidence source: fresh DDV v1.25 Steam GameAssembly + dump.cs, cross-checked with
 * current Switch UpdateGridObjectTransform contract. Not ported from v1.24.13.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.DdvCoreWorldV125Placement=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
'use strict';
const CARDINAL=new Set([0,4,8,12]);
const WALL=0x800;
const EXCLUSIVE=0x1f;
const CLEAR=0x20;
const BLOCKING=0x40;
const VERDICT=Object.freeze({
 VALID:'VALID',
 INVALID_BOUNDS:'INVALID_BOUNDS',
 INVALID_STRIDE:'INVALID_STRIDE',
 INVALID_FLOOR:'INVALID_FLOOR',
 OCCUPIED:'OCCUPIED',
 UNSUPPORTED_ORIENTATION:'UNSUPPORTED_ORIENTATION',
 UNSUPPORTED_WALL_AREA:'UNSUPPORTED_WALL_AREA',
 UNSUPPORTED_POLICY:'UNSUPPORTED_POLICY',
 GEOMETRY_UNKNOWN:'GEOMETRY_UNKNOWN',
 GRID_DATA_INVALID:'GRID_DATA_INVALID',
 UNKNOWN_OCCUPANCY:'UNKNOWN_OCCUPANCY'
});
const assert=(c,m)=>{if(!c)throw Error(m);};
const int=(v,m)=>{const n=Number(v);assert(Number.isSafeInteger(n),m);return n;};
function readVarint(bytes,pos){let v=0,shift=0;for(;;){if(pos>=bytes.length)throw Error('V125_GRIDDATA_TRUNCATED');const b=bytes[pos++];v+=(b&0x7f)*(2**shift);if((b&0x80)===0)return [v,pos];shift+=7;if(shift>49)throw Error('V125_GRIDDATA_VARINT');}}
function decodeFields(input){const b=input instanceof Uint8Array?input:new Uint8Array(input),out=[];let p=0;while(p<b.length){let tag;[tag,p]=readVarint(b,p);const field=Math.floor(tag/8),wire=tag&7;let value;if(wire===0){[value,p]=readVarint(b,p);}else if(wire===2){let n;[n,p]=readVarint(b,p);if(p+n>b.length)throw Error('V125_GRIDDATA_TRUNCATED');value=b.slice(p,p+n);p+=n;}else if(wire===5){if(p+4>b.length)throw Error('V125_GRIDDATA_TRUNCATED');value=b.slice(p,p+4);p+=4;}else if(wire===1){if(p+8>b.length)throw Error('V125_GRIDDATA_TRUNCATED');value=b.slice(p,p+8);p+=8;}else throw Error(`V125_GRIDDATA_WIRE_${wire}`);out.push([field,wire,value]);}return out;}
function first(fields,field,wire){for(const x of fields)if(x[0]===field&&(wire===undefined||x[1]===wire))return x[2];return undefined;}
function fixed32List(bytes){if(bytes.length%4)throw Error('V125_GRIDDATA_FIXED32');const out=[];for(let i=0;i<bytes.length;i+=4)out.push((bytes[i]|bytes[i+1]<<8|bytes[i+2]<<16|bytes[i+3]<<24)>>>0);return out;}
function decodeGridDataV125(input){try{const f=decodeFields(input),sizeX=first(f,1,0),sizeY=first(f,2,0);assert(Number.isInteger(sizeX)&&sizeX>0&&Number.isInteger(sizeY)&&sizeY>0,'SIZE');const directBytes=first(f,3,2),indexBytes=first(f,4,2),compactBytes=first(f,5,2);const direct=directBytes?fixed32List(directBytes):[];const table=indexBytes?fixed32List(indexBytes):[];if(direct.length){assert(direct.length===sizeX*sizeY,'DIRECT_COUNT');return Object.freeze({sizeX,sizeY,encoding:'DIRECT_FIXED32',floorTypes:Object.freeze(direct),compactedFloorTypeIndex:Object.freeze([]),compactedFloorTypes:Object.freeze([])});}assert(table.length>0&&compactBytes,'COMPACT_MISSING');return Object.freeze({sizeX,sizeY,encoding:'COMPACT_MSB',floorTypes:Object.freeze([]),compactedFloorTypeIndex:Object.freeze(table),compactedFloorTypes:Object.freeze(Array.from(compactBytes))});}catch(e){throw Error(`V125_GRIDDATA_INVALID:${e.message}`);}}
function compactBits(count){if(count<=2)return 1;if(count<=4)return 2;return 4;}
function floorAt(gridData,x,y){x=int(x,'FLOOR_X');y=int(y,'FLOOR_Y');if(x<0||y<0||x>=gridData.sizeX||y>=gridData.sizeY)return null;const flat=gridData.sizeY*x+y;if(gridData.floorTypes?.length)return Number(gridData.floorTypes[flat])>>>0;const table=gridData.compactedFloorTypeIndex||[],bits=compactBits(table.length),bitIndex=flat*bits,byteIndex=Math.floor(bitIndex/8),inByte=bitIndex&7,shift=8-bits-inByte;if(shift<0)throw Error('V125_GRIDDATA_COMPACT_CROSS_BYTE');const b=gridData.compactedFloorTypes?.[byteIndex]??0,idx=(b>>shift)&((1<<bits)-1);return Number(table[idx]??0)>>>0;}
function layersCollide(a,b){a=Number(a)>>>0;b=Number(b)>>>0;return ((a&b&EXCLUSIVE)!==0)||(((a&BLOCKING)!==0)&&((b&CLEAR)!==0))||(((a&CLEAR)!==0)&&((b&BLOCKING)!==0));}
function orientationIndex(v){const n=Number(v);if(Number.isSafeInteger(n))return n;const names=['GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight','GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight','GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft','GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'];return names.indexOf(String(v));}
function transformedOffset(dx,dy,areaT,gridT){if(areaT===gridT)return [dx,dy];return [Math.trunc(dx/gridT)*areaT,Math.trunc(dy/gridT)*areaT];}
function cardinalSize(g,ori,gridT){const sx=int(g.sizeX,'GEOM_X'),sy=int(g.sizeY,'GEOM_Y'),areaT=int(g.areaTessellationFactor||1,'AREA_TESS');assert(areaT>0&&gridT>0,'TESS');let w,h;if(ori===0||ori===8){w=sx;h=sy;}else if(ori===4||ori===12){w=sy;h=sx;}else return null;return {w:Math.trunc(w*gridT/areaT),h:Math.trunc(h*gridT/areaT)};}
function cardinalLocalCell(g,ori,dx,dy,gridT){const areaT=int(g.areaTessellationFactor||1,'AREA_TESS');let x,y;[x,y]=transformedOffset(dx,dy,areaT,gridT);const sx=int(g.sizeX,'GEOM_X'),sy=int(g.sizeY,'GEOM_Y');let lx,ly;if(ori===0){lx=sx-1-x;ly=sy-1-y;}else if(ori===4){lx=y;ly=sy-1-x;}else if(ori===8){lx=x;ly=y;}else if(ori===12){lx=sx-1-y;ly=x;}else return null;if(lx<0||ly<0||lx>=sx||ly>=sy)return null;return {x:lx,y:ly,index:sy*lx+ly};}
function layerAt(g,ori,dx,dy,gridT){const p=cardinalLocalCell(g,ori,dx,dy,gridT);if(!p)return null;const expected=int(g.sizeX,'GEOM_X')*int(g.sizeY,'GEOM_Y');if(!Array.isArray(g.layers)||g.layers.length!==expected)throw Error('V125_GEOMETRY_LAYER_COUNT');return Number(g.layers[p.index])>>>0;}
function rectsOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function objectRect(o,g,gridT){const ori=orientationIndex(o.orientation??o.Orientation),s=cardinalSize(g,ori,gridT);if(!s)return null;return {x:int(o.x??o.X,'OBJ_X'),y:int(o.y??o.Y,'OBJ_Y'),w:s.w,h:s.h};}
function geometryGet(index,itemId){return index?.[itemId]??index?.[String(itemId)]??null;}
function validateOrdinaryCardinalPlacement({gridData,geometryIndex,objects,candidate,gridTessellationFactor=1,excludeEditorId=null,clearArea=false,automaticSpawning=false}){
 const reasons=[],conflicts=[];if(clearArea||automaticSpawning)return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.UNSUPPORTED_POLICY,reasons:[clearArea?'CLEAR_AREA_UNSUPPORTED':null,automaticSpawning?'AUTOMATIC_SPAWNING_UNSUPPORTED':null].filter(Boolean),conflicts};
 if(!gridData||!Number.isInteger(gridData.sizeX)||!Number.isInteger(gridData.sizeY))return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.GRID_DATA_INVALID,reasons:['GRID_DATA_REQUIRED'],conflicts};
 const g=geometryGet(geometryIndex,candidate.itemId??candidate.ItemID);if(!g)return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.GEOMETRY_UNKNOWN,reasons:['CANDIDATE_GEOMETRY_UNRESOLVED'],conflicts};
 const ori=orientationIndex(candidate.orientation??candidate.Orientation);if(!CARDINAL.has(ori))return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.UNSUPPORTED_ORIENTATION,reasons:['CARDINAL_ONLY_V0'],conflicts};
 const floorFlag=Number(g.acceptedFloorTypesFlag)>>>0;if((floorFlag&WALL)!==0)return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.UNSUPPORTED_WALL_AREA,reasons:['WALL_GRIDAREA_UNSUPPORTED_V0'],conflicts};
 const gridT=int(gridTessellationFactor,'GRID_TESS'),x=int(candidate.x??candidate.X,'X'),y=int(candidate.y??candidate.Y,'Y'),size=cardinalSize(g,ori,gridT);if(x<0||y<0||x+size.w>gridData.sizeX*gridT||y+size.h>gridData.sizeY*gridT)return {status:'INVALID',valid:false,verdict:VERDICT.INVALID_BOUNDS,reasons:['AREA_OUTSIDE_GRID'],conflicts,footprint:size};
 if(g.strideOverride!==null&&g.strideOverride!==undefined){const stride=int(g.strideOverride,'STRIDE')*gridT;if(stride>0&&(x%stride!==0||y%stride!==0))return {status:'INVALID',valid:false,verdict:VERDICT.INVALID_STRIDE,reasons:['STRIDE_OVERRIDE_MISMATCH'],conflicts,footprint:size};}
 const candidateRect={x,y,w:size.w,h:size.h};
 // Native GridCells can precisely query candidate-area objects. Offline v0 fails closed if an
 // unresolved/non-cardinal object's footprint could not be reconstructed at all.
 for(const o of objects||[]){if(excludeEditorId!==null&&String(o.editorId)===String(excludeEditorId))continue;const og=geometryGet(geometryIndex,o.itemId??o.ItemID);if(!og)return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.UNKNOWN_OCCUPANCY,reasons:[`OCCUPANCY_GEOMETRY_UNRESOLVED:${o.editorId??o.ID??'unknown'}`],conflicts,footprint:size};const oo=orientationIndex(o.orientation??o.Orientation),r=objectRect(o,og,gridT);if(!r)return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.UNKNOWN_OCCUPANCY,reasons:[`OCCUPANCY_NONCARDINAL:${o.editorId??o.ID??'unknown'}`],conflicts,footprint:size};if(!rectsOverlap(candidateRect,r))continue;}
 for(let dx=0;dx<size.w;dx++)for(let dy=0;dy<size.h;dy++){
   const layer=layerAt(g,ori,dx,dy,gridT);if(layer===null)return {status:'UNSUPPORTED',valid:false,verdict:VERDICT.GEOMETRY_UNKNOWN,reasons:['LOCAL_CELL_MAPPING_FAILED'],conflicts,footprint:size};
   if(layer===0)continue; // current native IsAreaValidFor skips floor/collision checks for zero-layer cells
   const wx=x+dx,wy=y+dy,cx=Math.trunc(wx/gridT),cy=Math.trunc(wy/gridT),floor=floorAt(gridData,cx,cy);
   if(floor===null||((floor>>>0)&floorFlag)===0)return {status:'INVALID',valid:false,verdict:VERDICT.INVALID_FLOOR,reasons:['FLOOR_TYPE_MISMATCH'],conflicts,footprint:size,cell:{x:wx,y:wy,coarseX:cx,coarseY:cy,floorType:floor,candidateFloorType:floorFlag}};
   for(const o of objects||[]){if(excludeEditorId!==null&&String(o.editorId)===String(excludeEditorId))continue;const og=geometryGet(geometryIndex,o.itemId??o.ItemID),oo=orientationIndex(o.orientation??o.Orientation);if(!og||!CARDINAL.has(oo))continue;const ox=wx-int(o.x??o.X,'OBJ_X'),oy=wy-int(o.y??o.Y,'OBJ_Y'),or=objectRect(o,og,gridT);if(ox<0||oy<0||ox>=or.w||oy>=or.h)continue;const existingLayer=layerAt(og,oo,ox,oy,gridT);if(existingLayer!==null&&layersCollide(layer,existingLayer)){const hit={x:wx,y:wy,candidateLayer:layer,existingLayer,editorId:o.editorId??null,itemId:Number(o.itemId??o.ItemID)};conflicts.push(hit);return {status:'INVALID',valid:false,verdict:VERDICT.OCCUPIED,reasons:['GRID_LAYER_CONFLICT'],conflicts,footprint:size};}}
 }
 return {status:'VALID',valid:true,verdict:VERDICT.VALID,reasons,conflicts,footprint:size};
}
function validateOrdinaryCardinalCandidateSet({gridData,geometryIndex,objects,candidateEditorIds,gridTessellationFactor=1,clearArea=false,automaticSpawning=false}){
 const ids=Array.from(new Set((candidateEditorIds||[]).map(String))),byId=new Map((objects||[]).map(o=>[String(o.editorId),o])),results=[];
 for(const id of ids){
   const candidate=byId.get(id);
   if(!candidate){results.push({editorId:id,result:{status:'UNSUPPORTED',valid:false,verdict:'OBJECT_MISSING',reasons:['CANDIDATE_OBJECT_MISSING'],conflicts:[]}});continue;}
   const result=validateOrdinaryCardinalPlacement({gridData,geometryIndex,objects,candidate,gridTessellationFactor,excludeEditorId:id,clearArea,automaticSpawning});
   results.push({editorId:id,result});
 }
 const invalid=results.find(x=>x.result.status==='INVALID'),unsupported=results.find(x=>x.result.status!=='VALID'&&x.result.status!=='INVALID');
 return {status:invalid?'INVALID':unsupported?'UNSUPPORTED':'VALID',valid:!invalid&&!unsupported,results};
}
function createDocumentPlacementValidator({gridDataIndex={},geometryIndex={}}={}){
  return function(before,after,changes){
    const issues=[],supported=[];
    for(const ch of changes||[]){
      if(ch.kinds?.some(k=>!['MOVE','ROTATE'].includes(k))){issues.push({severity:'BLOCK',code:'V125_PLACEMENT_OPERATION_UNSUPPORTED',editorId:ch.editorId});continue;}
      supported.push(ch);
    }
    if(!supported.length)return {status:issues.length?'UNSUPPORTED':'VALID',issues};
    const raw=gridDataIndex[after.target?.gridDataPath];
    if(!raw){for(const ch of supported)issues.push({severity:'BLOCK',code:'V125_GRIDDATA_NOT_BOUND',editorId:ch.editorId});return {status:'UNSUPPORTED',issues};}
    const gd=(raw instanceof Uint8Array||raw instanceof ArrayBuffer)?decodeGridDataV125(raw):raw;
    const group=validateOrdinaryCardinalCandidateSet({gridData:gd,geometryIndex,objects:after.objects||[],candidateEditorIds:supported.map(x=>x.editorId),gridTessellationFactor:Number(after.target?.tessellationFactor||1)});
    for(const x of group.results){if(x.result.status!=='VALID')issues.push({severity:'BLOCK',code:`V125_PLACEMENT_${x.result.verdict}`,editorId:x.editorId,detail:x.result});}
    return {status:issues.length?'UNSUPPORTED':'VALID',issues};
  };
}
return Object.freeze({revision:'V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2',VERDICT,CARDINAL,WALL,EXCLUSIVE,CLEAR,BLOCKING,decodeGridDataV125,floorAt,layersCollide,cardinalSize,cardinalLocalCell,layerAt,validateOrdinaryCardinalPlacement,validateOrdinaryCardinalCandidateSet,createDocumentPlacementValidator});
});
