import test from 'node:test';
import assert from 'node:assert/strict';
import {captureScenePreset} from '../src/lib/wep/scene-capture-runtime.ts';
import {validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
import {
  WEP_LOCAL_SCENE_REUSE_OPERATION,buildReadonlyLocalSceneReuseDraft
} from '../src/lib/wep/local-scene-reuse-readonly.ts';
import {LOCAL_SCENE_PRESET_LOCALES,localScenePresetCopy} from '../src/lib/wep/local-scene-preset-copy.js';
import fs from 'node:fs';
const id='scene_11111111-1111-4111-8111-111111111111';
const editor={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{platform:'synthetic',gameVersion:'1.25.0',areaKey:'fixture'},
 networks:{roads:null,fences:null},objects:[{
 editorId:'only-in-the-original-editor',itemId:40000048,
 layer:'furniture',x:2,y:4,orientation:0,
 footprint:[{x:0,y:0}],editability:'editable',
 portableState:null,dependencyIds:[],source:null
 }]};
const capture=()=>captureScenePreset(editor,{selectionIds:[editor.objects[0].editorId],title:'Reusable local',
 includeRoads:false,includeFences:false},validatePublishablePreset).artifact;
const project=a=>buildReadonlyLocalSceneReuseDraft({sceneId:id,sourceRevision:3,artifact:a});
const deny=(edit,code)=>{const a=structuredClone(capture());edit(a);
 assert.throws(()=>project(a),new RegExp('WEP_SCENE_REUSE_'+code));};
test('explicit local-only typed captured Scene -> DETACHED readonly Draft; no original editor ID, command or mutation',()=>{
 const a=capture(),before=JSON.stringify(a);
 const d=project(a);
 assert.equal(JSON.stringify(a),before);
 assert.equal(WEP_LOCAL_SCENE_REUSE_OPERATION,'WEP_LOCAL_SCENE_REUSE_DETACHED_READONLY_DRAFT@1');
 assert.equal(d.sourceRevision,3);
 assert.deepEqual(d.bounds,{w:1,h:1});
 assert.equal(d.objects.length,1);
 assert.deepEqual(d.objects[0].footprint,[{x:0,y:0}]);
 assert.equal(d.objects[0].artifactObjectId,'o0');
 assert.equal(d.objects[0].x,0);assert.equal(d.objects[0].y,0);
 assert.equal(d.objects[0].source,null);
 assert.equal(d.objects[0].nativeGridObjectId,null);
 assert.equal(JSON.stringify(d).includes('only-in-the-original-editor'),false);
 for(const k of ['localOnly','detachedFromEditorSession']) assert.equal(d[k],true);
 for(const k of ['inventoryVerified','nativePlacementAuthorized','editorMutationAuthorized','writeReady','applyReady']) assert.equal(d[k],false);
 assert.equal('command' in d,false);assert.equal('destinationGridId' in d,false);
});
test('identity and stale receipt must be bounded: artifact alone is never a scene-authorized key',()=>{
 for(const args of [
  {sceneId:'native:42',sourceRevision:3,artifact:capture()},
  {sceneId:id,sourceRevision:0,artifact:capture()},
  {sceneId:id,sourceRevision:1.5,artifact:capture()}
 ]) assert.throws(()=>buildReadonlyLocalSceneReuseDraft(args),/SOURCE_IDENTITY_INVALID/);
});
test('topology, Native ID, SubGrid, unknown layer and untrusted geometry fail closed',()=>{
 deny(a=>{a.requirements.roadTopology=true;},'TOPOLOGY_UNVERIFIED');
 deny(a=>{a.objects[0].sourceGridObjectId='native-o7';},'ARTIFACT_INVALID');
 deny(a=>{a.objects[0].portableState={codec:'subgrid.itemdata-default-empty-child@1'};},'OBJECT_UNVERIFIED');
 deny(a=>{a.objects[0].layer='road';},'OBJECT_UNVERIFIED');
 deny(a=>{a.objects[0].footprint=[{x:1,y:0}];},'FOOTPRINT_OUTSIDE_LOCAL_BOUNDS');
 deny(a=>{a.objects[0].localX=999;},'FOOTPRINT_OUTSIDE_LOCAL_BOUNDS');
 deny(a=>{a.objects[0].dependencyIds=['o999'];},'ARTIFACT_INVALID');
});
test('8 locales and World Editor click-only draft UI cannot authorize native apply',()=>{
 for(const locale of LOCAL_SCENE_PRESET_LOCALES){
  const c=localScenePresetCopy(locale);
  for(const key of ['reuse','reuseReady','reuseBlocked'])
   assert.ok(typeof c[key]==='string'&&c[key].length>0,locale+':'+key);
 }
 assert.equal(LOCAL_SCENE_PRESET_LOCALES.length,8);
 const route=fs.readFileSync('src/routes/editor/world/+page.svelte','utf8');
 assert.match(route,/data-wep-local-scene-reuse/);
 assert.match(route,/on:click=\{prepareLocalSceneReuseDraft\}/);
 assert.match(route,/fresh\.revision !== localSceneRevision/);
 assert.match(route,/data-wep-local-scene-draft/);
 assert.match(route,/applyReady=false/);
 assert.doesNotMatch(route,/on:click=\{.*commitLocalSceneReuse/);
});
