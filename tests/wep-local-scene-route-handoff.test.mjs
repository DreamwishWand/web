import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 WEP_LOCAL_SCENE_ROUTE_INTENT_KEY as KEY,
 WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA as SCHEMA,
 WEP_LOCAL_SCENE_ROUTE_INTENT_MAX_AGE_MS as MAX_AGE,
 WEP_LOCAL_SCENE_ROUTE_LOCALES,localSceneRouteCopy,
 stageLocalSceneRouteIntent,peekLocalSceneRouteIntent,takeLocalSceneRouteIntent
} from '../src/lib/wep/local-scene-route-handoff.mjs';
const id='scene_11111111-1111-4111-8111-111111111111';
const now=1794231000000;
function storage(){const data=new Map();return {
 getItem:k=>data.has(k)?data.get(k):null,
 setItem:(k,v)=>data.set(k,String(v)),
 removeItem:k=>data.delete(k),
 dump:()=>[...data.entries()]
};}
test('same-tab explicit sender hint has only strict ID, revision, time; no artifact or credentials',()=>{
 const store=storage();
 const v=stageLocalSceneRouteIntent(store,{sceneId:id,expectedRevision:4},now);
 assert.deepEqual(v,{sceneId:id,expectedRevision:4,issuedAt:now});
 const raw=store.getItem(KEY);
 assert.equal(raw.length<256,true);
 assert.deepEqual(Object.keys(JSON.parse(raw)),['schema','sceneId','expectedRevision','issuedAt']);
 for(const leak of ['itemId','artifact','native','title','source','sceneSave','editorId','auth','writeReady','ownership'])
  assert.equal(raw.includes(leak),false,leak);
 assert.deepEqual(peekLocalSceneRouteIntent(store,now),{schema:SCHEMA,...v});
 assert.deepEqual(takeLocalSceneRouteIntent(store,peekLocalSceneRouteIntent(store,now),now),{schema:SCHEMA,...v});
 assert.equal(peekLocalSceneRouteIntent(store,now),null,'consume is one-shot');
});
test('expired, future, malformed, oversized, native-shaped, extra keys deny without storage or Scene reads',()=>{
 const s=storage();
 for(const bad of [
  {sceneId:'g42:o7',expectedRevision:1},
  {sceneId:id,expectedRevision:0},
  {sceneId:id,expectedRevision:1.5},
  {sceneId:id,expectedRevision:'1'}
 ]) assert.throws(()=>stageLocalSceneRouteIntent(s,bad,now),/INTENT_INVALID/);
 stageLocalSceneRouteIntent(s,{sceneId:id,expectedRevision:1},now);
 assert.ok(peekLocalSceneRouteIntent(s,now+MAX_AGE),'TTL exact boundary remains valid');
 assert.equal(peekLocalSceneRouteIntent(s,now+MAX_AGE+1),null);
 assert.equal(peekLocalSceneRouteIntent(s,now-1),null);
 s.setItem(KEY,'x'.repeat(257));assert.equal(peekLocalSceneRouteIntent(s,now),null);
 s.setItem(KEY,JSON.stringify({schema:SCHEMA,sceneId:id,expectedRevision:1,issuedAt:now,writeReady:true}));
 assert.equal(peekLocalSceneRouteIntent(s,now),null);
 s.setItem(KEY,JSON.stringify({schema:SCHEMA,sceneId:id,expectedRevision:1,issuedAt:now,artifact:{}}));
 assert.equal(peekLocalSceneRouteIntent(s,now),null);
});
test('other-tab or same-tab mutation after render never becomes receiver receipt',()=>{
 const s=storage(),other=storage();
 stageLocalSceneRouteIntent(s,{sceneId:id,expectedRevision:2},now);
 let shown=peekLocalSceneRouteIntent(s,now);
 assert.equal(takeLocalSceneRouteIntent(other,shown,now),null);
 stageLocalSceneRouteIntent(s,{sceneId:id,expectedRevision:3},now);
 assert.equal(takeLocalSceneRouteIntent(s,shown,now),null);
 assert.equal(peekLocalSceneRouteIntent(s,now),null);
 assert.equal(takeLocalSceneRouteIntent(s,shown,now),null);
});
test('eight localized read-only prompts, explicit click and source boundaries',()=>{
 assert.deepEqual([...WEP_LOCAL_SCENE_ROUTE_LOCALES],
  ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
 for(const locale of WEP_LOCAL_SCENE_ROUTE_LOCALES)
  for(const key of ['title','notice','action','ready','blocked'])
   assert.ok(localSceneRouteCopy(locale)[key]?.length>5,locale+' '+key);
 const source=fs.readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(source,/routeSceneIntent = peekLocalSceneRouteIntent\(sessionStorage\)/);
 assert.match(source,/on:click=\{reopenSelectedRoutedScene\}/);
 assert.match(source,/takeLocalSceneRouteIntent\(sessionStorage, shown\)/);
 assert.match(source,/fresh\.revision !== chosen\.expectedRevision/);
 assert.match(source,/buildReadonlyLocalSceneReuseDraft\(/);
 assert.match(source,/data-wep-selected-scene-route-draft data-apply="off"/);
 assert.match(source,/data-save-writer="off" data-native-apply="off"/);
 assert.doesNotMatch(source,/on:click=\{autoApplyLocalScene\}/);
 const presets=fs.readFileSync('src/routes/presets/+page.svelte','utf8');
 assert.equal(presets.includes('stageLocalSceneRouteIntent'),false,'08 WEB sender is a separate PR');
});
