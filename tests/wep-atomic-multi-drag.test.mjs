import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorSession } from '../src/lib/wep/editor-runtime.ts';
const obj=(id,x,y,patch={})=>({
 editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
 footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
 editability:'editable',metadata:{displayName:id,reasons:[]},...patch
});
const doc=(objects)=>({
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'test-grid'},
 metadata:{},networks:{roads:null,fences:null},capabilities:{},objects
});
const area={x:0,y:0,w:16,h:12};
const fixtures=()=>[obj('chair',2,2),obj('lamp',6,2),obj('rock',4,2,{layer:'static',editability:'readonly'}),obj('protected',10,2,{editability:'readonly'})];
test('existing one MOVE command atomically moves two furniture and creates ONE undo/redo entry',()=>{
 const session=createEditorSession(doc(fixtures()));
 session.setSelection(['chair','lamp']);
 const before=JSON.stringify(session.getDocument());
 const preview=session.previewStrictMove(null,1,0,area);
 assert.equal(preview.ok,true);
 assert.equal(JSON.stringify(session.getDocument()),before,'preview must not edit');
 assert.deepEqual(session.getHistoryState(),{undoDepth:0,redoDepth:0,lastKind:null});
 const moved=session.move(null,1,0,{strict:true,areaBounds:area});
 assert.equal(moved.applied,true);
 assert.equal(moved.draftBlocked,false);
 assert.equal(session.getHistoryState().undoDepth,1);
 assert.deepEqual(session.getDocument().objects.filter(o=>o.layer==='furniture'&&o.editability==='editable').map(o=>o.x),[3,7]);
 session.undo();
 assert.equal(JSON.stringify(session.getDocument()),before);
 session.redo();
 assert.deepEqual(session.getDocument().objects.filter(o=>o.layer==='furniture'&&o.editability==='editable').map(o=>o.x),[3,7]);
 assert.equal(session.getHistoryState().undoDepth,1);
});
test('footprint collision rejects whole group, keeps selection, history, and unrelated records immutable',()=>{
 const session=createEditorSession(doc(fixtures()));
 session.setSelection(['chair','lamp']);
 const before=JSON.stringify(session.exportRecoverySnapshot());
 const preview=session.previewStrictMove(null,2,0,area);
 assert.equal(preview.ok,false);
 assert.equal(preview.code,'WEP_MULTI_DRAG_COLLISION');
 const moved=session.move(null,2,0,{strict:true,areaBounds:area});
 assert.equal(moved.applied,false);
 assert.equal(moved.validation.ok,false);
 assert.equal(JSON.stringify(session.exportRecoverySnapshot()),before);
});
test('colliding with protected/UNKNOWN is blocked, even if unselected',()=>{
 const session=createEditorSession(doc(fixtures()));
 session.setSelection(['chair','lamp']);
 assert.equal(session.previewStrictMove(null,4,0,area).ok,false);
});
test('grid edges, zero delta, noninteger delta and unsupported layers fail closed',()=>{
 const session=createEditorSession(doc(fixtures()));
 session.setSelection(['chair','lamp']);
 assert.equal(session.previewStrictMove(null,-4,0,area).code,'WEP_MULTI_DRAG_OUT_OF_AREA_BOUNDS');
 assert.equal(session.previewStrictMove(null,0,0,area).code,'WEP_MULTI_DRAG_ZERO_DELTA');
 assert.throws(()=>session.previewStrictMove(null,0.2,0,area),/WEP_MOVE_DX_INVALID/);
 session.setSelection(['chair','rock']);
 assert.throws(()=>session.previewStrictMove(null,1,0,area),/WEP_OBJECT_NOT_EDITABLE/);
});
test('SubGrid/other Grid and dangerous attached state reject without history',()=>{
 const list=fixtures();list[0].metadata.gridId=99;
 let s=createEditorSession(doc(list));s.setSelection(['chair','lamp']);
 assert.equal(s.previewStrictMove(null,1,0,area).code,'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID');
 list[0].metadata={reasons:[],subGridId:4};
 s=createEditorSession(doc(list));s.setSelection(['chair','lamp']);
 assert.equal(s.previewStrictMove(null,1,0,area).code,'WEP_MULTI_DRAG_SUBGRID_UNPROVEN');
 list[0].metadata={reasons:['PROGRESSION_OWNERSHIP_UNKNOWN']};
 s=createEditorSession(doc(list));s.setSelection(['chair','lamp']);
 assert.equal(s.previewStrictMove(null,1,0,area).code,'WEP_MULTI_DRAG_OBJECT_UNSUPPORTED_OR_PROTECTED');
 list[0].metadata={reasons:[],storageCapability:{status:'SUPPORTED_NONEMPTY'}};
 s=createEditorSession(doc(list));s.setSelection(['chair','lamp']);
 assert.equal(s.previewStrictMove(null,1,0,area).code,'WEP_MULTI_DRAG_OBJECT_UNSUPPORTED_OR_PROTECTED');
});
test('strict collision/validation overrides historical allowInvalidDraft behavior',()=>{
 const rejecting=()=>({ok:false,issues:[{severity:'BLOCK',code:'NATIVE_MOVE_BLOCKED'}]});
 const session=createEditorSession(doc(fixtures()),{validator:rejecting,allowInvalidDraft:true});
 session.setSelection(['chair','lamp']);
 const before=JSON.stringify(session.getDocument());
 assert.equal(session.previewStrictMove(null,1,0,area).code,'NATIVE_MOVE_BLOCKED');
 const result=session.move(null,1,0,{strict:true,areaBounds:area});
 assert.equal(result.applied,false);
 assert.equal(JSON.stringify(session.getDocument()),before);
 assert.equal(session.getHistoryState().undoDepth,0);
});
test('eight-locale drag status copy is complete',async()=>{
 const {WORLD_EDITOR_MARQUEE_LOCALES,worldEditorMarqueeCopy}=await import('../src/lib/wep/world-editor-marquee-copy.js');
 assert.equal(WORLD_EDITOR_MARQUEE_LOCALES.length,8);
 for(const locale of WORLD_EDITOR_MARQUEE_LOCALES){
  const msg=worldEditorMarqueeCopy(locale);
  for(const key of ['moveHint','movePreview','moveRejected','moveCancelled','moveApplied'])
   assert.ok(msg[key]?.length>3,locale+':'+key);
  for(const placeholder of ['{count}','{dx}','{dy}'])
   assert.ok(msg.movePreview.includes(placeholder),locale+':'+placeholder);
 }
});
