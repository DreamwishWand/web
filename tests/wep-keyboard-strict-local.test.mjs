import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEditorSession } from '../src/lib/wep/editor-runtime.ts';

const route = readFileSync(new URL('../src/routes/editor/world/+page.svelte', import.meta.url), 'utf8');
const obj = (editorId,x,extra={}) => ({
  editorId,itemId:40000001,layer:'furniture',x,y:2,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
  editability:'editable',metadata:{displayName:editorId,reasons:[],...extra}
});
const area={x:0,y:0,w:16,h:12};
function sessionWith(blocked=false) {
  const doc={
    schema:'dreamwish-wand-wep-editor-document',version:1,
    target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'keyboard-group'},
    networks:{roads:null,fences:null},roomFinish:null,capabilities:{},
    metadata:{},objects:[
      obj('chair',2),obj('lamp',6),
      ...(blocked?[{...obj('road',3),layer:'road',editability:'readonly'}]:[])
    ]
  };
  const s=createEditorSession(doc,{allowInvalidDraft:true});
  s.setSelection(['chair','lamp']);
  return s;
}
test('keyboard and button group-move both use accepted previewStrictMove and strict MOVE, never legacy loose multi-selection',()=>{
 const body=route.slice(route.indexOf('  function runMutation('),route.indexOf('  function undo()'));
 assert.match(body,/if \(delta && selection\.length >= 2\)/);
 assert.match(body,/session\.previewStrictMove\(\s*ids, delta\.dx, delta\.dy, areaBounds/);
 assert.match(body,/session\.move\(ids, delta\.dx, delta\.dy, \{\s*strict: true,/);
 assert.match(body,/else if \(delta\) \{\s*result = session\.move\(null, delta\.dx, delta\.dy\)/);
 assert.match(body,/WEP_MULTI_DRAG_SELECTION_CHANGED/);
 assert.ok(!body.includes("session.move(null, 0, -1)"),'no loose multi-move shortcut');
});
test('strict preview and keyboard/button-authorized commit move whole group once with one Undo/Redo',()=>{
 const s=sessionWith();
 const before=s.exportRecoverySnapshot();
 assert.equal(s.previewStrictMove(null,1,0,area).ok,true);
 assert.deepEqual(s.exportRecoverySnapshot(),before);
 const moved=s.move(null,1,0,{strict:true,areaBounds:area});
 assert.equal(moved.applied,true);
 assert.equal(s.getHistoryState().undoDepth,1);
 assert.deepEqual(s.getDocument().objects.map(x=>x.x),[3,7]);
 s.undo();
 assert.deepEqual(s.getDocument(),before.document);
 assert.equal(s.getHistoryState().undoDepth,0);
 s.redo();
 assert.deepEqual(s.getDocument().objects.map(x=>x.x),[3,7]);
 assert.equal(s.getHistoryState().undoDepth,1);
});
test('strict blocked group step preserves Document, selection and REDO branch in all-invalid fixture',()=>{
 const s=sessionWith(true);
 // Existing redo branch: a rejected keyboard step must not destroy it.
 s.setSelection(['chair']);
 assert.equal(s.move(['chair'],0,1).applied,true);
 s.undo();
 s.setSelection(['chair','lamp']);
 const before=s.exportRecoverySnapshot();
 const invalid=s.previewStrictMove(null,1,0,area);
 assert.equal(invalid.ok,false);
 assert.equal(invalid.code,'WEP_MULTI_DRAG_COLLISION');
 assert.deepEqual(s.exportRecoverySnapshot(),before);
 const result=s.move(null,1,0,{strict:true,areaBounds:area});
 assert.equal(result.applied,false);
 assert.deepEqual(s.exportRecoverySnapshot(),before);
 assert.equal(s.getHistoryState().redoDepth,1);
});
test('strict group keyboard step rejects selected unknown with no document mutation',()=>{
 const s=sessionWith();
 s.setSelection(['chair']);
 const snap=s.exportRecoverySnapshot();
 const invalid=s.previewStrictMove(null,-3,0,area);
 assert.equal(invalid.ok,false);
 assert.equal(invalid.code,'WEP_MULTI_DRAG_OUT_OF_AREA_BOUNDS');
 assert.deepEqual(s.exportRecoverySnapshot(),snap);
});
