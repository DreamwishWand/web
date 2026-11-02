import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/lib/community/staging-http-client.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {CommunityLabClient}=await import('data:text/javascript;base64,'+
  Buffer.from(js).toString('base64'));
const handlers=[];
const memory=new Map(),local=new Map();
globalThis.sessionStorage={
  getItem(k){return memory.get(k)??null;},
  setItem(k,v){memory.set(k,v);},
  removeItem(k){memory.delete(k);}
};
globalThis.localStorage={
  getItem(k){return local.get(k)??null;},
  setItem(k,v){local.set(k,v);},
  removeItem(k){local.delete(k);}
};
globalThis.window={addEventListener(type,listener){
  if(type==='storage')handlers.push(listener);
}};
globalThis.crypto??=(await import('node:crypto')).webcrypto;
const LEGACY_KEY='dreamwishwand-community-session-v1';
const NOTICE_KEY='dreamwishwand-community-logout-notice-v2';
let KEY='';
function configScope(config){
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
const storageKey=config=>'dreamwishwand-community-session-v2:'+configScope(config);
function config(suffix,key='sb_publishable_test'){
  id++;return {supabaseUrl:'https://community-test-'+id+(suffix||'')+'.invalid',publishableKey:key};
}
function fixture(config, user='A', seconds=3600){
  const c=cred(user,'fixture',seconds);
  return {version:2,config,session:{
    accessToken:c.access_token,refreshToken:c.refresh_token,userId:user,
    email:null,expiresAt:Date.now()+seconds*1000
  }};
}
let id=0;
function setup(user='A',seconds=20){
  memory.clear();local.clear();id++;
  const config={supabaseUrl:'https://community-test-'+id+'.invalid',
    publishableKey:'sb_publishable_test'};
  KEY=storageKey(config);
  const s=cred(user,'old',seconds);
  memory.set(KEY,JSON.stringify(fixture(config,user,seconds)));
  return [new CommunityLabClient(config),new CommunityLabClient(config)];
}
function cred(user,serial,seconds=3600){
  return {access_token:'TEST_JWT_'+user+'_'+serial,
    refresh_token:'TEST_REFRESH_SECRET_'+user+'_'+serial,
    expires_in:seconds,user:{id:user,email:user+'@example.invalid'}};
}
function http(status,body){return new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json'}
});}
function defer(){
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  return {promise,resolve,reject};
}
test('one rotating refresh for simultaneous clients; aborted waiter does not cancel shared flight',async()=>{
  const [a,b]=setup();let refreshCount=0;
  const events=[],off=b.subscribeSession(x=>events.push(x));
  const held=defer();
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token')){refreshCount++;return held.promise;}
    return http(200,{});
  };
  const abort=new AbortController();
  const first=a.getValidSignedSession({signal:abort.signal});
  const second=b.getValidSignedSession();
  await Promise.resolve();abort.abort();
  await assert.rejects(first,/SESSION_REQUEST_ABORTED/);
  held.resolve(http(200,cred('A','rotated')));
  const latest=await second;
  assert.equal(refreshCount,1);
  assert.equal(latest.accessToken,'TEST_JWT_A_rotated');
  assert.equal(a.session.accessToken,b.session.accessToken);
  assert.equal(JSON.parse(memory.get(KEY)).session.refreshToken,'TEST_REFRESH_SECRET_A_rotated');
  assert.deepEqual(events.map(x=>x.kind),['refreshed']);
  assert.ok(!JSON.stringify(events).includes('TEST_JWT'));
  assert.ok(!JSON.stringify(events).includes('TEST_REFRESH_SECRET'));
  off();
});
test('logout instantly cancels inflight refresh and never restores old session',async()=>{
  const [a,b]=setup();const held=defer(),out=defer();
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token'))return held.promise;
    if(String(url).includes('/logout'))return out.promise;
    return http(200,{});
  };
  const pending=a.getValidSignedSession();
  await Promise.resolve();
  const signingOut=b.signOut();
  assert.equal(a.session,null);
  assert.equal(memory.has(KEY),false);
  held.resolve(http(200,cred('A','rotated')));
  await assert.rejects(pending,/SESSION_STALE_OR_LOGGED_OUT/);
  out.resolve(http(200,{}));await signingOut;
  assert.equal(b.session,null);
  assert.ok(!JSON.stringify([...local.values()]).includes('TEST_REFRESH_SECRET'));
});
test('delayed old login cannot overwrite newer Account B session',async()=>{
  const [a,b]=setup('A',3600);
  const old=defer();
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('grant_type=password')){
      return JSON.parse(options.body).email==='old'?old.promise:http(200,cred('B','new'));
    }
    return http(200,{});
  };
  const lag=a.signInWithPassword('old','ignored');
  await Promise.resolve();
  const now=await b.signInWithPassword('new','ignored');
  assert.equal(now.userId,'B');
  old.resolve(http(200,cred('A','late')));
  await assert.rejects(lag,/SESSION_STALE_OR_LOGGED_OUT/);
  assert.equal(a.session.userId,'B');
  assert.equal(JSON.parse(memory.get(KEY)).session.userId,'B');
});
test('invalid rotation invalidates all clients and emits only tokenless events',async()=>{
  const [a,b]=setup();const events=[];
  b.subscribeSession(e=>events.push(e));
  let calls=0;
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token')){calls++;return http(401,{error:'invalid_grant'});}
    return http(200,{});
  };
  await assert.rejects(a.getValidSignedSession(),/401/);
  assert.equal(calls,1);assert.equal(b.session,null);
  assert.deepEqual(events.map(x=>x.kind),['session-invalidated']);
  assert.equal(JSON.stringify(events).includes('TEST_REFRESH_SECRET'),false);
});
test('401 on non-idempotent writer is not automatically replayed',async()=>{
  const [a]=setup('A',3600);let writers=0,refreshes=0;
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token')){refreshes++;return http(200,cred('A','new'));}
    if(String(url).includes('community-command')){writers++;return http(401,{error:'unauthorized'});}
    return http(200,{});
  };
  await assert.rejects(a.command('write',{}),/401/);
  assert.equal(writers,1);assert.equal(refreshes,0);
});
test('read-oriented query retries 401 only once; old HTTP response rejected after logout',async()=>{
  const [a]=setup('A',3600);let queries=0,refreshes=0;
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token')){refreshes++;return http(200,cred('A','new'));}
    if(String(url).includes('community-query')){queries++;return http(queries===1?401:200,queries===1?{error:'expired'}:{ok:true});}
    return http(200,{});
  };
  const result=await a.query('read',{});
  assert.equal(result.ok,true);assert.equal(queries,2);assert.equal(refreshes,1);
  const held=defer();
  globalThis.fetch=async url=>{
    if(String(url).includes('community-query'))return held.promise;
    return http(200,{});
  };
  const pending=a.query('read',{});
  await Promise.resolve();await a.signOut();
  held.resolve(http(200,{ok:true,private:true}));
  await assert.rejects(pending,/SESSION_STALE_OR_LOGGED_OUT/);
});
test('other tab receives only logout invalidation, never tokens',()=>{
  const [a,b]=setup('A',3600);assert.equal(a.session.userId,'A');
  const payload=JSON.stringify({scope:configScope(a.config),kind:'logout',nonce:'one'});
  for(const cb of handlers)cb({key:NOTICE_KEY,newValue:payload});
  assert.equal(a.session,null);assert.equal(b.session,null);
  assert.equal(memory.has(KEY),false);
  assert.ok(!payload.includes('TEST_JWT'));
  assert.ok(!payload.includes('TEST_REFRESH_SECRET'));
});

