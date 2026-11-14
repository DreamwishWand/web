import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4383';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 const context=await browser.newContext({serviceWorkers:'block'});
 const pages=await Promise.all([context.newPage(),context.newPage()]);
 await Promise.all(pages.map(p=>p.goto(origin+'/presets/',{waitUntil:'domcontentloaded'})));
 async function setup(p){
  await p.evaluate(async()=>{
   const m=await import('/src/lib/wep/local-scene-preset-store.mjs');
   const {captureScenePreset}=await import('/src/lib/wep/scene-capture-runtime.ts');
   const {validatePublishablePreset}=await import('/src/lib/wep/scene-preset-runtime.ts');
   const artifact=captureScenePreset({target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qa-only'},objects:[{editorId:'a',itemId:40000048,layer:'furniture',x:3,y:4,orientation:0,footprint:[{x:0,y:0}],portableState:null,dependencyIds:[],editability:'editable'}]},{selectionIds:['a'],includeRoads:false,includeFences:false,title:'QA Scene'},validatePublishablePreset).artifact;
   const entry=n=>({id:'scene_aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0'),title:'QA '+n,createdAt:'2026-11-14T00:00:00Z',artifact:structuredClone(artifact)});
   const file=entries=>JSON.stringify({schema:m.WEP_LOCAL_SCENE_PORTABLE_SCHEMA,version:1,entries});
   const raw=async()=>{
    const db=await m.openLocalSceneDb();
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(m.WEP_LOCAL_SCENE_STORE,'readonly'),q=tx.objectStore(m.WEP_LOCAL_SCENE_STORE).get('library');tx.oncomplete=()=>resolve(q.result);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
   };
   const put=async(row)=>{
    const db=await m.openLocalSceneDb();
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(m.WEP_LOCAL_SCENE_STORE,'readwrite');tx.objectStore(m.WEP_LOCAL_SCENE_STORE).put(row,'library');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}finally{db.close();}
   };
   globalThis.qa={m,entry,file,raw,put,run:async(entries,revision)=>{try{const r=await m.importLocalScenePortableFile({raw:file(entries),expectedRevision:revision});return {ok:true,revision:r.revision,backup:r.backup};}catch(e){return {ok:false,error:e.message};}}};
  });
 }
 await Promise.all(pages.map(setup));
 const p=pages[0], other=pages[1];
 // Empty database: the historical false accept plus new mixed-file and coercion inputs.
 const empty=await p.evaluate(async()=>{
  const {m,entry,file}=qa;let opens=0;const factory={open(...args){opens++;return indexedDB.open(...args);}};
  const badLayers=[['furniture'],[['building']],['landscaping',null],{toString:'furniture'},'furniture\u0000','landscaping\u200b',false,17];
  const negatives=[];
  for(const layer of badLayers){const e=entry(10);e.artifact.objects[0].layer=layer;negatives.push(file([entry(11),e,entry(12)]));}
  for(const [key,value] of [['localX',[0]],['orientation','0'],['footprint',[{x:0,y:'0'}]],['dependencyIds',[['o0']]]]){const e=entry(10);e.artifact.objects[0][key]=value;negatives.push(file([entry(11),e]));}
  const result=[];
  for(const raw of negatives){let parser='ACCEPTED',imported='ACCEPTED';try{m.parseLocalScenePortableFile(raw);}catch(e){parser=e.message;}
   try{await m.importLocalScenePortableFile({factory,raw,expectedRevision:0});}catch(e){imported=e.message;}result.push({parser,imported});}
  return {opens,databases:await indexedDB.databases(),result};
 });
 assert.equal(empty.opens,0);assert.ok(!empty.databases.some(x=>x.name==='dreamwishwand:wep:scene-presets:local:v1'));assert.equal(empty.result.length,12);assert.ok(empty.result.every(x=>x.parser!=='ACCEPTED'&&x.imported!=='ACCEPTED'),JSON.stringify(empty));
 // Real commits to rev2, then reproduce the precise historical rev2->3 input.
 const initial=await p.evaluate(async()=>{const {entry,run,raw}=qa;const a=await run([entry(1)],0);const b=await run([entry(2)],1);return {a,b,row:await raw()};});
 assert.equal(initial.a.ok,true);assert.equal(initial.b.ok,true);assert.equal(initial.row.revision,2);assert.equal(initial.row.backupRevision,1);
 const populated=await other.evaluate(async()=>{
  const {m,entry,file,raw}=qa;const before=await raw();let opens=0;const factory={open(...args){opens++;return indexedDB.open(...args);}};
  const cases=[['furniture'],[['building']],['landscaping',null],{toString:'furniture'},'furniture\u0000','landscaping\u200b'];
  const errors=[];
  for(let i=0;i<cases.length;i++){const e=entry(7);e.artifact.objects[0].layer=cases[i];const input=file(i===0?[e]:[entry(8),e,entry(9)]);let parser='ACCEPTED',imported='ACCEPTED';try{m.parseLocalScenePortableFile(input);}catch(e){parser=e.message;}
   try{await m.importLocalScenePortableFile({factory,raw:input,expectedRevision:2});}catch(e){imported=e.message;}errors.push({parser,imported});}
  return {before,after:await raw(),opens,errors};
 });
 assert.equal(populated.opens,0);assert.deepEqual(populated.before,initial.row);assert.deepEqual(populated.after,initial.row);assert.ok(populated.errors.every(x=>x.parser==='WEP_LOCAL_SCENE_PORTABLE_OBJECT_INVALID'&&x.imported===x.parser));
 console.log('ACT539_CAUSAL_REPLAY_REV2_UNCHANGED',JSON.stringify({parser:populated.errors[0].parser,imported:populated.errors[0].imported,revisionBefore:populated.before.revision,revisionAfter:populated.after.revision,openCount:populated.opens}));
 // Three valid primitive enums in a single import, independently reopen/export.
 const valid=await p.evaluate(async()=>{const {m,entry,run,raw}=qa;const entries=['furniture','building','landscaping'].map((layer,i)=>{const e=entry(20+i);e.artifact.objects[0].layer=layer;return e;});const result=await run(entries,2);const row=await raw();const reopened=await m.reopenLocalScenes();const exported=await m.exportLocalScenePortableFile({expectedRevision:3});return {result,row,reopened,exported,entries};});
 assert.equal(valid.result.ok,true);assert.equal(valid.row.revision,3);assert.equal(valid.row.backup,initial.row.primary);assert.equal(valid.row.backupRevision,2);assert.equal(valid.reopened.primary,valid.row.primary);assert.deepEqual(JSON.parse(valid.exported).entries.slice(-3),valid.entries);
 // Historic legacy row is readable but cannot be exported as a typed portable file.
 // Inject a synthetic legacy record to prove whole-file refusal, never normalization.
 const legacy=await p.evaluate(async()=>{const {m,put,raw}=qa;const before=await raw();const doc=JSON.parse(before.primary);doc.entries[1].artifact.objects[0].layer=['furniture'];const seeded={...before,primary:JSON.stringify(doc)};await put(seeded);let error='ACCEPTED';try{await m.exportLocalScenePortableFile({expectedRevision:3});}catch(e){error=e.message;}const after=await raw();return {seeded,after,error};});
 assert.equal(legacy.error,'WEP_LOCAL_SCENE_PORTABLE_OBJECT_INVALID');assert.deepEqual(legacy.after,legacy.seeded);
 console.log('ACT539_REAL_IDB_STRICT_LAYER_3POS_12EMPTY_6POPULATED_LEGACY_DENIAL_PASS');
} finally {await browser.close();}
