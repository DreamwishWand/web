import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import { loadCollectionRuntime } from '../src/lib/collection/runtime.js';
import { buildSharedCatalogDirectory } from '../src/lib/entity/shared-catalog-directory.mjs';
import { createSwitchWorldReadAdapter } from '../src/lib/wep/world-browser-adapter.ts';
import {
 WEP_SAVEFREE_FIRST_SCENE_OPERATION,resolveVerifiedSaveFreeSceneItem,
 buildSaveFreeFirstNonemptyScene,SAVEFREE_SCENE_LOCALES,saveFreeSceneCopy
} from '../src/lib/wep/savefree-first-scene.ts';
import { validatePublishablePreset,preflightScene } from '../src/lib/wep/scene-preset-runtime.ts';
import { captureScenePreset } from '../src/lib/wep/scene-capture-runtime.ts';
import { buildReadonlyLocalSceneReuseDraft } from '../src/lib/wep/local-scene-reuse-readonly.ts';
import { saveLocalScene } from '../src/lib/wep/local-scene-preset-store.mjs';

const root=new URL('../',import.meta.url);
const localFetch=async url=>{
 const path=new URL(String(url),'https://wand.invalid').pathname;
 const bytes=await readFile(new URL('./static'+path,root));
 return new Response(bytes,{status:200});
};
const approved=await Promise.all([
 loadCollectionRuntime('',localFetch),
 createSwitchWorldReadAdapter({basePath:'',fetchImpl:localFetch})
]);
const [{index,rows},binding]=approved;
const directory=buildSharedCatalogDirectory(index,rows,'en');
const title='Save-free first genuine nonempty local Scene';
const build=(itemId=40000047)=>buildSaveFreeFirstNonemptyScene({directory,binding,itemId,title});

test('original pinned collection Item and World source footprint/Policy join positive 3x2, no guessed Item or inventory',()=>{
 assert.equal(index.t.buildID,'52BD625D9B4E0053');
 assert.equal(directory.status,'READY');
 assert.equal(directory.entries.length>0,true);
 const row=directory.entries.filter(x=>x.itemId===40000047);
 assert.equal(row.length,1,'the actual 40000047 must exist uniquely in SHA-verified catalog');
 assert.equal(row[0].family,'Furniture');
 const selected=resolveVerifiedSaveFreeSceneItem(directory,binding,40000047);
 assert.equal(selected.itemId,40000047);
 assert.equal(selected.layer,'furniture');
 assert.deepEqual(selected.bounds,{w:3,h:2});
 assert.equal(selected.footprint.length,6);
 assert.equal(selected.inventoryVerified,false);
 assert.equal(selected.applyReady,false);
 assert.equal(selected.writeReady,false);
});

test('canonical capture creates exactly one nonempty 3x2 portable Scene with no Editor/Native IDs or writes',()=>{
 const result=build();
 assert.equal(result.operation,WEP_SAVEFREE_FIRST_SCENE_OPERATION);
 assert.equal(result.localOnly,true);
 assert.equal(result.editorSessionCreated,false);
 assert.equal(result.nativePlacementAuthorized,false);
 assert.equal(result.inventoryVerified,false);
 assert.equal(result.writeReady,false);
 assert.equal(result.applyReady,false);
 assert.equal(result.artifact.objects.length,1);
 assert.deepEqual(result.artifact.bounds,{w:3,h:2});
 assert.equal(result.artifact.objects[0].layer,'furniture');
 assert.equal(result.artifact.objects[0].itemId,40000047);
 assert.equal(result.artifact.objects[0].footprint.length,6);
 assert.equal(result.artifact.objects[0].portableState,null);
 assert.equal(result.artifact.source.platform,'synthetic');
 assert.equal(result.artifact.networks.roads,null);
 assert.equal(result.artifact.networks.fences,null);
 assert.equal(result.artifact.requirements.roadTopology,false);
 assert.equal(result.artifact.requirements.fenceTopology,false);
 assert.equal(validatePublishablePreset(result.artifact).ok,true);
 const p=preflightScene(result.artifact);
 assert.equal(p.ok,true);
 assert.equal(p.writeReady,false);
 const j=JSON.stringify(result.artifact);
 for(const field of ['gridId','gridObjectId','editorId','saveBytes','ownership','nativeGrid','sourceGridId'])
  assert.doesNotMatch(j,new RegExp('"'+field+'"\\\\s*:'),field);
 const detached=buildReadonlyLocalSceneReuseDraft({
  sceneId:'scene_11111111-1111-4111-8111-111111111111',
  sourceRevision:1,artifact:result.artifact
 });
 assert.deepEqual(detached.bounds,{w:3,h:2});
 assert.equal(detached.objects.length,1);
 assert.equal(detached.writeReady,false);
 assert.equal(detached.applyReady,false);
});

