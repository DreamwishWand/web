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

test('migration canonical file rejects forged authority, duplicate IDs, malformed and oversized before any IDB open',async()=>{
 const m=await import('../src/lib/wep/local-scene-preset-store.mjs');
 const entry={id:'scene_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Local',createdAt:'2026-11-14T00:00:00Z',artifact:captured().artifact};
 const envelope={schema:m.WEP_LOCAL_SCENE_PORTABLE_SCHEMA,version:1,entries:[entry]};
 const raw=JSON.stringify(envelope);
 assert.deepEqual(m.parseLocalScenePortableFile(raw).entries,[entry]);
 const badFactory={open(){throw Error('MUST_NOT_OPEN_IDB');}};
 const mutate=fn=>{const x=structuredClone(envelope);fn(x);return JSON.stringify(x);};
 for(const bad of [
  '{}',raw+' ',JSON.stringify({...envelope,entries:[]}),mutate(x=>x.entries.push(x.entries[0])),
  mutate(x=>x.entries[0].artifact.networks.roads={}),mutate(x=>x.entries[0].artifact.requirements.roadTopology=true),
  mutate(x=>x.entries[0].artifact.session={key:'secret'}),mutate(x=>x.entries[0].artifact.objects[0].portableState={codec:'subgrid.itemdata-default-empty-child@1'}),
  mutate(x=>x.entries[0].artifact.objects[0].localX=999),mutate(x=>x.entries[0].artifact.requirements.itemQuantities['40000048']=99),
  mutate(x=>x.entries[0].artifact.objects[0].gridId=1), 'x'.repeat(m.WEP_LOCAL_SCENE_PORTABLE_MAX_BYTES+1)
 ])await assert.rejects(m.importLocalScenePortableFile({factory:badFactory,raw:bad,expectedRevision:0}),/WEP_(LOCAL_SCENE|SCENE_REUSE)_/);
 const {localScenePortableCopy}=await import('../src/lib/wep/local-scene-preset-copy.js');
 for(const locale of LOCAL_SCENE_PRESET_LOCALES)for(const key of ['export','choose','import','count','exported','imported','blocked','notice'])
  assert.ok(localScenePortableCopy(locale)[key]?.length>2);
});

test('portable layer requires an exact primitive enum; no coercion or IDB open',async()=>{
 const m=await import('../src/lib/wep/local-scene-preset-store.mjs');
 const entry={id:'scene_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Local',createdAt:'2026-11-14T00:00:00Z',artifact:captured().artifact};
 const file={schema:m.WEP_LOCAL_SCENE_PORTABLE_SCHEMA,version:1,entries:[entry]};
 const raw=layer=>{const copy=structuredClone(file);copy.entries[0].artifact.objects[0].layer=layer;return JSON.stringify(copy);};
 for(const layer of ['furniture','building','landscaping'])
  assert.equal(m.parseLocalScenePortableFile(raw(layer)).entries[0].artifact.objects[0].layer,layer);
 let opens=0;
 const factory={open(){opens++;throw Error('MUST_NOT_OPEN_IDB');}};
 for(const layer of [['furniture'],['building'],['landscaping'],[],['furniture','building'],{},null,0,true,'','unknown','Furniture',' furniture','furniture ']){
  assert.throws(()=>m.parseLocalScenePortableFile(raw(layer)),/WEP_LOCAL_SCENE_PORTABLE_OBJECT_INVALID/);
  for(const expectedRevision of [0,2])
   await assert.rejects(m.importLocalScenePortableFile({factory,raw:raw(layer),expectedRevision}),/WEP_LOCAL_SCENE_PORTABLE_OBJECT_INVALID/);
 }
 // Other coercible fields are already rejected by detached geometry or exact portable checks.
 for(const [key,value] of [['itemId','40000048'],['localX','0'],['localY',[0]],['orientation',false],['artifactObjectId',['o0']],['footprint',[{x:'0',y:0}]],['dependencyIds',[['o0']]]]){
  const copy=structuredClone(file);copy.entries[0].artifact.objects[0][key]=value;
  await assert.rejects(m.importLocalScenePortableFile({factory,raw:JSON.stringify(copy),expectedRevision:0}),/WEP_(LOCAL_SCENE|SCENE_REUSE)_/);
 }
 for(const [key,value] of [['bounds',{w:'1',h:1}],['originPolicy',['capture-region-top-left']],['artifactVersion','1']]){
  const copy=structuredClone(file);copy.entries[0].artifact[key]=value;
  await assert.rejects(m.importLocalScenePortableFile({factory,raw:JSON.stringify(copy),expectedRevision:0}),/WEP_(LOCAL_SCENE|SCENE_REUSE)_/);
 }
 assert.equal(opens,0);
});

test('local save rejects revision exhaustion and UTF-8 oversized artifact before opening IDB',async()=>{
 let opens=0;
 const factory={open(){opens++;throw Error('MUST_NOT_OPEN_IDB');}};
 const artifact=captured().artifact;
 const input={factory,title:'Scene',artifact,idFactory:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
 for(const expectedRevision of [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1])
  await assert.rejects(saveLocalScene({...input,expectedRevision}),/INPUT_INVALID/);
 const huge=structuredClone(artifact);
 huge.source.areaKey='界'.repeat(1400000);
 assert.ok(JSON.stringify(huge).length<4*1024*1024);
 assert.ok(new TextEncoder().encode(JSON.stringify(huge)).length>4*1024*1024);
 await assert.rejects(saveLocalScene({...input,artifact:huge,expectedRevision:0}),/LIMIT_REACHED/);
 assert.equal(opens,0);
});
