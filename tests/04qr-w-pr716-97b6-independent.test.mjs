// 04 QR-W independent, NEW_ONLY WEP PR716 frozen 97b6; no real P1G or Native Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createEditorSession} from '../src/lib/wep/editor-runtime.ts';
import {buildSpatialScene} from '../src/lib/wep/spatial-scene.ts';

const SOURCE='97b6b5b2d3e2a428daa7e376ab48b2f8c016222b';
const PARENT='7ca7369bc3cd9e12e4cbbe7a7815789e14432e25';
const ownerBlobs=new Map([
 ['.github/workflows/wep-multi-move-ancestry-negatives-20261106.yml','95f5511676085f6deef912b5e024faa81e9f551f'],
 ['scripts/wep-multi-move-ancestry-negatives-browser.mjs','4eabb4cb0de658c51d519c080ef28c2842807499'],
 ['tests/wep-multi-move-ancestry-negatives.test.mjs','84fda4b3bfdd56a03358fea609b2e1f4c4ec4353']
]);
const qaFiles=[
 '.github/workflows/04qr-w-pr716-97b6-independent.yml',
 'scripts/04qr-w-pr716-97b6-chrome.mjs',
 'tests/04qr-w-pr716-97b6-independent.test.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();

const furniture=(id,x,y)=>({
 editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
 footprint:[{x:0,y:0}],source:{rootGridId:10},portableState:null,
 dependencyIds:[],editability:'editable',
 metadata:{displayName:id,rootGridId:10,reasons:[]}
});
const makeDoc=(mutate)=>{
 const valid=furniture('Valid',1,2);
 const invalid=furniture('Untrusted',8,3);
 mutate(invalid);
 return {
  schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'synthetic',gameVersion:'1.25.0',rootGridId:10,areaKey:'QR716'},
  capabilities:{},metadata:{},networks:{roads:null,fences:null},
  objects:[valid,invalid,{...furniture('Background',12,5),layer:'static',editability:'readonly'}]
 };
};

test('Q716-01 original three Source files are pinned, production runtime unchanged, exactly three QA-only files',()=>{
 assert.equal(git('rev-parse',SOURCE),SOURCE);
 assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
 assert.deepEqual(diff(PARENT,SOURCE),[...ownerBlobs.keys()].sort());
 for(const [p,blob] of ownerBlobs){
  assert.equal(git('rev-parse',SOURCE+':'+p),blob,p);
  assert.equal(git('hash-object',p),blob,p);
 }
 assert.equal(git('rev-parse',SOURCE+':src/lib/wep/editor-runtime.ts'),
              git('rev-parse',PARENT+':src/lib/wep/editor-runtime.ts'));
 assert.equal(git('rev-parse',SOURCE+':src/lib/wep/spatial-scene.ts'),
              git('rev-parse',PARENT+':src/lib/wep/spatial-scene.ts'));
 assert.deepEqual(diff(SOURCE,'HEAD'),qaFiles);
});

const variants=[
 {name:'source conflicting root after valid first',type:'root',patch:o=>{o.source.rootGridId=11;}},
 {name:'metadata conflicting root after valid first',type:'root',patch:o=>{o.metadata.rootGridId=11;}},
 {name:'source parent even when same root',type:'parent',patch:o=>{o.source.parentGridId=10;}},
 {name:'metadata parent even when same root',type:'parent',patch:o=>{o.metadata.parentGridId=10;}},
 {name:'source nested subGridDataPath',type:'path',patch:o=>{o.source.subGridDataPath='World/Villages[0]/Areas[2]/SubGrid[8]';}},
 {name:'metadata nested subGridDataPath',type:'path',patch:o=>{o.metadata.subGridDataPath='World/Villages[0]/Areas[2]/SubGrid[8]';}}
];
const bounds={x:0,y:0,w:16,h:12};
for(const v of variants){
 test('Q716 independent reject '+v.name+' with untrusted selected LAST and atomic snapshot',()=>{
  const doc=makeDoc(v.patch);
  const scene=buildSpatialScene(doc);
  assert.deepEqual(scene.objects.map(o=>o.editorId),['Valid','Background']);
  assert.deepEqual(scene.unresolved.map(o=>o.editorId),['Untrusted']);
  assert.equal(scene.persistentWriteAuthorized,false);
  const session=createEditorSession(doc,{allowInvalidDraft:true});
  assert.deepEqual(session.setSelection(['Valid','Untrusted']),['Valid','Untrusted']);
  const snapshot=JSON.stringify(session.exportRecoverySnapshot());
  const docBefore=JSON.stringify(session.getDocument());
  const historyBefore=JSON.stringify(session.getHistoryState());
  const expected=v.type==='root'?'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID':'WEP_MULTI_DRAG_SUBGRID_UNPROVEN';

  // Opposite directions and reverse order: no picking only the good object.
  for(const [selection,dx,dy] of [[['Valid','Untrusted'],2,1],[['Untrusted','Valid'],-1,2]]){
   const prev=session.previewStrictMove(selection,dx,dy,bounds);
   assert.equal(prev.ok,false,v.name);
   assert.equal(prev.code,expected,v.name);
   assert.equal(prev.validation.ok,false);
   assert.equal(JSON.stringify(session.exportRecoverySnapshot()),snapshot,'preview must be pure');
   const result=session.move(selection,dx,dy,{strict:true,areaBounds:bounds});
   assert.equal(result.applied,false,'whole group rejected');
   assert.equal(result.draftBlocked,true,'allowInvalidDraft does not override strict edit');
   assert.equal(result.validation.issues[0].code,expected);
   assert.equal(JSON.stringify(session.getDocument()),docBefore,'all objects including unselected unchanged');
   assert.equal(JSON.stringify(session.getHistoryState()),historyBefore,'Undo/Redo/history unchanged');
   assert.equal(JSON.stringify(session.exportRecoverySnapshot()),snapshot,'selection/recovery immutable');
  }
  assert.deepEqual(session.getHistoryState(),{undoDepth:0,redoDepth:0,lastKind:null});
  assert.deepEqual(session.getDocument().objects.map(o=>[o.editorId,o.x,o.y]),
   [['Valid',1,2],['Untrusted',8,3],['Background',12,5]]);
 });
}
