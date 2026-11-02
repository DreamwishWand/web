import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/lib/community/staging-http-client.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
let importSerial=0;
async function freshClientModule(){
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64')+'#isolate-'+(++importSerial));
}
const sessions=new Map(),locals=new Map(),handlers=[];
const faults={set:false,remove:false,localSet:false};
const sessionStorage={
  getItem(k){return sessions.get(k)??null;},
  setItem(k,v){if(faults.set&&k.includes('community-session-v2:cfg2-')&&!k.includes('probe:'))throw Error('SECRET_SHOULD_NOT_LOG');sessions.set(k,v);},
  removeItem(k){if(faults.remove&&k.includes('community-session-v2:cfg2-')&&!k.includes('probe:'))throw Error('SECRET_SHOULD_NOT_LOG');sessions.delete(k);}
};
const localStorage={
  getItem(k){return locals.get(k)??null;},
  setItem(k,v){if(faults.localSet)throw Error('SECRET_SHOULD_NOT_LOG');locals.set(k,v);},
  removeItem(k){locals.delete(k);}
};
globalThis.sessionStorage=sessionStorage;
globalThis.localStorage=localStorage;
globalThis.window={addEventListener(type,fn){if(type==='storage')handlers.push(fn);}};
globalThis.crypto??=(await import('node:crypto')).webcrypto;

let unique=0;
const cred=(id,which='new',expires=3600)=>({
  access_token:'TEST_JWT_'+id+'_'+which,
  refresh_token:'TEST_REFRESH_SECRET_'+id+'_'+which,
  expires_in:expires,user:{id,email:id+'@example.invalid'}
});
const response=(status,body)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json'}
});
function defer(){let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};}
function config(kind='A',key='sb_publishable_foo'){
  return {supabaseUrl:'https://write-fault-'+(++unique)+'-'+kind+'.invalid',publishableKey:key};
}
function start(){
  sessions.clear();locals.clear();handlers.length=0;
  faults.set=false;faults.remove=false;faults.localSet=false;
}
const storageKey=()=>[...sessions.keys()].find(k=>k.startsWith('dreamwishwand-community-session-v2:cfg2-')&&!k.includes('probe:'));
function putSession(client,id='A',seconds=3600){
  const key='dreamwishwand-community-session-v2:'+scope(client.config);
  sessions.set(key,JSON.stringify({version:2,config:client.config,session:{
    accessToken:'TEST_JWT_'+id+'_old',refreshToken:'TEST_REFRESH_SECRET_'+id+'_old',
    userId:id,email:null,expiresAt:Date.now()+seconds*1000
  }}));
}
// Signed in through the real module API; raw v2 Storage injection is not
// an authentication fixture under the cold-start fail-closed contract.
async function provisionSignedClient(Client,cfg,id='A',seconds=3600){
  const client=new Client(cfg);
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>response(200,cred(id,'old',seconds));
  try { await client.signInWithPassword(id,'synthetic-fixture'); }
  finally { globalThis.fetch=previous; }
  return client;
}
function scope(config){
  const input=JSON.stringify([config.supabaseUrl,config.publishableKey]);
  let a=0x811c9dc5,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
  for(let i=0;i<input.length;i++){
    const n=input.charCodeAt(i);
    a=Math.imul(a^n,0x01000193)>>>0;
    b=Math.imul(b^n,0x5bd1e995)>>>0;
    c=Math.imul(c^n,0x27d4eb2d)>>>0;
    d=Math.imul(d^n,0x165667b1)>>>0;
  }
  return 'cfg2-'+[a,b,c,d].map(n=>n.toString(16).padStart(8,'0')).join('');
}
const quarantineKey=c=>'dreamwishwand-community-session-quarantine-v1:'+scope(c);
const noticeKey='dreamwishwand-community-logout-notice-v2';
function noSecretNotifications(events){
  const publicOnly=JSON.stringify(events)+JSON.stringify([...locals.entries()]);
  assert.ok(!publicOnly.includes('TEST_JWT_'));
  assert.ok(!publicOnly.includes('TEST_REFRESH_SECRET_'));
  assert.ok(!publicOnly.includes('sb_publishable_'));
  assert.ok(!publicOnly.includes('SECRET_SHOULD_NOT_LOG'));
  assert.ok(!publicOnly.includes('TEST_ACCOUNT_SECRET'));
}

