import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {loadCollectionRuntime} from '../src/lib/collection/runtime.js';
import {buildSharedCatalogDirectory} from '../src/lib/entity/shared-catalog-directory.mjs';
import {createSwitchWorldReadAdapter} from '../src/lib/wep/world-browser-adapter.ts';
import {buildSaveFreeTwoFurnitureScene} from '../src/lib/wep/savefree-first-scene.ts';
import {reviewLocalSceneCoordinates,WEP_LOCAL_SCENE_COORDINATE_REVIEW} from '../src/lib/wep/local-scene-coordinate-review.ts';
import {preflightScene,validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
import {localSceneCoordinateCopy,LOCAL_SCENE_COORDINATE_LOCALES} from '../src/lib/wep/local-scene-coordinate-copy.js';

const root=new URL('../',import.meta.url);
const localFetch=async url=>{
 const path=new URL(String(url),'https://wand.invalid').pathname;
 return new Response(await readFile(new URL('./static'+path,root)),{status:200});
};
const [catalog,binding]=await Promise.all([
 loadCollectionRuntime('',localFetch),
 createSwitchWorldReadAdapter({basePath:'',fetchImpl:localFetch})
]);
const directory=buildSharedCatalogDirectory(catalog.index,catalog.rows,'en');
assert.equal(directory.status,'READY');
const source=buildSaveFreeTwoFurnitureScene({
 directory,binding,firstItemId:40000047,secondItemId:40000047,
 secondX:3,secondY:0,title:'Original local Scene'
}).artifact;
const sceneId='scene_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const moves=[{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o1',x:0,y:2}];
const review=(overrides={})=>reviewLocalSceneCoordinates({
 sceneId,sourceRevision:1,artifact:source,positions:moves,
 title:'Separate edited Scene',...overrides
});

test('two authenticated furniture relative coordinates produce a bounded different portable Scene without source mutation',()=>{
 const before=JSON.stringify(source);
 const r=review();
 assert.equal(r.operation,WEP_LOCAL_SCENE_COORDINATE_REVIEW);
 assert.equal(r.sourceRevision,1);
 assert.equal(r.localOnly,true);
 assert.equal(r.writeReady,false);
 assert.equal(r.applyReady,false);
 assert.equal(r.nativePlacementAuthorized,false);
 assert.equal(r.editorMutationAuthorized,false);
 assert.equal(r.sourceArtifactRaw,before);
 assert.deepEqual(r.bounds,{w:3,h:4});
 assert.equal(r.artifact.objects.length,2);
 assert.deepEqual(r.artifact.objects.map(o=>o.itemId),[40000047,40000047]);
 assert.deepEqual(r.artifact.objects.map(o=>[o.localX,o.localY]),[[0,0],[0,2]]);
 assert.equal(r.artifact.requirements.itemQuantities['40000047'],2);
 assert.equal(validatePublishablePreset(r.artifact).ok,true);
 assert.equal(preflightScene(r.artifact).writeReady,false);
 assert.equal(JSON.stringify(source),before,'original source artifact never modified');
 assert.equal(r.artifact.source.platform,'synthetic');
 assert.equal(r.artifact.networks.roads,null);
 assert.equal(r.artifact.networks.fences,null);
});

test('reject all overlap, counterfeit coordinates, stale/foreign objects and no-effect translations',()=>{
 for(const positions of [
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o1',x:1,y:1}],
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o1',x:63,y:0}],
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o1',x:0,y:63}],
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o1',x:-1,y:2}],
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o1',x:0.5,y:2}],
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'o0',x:3,y:0}],
  [{artifactObjectId:'o0',x:0,y:0},{artifactObjectId:'not-object',x:3,y:0}],
  [{artifactObjectId:'o0',x:0,y:0}],
  [{artifactObjectId:'o0',x:1,y:1},{artifactObjectId:'o1',x:4,y:1}]
 ])assert.throws(()=>review({positions}),/WEP_LOCAL_SCENE_COORD_/);
 for(const args of [{title:''},{title:' '},{title:'x'.repeat(121)},
  {sourceRevision:0},{sceneId:'grid_12'}])
  assert.throws(()=>review(args),/WEP_(LOCAL_SCENE_COORD|SCENE_REUSE)_/);
});

test('unsupported imported, Native or topology-bearing Scene never gets an editing plan',()=>{
 for(const mutate of [
  a=>a.source.platform='steam-windows',
  a=>a.source.gameVersion='1.25.0',
  a=>a.objects[0].orientation=1,
  a=>a.objects[0].portableState={codec:'subgrid.itemdata-default-empty-child@1'},
  a=>a.networks.roads={networks:[]},
  a=>a.objects[0].itemId=0
 ]){
  const bad=structuredClone(source);mutate(bad);
  assert.throws(()=>review({artifact:bad}),/WEP_(LOCAL_SCENE_COORD|SCENE_REUSE)_/);
 }
});

test('eight-locales and UI boundaries preserve no-native-no-account runtime',()=>{
 assert.deepEqual([...LOCAL_SCENE_COORDINATE_LOCALES],
  ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']);
 for(const loc of LOCAL_SCENE_COORDINATE_LOCALES)
  for(const k of ['title','notice','load','selectScene','selectObject',
   'x','y','apply','undo','redo','review','saveAs','newTitle','saved','denied','empty'])
   assert.ok(localSceneCoordinateCopy(loc)[k]?.length>=2,loc+':'+k);
 const page=readFileSync('src/routes/editor/world/+page.svelte','utf8');
 const ui=readFileSync('src/lib/wep/LocalSceneCoordinateStudio.svelte','utf8');
 assert.match(page,/<LocalSceneCoordinateStudio \/>/);
 for(const marker of ['data-wep-local-coordinate-studio','data-wep-coord-preview',
  'data-wep-coord-undo','data-wep-coord-redo','data-wep-coord-review',
  'data-wep-coord-save-as'])assert.match(ui,new RegExp(marker));
 assert.match(ui,/saveLocalScene\(/);
 assert.match(ui,/verifiedReopenLocalScene\(/);
 assert.match(ui,/readLocalSceneById\(/);
 assert.match(ui,/data-save-writer="off"/);
 assert.match(ui,/data-native-apply="off"/);
 assert.match(ui,/data-cloud="off"/);
 assert.doesNotMatch(ui,/session\.execute\(|fetch\(|openWorldSaveBytes\(|indexedDB\.open\(/);
});
