import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCollectionExact1Consumer} from '../src/lib/collection/collection-exact1-consumer.mjs';
import {collectionExact1Copy,COLLECTION_EXACT1_LOCALES} from '../src/lib/collection/collection-exact1-copy.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=new Uint8Array(16).fill(1),edited=new Uint8Array(16).fill(2),sha=hash(original),eSha=hash(edited);
const build={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626,externallyConfirmed:true};
const sw={platform:'switch',buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,externallyConfirmed:true};
const target={definitionId:21,groupIndex:0,itemId:40000001,oldValue:false,groupState:'NotComplete',falseCount:3,coreMinted:true,eligibilityVerified:true};
const safety={writerAuthorized:false,originalOverwriteAuthorized:false};
const closedAck=()=>({kind:'CLOSED',ok:true,nativeV3Verified:false,...safety});
const mutation=kind=>({kind,selection:1,choice:0,exactFieldChangedCount:1,...safety});
const adapter=()=>({
 inspectCollectionTargets:async()=>({selection:1,build,originalName:'source.p1g',originalSha256:sha,originalSizeBytes:16,targets:[target],...safety}),
 backupOriginal:async()=>({backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,originalName:'source.p1g',originalSha256:sha,originalSizeBytes:16,backupName:'backup.p1g'}),
 previewCollectionTarget:async(s,i)=>({selection:s,choice:i,oldValue:false,newValue:true,groupState:'NotComplete',remainingFalseCount:2,exactFieldChangedCount:1,...safety}),
 stageCollectionTarget:async(s,i)=>{assert.equal(s,1);assert.equal(i,0);return mutation('STAGED')},
 undo:async()=>mutation('UNDONE'),redo:async()=>mutation('REDONE'),
 exportEditedCopy:async()=>({kind:'EXPORTED',selection:1,editedCopyName:'edited.p1g',editedSha256:eSha,editedSizeBytes:16,backupName:'backup.p1g',editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true,...safety}),
 downloadVerifiedCopy:async(s,w)=>({kind:'VERIFIED_DOWNLOAD',name:w+'.p1g',sha256:w==='backup'?sha:eSha,sizeBytes:16,encryptedBytes:w==='backup'?original:edited}),
 close:async()=>closedAck()
});
const make=a=>createCollectionExact1Consumer(a,{trustedLocalHarness:true});
const ready=async c=>{await c.load();await c.backupOriginal();await c.preview(0)};
test('exact one collection bool UI positive both builds and separate verified downloads',async()=>{
 for(const b of [build,sw]){
  const a=adapter(),inspect=a.inspectCollectionTargets;a.inspectCollectionTargets=async()=>({...await inspect(),build:b});
  const c=make(a);await ready(c);assert.deepEqual(c.snapshot().preview,{choice:0,itemId:target.itemId,oldValue:false,newValue:true,remainingFalseCount:2});
  await c.stage();await c.undo();await assert.rejects(c.exportEditedCopy());await c.redo();await c.exportEditedCopy();
  assert.deepEqual((await c.downloadVerifiedCopy('backup')).encryptedBytes,original);assert.deepEqual((await c.downloadVerifiedCopy('edited')).encryptedBytes,edited);
  await c.close();assert.equal(c.snapshot().phase,'closed');
 }
});
test('unknown build, nonminted target, complete group, final false, duplicates, wrong old denied',async()=>{
 for(const patch of [{oldValue:true},{falseCount:1},{groupState:'Complete'},{coreMinted:false},{eligibilityVerified:false},{falseCount:2}]){
  const a=adapter(),inspect=a.inspectCollectionTargets;a.inspectCollectionTargets=async()=>({...await inspect(),targets:[{...target,...patch}]});
  const c=make(a);await assert.rejects(c.load());assert.equal(c.snapshot().phase,'closed');
 }
 for(const patch of [{build:{...build,buildId:'bad'}},{targets:[target,target]},{writerAuthorized:true}]){
  const a=adapter(),inspect=a.inspectCollectionTargets;a.inspectCollectionTargets=async()=>({...await inspect(),...patch});await assert.rejects(make(a).load());
 }
});
test('backup scope and exact preview/stage/output receipt denial',async()=>{
 for(const [method,patch] of [['backupOriginal',{backupName:'SOURCE.p1g'}],['previewCollectionTarget',{remainingFalseCount:0}],['previewCollectionTarget',{selection:2}],['stageCollectionTarget',{exactFieldChangedCount:2}],['exportEditedCopy',{editedCopyName:'backup.p1g'}],['exportEditedCopy',{freshWorkerReopenVerified:false}],['exportEditedCopy',{writerAuthorized:true}]]){
  const a=adapter(),fn=a[method];a[method]=async(...args)=>({...await fn(...args),...patch});
  const c=make(a);await assert.rejects(async()=>{await ready(c);await c.stage();await c.exportEditedCopy()});assert.equal(c.snapshot().phase,'closed');
 }
});
test('close revokes pending inspection and preview; no stale completion or second session',async()=>{
 for(const phase of ['load','preview']){
  const a=adapter();let release;const barrier=new Promise(r=>release=r);
  const method=phase==='load'?'inspectCollectionTargets':'previewCollectionTarget',fn=a[method];a[method]=async(...args)=>{await barrier;return fn(...args)};
  const c=make(a);if(phase==='preview'){await c.load();await c.backupOriginal()}
  const pending=phase==='load'?c.load():c.preview(0),rejected=assert.rejects(pending);await c.close();release();await rejected;assert.equal(c.snapshot().phase,'closed');
 }
});
test('eight locales have all labels; no gate without explicit trusted harness',()=>{
 assert.equal(COLLECTION_EXACT1_LOCALES.length,8);const keys=Object.keys(collectionExact1Copy('en'));
 for(const l of COLLECTION_EXACT1_LOCALES){assert.deepEqual(Object.keys(collectionExact1Copy(l)),keys);for(const v of Object.values(collectionExact1Copy(l)))assert.ok(typeof v==='string'&&v.length>0)}
 assert.throws(()=>createCollectionExact1Consumer(adapter()));
});