test('global revoke invalidates immediately and signs Wand cutoff before provider logout',async()=>{
  const [a,b]=setup('A',3600), held=defer(),calls=[];
  globalThis.fetch=async url=>{
    if(String(url).includes('community-command')){calls.push('wand');return held.promise;}
    if(String(url).includes('logout?scope=global')){calls.push('provider');return http(200,{});}
    return http(200,{});
  };
  const result=a.revokeAllSessions();
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(b.session,null);
  held.resolve(http(200,{ok:true}));
  assert.equal((await result).ok,true);
  assert.deepEqual(calls,['wand','provider']);
});

test('expired session uses one refresh; network failure invalidates without exposing token',async()=>{
  const [a,b]=setup('A',-10);let rotated=0;
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token')){rotated++;return http(200,cred('A','expired-refresh'));}
    return http(200,{});
  };
  assert.equal((await a.getValidSignedSession()).accessToken,'TEST_JWT_A_expired-refresh');
  assert.equal(rotated,1);
  const [c,d]=setup('A',-10);
  globalThis.fetch=async url=>{
    if(String(url).includes('refresh_token'))throw new Error('SYNTHETIC_NETWORK_FAILURE');
    return http(200,{});
  };
  await assert.rejects(c.getValidSignedSession(),/SYNTHETIC_NETWORK_FAILURE/);
  assert.equal(c.session,null);assert.equal(d.session,null);
});
test('old A refresh flight is detached when login switches to near-expired B',async()=>{
  const [a,b]=setup('A',10);
  const old=defer(),events=[];
  b.subscribeSession(e=>events.push(e));
  let refresh=0;
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('grant_type=refresh_token')){
      refresh++;
      return refresh===1?old.promise:http(200,cred('B','new-refresh'));
    }
    if(String(url).includes('grant_type=password'))
      return http(200,cred('B','new-login',10));
    return http(200,{});
  };
  const stale=a.getValidSignedSession();
  await Promise.resolve();
  const login=await b.signInWithPassword('B','synthetic');
  assert.equal(login.userId,'B');
  assert.equal((await b.getValidSignedSession()).userId,'B');
  old.resolve(http(200,cred('A','late-refresh')));
  await assert.rejects(stale,/SESSION_STALE_OR_LOGGED_OUT/);
  assert.equal(refresh,2);
  assert.equal(a.session.userId,'B');
  assert.ok(events.some(e=>e.kind==='account-changed'));
});


