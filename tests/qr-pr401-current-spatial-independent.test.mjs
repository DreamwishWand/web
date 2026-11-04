// Independent 04 QR NEW HEAD PR401 5bebc1fe... change-only 624 hierarchy
// and 626 read-only index provenance regression. No real P1G, no Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {read626SpatialReferences,inspect626SourceObjectAtRevision,assert624ProjectedObjectsMatchSave}
 from '../src/lib/wep/real-save-spatial-source.ts';
const h='f'.repeat(64);
const ctx626={platform:'Nintendo Switch',gameVersion:'1.25.3',schema:626,bid:'9A239D3DB569756D',sourceRevision:'test:rev',sourceSha256:h};
const ctx624={...ctx626,gameVersion:'1.25.0',schema:624,bid:'52BD625D9B4E0053'};
const address=(g,id)=>({gridId:g,gridObjectId:id,objectMapKey:String(id)});
const raw=(id,sub=null)=>({ID:id,ItemID:40000047,X:2,Y:3,Orientation:'GridOrientation_Up',
 State:sub?{SubGrid:{GridID:sub}}:null});
const grid=(id,objects)=>({ID:id,GridDataPath:'World/RealSource/'+id,TessellationFactor:1,Objects:objects});
test('new HEAD 624 nested child must use immediate Grid not a matching foreign root parent',()=>{
 const p={GameInfo:{Version:624},World:{GridCollection:{Grids:{
   '42':grid(42,{'7':raw(7,43),'8':raw(8,44)}),
   '43':grid(43,{'9':raw(9)}),'44':grid(44,{'10':raw(10)})
 },DiffGrids:{}}}};
 const obj=(g,id,rel,parent)=>({editorId:`g${g}:o${id}`,itemId:40000047,x:2,y:3,
  orientation:0,source:{...address(g,id),relation:rel,parentAddress:parent}});
 const pa=address(42,7),wrong=address(42,8);
 const d={schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,
   contractBuildIdentity:ctx624.bid,persistentWriteAuthorized:false,rootGridId:42,
   gridDataPath:'World/RealSource/42'},
  metadata:{directRootProjection:{evidenceStatus:'CONFIRMED'},subGridHierarchy:[{
   gridId:43,parentAddress:pa,gridDataPath:'World/RealSource/43',
   objects:[obj(43,9,'SUBGRID_CHILD',pa)],
   children:[{gridId:44,parentAddress:wrong,gridDataPath:'World/RealSource/44',
    objects:[obj(44,10,'SUBGRID_CHILD',wrong)],children:[]}]}]},
  objects:[obj(42,7,'ROOT',null),obj(42,8,'ROOT',null)]};
 assert.throws(()=>assert624ProjectedObjectsMatchSave(p,d,ctx624),
  /SPATIAL_624_SUBGRID_IMMEDIATE_PARENT_GRID_MISMATCH/);
 console.log('QR_401_LATEST_624_IMMEDIATE_PARENT_GRID_FAILCLOSED_PASS');
});
test('new HEAD 626 source Index cannot accept externally appended fake GridObject at same SHA/epoch',()=>{
 const p={GameInfo:{Version:626},World:{
  Villages:[{Areas:{'7':{GridIDs:[42]}}}],GridCollection:{
   Grids:{'42':grid(42,{'17':raw(17)})},DiffGrids:{}}}};
 const index=read626SpatialReferences(p,ctx626);
 assert.equal(index.status,'READ_ONLY_REFERENCE_INDEX');
 assert.equal(inspect626SourceObjectAtRevision(index,'g42:o17','test:rev',h).address.objectMapKey,'17');
 const injected={...index.objects[0],address:{...address(42,999),editorId:'g42:o999'},
  serializedX:99999,serializedY:99999};
 try{index.objects.push(injected);}catch(e){assert.ok(e instanceof TypeError);}
 assert.throws(()=>inspect626SourceObjectAtRevision(index,'g42:o999','test:rev',h),
  /SPATIAL_SOURCE_OBJECT_NOT_FOUND/,
  'mutable array cannot mint a new native Save GridObject ID');
 console.log('QR_401_LATEST_626_FORGED_OBJECT_INSPECTOR_DENIED_PASS');
});
