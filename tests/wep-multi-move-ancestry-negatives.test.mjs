import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorSession } from '../src/lib/wep/editor-runtime.ts';

// NEW-ONLY ancestry denial tests. No raw P1G, user data, Native Writer, or
// repetition of the accepted PR307 21/21 pointer/zoom regression.
const bounds={x:0,y:0,w:16,h:12};
const furniture=(id,x,y)=>({
  editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
  footprint:[{x:0,y:0}],source:{rootGridId:10},portableState:null,
  dependencyIds:[],editability:'editable',
  metadata:{displayName:id,reasons:[],rootGridId:10}
});
const documentFor=(patch)=>({
  schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{gameVersion:'1.25.0',platform:'synthetic',rootGridId:10,areaKey:'ancestry-negative-only'},
  capabilities:{},metadata:{},networks:{roads:null,fences:null},
  objects:[
    {...furniture('Chair',2,2),...patch},
    furniture('Lamp',6,2),
    {...furniture('Unselected',11,3),layer:'static',editability:'readonly'}
  ]
});
const cases=[
  {
    field:'rootGridId',
    mutated:()=>({metadata:{displayName:'Chair',reasons:[],rootGridId:11}}),
    code:'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID'
  },
  {
    field:'parentGridId',
    mutated:()=>({source:{rootGridId:10,parentGridId:10}}),
    code:'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'
  },
  {
    field:'subGridDataPath',
    mutated:()=>({metadata:{
      displayName:'Chair',reasons:[],rootGridId:10,
      subGridDataPath:'World/Villages[0]/Areas[7]/SubGrid[20]'
    }}),
    code:'WEP_MULTI_DRAG_SUBGRID_UNPROVEN'
  }
];

for (const {field,mutated,code} of cases) {
  test('strict group MOVE rejects mixed '+field+' provenance without mutation/history',()=>{
    const session=createEditorSession(documentFor(mutated()),{allowInvalidDraft:true});
    session.setSelection(['Chair','Lamp']);
    const before=JSON.stringify(session.exportRecoverySnapshot());
    const beforeDocument=JSON.stringify(session.getDocument());
    const beforeHistory=session.getHistoryState();
    assert.deepEqual(session.getSelection(),['Chair','Lamp']);
    const preview=session.previewStrictMove(['Chair','Lamp'],1,0,bounds);
    assert.equal(preview.ok,false,field);
    assert.equal(preview.code,code,field);
    assert.equal(preview.validation.ok,false);
    assert.equal(JSON.stringify(session.exportRecoverySnapshot()),before,'preflight must not mutate');
    const result=session.move(['Chair','Lamp'],1,0,{strict:true,areaBounds:bounds});
    assert.equal(result.applied,false,'reject the entire selected furniture set');
    assert.equal(result.draftBlocked,true,'strict failure blocks even allowInvalidDraft');
    assert.equal(result.validation.issues[0].code,code);
    assert.equal(JSON.stringify(session.getDocument()),beforeDocument,'no selected or unrelated mutation');
    assert.deepEqual(session.getHistoryState(),beforeHistory,'no Undo or Redo entry');
    assert.deepEqual(session.getSelection(),['Chair','Lamp'],'selection retained');
    assert.equal(JSON.stringify(session.exportRecoverySnapshot()),before,'no recovery/history drift');
    assert.deepEqual(session.getDocument().objects.map(o=>[o.editorId,o.x,o.y]),[
      ['Chair',2,2],['Lamp',6,2],['Unselected',11,3]
    ]);
  });
}