/** NEW CONFIG-SCOPE ONLY — existing 10 historical lifecycle tests remain intact. */
test('config isolate: A sign-in cannot hydrate or send credentials to different B URL',async()=>{
  memory.clear();local.clear();
  const a=new CommunityLabClient(config('-A'));
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push({url:String(url),headers:options?.headers});
    return http(200,cred('A','signed'));
  };
  await a.signInWithPassword('A','synthetic');
  const b=new CommunityLabClient(config('-B'));
  assert.equal(b.session,null);
  const count=requests.length;
  await assert.rejects(b.query('read',{}),/Sign in before/);
  assert.equal(requests.length,count);
  assert.equal(a.session.userId,'A');
  assert.ok(!storageKey(a.config).includes(a.config.publishableKey));
  assert.ok(!storageKey(a.config).includes('TEST_JWT'));
  assert.equal(memory.has(LEGACY_KEY),false);
});

test('config isolate: same URL with different publishable key has no inherited session',async()=>{
  memory.clear();local.clear();
  const sameUrl='https://config-key-isolation-'+(++id)+'.invalid';
  const a=new CommunityLabClient({supabaseUrl:sameUrl,publishableKey:'sb_publishable_alpha'});
  globalThis.fetch=async()=>http(200,cred('A','signed'));
  await a.signInWithPassword('A','synthetic');
  const b=new CommunityLabClient({supabaseUrl:sameUrl,publishableKey:'sb_publishable_beta'});
  assert.equal(b.session,null);
  await assert.rejects(b.getValidSignedSession(),/Sign in before/);
  assert.notEqual(storageKey(a.config),storageKey(b.config));
});

test('config isolate: separate sign-ins, logout and scoped tokenless broadcast',async()=>{
  memory.clear();local.clear();
  const a=new CommunityLabClient(config('-sep','sb_publishable_alpha'));
  const b=new CommunityLabClient(config('-sep','sb_publishable_beta'));
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('grant_type=password'))
      return http(200,cred(options.headers.apikey.endsWith('alpha')?'A':'B','new'));
    return http(200,{});
  };
  await a.signInWithPassword('A','synthetic');await b.signInWithPassword('B','synthetic');
  assert.equal(a.session.userId,'A');assert.equal(b.session.userId,'B');
  await a.signOut();
  assert.equal(a.session,null);assert.equal(b.session.userId,'B');
  const message=local.get(NOTICE_KEY);
  assert.ok(message);
  assert.equal(JSON.parse(message).scope,configScope(a.config));
  assert.ok(!message.includes('sb_publishable_'));
  assert.ok(!message.includes('TEST_JWT'));
  assert.ok(!message.includes('TEST_REFRESH_SECRET'));
  assert.ok(!message.includes('"A"'));
  for(const cb of handlers)cb({key:NOTICE_KEY,newValue:message});
  assert.equal(b.session.userId,'B');
  assert.equal(memory.has(storageKey(a.config)),false);
  assert.equal(memory.has(storageKey(b.config)),true);
  await b.signOut();
  assert.equal(b.session,null);
});

test('config isolate: legacy unbound session is discarded, never migrated or forwarded',async()=>{
  memory.clear();local.clear();
  memory.set(LEGACY_KEY,JSON.stringify({
    accessToken:'TEST_JWT_legacy',refreshToken:'TEST_REFRESH_SECRET_legacy',
    userId:'legacy',expiresAt:Date.now()+1e6,email:null
  }));
  const a=new CommunityLabClient(config('-legacy'));
  assert.equal(a.session,null);assert.equal(memory.has(LEGACY_KEY),false);
  let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected HTTP');};
  await assert.rejects(a.query('read'),/Sign in before/);
  assert.equal(calls,0);
});

