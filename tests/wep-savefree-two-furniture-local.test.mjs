import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCollectionRuntime} from '../src/lib/collection/runtime.js';
import {buildSharedCatalogDirectory} from '../src/lib/entity/shared-catalog-directory.mjs';
import {createSwitchWorldReadAdapter} from '../src/lib/wep/world-browser-adapter.ts';
import {buildSaveFreeTwoFurnitureScene,
  WEP_SAVEFREE_TWO_FURNITURE_LOCAL_SCENE_OPERATION,
  saveFreeSceneCopy,SAVEFREE_SCENE_LOCALES
} from '../src/lib/wep/savefree-first-scene.ts';
import {buildReadonlyLocalSceneReuseDraft} from '../src/lib/wep/local-scene-reuse-readonly.ts';
import {validatePublishablePreset,preflightScene} from '../src/lib/wep/scene-preset-runtime.ts';

const root=new URL('../',import.meta.url);
const fetchImpl=async url=>{
 const path=new URL(String(url),'https://wand.invalid').pathname;
 return new Response(await readFile(new URL('./static'+path,root)),{status:200});
};
const [catalog,binding]=await Promise.all([
 loadCollectionRuntime('',fetchImpl),
 createSwitchWorldReadAdapter({basePath:'',fetchImpl})
]);
const directory=buildSharedCatalogDirectory(catalog.index,catalog.rows,'en');
const args={directory,binding,firstItemId:40000047,secondItemId:40000047,
 secondX:3,secondY:0,title:'Two furniture local test'};
const build=(extra={})=>buildSaveFreeTwoFurnitureScene({...args,...extra});

test('two verified 3x2 footprints create one bounded and non-overlapping SaveFree Scene',()=>{
 const v=build();
 assert.equal(v.operation,WEP_SAVEFREE_TWO_FURNITURE_LOCAL_SCENE_OPERATION);
 assert.equal(v.localOnly,true);
 assert.equal(v.editorSessionCreated,false);
 assert.equal(v.nativePlacementAuthorized,false);
 assert.equal(v.inventoryVerified,false);
 assert.equal(v.writeReady,false);
 assert.equal(v.applyReady,false);
 assert.deepEqual(v.artifact.bounds,{w:6,h:2});
 assert.equal(v.artifact.objects.length,2);
 assert.deepEqual(v.artifact.objects.map(o=>o.itemId),[40000047,40000047]);
 assert.deepEqual(v.artifact.objects.map(o=>[o.localX,o.localY]),[[0,0],[3,0]]);
 assert.equal(v.artifact.requirements.itemQuantities['40000047'],2);
 assert.equal(v.artifact.source.platform,'synthetic');
 assert.equal(v.artifact.networks.roads,null);
 assert.equal(v.artifact.networks.fences,null);
 assert.equal(validatePublishablePreset(v.artifact).ok,true);
 const pre=preflightScene(v.artifact);
 assert.equal(pre.ok,true);assert.equal(pre.writeReady,false);
 const detached=buildReadonlyLocalSceneReuseDraft({
  sceneId:'scene_11111111-1111-4111-8111-111111111111',
  sourceRevision:1,artifact:v.artifact
 });
 assert.equal(detached.objects.length,2);
 assert.deepEqual(detached.bounds,{w:6,h:2});
 assert.equal(detached.nativePlacementAuthorized,false);
 assert.equal(detached.editorMutationAuthorized,false);
 assert.equal(detached.writeReady,false);
 assert.equal(detached.applyReady,false);
});

test('local composition denies overlap, off-canvas, fractional, negative and unverified item',()=>{
 for(const extra of [
  {secondX:0,secondY:0},{secondX:2,secondY:0},
  {secondX:1,secondY:1},{secondX:-1},{secondX:2.5},
  {secondY:-1},{secondY:0.1},{secondX:63},{secondY:63},
  {firstItemId:999999999},{secondItemId:999999999},
  {title:' '},{binding:{...binding,source:{...binding.source,gameVersion:'1.25.3'}}}
 ]) assert.throws(()=>build(extra),/WEP_SAVEFREE_SCENE_/);
});

test('source-signed geometry remains unchanged, portable payload has no Save/local Grid authority',()=>{
 const first=build();
 const second=build({secondX:0,secondY:2});
 assert.deepEqual(second.artifact.bounds,{w:3,h:4});
 assert.deepEqual(first.artifact.objects.map(o=>o.footprint.length),[6,6]);
 const serialized=JSON.stringify(first.artifact);
 for(const forbidden of ['gridObjectId','sourceGridId','saveBytes','ownership','nativeGrid','editorId'])
  assert.doesNotMatch(serialized,new RegExp('"'+forbidden+'"','i'));
 assert.equal(first.artifact.requirements.roadTopology,false);
 assert.equal(first.artifact.requirements.fenceTopology,false);
 assert.equal(first.artifact.objects.every(o=>o.portableState===null),true);
});

test('two-furniture controls retain explicit OFF defaults and eight localized labels',()=>{
 assert.deepEqual(SAVEFREE_SCENE_LOCALES,['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']);
 for(const locale of SAVEFREE_SCENE_LOCALES)
  for(const field of ['secondChoose','secondX','secondY','removeSecond','layoutPreview'])
   assert.ok(saveFreeSceneCopy(locale)[field]?.length>=3,locale+' '+field);
});
