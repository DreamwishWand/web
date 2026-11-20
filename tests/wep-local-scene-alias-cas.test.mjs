import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  renameLocalSceneAlias
} from '../src/lib/wep/local-scene-preset-store.mjs';
import {
  LOCAL_SCENE_PRESET_LOCALES, localScenePresetCopy
} from '../src/lib/wep/local-scene-preset-copy.js';

const id='scene_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const valid={sceneId:id,newTitle:'Renamed local Scene',expectedOldTitle:'Original Scene',expectedRevision:2};

test('local Scene alias input failures reject before any IndexedDB open or mutation',async()=>{
 let opens=0;
 const factory={open(){opens++;throw Error('DB_MUST_NOT_OPEN');}};
 for(const invalid of [
  {sceneId:'not-native'},{sceneId:'grid_123'},{sceneId:['scene_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']},
  {newTitle:''},{newTitle:' '},{newTitle:'x'.repeat(121)},
  {expectedOldTitle:''},{expectedOldTitle:'y'.repeat(121)},
  {expectedRevision:0},{expectedRevision:-1},
  {expectedRevision:1.5},{expectedRevision:Number.MAX_SAFE_INTEGER}
 ]){
  await assert.rejects(
   renameLocalSceneAlias({...valid,...invalid,factory}),
   /WEP_LOCAL_SCENE_ALIAS_INPUT_INVALID/
  );
 }
 await assert.rejects(
  renameLocalSceneAlias({...valid,newTitle:'Original Scene',factory}),
  /WEP_LOCAL_SCENE_ALIAS_UNCHANGED/
 );
 assert.equal(opens,0,'invalid UI input cannot create a new local library');
});

test('eight launch locales describe alias-only management without Save authority',()=>{
 assert.deepEqual([...LOCAL_SCENE_PRESET_LOCALES],
  ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
 for(const locale of LOCAL_SCENE_PRESET_LOCALES){
  const entry=localScenePresetCopy(locale);
  for(const key of ['aliasTitle','aliasLoad','aliasSelect','aliasNewName',
     'aliasRename','aliasRenamed','aliasBlocked','aliasNotice'])
   assert.ok(typeof entry[key]==='string'&&entry[key].trim().length>4,
    locale+':'+key);
 }
});

test('World Editor mount is explicit opt-in; Scene alias UI cannot call game writer',()=>{
 const route=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 const panel=readFileSync('src/lib/wep/LocalSceneAliasManager.svelte','utf8');
 const store=readFileSync('src/lib/wep/local-scene-preset-store.mjs','utf8');
 assert.match(route,/import LocalSceneAliasManager/);
 assert.match(route,/<LocalSceneAliasManager \/>/);
 assert.match(panel,/data-wep-local-scene-alias/);
 assert.match(panel,/on:click=\{loadSavedScenes\}/);
 assert.match(panel,/on:click=\{renameSelected\}/);
 assert.match(panel,/data-save-writer="off"/);
 assert.match(panel,/data-native-apply="off"/);
 assert.match(panel,/data-cloud="off"/);
 assert.doesNotMatch(panel,/session\.execute\(|EditorSession\(|openWorldSaveBytes\(|indexedDB\.open\(|fetch\(/);
 assert.match(store,/backupRevision:row\.revision,primary,backup:row\.primary/);
 assert.match(store,/ALIAS_REOPEN_MISMATCH/);
});
