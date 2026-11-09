import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localScenePresetCopy,LOCAL_SCENE_PRESET_LOCALES} from '../src/lib/wep/local-scene-preset-copy.js';
import {reopenLocalScenes,readLocalSceneById,WEP_LOCAL_SCENE_DB,WEP_LOCAL_SCENE_STORE} from '../src/lib/wep/local-scene-preset-store.mjs';
import {MY_WAND_VIEWS,MY_DOMAINS,myPresetsCopy} from '../src/lib/presets/my-presets-router.mjs';
const route=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');
test('My Presets local Scenes have separate explicit consumer and account ownership remains UNKNOWN',()=>{
 assert.deepEqual(MY_WAND_VIEWS,['created','saved']);
 assert.deepEqual(MY_DOMAINS,['wand','touchOfMagic','inGame']);
 assert.match(route,/data-my-local-scenes/);
 assert.match(route,/data-device-scene-authority="local-only"/);
 assert.match(route,/data-account-created="unverified"/);
 assert.match(route,/data-account-saved="unverified"/);
 assert.match(route,/data-local-scene-writer="off"/);
 assert.match(route,/data-auto-cloud="off"/);
 assert.match(route,/data-my-verified="false"/);
 assert.match(route,/data-my-community-list="off"/);
 const section=route.split("{#if myDomain==='wand'}")[1]?.split("{:else if myDomain==='touchOfMagic'}")[0];
 assert.ok(section);
 assert.ok(section.indexOf('data-my-local-scenes')>section.indexOf('</section>'),
   'Device Scene separate from My Created/Saved pane');
 assert.match(route,/data-my-wand-view=\{myView\}/);
 assert.match(route,/myView==='created'\?myCopy\.createdUnknown:myCopy\.savedUnknown/);
 assert.doesNotMatch(section,/saveDiscoveredWork|listLibrary|ensureCommunity|community\.save|SavedItem.*=|data-my-creator="verified"/);
 assert.doesNotMatch(route,/data-native-writer="on"|data-auto-cloud="on"|localStorage\.(?:setItem|removeItem)|indexedDB|autoBackup/);
});
test('accepted only WEP readonly DB reader, user click only, independently refreshed revision and preflight OFF',()=>{
 assert.equal(typeof reopenLocalScenes,'function');
 assert.equal(typeof readLocalSceneById,'function');
 assert.equal(WEP_LOCAL_SCENE_DB,'dreamwishwand:wep:scene-presets:local:v1');
 assert.equal(WEP_LOCAL_SCENE_STORE,'snapshots');
 assert.match(route,/import \{ reopenLocalScenes, readLocalSceneById \} from '\$lib\/wep\/local-scene-preset-store\.mjs'/);
 assert.match(route,/on:click=\{reopenDeviceSceneLibrary\}/);
 assert.match(route,/const current=await reopenLocalScenes\(\)/);
 assert.match(route,/const current=await readLocalSceneById\(id\)/);
 assert.match(route,/current\.revision!==deviceScenesRevision/);
 assert.match(route,/const readiness=preflightScene\(current\.entry\.artifact\)/);
 assert.match(route,/readiness\.writeReady!==false/);
 assert.match(route,/on:click=\{\(\)=>previewDeviceScene\(entry\.id\)\}/);
 assert.match(route,/deviceScenesOpened && deviceScenes\.length/);
 assert.match(route,/data-device-scene-preview/);
 assert.match(route,/data-scene-write-ready="false"/);
 assert.match(route,/data-device-scene-world-editor href=\{\`\$\{base\}\/editor\/world\/\`\}/);
 assert.doesNotMatch(route,/saveLocalScene|openLocalSceneDb|writeWorldEditorHandoff|createScenePresetHandoff|sceneId=.*location|sceneId=.*query/);
});
test('8 locale reuse, no new translation/model/storage fork and responsive keyboard focus',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual([...LOCAL_SCENE_PRESET_LOCALES],locales);
 for(const loc of locales){
  const labels=localScenePresetCopy(loc);
  for(const k of ['title','reopen','preview','empty','opened','blocked','notice'])
   assert.ok(typeof labels[k]==='string'&&labels[k].trim().length>2,loc+'/'+k);
  assert.ok(myPresetsCopy(loc).wandBoundary);
 }
 assert.match(route,/\.device-local-scenes button:focus-visible/);
 assert.match(route,/@media\(max-width:570px\)/);
 assert.match(route,/min-width:0/);
 assert.match(route,/data-device-scenes-status role="status" aria-live="polite"/);
});
