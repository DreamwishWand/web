import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 BAMBOO_CONSUMER_CONTRACT,BAMBOO_READ_KIND,BAMBOO_RESULT_KIND,
 BAMBOO_READ_TARGET_ITEM_ID,projectBambooReadOnlyResult,
 exactBambooRequest,exactBambooUiResult
} from '../src/lib/wep/steam-bamboo-readonly-consumer.mjs';
import {PROTECTED_BAMBOO40700007_READONLY_ANCHOR} from '../src/lib/ddv/core/save/product-steam626-bamboo-readonly-anchor.mjs';
const source=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const route=source('src/routes/editor/bamboo/steam/read/+page.svelte');
const worker=source('src/lib/wep/steam-bamboo-readonly.consumer.worker.mjs');
const off=source('src/routes/editor/bamboo/steam/+page.svelte');

const genuine=()=>({itemId:40700007,gridId:7,x:294,y:0,oldStock:9140,
 nextGridObjectId:15949,readOnly:true,productReadAccepted:false,
 writerAuthorized:false,stageAuthorized:false,editedCopyAuthorized:false,operationOn:false});
test('Bamboo UI receives only exact sanitized Rust Item40700007 ReadDomain, not secrets',()=>{
 const d=projectBambooReadOnlyResult(genuine());
 assert.deepEqual(Object.keys(d).sort(),[
  'itemId','gridId','x','y','oldStock','nextGridObjectId','readOnly',
  'productReadAccepted','writerAuthorized','stageAuthorized','editedCopyAuthorized','operationOn'
 ].sort());
 assert.deepEqual([d.oldStock,d.nextGridObjectId],[9140,15949]);
 assert.equal(Object.isFrozen(d),true);
 assert.equal(BAMBOO_READ_TARGET_ITEM_ID,40700007);
 assert.equal(exactBambooUiResult({contract:BAMBOO_CONSUMER_CONTRACT,
  kind:BAMBOO_RESULT_KIND,requestId:1,ok:true,result:genuine()}),true);
 const fromWorker=projectBambooReadOnlyResult(genuine());
 assert.equal(fromWorker.productReadAccepted,false,'fail-closed denial must survive Worker projection');
 assert.deepEqual(projectBambooReadOnlyResult(fromWorker),fromWorker,
  'exact Worker payload must be accepted unchanged on UI validation');
 assert.equal(exactBambooUiResult({contract:BAMBOO_CONSUMER_CONTRACT,
  kind:BAMBOO_RESULT_KIND,requestId:1,ok:true,result:fromWorker}),true,
  'independently emitted Worker result must not fail UI schema validation');
});
test('Forged source, CAS, capability or wrong target fails closed at Worker-to-UI DTO boundary',()=>{
 const bad=[
  {itemId:40700246},{gridId:-1},{x:2**32},{y:NaN},
  {oldStock:-1},{nextGridObjectId:0},{nextGridObjectId:2**32},
  {writerAuthorized:true},{stageAuthorized:true},{editedCopyAuthorized:true},
  {operationOn:true},{readOnly:false},{productReadAccepted:true},
  {sessionId:'a'.repeat(32)},{decodedSha256:'c'.repeat(64)},
  {rootSha256:'b'.repeat(64)},{rawJson:{Profile:'SECRET'}}
 ];
 for(const mutation of bad){
  assert.throws(()=>projectBambooReadOnlyResult({...genuine(),...mutation}),
   /BAMBOO_CONSUMER_RECEIPT_DENIED/);
 }
 assert.equal(exactBambooUiResult({contract:BAMBOO_CONSUMER_CONTRACT,
  kind:BAMBOO_RESULT_KIND,requestId:2,ok:true,result:genuine()}),false);
 assert.equal(exactBambooUiResult({contract:BAMBOO_CONSUMER_CONTRACT,
  kind:BAMBOO_RESULT_KIND,requestId:1,ok:true,result:{...genuine(),writerAuthorized:true}}),false);
});
test('Exact one-shot request rejects caller permission, wrong request ID and unobserved external Build',()=>{
 const mk=()=>({kind:BAMBOO_READ_KIND,requestId:1,file:{},gridId:7,x:294,y:0,externalSteamBuildObserved:true});
 assert.equal(exactBambooRequest(mk()),true);
 for(const mutation of [
  {kind:'STAGE_STEAM626_BAMBOO'},{requestId:2},{externalSteamBuildObserved:false},
  {gridId:2**32},{x:-1},{y:0.5},{writerAuthorized:true},{platform:'switch'}
 ])assert.equal(exactBambooRequest({...mk(),...mutation}),false);
});
test('Public default remains OFF even for forged query/localStorage and direct route, no fallback Engine',()=>{
 assert.equal(PROTECTED_BAMBOO40700007_READONLY_ANCHOR,null);
 assert.match(worker,/await loadProtectedBambooReadonlyWorker\(\)/);
 assert.match(worker,/allowSteam626BambooReadOnlySource:true/);
 assert.match(worker,/createP1gRustWorkerReadOnlyBridge/);
 assert.match(worker,/consumed=true; \/\/ consume BEFORE/);
 assert.match(worker,/encrypted\.fill\(0\)/);
 assert.match(worker,/writerAuthorized:false,stageAuthorized:false,operationOn:false/);
 assert.match(worker,/typeof sealed\.WorkerWasmSource!=='function'/);
 assert.doesNotMatch(worker,/\bfetch\s*\(|\bXMLHttpRequest\b|\bFileReader\b|localStorage|window\.location|semantic-writer-dev/);
 assert.match(route,/BambooWorker from '\$lib\/wep\/steam-bamboo-readonly\.consumer\.worker\.mjs\?worker'/);
 assert.match(route,/data-bamboo-runtime=\{ready\?'signed-readonly':'off'\}/);
 assert.match(route,/\{#if ready&&!used\}/);
 assert.match(route,/typeof File!=='undefined'/);
 assert.match(route,/noindex,nofollow/);
 assert.match(route,/on:submit\|preventDefault=\{readOnce\}/);
 assert.doesNotMatch(route,/\bfetch\s*\(|localStorage|stageScoped|exportEditedCopy|writeSave|setItem\(/);
 assert.match(off,/data-bamboo-runtime="off"/);
 assert.doesNotMatch(off,/<(?:input|form|button|textarea|select)\b/);
});
test('Eight locales, exact Steam target and no false SHA witness are maintained',()=>{
 assert.equal((route.match(/^  (?:en|ja|fr|it|de|'es-ES'|'zh-CN'|'pt-BR'):\[/gm)||[]).length,8);
 assert.match(route,/BAMBOO_READONLY_DISPLAY_FIELDS/);
 assert.match(route,/field==='oldStock'/);
 assert.match(route,/field==='nextGridObjectId'/);
 assert.doesNotMatch(route,/receipt\.(?:rootSha256|gridSha256|sessionId|decodedSha256)/);
});
