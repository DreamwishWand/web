import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  MOODBOARD_STORAGE_KEY
} from '../src/lib/moodboards/store.js';
import {
  verifyCurrentMoodboardItemPlacement,
  verifyCurrentMoodboardHandoffIdentity,
  verifyCurrentMoodboardEditorSession
} from '../src/lib/wep/world-editor-moodboard-placement-guard.mjs';
import {
  worldEditorStage1Copy,
  WORLD_EDITOR_STAGE1_LOCALES
} from '../src/lib/wep/world-editor-stage1-copy.js';

const stamp='2026-11-08T00:00:00.000Z';
const seed=()=>({
  schema:'wand.moodboards.local@1',version:2,updatedAt:stamp,
  boards:[{
    id:'board_a',title:'Board',createdAt:stamp,updatedAt:stamp,description:null,
    groups:[{id:'group_a',title:'Corner',order:0,collapsed:false}],
    references:[{
      id:'ref_a',type:'ITEM',entityId:'40000048',label:'Verified Chair',
      groupIds:['group_a'],createdAt:stamp,note:null,url:null
    }]
  }]
});
const storage=(document=seed())=>({
  raw:JSON.stringify(document),
  getItem(key){assert.equal(key,MOODBOARD_STORAGE_KEY);return this.raw;},
  setItem(){throw Error('read-only guard must never write Moodboard');}
});
const trusted=()=>new Map([[40000048,{itemId:40000048,label:'Verified Chair'}]]);
const pending=()=>({boardId:'board_a',referenceId:'ref_a',groupId:'group_a',itemId:40000048});
const deny=(patch,pattern)=> {
  const data=seed(),state=storage(data),input=pending();
  patch(data,input,state);
  if(state.raw===JSON.stringify(seed())) state.raw=JSON.stringify(data);
  assert.throws(
    ()=>verifyCurrentMoodboardItemPlacement(state,input,trusted()),
    pattern
  );
};
test('current verified Item and exact Board+Group allow only local Draft preflight; never write store',()=>{
  const state=storage(),before=state.raw;
  const result=verifyCurrentMoodboardItemPlacement(state,pending(),trusted());
  assert.equal(result.board.id,'board_a');
  assert.equal(result.reference.id,'ref_a');
  assert.equal(result.verifiedItem.itemId,40000048);
  assert.equal(result.persistentWriteAuthorized,false);
  assert.equal(state.raw,before);
});
test('Unsorted selection succeeds only while reference remains Unsorted',()=>{
  const data=seed();
  data.boards[0].references[0].groupIds=[];
  const state=storage(data);
  const unsorted={...pending(),groupId:null};
  assert.equal(verifyCurrentMoodboardItemPlacement(state,unsorted,trusted()).reference.id,'ref_a');
  data.boards[0].references[0].groupIds=['group_a'];
  state.raw=JSON.stringify(data);
  assert.throws(()=>verifyCurrentMoodboardItemPlacement(state,unsorted,trusted()),/GROUP_CHANGED/);
});
for(const [label,patch,pattern] of [
  ['deleted board',(d)=>d.boards.splice(0,1),/BOARD_MISSING/],
  ['deleted reference',(d)=>d.boards[0].references.splice(0,1),/ITEM_RETARGETED/],
  ['retargeted ItemID',(d)=>{d.boards[0].references[0].entityId='40000049';},/ITEM_RETARGETED/],
  ['retargeted type',(d)=>{d.boards[0].references[0].type='NOTE';},/ITEM_RETARGETED/],
  ['reference removed from group',(d)=>{d.boards[0].references[0].groupIds=[];},/GROUP_CHANGED/],
  ['deleted selected group',(d)=>d.boards[0].groups.splice(0,1),/GROUP_CHANGED/],
  ['wrong selected group',(_d,input)=>{input.groupId='other';},/GROUP_CHANGED/],
  ['forged reference id',(_d,input)=>{input.referenceId='forged';},/ITEM_RETARGETED/],
  ['forged ItemID',(_d,input)=>{input.itemId=40000049;},/ITEM_NOT_VERIFIED/],
  ['unknown document schema',(d)=>{d.schema='forged.moodboards@3';},/DOCUMENT_VERSION/],
  ['unknown document version',(d)=>{d.version=999;},/DOCUMENT_VERSION/],
  ['malformed JSON',(_d,_i,s)=>{s.raw='{INVALID';},/DOCUMENT_INVALID/],
  ['missing store',(_d,_i,s)=>{s.raw=null;},/DOCUMENT_MISSING/]
]) {
  test('fail closed on '+label+' with no Moodboard write',()=>{
    const d=seed(),input=pending(),state=storage(d);
    patch(d,input,state);
    if(state.raw!==null&&state.raw!=='{INVALID')state.raw=JSON.stringify(d);
    const before=state.raw;
    assert.throws(
      ()=>verifyCurrentMoodboardItemPlacement(state,input,trusted()),pattern
    );
    assert.equal(state.raw,before);
  });
}
test('malformed Item scope and denied local storage never authorize a draft',()=>{
  assert.throws(()=>verifyCurrentMoodboardItemPlacement(storage(),pending(),new Map()),/ITEM_NOT_VERIFIED/);
  assert.throws(()=>verifyCurrentMoodboardItemPlacement(storage(),pending(),new Map([[40000048,{itemId:40000048,label:''}]])),/ITEM_NOT_VERIFIED/);
  assert.throws(()=>verifyCurrentMoodboardItemPlacement({getItem(){throw Error('quota/offline')}},pending(),trusted()),/STORAGE_UNAVAILABLE/);
  assert.throws(()=>verifyCurrentMoodboardItemPlacement(null,pending(),trusted()),/STORAGE_UNAVAILABLE/);
});
test('live EditorSession and Area identity required; stale Session and target denied',()=>{
  const target={gameVersion:'1.25.0',platform:'synthetic',areaKey:'old-area',rootGridId:10};
  const session={getDocument(){return {target:{...target}};}};
  const displayed={target:{...target}};
  const pin={selectedSession:session,selectedTarget:JSON.stringify(target)};
  assert.equal(verifyCurrentMoodboardEditorSession(session,displayed,pin),true);
  const replacement={getDocument(){return {target:{...target}};}};
  assert.throws(()=>verifyCurrentMoodboardEditorSession(replacement,displayed,pin),/STALE_EDITOR_TARGET/);
  assert.throws(()=>verifyCurrentMoodboardEditorSession(session,{target:{...target,areaKey:'other-area'}},pin),/STALE_EDITOR_TARGET/);
  assert.throws(()=>verifyCurrentMoodboardEditorSession(session,{target:{...target,rootGridId:20}},pin),/STALE_EDITOR_TARGET/);
  assert.throws(()=>verifyCurrentMoodboardEditorSession(null,displayed,pin),/STALE_EDITOR_SESSION/);
  assert.equal(verifyCurrentMoodboardEditorSession(session,displayed),true,
    'handoff selected before a source was opened may use a subsequently verified live Session');
});
test('selection identity: changing only live handoff Ref/Group/timestamp while Board and old verified Item survive always denies',()=>{
  const selected={
    schema:'dreamwish-wand-world-editor-handoff@1',version:1,
    sourceSurface:'moodboard',intent:'MOODBOARD',boardId:'board_a',
    referenceId:'ref_a',groupId:'group_a',createdAt:stamp,
    persistentWriteAuthorized:false,productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  };
  const pending={referenceId:'ref_a',groupId:'group_a'};
  assert.equal(verifyCurrentMoodboardHandoffIdentity({...selected},selected,pending),true);
  for(const [label,change] of [
    ['NOTE ref same board',{referenceId:'ref_note'}],
    ['another ITEM ref same board',{referenceId:'ref_other_item'}],
    ['same ref different group',{groupId:null}],
    ['same ref original group but new selection timestamp',{createdAt:'2026-11-08T02:00:00.000Z'}],
    ['different board',{boardId:'board_b'}],
    ['different source',{sourceSurface:'explore',intent:'ITEM'}],
    ['tampered writer authorization',{productApplyAuthorized:true}]
  ]){
    assert.throws(
      ()=>verifyCurrentMoodboardHandoffIdentity({...selected,...change},selected,pending),
      /WEP_MOODBOARD_STALE_HANDOFF_IDENTITY/,label
    );
  }
  assert.throws(()=>verifyCurrentMoodboardHandoffIdentity(selected,selected,{referenceId:'ref_other_item',groupId:'group_a'}),/WEP_MOODBOARD_STALE_HANDOFF_IDENTITY/);
  assert.throws(()=>verifyCurrentMoodboardHandoffIdentity(selected,selected,{referenceId:'ref_a',groupId:null}),/WEP_MOODBOARD_STALE_HANDOFF_IDENTITY/);
  assert.throws(()=>verifyCurrentMoodboardHandoffIdentity(null,selected,pending),/WEP_MOODBOARD_STALE_HANDOFF_IDENTITY/);
});
test('World Editor checks the new store immediately before insert and Explore direct path is preserved',()=>{
  const panel=readFileSync(new URL('../src/lib/wep/WorldEditorStage1DecoratePanel.svelte',import.meta.url),'utf8');
  const start=panel.indexOf('function placePendingItem()');
  const end=panel.indexOf('async function preflightPendingPreset()',start);
  const body=panel.slice(start,end);
  assert.ok(start>0 && end>start);
  assert.ok(body.indexOf("handoff?.sourceSurface === 'moodboard'")>=0);
  assert.ok(body.indexOf('verifyCurrentMoodboardHandoffIdentity(')<
    body.indexOf('verifyCurrentMoodboardItemPlacement('),'live selection identity must be checked before cached ITEM read');
  assert.ok(body.indexOf('verifyCurrentMoodboardItemPlacement(')<
    body.indexOf('session.insertDraftGraph('),'store check must precede mutation');
  assert.ok(body.indexOf('verifyCurrentMoodboardEditorSession(')<
    body.indexOf('session.insertDraftGraph('),'session check must precede mutation');
  assert.match(body,/clearPending\(\);\s*board = null;\s*panelError = copy.staleReference;\s*return;/);
  assert.match(panel,/handoff\?\.sourceSurface === 'explore'/);
  assert.match(body,/persistentWriteAuthorized: false/);
});
test('all 8 locales provide an accessible stale source error',()=>{
  assert.deepEqual(WORLD_EDITOR_STAGE1_LOCALES,['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
  for(const lang of WORLD_EDITOR_STAGE1_LOCALES)
    assert.ok(worldEditorStage1Copy(lang).staleReference?.length>20,lang);
});
