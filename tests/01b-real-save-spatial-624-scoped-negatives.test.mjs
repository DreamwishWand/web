import test from 'node:test';
import assert from 'node:assert/strict';
import { assert624ProjectedObjectsMatchSave } from '../src/lib/wep/real-save-spatial-source.ts';

const bid = '52BD625D9B4E0053';
const context = {sourceSha256:'a'.repeat(64), sourceRevision:'epoch:1',
  platform:'Nintendo Switch', gameVersion:'1.25.0', schema:624, bid};
const rawObject = (id,sub=null) => ({ID:id,ItemID:40000001,X:2,Y:3,
  Orientation:'GridOrientation_Up',State:sub?{SubGrid:{GridID:sub,DesignID:null}}:null});
const grid = (id,objects) => ({ID:id,GridDataPath:'World/A',TessellationFactor:2,Objects:objects});
const address = (gridId,gridObjectId) => ({gridId,gridObjectId,objectMapKey:String(gridObjectId)});
const projected = (gridId,id,relation,parentAddress=null) => ({
  editorId:`g${gridId}:o${id}`,itemId:40000001,x:2,y:3,orientation:0,
  source:{...address(gridId,id),relation,parentAddress}
});
const profile = (rootObjects,children) => ({
  GameInfo:{Version:624},World:{GridCollection:{
    Grids:{'42':grid(42,rootObjects),...children},DiffGrids:{}},Villages:[]}
});
const doc = (objects,subGridHierarchy) => ({
  schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,
    contractBuildIdentity:bid,persistentWriteAuthorized:false,rootGridId:42,gridDataPath:'World/A'},
  metadata:{directRootProjection:{evidenceStatus:'CONFIRMED'},subGridHierarchy},objects
});
const child = (gridId,parentAddress,objects=[],children=[]) =>
  ({gridId,parentAddress,gridDataPath:'World/A',objects,children});

test('624 source binding rejects nested child linked to a different root, not its immediate parent',()=>{
  const p=profile({'7':rawObject(7,43),'8':rawObject(8,44)},{
    '43':grid(43,{'9':rawObject(9)}),'44':grid(44,{'10':rawObject(10)})});
  const wrong=doc([projected(42,7,'ROOT'),projected(42,8,'ROOT')],[
    child(43,address(42,7),[projected(43,9,'SUBGRID_CHILD',address(42,7))],[
      child(44,address(42,8),[projected(44,10,'SUBGRID_CHILD',address(42,8))])
    ])
  ]);
  assert.throws(()=>assert624ProjectedObjectsMatchSave(p,wrong,context),
    /SPATIAL_624_SUBGRID_IMMEDIATE_PARENT_GRID_MISMATCH/);
});
test('624 source binding rejects missing projected child objects even if root is complete',()=>{
  const p=profile({'7':rawObject(7,43)},{'43':grid(43,{'9':rawObject(9)})});
  const wrong=doc([projected(42,7,'ROOT')],[child(43,address(42,7),[])]);
  assert.throws(()=>assert624ProjectedObjectsMatchSave(p,wrong,context),
    /SPATIAL_624_CHILD_SOURCE_OBJECT_SET_INCOMPLETE/);
});
test('624 source binding rejects missing SubGrid hierarchy when raw root references child',()=>{
  const p=profile({'7':rawObject(7,43)},{'43':grid(43,{'9':rawObject(9)})});
  const wrong=doc([projected(42,7,'ROOT')],[]);
  assert.throws(()=>assert624ProjectedObjectsMatchSave(p,wrong,context),
    /SPATIAL_624_SUBGRID_HIERARCHY_INCOMPLETE/);
});
test('624 source binding rejects duplicate child Grid identity across branches',()=>{
  const p=profile({'7':rawObject(7,43),'8':rawObject(8,44)},{
    '43':grid(43,{'9':rawObject(9,45)}),
    '44':grid(44,{'10':rawObject(10,45)}),
    '45':grid(45,{'11':rawObject(11)})});
  const left=child(45,address(43,9),[projected(45,11,'SUBGRID_CHILD',address(43,9))]);
  const right=child(45,address(44,10),[projected(45,11,'SUBGRID_CHILD',address(44,10))]);
  const wrong=doc([projected(42,7,'ROOT'),projected(42,8,'ROOT')],[
    child(43,address(42,7),[projected(43,9,'SUBGRID_CHILD',address(42,7))],[left]),
    child(44,address(42,8),[projected(44,10,'SUBGRID_CHILD',address(42,8))],[right])
  ]);
  assert.throws(()=>assert624ProjectedObjectsMatchSave(p,wrong,context),
    /SPATIAL_624_SUBGRID_BOUNDARY_INVALID/);
});
