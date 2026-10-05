import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEditorSession
} from '../src/lib/wep/editor-runtime.ts';
import {
  WORLD_EDITOR_HANDOFF_STORAGE_KEY,
  createExploreItemHandoff,
  createMoodboardHandoff,
  readWorldEditorHandoff,
  writeWorldEditorHandoff
} from '../src/lib/wep/world-editor-handoff.ts';
import {
  isWorldEditorEnvironmentSupported
} from '../src/lib/wep/world-editor-environment.ts';
import {
  listRecoveryRecords,
  recoveryCompatible,
  saveRecoveryRoute
} from '../src/lib/wep/world-editor-recovery.ts';

function storage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    dump() { return Object.fromEntries(map); }
  };
}

function doc() {
  return {
    schema:'dreamwish-wand-wep-editor-document',
    version:1,
    target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,rootGridId:10,gridDataPath:'GridData/Test.json'},
    capabilities:{},
    metadata:{},
    networks:{roads:null,fences:null},
    objects:[
      {editorId:'a',itemId:40000001,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0},{x:1,y:0}],source:{},portableState:null,dependencyIds:[],editability:'editable',metadata:{worldClass:'FurnitureItemData'}},
      {editorId:'b',itemId:40000002,layer:'furniture',x:5,y:2,orientation:0,footprint:[{x:0,y:0}],source:{},portableState:null,dependencyIds:[],editability:'editable',metadata:{worldClass:'FurnitureItemData'}},
      {editorId:'c',itemId:40000003,layer:'furniture',x:10,y:4,orientation:0,footprint:[{x:0,y:0}],source:{},portableState:null,dependencyIds:[],editability:'editable',metadata:{worldClass:'FurnitureItemData'}}
    ]
  };
}

test('DEC-UX-248/252/257 handoff carries identifiers only and safety flags stay false', () => {
  const s=storage();
  const item=createExploreItemHandoff(40000001,'2026-10-05T00:00:00.000Z');
  writeWorldEditorHandoff(s,item);
  assert.equal(readWorldEditorHandoff(s).itemId,40000001);
  const raw=JSON.parse(s.getItem(WORLD_EDITOR_HANDOFF_STORAGE_KEY));
  assert.deepEqual(Object.keys(raw).sort(),[
    'createdAt','directSourceReplacementAuthorized','intent','itemId',
    'persistentWriteAuthorized','productApplyAuthorized','schema','sourceSurface','version'
  ].sort());
  assert.equal(raw.persistentWriteAuthorized,false);
  assert.equal(raw.productApplyAuthorized,false);
  assert.equal(raw.directSourceReplacementAuthorized,false);

  const mood=createMoodboardHandoff('board-1',{referenceId:'ref-1',groupId:'group-1',createdAt:'2026-10-05T00:00:00.000Z'});
  writeWorldEditorHandoff(s,mood);
  assert.equal(readWorldEditorHandoff(s).boardId,'board-1');
  assert.equal(readWorldEditorHandoff(s).groupId,'group-1');
});