test('same ItemID in distinct groups remains bound to preview choice, not item identity',async()=>{
 const a=adapter(),inspect=a.inspectCollectionTargets;a.inspectCollectionTargets=async()=>({...await inspect(),targets:[target,{...target,groupIndex:1}]});
 let chosen=-1;a.stageCollectionTarget=async(s,i)=>{chosen=i;return {...mutation('STAGED'),choice:i}};
 const c=make(a);await c.load();await c.backupOriginal();await c.preview(1);
 assert.equal(c.snapshot().preview.choice,1);assert.equal(c.snapshot().preview.itemId,target.itemId);
 await c.stage();assert.equal(chosen,1);
});

test('failed close blocks new inspection until explicit successful close retry',async()=>{
 for(const failure of ['sync','async']){
  const a=adapter(),inspect=a.inspectCollectionTargets;let calls=0,closeCalls=0;
  a.inspectCollectionTargets=async()=>{calls++;return inspect()};
  a.close=()=>{closeCalls++;if(closeCalls===1){if(failure==='sync')throw Error('close failed');return Promise.reject(Error('close failed'))}return Promise.resolve(closedAck())};
  const c=make(a);await c.load();await assert.rejects(c.close(),/close failed/);
  assert.equal(c.snapshot().phase,'close-failed');await assert.rejects(c.load());assert.equal(calls,1);
  await c.close();assert.equal(c.snapshot().phase,'closed');await c.load();assert.equal(calls,2);await c.close();
 }
});
test('failed deferred close denies stale completion and concurrent reopen; retry is explicit',async()=>{
 const a=adapter(),inspect=a.inspectCollectionTargets;let release,rejectClose,calls=0,closeCalls=0;
 const barrier=new Promise(r=>release=r),closing=new Promise((_,r)=>rejectClose=r);
 a.inspectCollectionTargets=async()=>{calls++;await barrier;return inspect()};
 a.close=()=>++closeCalls===1?closing:Promise.resolve(closedAck());
 const c=make(a),pending=assert.rejects(c.load()),one=assert.rejects(c.close()),two=assert.rejects(c.close());
 await assert.rejects(c.load());rejectClose(Error('close failed'));await Promise.all([one,two]);release();await pending;
 assert.equal(c.snapshot().phase,'close-failed');assert.equal(closeCalls,1);await assert.rejects(c.load());assert.equal(calls,1);
 await c.close();await c.load();assert.equal(calls,2);await c.close();
});
test('invalid receipt with failed cleanup also blocks reopening',async()=>{
 const a=adapter(),inspect=a.inspectCollectionTargets;let calls=0;
 a.inspectCollectionTargets=async()=>{calls++;return {...await inspect(),writerAuthorized:true}};
 a.close=async()=>{throw Error('close failed')};
 const c=make(a);await assert.rejects(c.load());assert.equal(c.snapshot().phase,'close-failed');
 await assert.rejects(c.load());assert.equal(calls,1);
});