test('empty Scene remains permanently invalid in both existing validator and capture',async()=>{
 const a=structuredClone(build().artifact);
 a.objects=[];
 const v=validatePublishablePreset(a);
 assert.equal(v.ok,false);
 assert.ok(v.issues.some(x=>x.code==='SCENE_OBJECTS_INVALID'));
 assert.throws(()=>captureScenePreset({objects:[],networks:{roads:null,fences:null}},
  {selectionIds:[]},validatePublishablePreset),/WEP_SCENE_SELECTION_EMPTY/);
 await assert.rejects(
  ()=>saveLocalScene({factory:null,artifact:a,title:'Not valid',
   expectedRevision:0,idFactory:()=> '11111111-1111-4111-8111-111111111111'}),
  /WEP_LOCAL_SCENE_PRESET_INVALID/
 );
});

test('unknown/unsupported native objects, wrong static identity and suspicious footprint are denied',()=>{
 for(const id of [0,-1,1.5,999999999,40003102])
  assert.throws(()=>build(id),/WEP_SAVEFREE_SCENE_/);
 assert.throws(()=>buildSaveFreeFirstNonemptyScene({
  directory,binding,itemId:40000047,title:''
 }),/TITLE_INVALID/);
 const fake={...binding,
  resolveDraftPlacementSource(id){
   const cap=binding.resolveDraftPlacementSource(id,1);
   return {...cap,footprint:[{x:0,y:0}]};
  }};
 assert.throws(()=>resolveVerifiedSaveFreeSceneItem(directory,fake,40000047),
  /FOOTPRINT_UNVERIFIED/);
 const wrong={...binding,source:{...binding.source,gameVersion:'1.25.3'}};
 assert.throws(()=>buildSaveFreeFirstNonemptyScene({
  directory,binding:wrong,itemId:40000047,title
 }),/SOURCE_UNVERIFIED/);
 const madeUp={...directory,entries:[{itemId:40000047,label:'Fake',family:'Furniture'}],
  source:{...directory.source,gameVersion:'1.25.3'}};
 assert.throws(()=>resolveVerifiedSaveFreeSceneItem(madeUp,binding,40000047),
  /SOURCE_UNVERIFIED/);
});

test('eight locales, explicit loading/select/preview/save and unchanged accepted single store',()=>{
 assert.deepEqual([...SAVEFREE_SCENE_LOCALES],['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']);
 for(const locale of SAVEFREE_SCENE_LOCALES)
  for(const key of ['title','notice','load','search','choose','unavailable','name','save','ready','saved','blocked','off'])
   assert.ok(saveFreeSceneCopy(locale)[key]?.length>2,locale+' '+key);
 const page=fs.readFileSync('src/routes/editor/world/+page.svelte','utf8');
 const component=fs.readFileSync('src/lib/wep/SaveFreeFirstScene.svelte','utf8');
 const store=fs.readFileSync('src/lib/wep/local-scene-preset-store.mjs','utf8');
 assert.match(page,/<SaveFreeFirstScene \/>/);
 assert.match(component,/on:click=\{loadVerifiedCatalog\}/);
 assert.match(component,/on:click=\{previewVerifiedNonemptyScene\}/);
 assert.match(component,/on:click=\{saveVerifiedNonemptyScene\}/);
 assert.match(component,/loadCollectionRuntime\(base\)/);
 assert.match(component,/createSwitchWorldReadAdapter\(\{ basePath: base \}\)/);
 assert.match(component,/saveLocalScene\(/);
 assert.match(component,/verifiedReopenLocalScene\(/);
 assert.match(component,/buildReadonlyLocalSceneReuseDraft\(/);
 assert.doesNotMatch(component,/createEditorSession\(|openWorldSaveBytes\(|localStorage\.setItem|session\.execute\(/);
 assert.match(store,/dreamwishwand:wep:scene-presets:local:v1/);
 assert.match(store,/expectedRevision/);
 assert.match(component,/data-save-writer="off"/);
 assert.match(component,/data-native-apply="off"/);
});
