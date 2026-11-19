import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_EDITOR_RECOVERY_INDEX_KEY,
  createRecoveryRecord,
  saveRecoveryRoute,
  getRecoveryRecord,
  listRecoveryRecords
} from '../src/lib/wep/world-editor-recovery.ts';

const a='a'.repeat(64), b='b'.repeat(64);
const recordKey=f=>'dreamwishwand:world-editor:recovery:v1:'+f;
const target={platform:'switch',gameVersion:'1.25.0',profileSchemaVersion:624};
const now='2026-11-19T00:00:00Z';
const input=(extra={})=>({
  sourceFingerprint:a,target,routeKey:'area-2',
  sessionSnapshot:{document:{objects:[{id:42}]},undoStack:[],redoStack:[]},
  now,...extra
});
const existing=()=>createRecoveryRecord({
  ...input(),routeKey:'area-1',sessionSnapshot:{document:{objects:[{id:1}]},undoStack:[],redoStack:[]},
  now:'2026-11-18T00:00:00Z'
});
function storage(initial,{failKey,phase='before',denyRollbackKey=null}={}) {
  const data=new Map(initial),before=[...data],writes=[];
  let failed=false;
  const api={
    getItem:key=>data.has(key)?data.get(key):null,
    setItem(key,value){
      const v=String(value);
      writes.push([key,v]);
      if(key===failKey&&!failed){
        failed=true;
        if(phase==='after')data.set(key,v);
        throw Error('injected quota');
      }
      if(key===denyRollbackKey&&failed)throw Error('rollback denied');
      data.set(key,v);
    },
    removeItem(key){
      if(key===denyRollbackKey&&failed)throw Error('rollback denied');
      data.delete(key);
    }
  };
  return {api,data,before,writes};
}

test('record first-write or index second-write errors restore exact existing checkpoint bytes',()=>{
  for(const failKey of [recordKey(a),WORLD_EDITOR_RECOVERY_INDEX_KEY]){
    for(const phase of ['before','after']){
      const old=JSON.stringify(existing());
      const initial=[[recordKey(a),old],[WORLD_EDITOR_RECOVERY_INDEX_KEY,JSON.stringify([b,a])],[recordKey(b),'unrelated bytes']];
      const s=storage(initial,{failKey,phase});
      assert.throws(()=>saveRecoveryRoute(s.api,input()),/injected quota/,
        'failure must never return a Saved receipt');
      assert.deepEqual([...s.data],s.before,
        'both index and original record must preserve their exact raw bytes');
      assert.equal(s.data.get(recordKey(a)),old);
      assert.equal(s.data.get(recordKey(b)),'unrelated bytes');
      assert.equal(getRecoveryRecord(s.api,a).activeRouteKey,'area-1');
    }
  }
});

test('new checkpoint fails without an orphan index or fabricated saved entry',()=>{
  for(const indexPresent of [false,true]){
    for(const phase of ['before','after']){
      const initial=indexPresent?[[WORLD_EDITOR_RECOVERY_INDEX_KEY,'[]']]:[];
      const s=storage(initial,{failKey:WORLD_EDITOR_RECOVERY_INDEX_KEY,phase});
      assert.throws(()=>saveRecoveryRoute(s.api,input()),/injected quota/);
      assert.deepEqual([...s.data],s.before);
      assert.equal(getRecoveryRecord(s.api,a),null);
      assert.deepEqual(listRecoveryRecords(s.api),[]);
    }
  }
});

test('if compensation itself is denied, return a distinct fail-closed error',()=>{
  const s=storage([[WORLD_EDITOR_RECOVERY_INDEX_KEY,'[]']],{
    failKey:WORLD_EDITOR_RECOVERY_INDEX_KEY,phase:'after',denyRollbackKey:recordKey(a)
  });
  assert.throws(()=>saveRecoveryRoute(s.api,input()),/WEP_RECOVERY_ROLLBACK_UNVERIFIED/);
  assert.equal(s.data.get(recordKey(a))!==undefined,true);
  // A partial storage state is not presented as successful; no Save authority.
});

test('successful checkpoint still performs normal two-key writes and preserves prior snapshot',()=>{
  const old=JSON.stringify(existing());
  const s=storage([[recordKey(a),old],[WORLD_EDITOR_RECOVERY_INDEX_KEY,JSON.stringify([a])]]);
  const receipt=saveRecoveryRoute(s.api,input());
  assert.equal(receipt.activeRouteKey,'area-2');
  assert.equal(receipt.routes['area-1'].session.document.objects[0].id,1);
  assert.equal(getRecoveryRecord(s.api,a).activeRouteKey,'area-2');
  assert.equal(s.writes.length,2);
});
