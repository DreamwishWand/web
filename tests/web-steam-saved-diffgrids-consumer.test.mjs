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

// OFF is not evidence of a failed deployment signature or a runtime cause.
// Keep all eight approved status strings explicit; no English fallback.
test('unavailable copy states prerequisites and no local read while unavailable in all eight locales',()=>{
 const expected={
  "en": "Local save reading is currently unavailable. Explicit enablement and successful runtime verification are required. No local save is read while this feature is unavailable.",
  "fr": "La lecture locale des sauvegardes est actuellement indisponible. Une activation explicite et une vérification réussie à l’exécution sont nécessaires. Aucune sauvegarde locale n’est lue tant que cette fonction est indisponible.",
  "it": "La lettura locale dei salvataggi non è al momento disponibile. Sono necessarie l’attivazione esplicita e la verifica riuscita in fase di esecuzione. Finché la funzione non è disponibile, non viene letto alcun salvataggio locale.",
  "de": "Das lokale Lesen von Spielständen ist derzeit nicht verfügbar. Eine ausdrückliche Aktivierung und eine erfolgreiche Laufzeitprüfung sind erforderlich. Solange diese Funktion nicht verfügbar ist, wird kein lokaler Spielstand gelesen.",
  "es-ES": "La lectura local de partidas guardadas no está disponible en este momento. Se requieren una activación explícita y una verificación correcta en tiempo de ejecución. Mientras esta función no esté disponible, no se lee ninguna partida guardada local.",
  "ja": "現在、ローカルセーブの読み取りは利用できません。明示的な有効化と実行時検証の成功が必要です。この機能を利用できない間は、ローカルセーブを読み取りません。",
  "zh-CN": "目前无法在本地读取存档。需要明确启用此功能并通过运行时验证。此功能不可用时，不会读取本地存档。",
  "pt-BR": "A leitura local de dados salvos não está disponível no momento. São necessárias a ativação explícita e a verificação bem-sucedida em tempo de execução. Nenhum dado salvo local é lido enquanto este recurso está indisponível."
};
 assert.deepEqual(Object.keys(expected),STEAM_DIFFGRIDS_LOCALES);
 for(const locale of STEAM_DIFFGRIDS_LOCALES){
   assert.equal(savedDiffGridsCopy(locale).unavailable,expected[locale],locale);
 }
 assert.equal(savedDiffGridsCopy('unsupported').unavailable,expected.en);
});

test('preformal reader route label is localized in all eight locales',()=>{
 const expected={"en":"Steam 1.25.3 · Pre-release read-only test","fr":"Steam 1.25.3 · Test en lecture seule avant publication","it":"Steam 1.25.3 · Test in sola lettura prima del rilascio","de":"Steam 1.25.3 · Schreibgeschützter Vorabtest","es-ES":"Steam 1.25.3 · Prueba de solo lectura previa al lanzamiento","ja":"Steam 1.25.3 · 正式リリース前の読み取り専用テスト","zh-CN":"Steam 1.25.3 · 正式发布前只读测试","pt-BR":"Steam 1.25.3 · Teste somente leitura antes do lançamento"};
 for(const locale of STEAM_DIFFGRIDS_LOCALES)assert.equal(savedDiffGridsCopy(locale).preformal,expected[locale]);
});

// Entry display only: no change to the typed client or Worker authority.
import {readFileSync} from 'node:fs';
test('dedicated Reader starts expanded; optional Timing panel remains collapsed',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const panel=read('src/lib/wep/SteamSavedDiffGridsReadonly.svelte');
 assert.match(panel,/<details open=\{preformal\} class="diffgrids-readonly"/);
 assert.match(panel,/export let preformal=false;/);
 assert.match(panel,/if\(!preformal\|\|location\.pathname!==base\+'\/editor\/steam-reader\/'\)return;/);
 assert.match(read('src/routes/editor/steam-reader/+page.svelte'),/<SteamSavedDiffGridsReadonly preformal=\{true\}/);
 assert.match(read('src/routes/editor/timing/+page.svelte'),/<SteamSavedDiffGridsReadonly \/>/);
});

import {compareOriginalBackupBytes,originalBackupFileName} from '../src/lib/ddv/core/save/local-original-backup.mjs';
test('shared encrypted original byte comparison: exact, same handle, mismatch, forged methods and revoke',async()=>{
 const bytes=new Uint8Array(1024*1024+13).fill(33),a=new Blob([bytes]),b=new Blob([bytes]);
 assert.equal(await compareOriginalBackupBytes(a,b,()=>true,2*1024*1024),bytes.length);
 for(const limit of [undefined,0,1.5,128*1024*1024+1])await assert.rejects(compareOriginalBackupBytes(a,b,()=>true,limit),/NOT_DISTINCT_BOUNDED/);
 await assert.rejects(compareOriginalBackupBytes(a,a,()=>true,2*1024*1024),/NOT_DISTINCT_BOUNDED/);
 const bad=new Blob([new Uint8Array(bytes.length).fill(34)]);bad.slice=()=>b;bad.arrayBuffer=()=>b.arrayBuffer();
 await assert.rejects(compareOriginalBackupBytes(a,bad,()=>true,2*1024*1024),/BYTES_DIFFER/);
 await assert.rejects(compareOriginalBackupBytes(a,new Blob([bytes.slice(1)]),()=>true,2*1024*1024),/NOT_DISTINCT_BOUNDED/);
 let calls=0;await assert.rejects(compareOriginalBackupBytes(a,b,()=>++calls<3,2*1024*1024),/SESSION_REVOKED/);
 for(const locale of STEAM_DIFFGRIDS_LOCALES)for(const k of ['backupDownload','backupCandidate','backupHint','backupRequested','backupChecking','backupMatched','backupRejected'])assert.ok(savedDiffGridsCopy(locale)[k]);
});

test('original backup filename preserves safe ASCII basename and distinct suffix',()=>{
 assert.equal(originalBackupFileName('synthetic626-diffgrids.p1g'),'synthetic626-diffgrids.p1g.original-backup.p1g');
 assert.equal(originalBackupFileName('Profile_01.P1G'),'Profile_01.P1G.original-backup.p1g');
 assert.equal(originalBackupFileName(''),'profile.p1g.original-backup.p1g');
 assert.equal(originalBackupFileName('a/b\\c:\n名.p1g'),'a_b_c___.p1g.original-backup.p1g');
 assert.doesNotMatch(originalBackupFileName('a/b\\c:\n名.p1g'),/[\/\\:\n]/);
});