test('DEC-UX-59/60 environment gate is device-class based, not viewport based', () => {
  assert.equal(isWorldEditorEnvironmentSupported({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:10}),true);
  assert.equal(isWorldEditorEnvironmentSupported({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)',maxTouchPoints:5}),false);
  assert.equal(isWorldEditorEnvironmentSupported({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:5}),false);
  assert.equal(isWorldEditorEnvironmentSupported({userAgent:'Mozilla/5.0 (X11; Linux x86_64)',userAgentDataMobile:false}),true);
});

test('DEC-UX-234..240 alignment/distribution/precise position use atomic MOVE history', () => {
  const seen=[];
  const validator=(candidate,context)=>{seen.push(context);return {ok:true,issues:[],persistentWriteAuthorized:false};};
  const session=createEditorSession(doc(),{validator});
  session.setSelection(['a','b']);
  let result=session.align(['a','b'],'left');
  assert.equal(result.applied,true);
  let current=session.getDocument();
  assert.equal(current.objects.find(x=>x.editorId==='a').x,0);
  assert.equal(current.objects.find(x=>x.editorId==='b').x,0);
  assert.equal(seen.at(-1).kind,'MOVE');
  assert.equal(seen.at(-1).command,'ALIGN_LEFT');

  result=session.setPositions(['b'],{b:{x:5,y:2}},'PRECISE_POSITION');
  assert.equal(result.applied,true);
  assert.equal(session.getDocument().objects.find(x=>x.editorId==='b').x,5);
  assert.equal(seen.at(-1).kind,'MOVE');

  session.setPositions(['a'],{a:{x:0,y:0}},'RESET_A');
  session.setPositions(['b'],{b:{x:4,y:2}},'RESET_B');
  session.setPositions(['c'],{c:{x:11,y:4}},'RESET_C');
  result=session.distribute(['a','b','c'],'horizontal');
  assert.equal(result.applied,true);
  current=session.getDocument();
  assert.equal(current.objects.find(x=>x.editorId==='a').x,0);
  assert.equal(current.objects.find(x=>x.editorId==='b').x,6);
  assert.equal(current.objects.find(x=>x.editorId==='c').x,11);
  assert.equal(seen.at(-1).command,'DISTRIBUTE_HORIZONTAL');

  session.undo();
  assert.equal(session.getDocument().objects.find(x=>x.editorId==='b').x,4);
  session.redo();
  assert.equal(session.getDocument().objects.find(x=>x.editorId==='b').x,6);
});

test('DEC-UX-237 generic transforms fail closed for Road/Fence objects', () => {
  const input=doc();
  input.objects[0].layer='road';
  const session=createEditorSession(input);
  assert.throws(()=>session.align(['a','b'],'left'),/WEP_GENERIC_TRANSFORM_NETWORK_OBJECT_UNSUPPORTED/);
});

test('DEC-UX-217..223 recovery round-trips committed history without raw source bytes', () => {
  const session=createEditorSession(doc());
  session.setSelection(['a']);
  session.move(['a'],1,0);
  const snapshot=session.exportRecoverySnapshot();
  assert.equal(snapshot.persistentWriteAuthorized,false);
  assert.equal(snapshot.WORLD_PERSISTENT_WRITE_V125,false);
  assert.equal(snapshot.productApplyAuthorized,false);

  const restored=createEditorSession(snapshot.document,{recoverySnapshot:snapshot});
  assert.equal(restored.getHistoryState().undoDepth,1);
  assert.equal(restored.getDocument().objects.find(x=>x.editorId==='a').x,1);
  restored.undo();
  assert.equal(restored.getDocument().objects.find(x=>x.editorId==='a').x,0);

  const s=storage();
  const fingerprint='a'.repeat(64);
  saveRecoveryRoute(s,{
    sourceFingerprint:fingerprint,
    sourceName:'profile.json',
    target:{platform:'switch',gameVersion:'1.25.0',profileSchemaVersion:624},
    routeKey:'switch|1.25.0|10|GridData/Test.json',
    sessionSnapshot:snapshot,
    now:'2026-10-05T00:00:00.000Z'
  });
  const records=listRecoveryRecords(s);
  assert.equal(records.length,1);
  assert.equal(recoveryCompatible(records[0],fingerprint,{platform:'switch',gameVersion:'1.25.0',profileSchemaVersion:624}),true);
  assert.equal(JSON.stringify(s.dump()).includes('sourceBytes'),false);
  assert.equal(JSON.stringify(s.dump()).includes('worldSource'),false);
});

test('DEC-UX Stage 1 Review Changes reports actual baseline-to-draft semantics and keeps apply false', () => {
  const session=createEditorSession(doc(),{
    validator:()=>({ok:true,issues:[],persistentWriteAuthorized:false})
  });
  session.setSelection(['a','b']);
  session.align(['a','b'],'left');
  session.setPositions(['a'],{a:{x:2,y:3}},'PRECISE_POSITION');
  session.insertDraftGraph([
    {
      localId:'new-item',
      itemId:40000999,
      layer:'furniture',
      localX:0,
      localY:0,
      orientation:0,
      footprint:[{x:0,y:0}],
      portableState:null,
      dependencyLocalIds:[],
      metadata:{worldClass:'FurnitureItemData'}
    }
  ],{anchorX:8,anchorY:8,selectCreated:false,kind:'PASTE'});

  const review=session.reviewChanges();
  assert.equal(review.schema,'dreamwish-wand-wep-draft-review@1');
  assert.equal(review.persistentWriteAuthorized,false);
  assert.equal(review.WORLD_PERSISTENT_WRITE_V125,false);
  assert.equal(review.PERSISTENT_WRITE,false);
  assert.equal(review.productApplyAuthorized,false);
  assert.equal(review.directSourceReplacementAuthorized,false);
  assert.equal(review.writeReady,false);
  assert.ok(review.changes.some(change=>change.editorId==='a'&&change.kind==='MOVE'));
  assert.ok(review.changes.some(change=>change.editorId==='b'&&change.kind==='MOVE'));
  assert.ok(review.changes.some(change=>change.itemId===40000999&&change.kind==='ADD'));
  assert.ok(review.commands.some(command=>command.command==='ALIGN_LEFT'));
  assert.ok(review.commands.some(command=>command.command==='PRECISE_POSITION'));
});

test('Review Changes returns to empty when draft history is completely undone', () => {
  const session=createEditorSession(doc(),{
    validator:()=>({ok:true,issues:[],persistentWriteAuthorized:false})
  });
  session.move(['a'],1,0);
  assert.equal(session.reviewChanges().changes.length,1);
  session.undo();
  assert.equal(session.reviewChanges().changes.length,0);
});
