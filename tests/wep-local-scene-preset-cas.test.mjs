import test from 'node:test';
import assert from 'node:assert/strict';
import {captureScenePreset} from '../src/lib/wep/scene-capture-runtime.ts';
import {preflightScene,validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
import {
  saveLocalScene,reopenLocalScenes,openLocalSceneDb,WEP_LOCAL_SCENE_OPERATION,
  WEP_LOCAL_SCENE_DB,WEP_LOCAL_SCENE_STORE
} from '../src/lib/wep/local-scene-preset-store.mjs';
import {localScenePresetCopy,LOCAL_SCENE_PRESET_LOCALES} from '../src/lib/wep/local-scene-preset-copy.js';
const doc={target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'test-only'},
 objects:[{editorId:'object-a',itemId:40000048,layer:'furniture',x:3,y:4,orientation:0,
 footprint:[{x:0,y:0}],portableState:null,dependencyIds:[],editability:'editable'}]};
const captured=()=>captureScenePreset(doc,{selectionIds:['object-a'],includeRoads:false,includeFences:false,title:'Locally saved'},validatePublishablePreset);
test('reuse exact typed Scene capture validator and preserve local-only preflight writeReady OFF',()=>{
 const cap=captured();
 assert.equal(cap.publicationReady,true);
 assert.equal(cap.artifact.schema,'dreamwish-wand-preset');
 assert.equal(cap.artifact.type,'scene');
 assert.equal(cap.artifact.objects[0].artifactObjectId,'o0');
 assert.equal(JSON.stringify(cap.artifact).includes('object-a'),false);
 assert.equal(preflightScene(cap.artifact).writeReady,false);
 assert.equal(WEP_LOCAL_SCENE_OPERATION,'WEP_SCENE_PRESET_LOCAL_IDB_CAS_BACKUP_REOPEN_READONLY');
});
test('reject invalid create inputs, forged native identity, nonportable topology before IDB creation',async()=>{
 const bad=structuredClone(captured().artifact);
 bad.objects[0].editorId='native-asserted';
 const failFactory={open(){throw Error('IDB_SHOULD_NOT_OPEN');}};
 await assert.rejects(saveLocalScene({factory:failFactory,expectedRevision:0,title:'Preset',artifact:bad}),/PRESET_INVALID/);
 const roads=structuredClone(captured().artifact);
 roads.requirements.roadTopology=true;
 await assert.rejects(saveLocalScene({factory:failFactory,expectedRevision:0,title:'Preset',artifact:roads}),/NETWORK_AUTHORITY_UNVERIFIED/);
 await assert.rejects(saveLocalScene({factory:failFactory,expectedRevision:-1,title:'Preset',artifact:captured().artifact}),/INPUT_INVALID/);
 await assert.rejects(saveLocalScene({factory:failFactory,expectedRevision:0,title:'',artifact:captured().artifact}),/INPUT_INVALID/);
 await assert.rejects(saveLocalScene({factory:failFactory,expectedRevision:0,title:'Preset',artifact:captured().artifact,idFactory:()=> 'bad'}),/ID_INVALID/);
});
test('read-only opener aborts absent IDB upgrade, never migrates or creates',async()=>{
 let aborted=false;
 const factory={open(name,version){
  assert.equal(name,WEP_LOCAL_SCENE_DB);assert.equal(version,1);
  const req={transaction:{abort(){aborted=true;setImmediate(()=>req.onerror());}}};
  setImmediate(()=>req.onupgradeneeded());
  return req;
 }};
 await assert.rejects(reopenLocalScenes(factory),/DB_UNAVAILABLE_OR_ABSENT/);
 assert.equal(aborted,true);
 assert.equal(WEP_LOCAL_SCENE_STORE,'snapshots');
});
test('eight locales, no Community ownership claim or Save Writer gates',()=>{
 assert.equal(LOCAL_SCENE_PRESET_LOCALES.length,8);
 for(const locale of LOCAL_SCENE_PRESET_LOCALES){
  const c=localScenePresetCopy(locale);
  for(const k of ['title','save','reopen','preview','saved','blocked','notice'])
   assert.ok(typeof c[k]==='string'&&c[k].trim(),locale+':'+k);
 }
});
