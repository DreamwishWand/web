// 04 QR-W independent WEP recovery journal partial localStorage transaction L2.
// All storage and drafts are synthetic, never original encrypted Save bytes.
// Fail-closed if rollback cannot be proven by original raw exact readback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 WORLD_EDITOR_RECOVERY_INDEX_KEY,saveRecoveryRoute,
 createRecoveryRecord,getRecoveryRecord,listRecoveryRecords
} from '../src/lib/wep/world-editor-recovery.ts';

const a='a'.repeat(64),b='b'.repeat(64);
const recordKey=f=>'dreamwishwand:world-editor:recovery:v1:'+f;
const target={platform:'switch',gameVersion:'1.25.0',profileSchemaVersion:624};
const time='2026-11-19T03:00:00.000Z';
const input=more=>({sourceFingerprint:a,target,routeKey:'area-new',
 sessionSnapshot:{document:{objects:[{id:998}]},undoStack:[],redoStack:[]},
 now:time,...more});
const prev=()=>createRecoveryRecord({...input({routeKey:'area-old',
 now:'2026-11-18T02:00:00.000Z',
 sessionSnapshot:{document:{objects:[{id:17}]},undoStack:[],redoStack:[]}})});
const baseline=()=>{
 const row=JSON.stringify(prev());
 const originalIndex='[\n  "'+b+'",\n  "'+a+'"\n]';
 return [[recordKey(a),row],[WORLD_EDITOR_RECOVERY_INDEX_KEY,originalIndex],[recordKey(b),'opaque untouched other fingerprint'],['other-app-key','<private>']];
};
const asMap=()=>new Map(baseline());
const snapshot=m=>[...m.entries()];
function injectFailure(store,{failKey,phase='after',corruptRollbackKey=null,
 throwRollbackKey=null,unreadableAfterFailureKey=null}={}){
 const data=store,events=[];let failed=false;
 const api={
  getItem(key){
   events.push('get:'+key);
   if(failed&&key===unreadableAfterFailureKey)throw Error('READBACK_DENIED');
   return data.has(key)?data.get(key):null;
  },
  setItem(key,value){
   const next=String(value);events.push('set:'+key);
   if(key===failKey&&!failed){
    failed=true;
    if(phase==='after')data.set(key,next);
    throw Error('QUOTA_FAULT');
   }
   if(failed&&key===throwRollbackKey)throw Error('ROLLBACK_WRITE_DENIED');
   if(failed&&key===corruptRollbackKey){data.set(key,'[]');return;}
   data.set(key,next);
  },
  removeItem(key){
   events.push('remove:'+key);
   if(failed&&key===throwRollbackKey)throw Error('ROLLBACK_REMOVE_DENIED');
   data.delete(key);
  }
 };
 return {api,events,data};
}
test('original raw whitespace, unrelated keys, existing snapshot stay byte-equal after first or second write failure',()=>{
 for(const key of [recordKey(a),WORLD_EDITOR_RECOVERY_INDEX_KEY])
 for(const phase of ['before','after']){
  const data=asMap(),original=snapshot(data);
  const f=injectFailure(data,{failKey:key,phase});
  assert.throws(()=>saveRecoveryRoute(f.api,input()),/QUOTA_FAULT/);
  assert.deepEqual(snapshot(data),original,'raw localStorage must match exactly, not JSON normalization');
  assert.equal(getRecoveryRecord(f.api,a).activeRouteKey,'area-old');
  assert.deepEqual(listRecoveryRecords(f.api).map(x=>x.sourceFingerprint),[a]);
  assert.equal(data.get('other-app-key'),'<private>');
 }
});
test('a partial first-ever checkpoint never fabricates an entry or overwrites unrelated storage on second-write fault',()=>{
 for(const phase of ['before','after']){
  const data=new Map([['other-app-key','opaque'],[WORLD_EDITOR_RECOVERY_INDEX_KEY,'[]']]);
  const original=snapshot(data);
  const f=injectFailure(data,{failKey:WORLD_EDITOR_RECOVERY_INDEX_KEY,phase});
  assert.throws(()=>saveRecoveryRoute(f.api,input()),/QUOTA_FAULT/);
  assert.deepEqual(snapshot(data).sort(),original.sort());
  assert.equal(getRecoveryRecord(f.api,a),null);
  assert.deepEqual(listRecoveryRecords(f.api),[]);
  assert.equal(data.has(recordKey(a)),false);
 }
});
test('index rollback that falsely reports success but corrupts raw bytes is explicitly UNVERIFIED',()=>{
 const data=asMap(),orig=snapshot(data),f=injectFailure(data,{
  failKey:WORLD_EDITOR_RECOVERY_INDEX_KEY,phase:'after',
  corruptRollbackKey:WORLD_EDITOR_RECOVERY_INDEX_KEY
 });
 let error;
 try{saveRecoveryRoute(f.api,input())}catch(e){error=e}
 assert.equal(error?.message,'WEP_RECOVERY_ROLLBACK_UNVERIFIED');
 assert.equal(error.cause?.message,'QUOTA_FAULT');
 assert.notDeepEqual(snapshot(data),orig,'a broken compensator is not successful rollback');
 assert.equal(data.get(recordKey(a)),orig[0][1],'unrelated original record remains byte-equal');
});
test('unreadable rollback verification and denied record restoration produce fail-closed error with original cause',()=>{
 for(const failure of [
  {unreadableAfterFailureKey:WORLD_EDITOR_RECOVERY_INDEX_KEY},
  {throwRollbackKey:recordKey(a)}
 ]){
  const data=asMap(),f=injectFailure(data,{
   failKey:WORLD_EDITOR_RECOVERY_INDEX_KEY,phase:'after',...failure
  });
  let error;
  try{saveRecoveryRoute(f.api,input())}catch(e){error=e}
  assert.equal(error?.message,'WEP_RECOVERY_ROLLBACK_UNVERIFIED');
  assert.equal(error.cause?.message,'QUOTA_FAULT');
  assert.equal(data.get('other-app-key'),'<private>');
 }
});
test('malformed/duplicate index or corrupted old record prevents checkpoint BEFORE any storage write',()=>{
 for(const [label,mutate] of [
  ['malformed index',m=>m.set(WORLD_EDITOR_RECOVERY_INDEX_KEY,'{')],
  ['duplicate index',m=>m.set(WORLD_EDITOR_RECOVERY_INDEX_KEY,JSON.stringify([a,a]))],
  ['unbounded index',m=>m.set(WORLD_EDITOR_RECOVERY_INDEX_KEY,JSON.stringify(Array(21).fill(b)))],
  ['existing corrupt',m=>m.set(recordKey(a),'{bad json')]
 ]){
  const data=asMap();mutate(data);
  const f=injectFailure(data,{});
  assert.throws(()=>saveRecoveryRoute(f.api,input()),/WEP_RECOVERY_/ ,label);
  assert.equal(f.events.some(x=>x.startsWith('set:')||x.startsWith('remove:')),false,label);
  assert.equal(data.get('other-app-key'),'<private>');
 }
});
test('success keeps both confirmed source route snapshots while all Save and Native Apply permissions stay false',()=>{
 const data=asMap(),f=injectFailure(data,{});
 const receipt=saveRecoveryRoute(f.api,input());
 assert.equal(receipt.activeRouteKey,'area-new');
 assert.equal(receipt.routes['area-old'].session.document.objects[0].id,17);
 assert.equal(receipt.routes['area-new'].session.document.objects[0].id,998);
 for(const name of ['persistentWriteAuthorized','WORLD_PERSISTENT_WRITE_V125',
  'PERSISTENT_WRITE','productApplyAuthorized','directSourceReplacementAuthorized'])
  assert.equal(receipt[name],false);
 const read=getRecoveryRecord(f.api,a);
 assert.equal(read.activeRouteKey,'area-new');
 assert.equal(data.get(recordKey(b)),'opaque untouched other fingerprint');
 assert.equal(data.get('other-app-key'),'<private>');
 assert.equal(f.events.filter(x=>x.startsWith('set:')).length,2);
});
