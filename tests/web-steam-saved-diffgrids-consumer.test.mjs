import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavedDiffGridsUiClient,READONLY_DIFFGRIDS_UI_CONTRACT,
 STEAM_FULL_VERSION} from '../src/lib/wep/steam-saved-diffgrids-ui-client.mjs';
import {STEAM_DIFFGRIDS_LOCALES,savedDiffGridsCopy}
 from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';

const encrypted=new Blob([new Uint8Array(16)]);
const sha='a'.repeat(64);
const safeOpen=()=>({
 contract:READONLY_DIFFGRIDS_UI_CONTRACT,selection:1,recordCount:2,
 maxRecordsPerPage:8,nextPageIndex:0,sourceShaMatched:true,
 originalSizeMatched:true,externallyObservedSteamFullVersion:true,
 physicalBuildCryptographicallyVerified:false,fullDocumentValidated:true,
 externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
 allNativeReferencesVerified:false,productReadAccepted:false,
 nativeV3Verified:false,writerAuthorized:false,applyAuthorized:false,
 cloudUploadPerformed:false,originalFileModified:false
});
const grid=()=>({
 gridId:0,defaultLayoutGridId:0,defaultGridHashCode:-3,
 defaultGridDataHashCode:4,modifiedObjectCount:1,removedObjectCount:1,
 modifiedRemovedSameIdPairs:1,externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
 nativeEffectiveGridVerified:false
});
const safePage=()=>({
 contract:READONLY_DIFFGRIDS_UI_CONTRACT,selection:1,pageIndex:0,
 records:[grid(),{...grid(),gridId:1}],nextPageIndex:null,
 externalLayoutStatus:'UNRESOLVED_EXTERNAL_LAYOUT',
 allNativeReferencesVerified:false,productReadAccepted:false,
 nativeV3Verified:false,writerAuthorized:false,applyAuthorized:false,
 cloudUploadPerformed:false
});
function setup(handler=()=>null){
 let messages=[];
 let worker;
 const create=()=>{worker={
   onmessage:null,onerror:null,terminated:false,
   postMessage(msg){
     messages.push(msg);
     const summary=handler(msg)??(
       msg.kind==='OPEN_LOCAL_STORED_DIFFGRIDS'?safeOpen():
       msg.kind==='READ_LOCAL_STORED_DIFFGRIDS_NEXT'?safePage():
       {closed:true,writerAuthorized:false}
     );
     queueMicrotask(()=>this.onmessage?.({data:{requestId:msg.requestId,
       ok:true,summary}}));
   },
   terminate(){this.terminated=true}
 };
 queueMicrotask(()=>worker.onmessage?.({data:{
   kind:'DIFFGRIDS_RUNTIME_READY',ready:true,writerAuthorized:false}}));
 return worker;};
 const client=createSavedDiffGridsUiClient(create);
 let last;
 client.start(state=>{last=state});
 return {client,messages,getWorker:()=>worker,getLast:()=>last};
}
const flush=()=>new Promise(r=>setImmediate(r));

test('all eight locales have nonempty independent Grid and safety copy',()=>{
 assert.deepEqual(STEAM_DIFFGRIDS_LOCALES,
   ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
 for(const locale of STEAM_DIFFGRIDS_LOCALES){
   const c=savedDiffGridsCopy(locale);
   for(const key of ['title','gridId','modified','removed','overlap',
      'layout','unresolved','safety','open','close','unavailable','error']){
     assert.equal(typeof c[key],'string');
     assert.ok(c[key].length>=2);
   }
 }
 assert.equal(savedDiffGridsCopy('unsupported').title,savedDiffGridsCopy('en').title);
});
test('manual-only open and bounded page project only safe fields',async()=>{
 const c=setup();await flush();
 assert.equal(c.getLast().ready,true);
 assert.equal(c.messages.length,0,'no automatic file read');
 await assert.rejects(()=>c.client.open(encrypted,sha,false),/FAILED_CLOSED/);
 assert.equal(c.messages.length,0);
 const receipt=await c.client.open(encrypted,sha,true);
 assert.equal(receipt.recordCount,2);
 assert.equal(c.messages[0].kind,'OPEN_LOCAL_STORED_DIFFGRIDS');
 assert.equal(c.messages[0].attestation.fullVersion,STEAM_FULL_VERSION);
 assert.equal(c.messages[0].attestation.observedOutsideSave,true);
 const page=await c.client.readNext();
 assert.equal(page.records.length,2);
 assert.equal(page.records[0].gridId,'0','GridID0 is literal, not legality');
 assert.deepEqual(Object.keys(page.records[0]).sort(),[
   'gridId','modifiedObjectCount','removedObjectCount',
   'modifiedRemovedSameIdPairs','externalLayoutStatus'].sort());
 assert.equal(page.hasNext,false);
 await assert.rejects(()=>c.client.readNext(),/FAILED_CLOSED/);
 await c.client.close();
 assert.equal(c.client.getState().hasSession,false);
 c.client.dispose();assert.equal(c.getWorker().terminated,true);
});
test('forged authority and raw JSON response fail closed',async()=>{
 for(const mutate of [
   r=>({...r,productReadAccepted:true}),
   r=>({...r,sessionId:'b'.repeat(32)}),
   r=>({...r,records:[{...grid(),rawJson:'{"secret":"leak"}'},grid()]})
 ]){
   const c=setup(msg=>{
     if(msg.kind==='READ_LOCAL_STORED_DIFFGRIDS_NEXT')return mutate(safePage());
     return null;
   });
   await flush();await c.client.open(encrypted,sha,true);
   await assert.rejects(()=>c.client.readNext(),/FAILED_CLOSED/);
   assert.equal(c.client.getState().hasSession,false);
   c.client.dispose();
 }
});
test('invalid Source, worker unavailable and after Close reject without file transfer',async()=>{
 const c=setup();await flush();
 await assert.rejects(()=>c.client.open(encrypted,'not-an-original-sha',true),/FAILED_CLOSED/);
 assert.equal(c.messages.length,0);
 c.client.dispose();
 await assert.rejects(()=>c.client.open(encrypted,sha,true),/FAILED_CLOSED/);
 const d=createSavedDiffGridsUiClient(()=>({
   onmessage:null,onerror:null,terminate(){},
   postMessage(){throw Error('MUST_NOT_POST')}
 }));
 d.start(()=>{});
 await assert.rejects(()=>d.open(encrypted,sha,true),/FAILED_CLOSED/);
 d.dispose();
});