test('new: sign-in setItem throws; same-config observers and epochs still fail closed',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('sign-in');
  const a=new CommunityLabClient(cfg),b=new CommunityLabClient(cfg),events=[];
  b.subscribeSession(x=>events.push(x));
  faults.set=true;
  globalThis.fetch=async()=>response(200,cred('TEST_ACCOUNT_SECRET'));
  await assert.rejects(a.signInWithPassword('new','synthetic'),/SESSION_STORAGE_WRITE_FAILED/);
  assert.equal(a.session,null);assert.equal(b.session,null);
  assert.ok(events.some(e=>e.kind==='session-invalidated'));
  const last=events.at(-1);
  assert.ok(last.generation>=2&&last.logoutEpoch>=2);
  assert.equal(sessions.has('dreamwishwand-community-session-v2:'+scope(cfg)),false);
  assert.equal(locals.get(quarantineKey(cfg)),'1');
  noSecretNotifications(events);
});

test('new: failed refresh setItem does not publish a rotated credential',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('refresh');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A',5),events=[];
  a.subscribeSession(e=>events.push(e));
  faults.set=true;
  globalThis.fetch=async()=>response(200,cred('A','rotated'));
  await assert.rejects(a.getValidSignedSession(),/SESSION_STORAGE_WRITE_FAILED/);
  assert.equal(a.session,null);
  assert.equal(sessions.has('dreamwishwand-community-session-v2:'+scope(cfg)),false);
  assert.equal(events.at(-1).kind,'session-invalidated');
  assert.ok(events.at(-1).logoutEpoch>=1);
  noSecretNotifications(events);
});

test('new: logout removeItem denial uses null tombstone, still notifies and calls provider',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('logout');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A'),events=[];
  a.subscribeSession(e=>events.push(e));
  let providerCalls=0;
  globalThis.fetch=async url=>{if(String(url).includes('/logout'))providerCalls++;return response(200,{});};
  faults.remove=true;
  await a.signOut();
  assert.equal(providerCalls,1);
  assert.equal(a.session,null);
  assert.equal(sessions.get('dreamwishwand-community-session-v2:'+scope(cfg)),'null');
  assert.equal(events.at(-1).kind,'session-invalidated');
  assert.ok(events.at(-1).logoutEpoch>=2);
  assert.equal(locals.get(quarantineKey(cfg)),'1');
  assert.ok(locals.has(noticeKey));
  faults.remove=false;
  const {CommunityLabClient:Reload}=await freshClientModule();
  assert.equal(new Reload(cfg).session,null);
  noSecretNotifications(events);
});

test('new: failed remove AND tombstone overwrite quarantines stale persisted credential on reload',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('stale');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A'),events=[];
  a.subscribeSession(e=>events.push(e));
  faults.remove=true;faults.set=true;
  globalThis.fetch=async()=>response(200,{});
  await a.signOut();
  assert.equal(a.session,null);
  assert.equal(events.at(-1).kind,'session-invalidated');
  const key='dreamwishwand-community-session-v2:'+scope(cfg);
  assert.ok(sessions.get(key).includes('TEST_JWT_A_old'));
  assert.equal(locals.get(quarantineKey(cfg)),'1');
  faults.remove=false;faults.set=false;
  const {CommunityLabClient:Reload}=await freshClientModule();
  const b=new Reload(cfg);
  assert.equal(b.session,null);
  let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected outbound');};
  await assert.rejects(b.query('read'),/Sign in before/);
  assert.equal(calls,0);
  noSecretNotifications(events);
});

test('new: sign-in A to B with remove and set failures cannot revive A or accept B',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('switch');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A'),events=[];
  a.subscribeSession(e=>events.push(e));
  faults.set=true;faults.remove=true;
  globalThis.fetch=async()=>response(200,cred('B','login'));
  await assert.rejects(a.signInWithPassword('B','synthetic'),/SESSION_STORAGE_WRITE_FAILED/);
  assert.equal(a.session,null);
  assert.ok(events.some(e=>e.kind==='session-invalidated'));
  assert.ok(events.at(-1).logoutEpoch>=2);
  assert.equal(locals.get(quarantineKey(cfg)),'1');
  assert.ok(sessions.get('dreamwishwand-community-session-v2:'+scope(cfg)).includes('TEST_JWT_A_old'));
  noSecretNotifications(events);
});