test('config isolate: malformed v2, forged config envelope and blocked storage fail closed',()=>{
  memory.clear();local.clear();
  const ca=config('-valid'),cb=config('-broken');
  const a=new CommunityLabClient(ca);
  memory.set(storageKey(ca),JSON.stringify(fixture(ca,'A')));
  memory.set(storageKey(cb),'{broken-json');
  const b=new CommunityLabClient(cb);
  assert.equal(b.session,null);
  assert.equal(memory.has(storageKey(cb)),false);
  assert.equal(memory.has(storageKey(ca)),true);
  const cc=config('-forged');
  memory.set(storageKey(cc),JSON.stringify(fixture(ca,'A')));
  const c=new CommunityLabClient(cc);
  assert.equal(c.session,null);
  const cd=config('-denied');
  const previous=globalThis.sessionStorage.getItem;
  try{
    globalThis.sessionStorage.getItem=()=>{throw Error('STORAGE_DENIED');};
    const d=new CommunityLabClient(cd);
    assert.equal(d.session,null);
  }finally{globalThis.sessionStorage.getItem=previous;}
  assert.equal(a.session,null); // a was constructed before fixture was injected
});

test('config isolate: simultaneous A/B refresh and A logout do not cancel B rotation',async()=>{
  memory.clear();local.clear();
  const ca=config('-raceA'),cb=config('-raceB');
  memory.set(storageKey(ca),JSON.stringify(fixture(ca,'A',10)));
  memory.set(storageKey(cb),JSON.stringify(fixture(cb,'B',10)));
  const a=new CommunityLabClient(ca),a2=new CommunityLabClient(ca);
  const b=new CommunityLabClient(cb),b2=new CommunityLabClient(cb);
  const pendingA=defer(),pendingB=defer();
  let ac=0,bc=0;
  globalThis.fetch=async(url,options)=>{
    if(String(url).includes('grant_type=refresh_token')){
      const isA=options.headers.apikey===ca.publishableKey;
      if(isA){ac++;return pendingA.promise;}
      bc++;return pendingB.promise;
    }
    return http(200,{});
  };
  const oldA=a.getValidSignedSession(),alsoA=a2.getValidSignedSession();
  const nextB=b.getValidSignedSession(),alsoB=b2.getValidSignedSession();
  await Promise.resolve();
  assert.equal(ac,1);assert.equal(bc,1);
  await a.signOut();
  assert.equal(a2.session,null);
  pendingB.resolve(http(200,cred('B','rotated')));
  assert.equal((await nextB).userId,'B');
  assert.equal((await alsoB).userId,'B');
  pendingA.resolve(http(200,cred('A','stale')));
  await assert.rejects(oldA,/SESSION_STALE_OR_LOGGED_OUT/);
  await assert.rejects(alsoA,/SESSION_STALE_OR_LOGGED_OUT/);
  assert.equal(b.session.userId,'B');
  assert.equal(JSON.parse(memory.get(storageKey(cb))).session.refreshToken,'TEST_REFRESH_SECRET_B_rotated');
  assert.equal(memory.has(storageKey(ca)),false);
});

test('config isolate: notification rejects legacy/bad scopes, matches only same config',()=>{
  memory.clear();local.clear();
  const ca=config('-notA','sb_publishable_alpha');
  const cb={supabaseUrl:ca.supabaseUrl,publishableKey:'sb_publishable_beta'};
  memory.set(storageKey(ca),JSON.stringify(fixture(ca,'A')));
  memory.set(storageKey(cb),JSON.stringify(fixture(cb,'B')));
  const a=new CommunityLabClient(ca),a2=new CommunityLabClient(ca);
  const b=new CommunityLabClient(cb);
  const old=JSON.stringify({kind:'logout',scope:ca.supabaseUrl,nonce:'old'});
  for(const cb of handlers)cb({key:'dreamwishwand-community-logout-notice-v1',newValue:old});
  assert.equal(a.session.userId,'A');assert.equal(b.session.userId,'B');
  for(const listener of handlers)listener({key:NOTICE_KEY,newValue:'bad-json'});
  assert.equal(a.session.userId,'A');
  const notice=JSON.stringify({kind:'logout',scope:configScope(ca),nonce:'x'});
  for(const listener of handlers)listener({key:NOTICE_KEY,newValue:notice});
  assert.equal(a.session,null);assert.equal(a2.session,null);
  assert.equal(b.session.userId,'B');
  assert.ok(!notice.includes('sb_publishable_'));
  assert.ok(!notice.includes('TEST_'));
});