test('Collection Close must return exact common CLOSED receipt; forged or void ack never permits new inspection',async()=>{
 for(const bad of [undefined,null,{}, { ...closedAck(),kind:'OPEN' },{...closedAck(),ok:false},
  {...closedAck(),writerAuthorized:true},{...closedAck(),nativeV3Verified:true},
  {...closedAck(),originalOverwriteAuthorized:true},{...closedAck(),sessionId:'not-for-ui'}]){
  const a=adapter(),inspect=a.inspectCollectionTargets;let reads=0,closes=0;
  a.inspectCollectionTargets=async()=>{reads++;return inspect()};
  a.close=async()=>++closes===1?bad:closedAck();
  const c=make(a);await c.load();await assert.rejects(c.close());
  assert.equal(c.snapshot().phase,'close-failed');assert.equal(c.snapshot().targets.length,0);
  await assert.rejects(c.load());assert.equal(reads,1);
  await c.close();await c.load();assert.equal(reads,2);await c.close();
 }
});
test('shared pending Close rejects forged ack and suppresses stale load; exact retry restores only closed state',async()=>{
 const a=adapter(),inspect=a.inspectCollectionTargets;let resolveRead,resolveClose,reads=0,closes=0;
 const read=new Promise(r=>resolveRead=r),barrier=new Promise(r=>resolveClose=r);
 a.inspectCollectionTargets=async()=>{reads++;await read;return inspect()};
 a.close=()=>++closes===1?barrier:Promise.resolve(closedAck());
 const c=make(a),pending=assert.rejects(c.load()),one=assert.rejects(c.close()),two=assert.rejects(c.close());
 await assert.rejects(c.load());resolveClose({...closedAck(),writerAuthorized:true});
 await Promise.all([one,two]);resolveRead();await pending;
 assert.equal(c.snapshot().phase,'close-failed');assert.equal(closes,1);
 await assert.rejects(c.load());assert.equal(reads,1);
 await c.close();assert.equal(c.snapshot().phase,'closed');await c.load();assert.equal(reads,2);await c.close();
});
test('invalid inspection and unverified cleanup cannot claim closed or allow new load',async()=>{
 const a=adapter(),inspect=a.inspectCollectionTargets;let reads=0;
 a.inspectCollectionTargets=async()=>{reads++;return {...await inspect(),writerAuthorized:true}};
 a.close=async()=>undefined;const c=make(a);
 await assert.rejects(c.load());assert.equal(c.snapshot().phase,'close-failed');
 await assert.rejects(c.load());assert.equal(reads,1);
});