test('new: late refresh after throwing logout cannot reinstall old token',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('late');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A',4),b=new CommunityLabClient(cfg);
  const held=defer(),events=[];
  b.subscribeSession(e=>events.push(e));
  globalThis.fetch=async url=>String(url).includes('refresh_token')?held.promise:response(200,{});
  const pending=a.getValidSignedSession();
  await Promise.resolve();
  faults.remove=true;
  await b.signOut();
  assert.equal(a.session,null);
  held.resolve(response(200,cred('A','late')));
  await assert.rejects(pending,/SESSION_STALE_OR_LOGGED_OUT/);
  assert.equal(a.session,null);
  assert.equal(events.at(-1).kind,'session-invalidated');
  noSecretNotifications(events);
});

test('new: A storage write failure does not invalidate cross-config B',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const ca=config('A','sb_publishable_A'),cb=config('B','sb_publishable_B');
  const a=await provisionSignedClient(CommunityLabClient,ca,'A');
  const b=await provisionSignedClient(CommunityLabClient,cb,'B'),seen=[];
  b.subscribeSession(x=>seen.push(x));
  faults.remove=true;faults.set=true;
  globalThis.fetch=async()=>response(200,{});
  await a.signOut();
  assert.equal(a.session,null);
  assert.equal(b.session.userId,'B');
  for(const listener of handlers){
    listener({key:noticeKey,newValue:locals.get(noticeKey)});
  }
  assert.equal(b.session.userId,'B');
  assert.deepEqual(seen,[]);
  noSecretNotifications(seen);
});

test('new: storage and localStorage all reject writes; in-memory logout still notifies',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('all-denied');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A'),events=[];
  a.subscribeSession(x=>events.push(x));
  faults.remove=true;faults.set=true;faults.localSet=true;
  globalThis.fetch=async()=>response(200,{});
  await a.signOut();
  assert.equal(a.session,null);
  assert.equal(events.at(-1).kind,'session-invalidated');
  assert.equal(locals.has(noticeKey),false);
  // All session writes are blocked: no durable revocation is possible.
  // This case is not claimed to prevent stale snapshot rehydration if storage
  // later recovers with no tokenless quarantine marker.
  assert.ok(sessions.get('dreamwishwand-community-session-v2:'+scope(cfg)).includes('TEST_JWT_A_old'));
  const {CommunityLabClient:BlockedReload}=await freshClientModule();
  assert.equal(new BlockedReload(cfg).session,null);
  noSecretNotifications(events);
});

test('new: new sign-in after storage recovery overwrites stale snapshot and clears quarantine',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('recover');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A'),events=[];
  a.subscribeSession(x=>events.push(x));
  faults.remove=true;faults.set=true;
  globalThis.fetch=async()=>response(200,{});
  await a.signOut();
  assert.equal(locals.get(quarantineKey(cfg)),'1');
  faults.remove=false;faults.set=false;
  globalThis.fetch=async()=>response(200,cred('B','replacement'));
  await a.signInWithPassword('B','synthetic');
  assert.equal(a.session.userId,'B');
  assert.equal(locals.has(quarantineKey(cfg)),false);
  assert.equal(JSON.parse(sessions.get('dreamwishwand-community-session-v2:'+scope(cfg))).session.userId,'B');
  const {CommunityLabClient:Reload}=await freshClientModule();
  const cold=new Reload(cfg);
  assert.equal(cold.session,null); // even a freshly persisted B never auto-hydrates
  await assert.rejects(cold.getValidSignedSession(),/Sign in before/);
  noSecretNotifications(events);
});

test('new: stale writer 401 still not retried when Storage remove fails',async()=>{
  start();
  const {CommunityLabClient}=await freshClientModule();
  const cfg=config('writer');
  const a=await provisionSignedClient(CommunityLabClient,cfg,'A');
  let writerCalls=0,refreshCalls=0;
  globalThis.fetch=async url=>{
    if(String(url).includes('community-command')){writerCalls++;return response(401,{error:'no'});}
    if(String(url).includes('refresh_token')){refreshCalls++;return response(200,cred('A'));}
    return response(200,{});
  };
  faults.remove=true;
  await assert.rejects(a.command('write',{}),/401/);
  assert.equal(writerCalls,1);assert.equal(refreshCalls,0);
});
