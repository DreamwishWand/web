import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stageVerifiedMyLocalSceneRoute} from '../src/lib/presets/my-local-scene-route-sender.mjs';
import {stageLocalSceneRouteIntent,peekLocalSceneRouteIntent,takeLocalSceneRouteIntent,
 WEP_LOCAL_SCENE_ROUTE_INTENT_KEY as KEY,WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA as SCHEMA,
 WEP_LOCAL_SCENE_ROUTE_INTENT_MAX_AGE_MS as TTL,
 WEP_LOCAL_SCENE_ROUTE_LOCALES,localSceneRouteCopy} from '../src/lib/wep/local-scene-route-handoff.mjs';
import {MY_WAND_VIEWS,MY_DOMAINS,myPresetsCopy} from '../src/lib/presets/my-presets-router.mjs';
const ui=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');
const ID='scene_11111111-1111-4111-8111-111111111111';
const NOW=1794231000000;
const artifact={
 schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',title:'Portable local',
 source:{gameVersion:null,platform:null,areaKey:null},
 bounds:{w:2,h:1},originPolicy:'capture-region-top-left',
 objects:[{artifactObjectId:'o0',itemId:40000048,layer:'furniture',
  localX:0,localY:0,orientation:0,footprint:[{x:0,y:0}],portableState:null,dependencyIds:[]}],
 networks:{roads:null,fences:null},
 requirements:{itemQuantities:{'40000048':1},roadTopology:false,fenceTopology:false},
 normalization:{sourceGridIdsRemoved:true,sourceGridObjectIdsRemoved:true,dependencyClosureIncluded:true}
};
const selected={id:ID,title:'Portable local',createdAt:'2026-11-09T10:00:00.000Z',objectCount:1};
const record={revision:3,entry:{...selected,artifact}};
const makeStorage=()=>{const m=new Map();return {
 getItem:k=>m.has(k)?m.get(k):null,
 setItem:(k,v)=>m.set(k,String(v)),
 removeItem:k=>m.delete(k),
 keys:()=>[...m.keys()]
};};
const args=(storage={},extra={})=>({
 selected,expectedRevision:3,storage,readScene:async()=>structuredClone(record),now:NOW,...extra
});
async function denies(extra){
 const storage=makeStorage();
 await assert.rejects(stageVerifiedMyLocalSceneRoute(args(storage,extra)),/WEB_MYLOCAL_SCENE_ROUTE_NOT_VERIFIED|WEP_SCENE_REUSE_/);
 assert.equal(storage.getItem(KEY),null,'failed or unverified click cannot stage');
}
test('explicit sender: accepted single WEP hint with ID+Revision+issuedAt only',async()=>{
 const storage=makeStorage();
 const receipt=await stageVerifiedMyLocalSceneRoute(args(storage));
 assert.deepEqual(receipt,{sceneId:ID,expectedRevision:3,issuedAt:NOW});
 assert.deepEqual(Object.keys(JSON.parse(storage.getItem(KEY))),['schema','sceneId','expectedRevision','issuedAt']);
 assert.equal(JSON.parse(storage.getItem(KEY)).schema,SCHEMA);
 for(const leak of ['artifact','title','creator','savedItem','editorId','native','itemId','x','source'])
  assert.equal(storage.getItem(KEY).includes('"' + leak + '"'),false,leak);
 assert.equal(peekLocalSceneRouteIntent(storage,NOW+TTL+1),null,'past 3min expired');
 assert.ok(peekLocalSceneRouteIntent(storage,NOW+TTL));
 const shown=peekLocalSceneRouteIntent(storage,NOW);
 assert.deepEqual(takeLocalSceneRouteIntent(storage,shown,NOW),{schema:SCHEMA,...receipt});
 assert.equal(takeLocalSceneRouteIntent(storage,shown,NOW),null,'one shot cannot replay');
});
test('no stage on stale tab, forge, deletion, mismatch, bad preflight, Native/Topology',async()=>{
 await denies({expectedRevision:2});
 await denies({readScene:async()=>({...record,revision:4})});
 await denies({readScene:async()=>{throw Error('WEP_LOCAL_SCENE_ENTRY_MISSING');}});
 await denies({selected:{...selected,id:'native:g7'}});
 await denies({selected:{...selected,objectCount:2}});
 await denies({readScene:async()=>({...record,entry:{...record.entry,title:'Changed title'}})});
 await denies({readScene:async()=>({...record,entry:{...record.entry,createdAt:'2026-11-09T11:00:00.000Z'}})});
 await denies({readScene:async()=>({...record,entry:{...record.entry,artifact:{...artifact,objects:[]}}})});
 await denies({preflight:()=>({ok:false,writeReady:false})});
 await denies({preflight:()=>({ok:true,writeReady:true})});
 await denies({readScene:async()=>({...record,entry:{...record.entry,artifact:{...artifact,objects:[{
   ...artifact.objects[0],sourceGridObjectId:'native:o1'}]}}})});
 await denies({readScene:async()=>({...record,entry:{...record.entry,artifact:{...artifact,networks:{roads:[],fences:null}}}})});
 await denies({readScene:async()=>({...record,entry:{...record.entry,artifact:{...artifact,objects:[{
   ...artifact.objects[0],footprint:[{x:90,y:0}]}]}}})});
});
test('previous pending hint invalidated before subsequent denied explicit click',async()=>{
 const storage=makeStorage();
 stageLocalSceneRouteIntent(storage,{sceneId:ID,expectedRevision:3},NOW);
 await assert.rejects(stageVerifiedMyLocalSceneRoute(args(storage,{readScene:async()=>{throw Error('corrupt');}})),/NOT_VERIFIED/);
 assert.equal(storage.getItem(KEY),null,'no stale previously staged hint');
});
test('Presets sender-only UI is explicit, separate from Created/Saved; no WEP Source edits',()=>{
 assert.deepEqual([...MY_WAND_VIEWS],['created','saved']);
 assert.deepEqual([...MY_DOMAINS],['wand','touchOfMagic','inGame']);
 assert.match(ui,/data-my-local-scenes/);
 assert.match(ui,/data-my-verified="false"/);
 assert.match(ui,/data-my-community-list="off"/);
 assert.match(ui,/data-account-created="unverified"/);
 assert.match(ui,/data-account-saved="unverified"/);
 assert.match(ui,/data-auto-cloud="off"/);
 assert.match(ui,/data-local-scene-writer="off"/);
 assert.match(ui,/data-device-scene-world-editor-selected/);
 assert.match(ui,/on:click=\{openSelectedDeviceSceneInWorldEditor\}/);
 assert.match(ui,/if\(deviceScenesBusy \|\| !deviceScenesOpened \|\| !deviceSceneSelected\)return/);
 assert.match(ui,/selected:\{\.\.\.deviceSceneSelected\}/);
 assert.match(ui,/expectedRevision:deviceScenesRevision/);
 assert.match(ui,/storage:sessionStorage/);
 assert.match(ui,/window.location.assign\(\`\$\{base\}\/editor\/world\/\`\)/);
 assert.match(ui,/data-device-scene-world-editor href=/,'generic link retained');
 assert.doesNotMatch(ui,/stageLocalSceneRouteIntent|saveLocalScene|indexedDB|localStorage\.(?:removeItem|setItem)/,
  'WEP Route receiver contract consumed through tested 08 WEB adapter, no duplicate Reader/Writer');
 const route=ui.split('data-my-local-scenes')[1]?.split("{:else if myDomain==='touchOfMagic'}")[0];
 assert.match(route,/data-device-scene-world-editor-selected/);
 assert.doesNotMatch(route,/Created.*ownership|data-auto-cloud="on"|data-native-writer="on"/);
});
test('8 original locales, keyboard focus and 320px/200% support',()=>{
 assert.deepEqual([...WEP_LOCAL_SCENE_ROUTE_LOCALES],['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
 for(const locale of WEP_LOCAL_SCENE_ROUTE_LOCALES){
  assert.ok(localSceneRouteCopy(locale).action?.length>4,locale);
  assert.ok(localSceneRouteCopy(locale).blocked?.length>4,locale);
  assert.ok(myPresetsCopy(locale).createdUnknown);
 }
 assert.match(ui,/\.device-local-scenes button:focus-visible/);
 assert.match(ui,/@media\(max-width:570px\)/);
 assert.match(ui,/aria-label=\{deviceSceneRouteCopy.action\}/);
});
