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
 const start=await p.evaluate(async()=>{const {m,entry,file,raw,run}=qa;let opens=0;const factory={open(){opens++;throw Error('OPEN_FORBIDDEN')}};
  const e=entry(1), good=file([e]);
  const bad=[good.replace('"version":1','"version":1,"version":1'),good.replace('"title":"QA 1"','"title":"QA 1","title":"QA 1"'), '\uFEFF'+good,good+'\n',file(Array.from({length:101},(_,i)=>entry(i+1)))];
  for(const x of bad){try{await m.importLocalScenePortableFile({factory,raw:x,expectedRevision:0});throw Error('FALSE_ACCEPT')}catch(e){if(e.message==='FALSE_ACCEPT'||e.message==='OPEN_FORBIDDEN')throw e;}}
  const before=await indexedDB.databases();const result=await run([entry(1)],0);return {opens,before,result,row:await raw()};
 });
 assert.equal(start.opens,0);assert.ok(!start.before.some(x=>x.name==='dreamwishwand:wep:scene-presets:local:v1'));assert.equal(start.result.ok,true);assert.equal(start.row.revision,1);
 const race=await Promise.all([p.evaluate(()=>qa.run([qa.entry(2)],1)),other.evaluate(()=>qa.run([qa.entry(3)],1))]);
 assert.equal(race.filter(x=>x.ok).length,1,JSON.stringify(race));assert.equal(race.filter(x=>!x.ok&&/STALE_REVISION/.test(x.error)).length,1,JSON.stringify(race));
 const row=await p.evaluate(()=>qa.raw());assert.equal(row.revision,2);assert.equal(row.backup,start.row.primary);assert.equal(row.backupRevision,1);assert.equal(JSON.parse(row.primary).entries.length,2);
 const winner=JSON.parse(row.primary).entries[1].id;
 const rest=await p.evaluate(async({winner,row})=>{const {m,entry,raw,run,put}=qa;const replay=await run([entry(Number(winner.slice(-12)))],2);const collision=await run([entry(4),entry(1)],2);const after=await raw();
  const stale=await run([entry(5)],1);const staleAfter=await raw();
  const corrupt={...row,backup:'{broken'};await put(corrupt);const bad=await run([entry(6)],2);const badAfter=await raw();await put(row);
  const over=await run(Array.from({length:99},(_,i)=>entry(i+100)),2);const overAfter=await raw();
  const exported=await m.exportLocalScenePortableFile({expectedRevision:2});
  return {replay,collision,after,stale,staleAfter,bad,badAfter,corrupt,over,overAfter,exported};
 },{winner,row});
 assert.match(rest.replay.error,/PORTABLE_ID_COLLISION/);assert.match(rest.collision.error,/PORTABLE_ID_COLLISION/);assert.deepEqual(rest.after,row);assert.match(rest.stale.error,/STALE_REVISION/);assert.deepEqual(rest.staleAfter,row);assert.match(rest.bad.error,/DOCUMENT_INVALID/);assert.deepEqual(rest.badAfter,rest.corrupt);assert.match(rest.over.error,/LIMIT_REACHED/);assert.deepEqual(rest.overAfter,row);
 assert.deepEqual(JSON.parse(rest.exported).entries,JSON.parse(row.primary).entries);
 console.log('ACT523_REAL_IDB_TWO_TAB_CAS_BACKUP_REOPEN_REPLAY_CORRUPTION_LIMIT_PASS');
 // The new file trust boundary claims exact capture shape. String coercion
 // in the inherited readonly validator must not permit array-valued layer.
 const type=await p.evaluate(async()=>{const {m,entry,file,raw,run}=qa;const e=entry(7);e.artifact.objects[0].layer=['furniture'];const before=await raw();let parser;try{m.parseLocalScenePortableFile(file([e]));parser='ACCEPTED'}catch(err){parser=err.message;}
 const result=await run([e],2);const after=await raw();return {parser,result,before,after,storedLayer:JSON.parse(after.primary).entries.find(x=>x.id===e.id)?.artifact.objects[0].layer};
 });
 console.log('ACT523_LAYER_TYPE_COUNTEREXAMPLE',JSON.stringify({parser:type.parser,result:type.result.ok,revisionBefore:type.before.revision,revisionAfter:type.after.revision,storedLayer:type.storedLayer}));
 assert.notEqual(type.parser,'ACCEPTED','canonical file must reject array-valued layer');
 assert.equal(type.result.ok,false,'malformed layer must not commit');assert.deepEqual(type.after,type.before);
} finally {await browser.close();}
