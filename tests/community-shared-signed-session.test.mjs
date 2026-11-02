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
const KEY='dreamwishwand-community-session-v1';
let id=0;
function setup(user='A',seconds=20){
  memory.clear();local.clear();id++;
  const config={supabaseUrl:'https://community-test-'+id+'.invalid',
    publishableKey:'sb_publishable_test'};
  const s=cred(user,'old',seconds);
  memory.set(KEY,JSON.stringify({
    accessToken:s.access_token,refreshToken:s.refresh_token,
    expiresAt:Date.now()+seconds*1000,userId:user,email:null
  }));
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
  assert.equal(JSON.parse(memory.get(KEY)).refreshToken,'TEST_REFRESH_SECRET_A_rotated');
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
  assert.equal(JSON.parse(memory.get(KEY)).userId,'B');
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
  const payload=JSON.stringify({scope:a.config.supabaseUrl,kind:'logout',nonce:'one'});
  for(const cb of handlers)cb({key:'dreamwishwand-community-logout-notice-v1',newValue:payload});
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
