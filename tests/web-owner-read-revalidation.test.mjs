import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOwnerReadRevalidation,attachOwnerReadBrowserLifecycle,
  OWNER_REVALIDATION_PRODUCTION_ENABLED} from '../src/lib/dreamsnaps/owner-read-revalidation.js';
import {SOURCE153_BROWSER_E2_PRODUCTION_ENABLED} from '../src/lib/dreamsnaps/source153-owner-browser-e2.js';
import {SOURCE153_OWNER_V2_LIVE_ENABLED} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
import {OWNER_MANAGEMENT_ENABLED} from '../src/lib/dreamsnaps/owner-management.js';
const work='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const candidate=(overrides={})=>({
 status:'SOURCE153_SCHEMA_CANDIDATE_ONLY',kind:'OriginalCompetition',
 entryState:'FROZEN_ORIGINAL_ENTRY',grantState:'recorded',
 policyScope:'UNVERIFIED',publicDisabled:true,rowVersion:1,
 authorizationEpoch:1,sourceCandidateOnly:true,
 ownerReadVerified:false,actionsEnabled:false,liveBackendEnabled:false,
 snapshot:null,...overrides
});
function start(read,updates=[]) {
 const core=createOwnerReadRevalidation({read,onChange:x=>updates.push(x)});
 core.routeChanged(work);
 core.replaceSession('opaque.jwt.secret','anon-public-key');
 return core;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('production gates and established Owner/WEB267 source stay OFF',()=>{
 assert.equal(OWNER_REVALIDATION_PRODUCTION_ENABLED,false);
 assert.equal(SOURCE153_BROWSER_E2_PRODUCTION_ENABLED,false);
 assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
 const page=readFileSync(new URL('../src/routes/dreamsnaps/my/manage/source153-e2/+page.svelte',import.meta.url),'utf8');
 assert.ok(page.includes("import.meta.env.DEV"));
 assert.ok(page.includes("createOwnerReadRevalidation"));
 assert.ok(page.includes("attachOwnerReadBrowserLifecycle"));
 assert.ok(page.includes("readIsolatedSource153Owner"));
 assert.ok(page.includes("clearSession"));
 assert.ok(page.includes('aria-live="polite"'));
 assert.ok(page.includes('disabled={working || !token || !canInspect}'));
 assert.ok(!page.includes('localStorage'));
});

test('candidate is bounded source-only; never stores raw secrets, actor ID or an elevated snapshot',async()=>{
 const core=start(async()=>candidate({
   ownerAccountId:'SECRET_ACCOUNT',photoMediaId:'SECRET_MEDIA',
   storageKey:'SECRET_STORAGE',access_token:'SECRET_JWT',signedUrl:'SECRET_SIGNER'
 }));
 const result=await core.revalidate();
 assert.equal(result.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(result.ownerReadVerified,false);
 assert.equal(result.snapshot,null);
 assert.equal(result.actionsEnabled,false);
 assert.equal(result.liveBackendEnabled,false);
 for(const secret of ['SECRET_ACCOUNT','SECRET_MEDIA','SECRET_STORAGE','SECRET_JWT','SECRET_SIGNER','opaque.jwt.secret',work]){
   assert.ok(!JSON.stringify(core.getState()).includes(secret),'STATE_CONTAINS_SENSITIVE_DATA');
 }
 core.dispose();
});

test('passive remote revocation is not claimed, but visibility/focus/offline immediately clear and re-read',async()=>{
 const calls=[];
 const core=start(async x=>{calls.push(x);return candidate();});
 await core.revalidate();
 assert.equal(calls.length,1);
 assert.ok(core.getState().view);
 // Without local event or server message there is no magical instant revocation.
 await tick();
 assert.equal(calls.length,1);
 core.invalidate('HIDDEN');
 assert.equal(core.getState().view,null);
 assert.equal(core.getState().status,'REVALIDATION_REQUIRED');
 // Hidden = no re-read; visible = a new server-authorized request.
 await core.resume('VISIBLE');
 assert.equal(calls.length,2);
 assert.equal(calls[1].expectedRowVersion,1);
 assert.equal(calls[1].expectedAuthorizationEpoch,1);
 core.invalidate('BLUR');
 assert.equal(core.getState().view,null);
 await core.resume('FOCUS');
 assert.equal(calls.length,3);
 core.invalidate('OFFLINE');
 assert.equal(core.getState().view,null);
 await core.resume('ONLINE');
 assert.equal(calls.length,4);
 core.dispose();
});

test('CAS refusal never auto-retries; only explicit fresh read discards previous expectation',async()=>{
 const reqs=[];
 const core=start(async x=>{
   reqs.push({row:x.expectedRowVersion,epoch:x.expectedAuthorizationEpoch});
   return reqs.length===2 ? {status:'REFRESH_REQUIRED'} : candidate({rowVersion:2,authorizationEpoch:2});
 });
 await core.revalidate();
 core.invalidate('WITHDRAWAL');
 await core.revalidate();
 assert.equal(core.getState().view,null);
 assert.equal(core.getState().status,'REFRESH_REQUIRED');
 assert.equal(reqs.length,2);
 await tick();
 assert.equal(reqs.length,2);
 await core.revalidate({fresh:true});
 assert.equal(reqs.length,3);
 assert.equal(reqs[1].row,2);
 assert.equal(reqs[2].row,undefined);
 assert.equal(core.getState().view.rowVersion,2);
 core.dispose();
});

test('stale delayed response cannot repopulate after Work/account/session change, logout or dispose',async()=>{
 for(const invalidation of ['WORK_CHANGED','ACCOUNT_CHANGED','SESSION_CHANGED','LOGOUT']){
   let deliver;
   const core=start(()=>new Promise(r=>{deliver=r;}));
   const promise=core.revalidate();
   assert.equal(core.getState().status,'READING_SOURCE');
   core.invalidate(invalidation);
   assert.equal(core.getState().view,null);
   deliver(candidate());
   await promise;
   assert.equal(core.getState().view,null);
   assert.equal(core.getState().status,'AUTH_REQUIRED');
   core.dispose();
 }
 let release;
 const core=start(()=>new Promise(r=>{release=r;}));
 const pending=core.revalidate();
 core.routeChanged(other);
 release(candidate());
 await pending;
 assert.equal(core.getState().view,null);
 assert.equal(core.getState().canInspect,false);
 core.dispose();
});

test('invalidation on local policy, stale CAS and service denial is fail-closed',async()=>{
 const core=start(async()=>candidate());
 await core.revalidate();
 core.invalidate('POLICY_CHANGED');
 assert.equal(core.getState().view,null);
 await core.revalidate();
 core.invalidate('CAS_CONFLICT');
 assert.equal(core.getState().status,'REFRESH_REQUIRED');
 assert.equal(core.getState().view,null);
 core.dispose();
 const denied=start(async()=>({status:'BACKEND_UNAVAILABLE'}));
 await denied.revalidate();
 assert.equal(denied.getState().view,null);
 denied.dispose();
 const unsafe=start(async()=>candidate({ownerReadVerified:true}));
 await unsafe.revalidate();
 assert.equal(unsafe.getState().status,'SOURCE_CONTRACT_REJECTED');
 unsafe.dispose();
});


test('QR291 TRUE RED repair: REFRESH_REQUIRED latch forbids generic Inspect and every lifecycle resume until explicit Fresh',async()=>{
 for(const trigger of ['FOCUS','VISIBLE','ONLINE','PAGESHOW']){
  const calls=[];
  const core=start(async x=>{
   calls.push({row:x.expectedRowVersion,epoch:x.expectedAuthorizationEpoch});
   return calls.length===2 ? {status:'REFRESH_REQUIRED'} :
     candidate({rowVersion:calls.length===1?2:3,authorizationEpoch:calls.length===1?2:3});
  });
  await core.revalidate();               // signed source candidate CAS2/2
  core.invalidate('WITHDRAWAL');
  await core.revalidate();               // server refuses stale CAS2/2
  assert.equal(calls.length,2);
  assert.deepEqual(calls[1],{row:2,epoch:2});
  assert.equal(core.getState().status,'REFRESH_REQUIRED');
  assert.equal(core.getState().view,null);
  assert.equal(core.getState().canInspect,false);
  assert.equal(core.getState().canFreshRead,true);
  await core.resume(trigger);           // NO HTTP
  assert.equal(core.getState().status,'REFRESH_REQUIRED',trigger);
  assert.equal(core.getState().view,null,trigger);
  await core.revalidate();              // generic Inspect also NO HTTP
  assert.equal(calls.length,2,trigger);
  assert.equal(core.getState().status,'REFRESH_REQUIRED');
  for(const localEvent of ['HIDDEN','BLUR','OFFLINE','PAGEHIDE','POLICY_CHANGED']){
   core.invalidate(localEvent);
   assert.equal(core.getState().status,'REFRESH_REQUIRED');
   assert.equal(core.getState().view,null);
   assert.equal(core.getState().canInspect,false);
  }
  for(const resumeEvent of ['VISIBLE','FOCUS','ONLINE','PAGESHOW']){
   await core.resume(resumeEvent);
   assert.equal(core.getState().status,'REFRESH_REQUIRED');
   assert.equal(core.getState().view,null);
  }
  await tick();
  assert.equal(calls.length,2,'AUTOMATIC_CAS_BYPASS');
  await core.revalidate({fresh:true}); // explicit user Fresh, signed reauth
  assert.equal(calls.length,3);
  assert.deepEqual(calls[2],{row:undefined,epoch:undefined});
  assert.equal(core.getState().status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(core.getState().view.rowVersion,3);
  assert.equal(core.getState().canInspect,true);
  assert.equal(core.getState().canFreshRead,false);
  core.dispose();
 }
});

test('CAS_CONFLICT sticky latch survives resume and normal Inspect; only explicit Fresh resets it',async()=>{
 const calls=[];
 const core=start(async x=>{calls.push(x);return candidate({rowVersion:4,authorizationEpoch:4});});
 await core.revalidate();
 core.invalidate('CAS_CONFLICT');
 assert.equal(core.getState().status,'REFRESH_REQUIRED');
 assert.equal(core.getState().view,null);
 for(const why of ['FOCUS','VISIBLE','ONLINE','PAGESHOW']){
  await core.resume(why);
  await core.revalidate();
 }
 assert.equal(calls.length,1);
 assert.equal(core.getState().canInspect,false);
 assert.equal(core.getState().canFreshRead,true);
 await core.revalidate({fresh:true});
 assert.equal(calls.length,2);
 assert.equal(calls[1].expectedRowVersion,undefined);
 assert.equal(calls[1].expectedAuthorizationEpoch,undefined);
 core.dispose();
});

test('Fresh read still rejects denied backend and cannot promote an Owner snapshot',async()=>{
 let calls=0;
 const core=start(async()=>{
  calls++;
  if(calls===1)return candidate({rowVersion:5,authorizationEpoch:5});
  if(calls===2)return {status:'REFRESH_REQUIRED'};
  return {status:'BACKEND_UNAVAILABLE'};
 });
 await core.revalidate();
 core.invalidate('WITHDRAWAL');
 await core.revalidate();
 assert.equal(core.getState().status,'REFRESH_REQUIRED');
 await core.revalidate({fresh:true});
 assert.equal(calls,3);
 assert.equal(core.getState().view,null);
 assert.equal(core.getState().snapshot,null);
 assert.equal(core.getState().ownerReadVerified,false);
 assert.equal(core.getState().actionsEnabled,false);
 assert.equal(core.getState().liveBackendEnabled,false);
 core.dispose();
});

test('CAS latch drops only with new Work, different Session or logout; old late HTTP cannot restore it',async()=>{
 for(const reset of ['WORK','SESSION','LOGOUT']){
  const calls=[];
  const core=start(async x=>{
   calls.push(x);
   if(calls.length===1)return candidate({rowVersion:7,authorizationEpoch:7});
   if(calls.length===2)return {status:'REFRESH_REQUIRED'};
   return candidate();
  });
  await core.revalidate();
  core.invalidate('WITHDRAWAL');
  await core.revalidate();
  assert.equal(core.getState().status,'REFRESH_REQUIRED');
  if(reset==='WORK')core.routeChanged(other);
  if(reset==='SESSION')core.replaceSession('new-signed-token','new-anon-key');
  if(reset==='LOGOUT')core.invalidate('LOGOUT');
  assert.notEqual(core.getState().status,'REFRESH_REQUIRED');
  assert.equal(core.getState().view,null);
  assert.equal(core.getState().canFreshRead,false);
  if(reset==='WORK'||reset==='LOGOUT')assert.equal(core.getState().canInspect,false);
  if(reset==='SESSION')assert.equal(core.getState().canInspect,true);
  core.dispose();
 }
 let release;
 const core=start(()=>new Promise(resolve=>{release=resolve;}));
 const pending=core.revalidate();
 core.invalidate('CAS_CONFLICT');
 release(candidate({rowVersion:10,authorizationEpoch:10}));
 await pending;
 assert.equal(core.getState().status,'REFRESH_REQUIRED');
 assert.equal(core.getState().view,null);
 assert.equal(core.getState().canInspect,false);
 core.dispose();
});

test('DEV-only Fresh button is separately enabled, but ordinary Inspect stays disabled under CAS latch',()=>{
 const page=readFileSync(new URL('../src/routes/dreamsnaps/my/manage/source153-e2/+page.svelte',import.meta.url),'utf8');
 assert.ok(page.includes('disabled={working || !token || !canInspect}'));
 assert.ok(page.includes('disabled={working || !canFreshRead}'));
 assert.ok(page.includes("ownerController.revalidate({fresh:true})"));
 assert.ok(page.includes("status==='REFRESH_REQUIRED'"));
 assert.ok(!page.includes('OWNER_REVALIDATION_PRODUCTION_ENABLED=true'));
});

test('local browser event adapter removes listeners and lifecycle stays unprivileged',async()=>{
 class Target {
  constructor(){this.handlers=new Map();}
  addEventListener(k,cb){const arr=this.handlers.get(k)||[];arr.push(cb);this.handlers.set(k,arr);}
  removeEventListener(k,cb){this.handlers.set(k,(this.handlers.get(k)||[]).filter(f=>f!==cb));}
  emit(k){for(const fn of this.handlers.get(k)||[])fn();}
 }
 const documentRef=new Target(),windowRef=new Target();
 documentRef.visibilityState='visible';
 let calls=0;
 const core=start(async()=>{calls++;return candidate();});
 await core.revalidate();
 const detach=attachOwnerReadBrowserLifecycle(core,{documentRef,windowRef});
 documentRef.visibilityState='hidden';documentRef.emit('visibilitychange');
 assert.equal(core.getState().view,null);
 documentRef.visibilityState='visible';documentRef.emit('visibilitychange');
 await tick();
 assert.equal(calls,2);
 windowRef.emit('offline');
 assert.equal(core.getState().view,null);
 windowRef.emit('online');
 await tick();
 assert.equal(calls,3);
 detach();
 windowRef.emit('blur');
 assert.ok(core.getState().view);
 core.dispose();
});
