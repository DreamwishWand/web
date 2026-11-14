import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_EDITOR_RECOVERY_INDEX_KEY as indexKey,
  createRecoveryRecord,
  saveRecoveryRoute,
  getRecoveryRecord,
  listRecoveryRecords
} from '../src/lib/wep/world-editor-recovery.ts';

const a='a'.repeat(64),b='b'.repeat(64);
const key=f=>'dreamwishwand:world-editor:recovery:v1:'+f;
const target={platform:'switch',gameVersion:'1.25.0',profileSchemaVersion:624};
const now='2026-11-14T00:00:00Z';
const input=(extra={})=>({sourceFingerprint:a,target,routeKey:'area-1',sessionSnapshot:{document:{objects:[]},undoStack:[],redoStack:[]},now,...extra});
const record=(extra={})=>createRecoveryRecord(input(extra));
function store(initial=[]){
 const data=new Map(initial),writes=[];
 const storage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{writes.push([k,v]);data.set(k,v);},removeItem:k=>{writes.push([k,null]);data.delete(k);}};
 return {storage,data,writes};
}
function unchanged(s,before){assert.deepEqual([...s.data],before);assert.deepEqual(s.writes,[]);}

test('checkpoint refuses corrupt existing same-fingerprint records without replacing raw data or index',()=>{
 for(const raw of ['', '{', 'null', '{}', JSON.stringify({...record(),persistentWriteAuthorized:true}),JSON.stringify({...record(),routes:{}})]){
  const s=store([[key(a),raw],[indexKey,JSON.stringify([a])],[key(b),'unrelated raw']]);
  const before=[...s.data];
  assert.throws(()=>saveRecoveryRoute(s.storage,input()),/WEP_RECOVERY_EXISTING_RECORD_INVALID/);
  unchanged(s,before);
 }
});
test('checkpoint refuses wrong embedded fingerprint or target under the same key before either write',()=>{
 for(const wrong of [record({sourceFingerprint:b}),record({target:{...target,platform:'steam-windows'}}),record({target:{...target,gameVersion:'1.25.3'}}),record({target:{...target,profileSchemaVersion:626}})]){
  const s=store([[key(a),JSON.stringify(wrong)],[indexKey,JSON.stringify([a])]]);
  const before=[...s.data];
  assert.throws(()=>saveRecoveryRoute(s.storage,input()),/WEP_RECOVERY_EXISTING_TARGET_MISMATCH/);
  unchanged(s,before);
 }
});
test('checkpoint rejects malformed and ambiguous index, even with no current record',()=>{
 for(const raw of ['', '{', 'null','{}', JSON.stringify([a,a]),JSON.stringify([1]),JSON.stringify(['x']),JSON.stringify(Array.from({length:21},(_,i)=>i.toString(16).padStart(64,'0')))]){
  const s=store([[indexKey,raw],[key(b),'unrelated raw']]);const before=[...s.data];
  assert.throws(()=>saveRecoveryRoute(s.storage,input()),/WEP_RECOVERY_INDEX_INVALID/);
  unchanged(s,before);
 }
 const dangling=store([[indexKey,JSON.stringify([a])],[key(b),'unrelated raw']]);
 const before=[...dangling.data];
 assert.throws(()=>saveRecoveryRoute(dangling.storage,input()),/WEP_RECOVERY_INDEX_RECORD_MISSING/);
 unchanged(dangling,before);
});
test('valid checkpoints preserve other routes and other records, including an indexed record and a valid unindexed legacy record',()=>{
 const s=store([[key(b),JSON.stringify(record({sourceFingerprint:b}))],[indexKey,JSON.stringify([b])]]);
 const bRaw=s.data.get(key(b));
 saveRecoveryRoute(s.storage,input());
 const first=getRecoveryRecord(s.storage,a);
 assert.equal(first.activeRouteKey,'area-1');
 const second=saveRecoveryRoute(s.storage,input({routeKey:'area-2',sessionSnapshot:{document:{objects:[{id:1}]},undoStack:[{id:'draft'}],redoStack:[]}}));
 assert.deepEqual(second.routes['area-1'],first.routes['area-1']);
 assert.equal(second.activeRouteKey,'area-2');assert.equal(s.data.get(key(b)),bRaw);
 assert.deepEqual(JSON.parse(s.data.get(indexKey)),[b,a]);
 assert.equal(listRecoveryRecords(s.storage).length,2);
 const orphan=store([[key(a),JSON.stringify(first)]]);
 const result=saveRecoveryRoute(orphan.storage,input({routeKey:'area-2'}));
 assert.deepEqual(result.routes['area-1'],first.routes['area-1']);
 assert.deepEqual(JSON.parse(orphan.data.get(indexKey)),[a]);
});
test('fresh empty storage and valid empty index remain accepted; storage read failure does not write',()=>{
 for(const initial of [[],[[indexKey,'[]']]]){
  const s=store(initial);
  const result=saveRecoveryRoute(s.storage,input());
  assert.deepEqual(getRecoveryRecord(s.storage,a),result);
  assert.equal(s.writes.length,2);
 }
 const s=store([[key(a),JSON.stringify(record())]]);
 const before=[...s.data];
 const denied={...s.storage,getItem:k=>{if(k===indexKey)throw Error('read denied');return s.storage.getItem(k);}};
 assert.throws(()=>saveRecoveryRoute(denied,input()),/read denied/);
 unchanged(s,before);
});

test('checkpoint refuses inherited and reserved recovery routes without replacing original bytes',()=>{
 const good=record();
 const make=(routes,activeRouteKey)=>JSON.stringify({...good,routes,activeRouteKey});
 const snap=routeKey=>({...good.routes['area-1'],routeKey});
 const invalid=[
  make({},'toString'),make({},'constructor'),
  make(Object.fromEntries([['__proto__',snap('__proto__')]]),'__proto__'),
  make(Object.fromEntries([['prototype',snap('prototype')]]),'prototype'),
  make(Object.fromEntries([['hasOwnProperty',snap('hasOwnProperty')]]),'hasOwnProperty'),
  make(null,'area-1'),make([], 'area-1'),make('area-1','area-1'),
  make({'area-1':snap('area-1')},['area-1']),
  make({'area-1':snap('different')},'area-1'),
  make({'area-1':snap('area-1')},'missing'),
  make({'area-1':snap('area-1'),constructor:snap('constructor')},'area-1')
 ];
 for(const raw of invalid){
  const s=store([[key(a),raw],[indexKey,JSON.stringify([a])],[key(b),'other raw']]);
  const before=[...s.data];
  assert.throws(()=>saveRecoveryRoute(s.storage,input()),/WEP_RECOVERY_EXISTING_RECORD_INVALID/);
  unchanged(s,before);
  assert.equal(getRecoveryRecord(s.storage,a),null);
  assert.deepEqual(listRecoveryRecords(s.storage),[]);
 }
 for(const routeKey of ['__proto__','constructor','toString','prototype',['area-1']]){
  const s=store();assert.throws(()=>saveRecoveryRoute(s.storage,input({routeKey})),/WEP_RECOVERY_ROUTE_KEY_REQUIRED/);
  unchanged(s,[]);
 }
 const s=store([[key(a),JSON.stringify(good)],[indexKey,JSON.stringify([a])]]);
 const next=saveRecoveryRoute(s.storage,input({routeKey:'area-2'}));
 assert.deepEqual(next.routes['area-1'],good.routes['area-1']);
 assert.equal(next.activeRouteKey,'area-2');
});
