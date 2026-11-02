import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOwnerSharedAuthConsumer} from '../src/lib/dreamsnaps/owner-shared-auth-consumer.js';
import {createOwnerReadRevalidation} from '../src/lib/dreamsnaps/owner-read-revalidation.js';
import {OWNER_PRODUCT_READONLY_ENABLED,OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED}
 from '../src/lib/dreamsnaps/owner-product-readonly.js';
const workA='11111111-1111-4111-8111-111111111111';
const workB='22222222-2222-4222-8222-222222222222';
const actorA='33333333-3333-4333-8333-333333333333';
const actorB='44444444-4444-4444-8444-444444444444';
const session=(userId=actorA,accessToken='candidate-a')=>({
 userId,accessToken,refreshToken:'never-shown',expiresAt:Date.now()+300000,
 email:'private@example.invalid'
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function mockClient(){
 const listeners=new Set();
 const c={
  config:{supabaseUrl:'https://example.test',publishableKey:'sb_publishable_dev_fixture'},
  session:session(),leases:0,held:null,events:[],
  subscribeSession(cb){listeners.add(cb);return ()=>listeners.delete(cb)},
  async getValidSignedSession({signal}={}){c.leases++;
   if(c.held)return c.held.promise;
   if(signal?.aborted)throw Error('ABORTED');
   return {...c.session};
  },
  emit(kind){const event={kind,generation:c.events.length+1,logoutEpoch:kind==='logged-out'?1:0};c.events.push(event);for(const cb of [...listeners])cb(event)},
  count:()=>listeners.size
 };
 return c;
}
function candidateRead({status='SOURCE153_SCHEMA_CANDIDATE_ONLY',state='recorded'}={}){
 let hits=[];
 const controller=createOwnerReadRevalidation({read:async args=>{
  hits.push({workId:args.workId,expectedRowVersion:args.expectedRowVersion,
    expectedAuthorizationEpoch:args.expectedAuthorizationEpoch});
  return status==='SOURCE153_SCHEMA_CANDIDATE_ONLY'?{
   status,kind:'PostEventCreation',entryState:'NO_COMPETITION_ENTRY',
   grantState:state,policyScope:'UNVERIFIED',publicDisabled:state==='withdrawn',
   rowVersion:2,authorizationEpoch:3,sourceCandidateOnly:true,
   ownerReadVerified:false,actionsEnabled:false,liveBackendEnabled:false,snapshot:null
  }:{status,sourceCandidateOnly:false,snapshot:null,ownerReadVerified:false,
    actionsEnabled:false,liveBackendEnabled:false};
 }});
 return {controller,hits};
}
function harness({enabled=true}={}){
 const client=mockClient(),stub=candidateRead();
 const notices=[];
 const bridge=createOwnerSharedAuthConsumer({
  client,controller:stub.controller,enabled,
  onSessionChange:v=>notices.push(v)
 });
 bridge.attach();bridge.routeChanged(workA);
 return {client,bridge,notices,...stub};
}
test('new Owner consumer contract and ALL production gates hard OFF',()=>{
 assert.equal(OWNER_PRODUCT_READONLY_ENABLED,false);
 assert.equal(OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED,false);
 const h=harness({enabled:false});
 return h.bridge.inspect().then(v=>{
  assert.equal(h.client.leases,0);assert.equal(h.hits.length,0);
  assert.equal(v.ownerReadVerified,false);h.bridge.dispose();
 });
});
test('shared Session subscribe is tokenless, OFF observer still reflects signout',()=>{
 const h=harness({enabled:false});
 assert.equal(h.client.count(),1);
 h.client.session=null;h.client.emit('logged-out');
 assert.deepEqual(h.notices,[true,false]);
 assert.equal(h.controller.getState().snapshot,null);
 assert.deepEqual(Object.keys(h.client.events[0]).sort(),['generation','kind','logoutEpoch']);
 h.bridge.dispose();assert.equal(h.client.count(),0);
});
test('signed Session lease is obtained once and does not promote Source candidate to authority',async()=>{
 const h=harness();
 let v=await h.bridge.inspect();
 assert.equal(h.client.leases,1);assert.equal(h.hits.length,1);
 assert.equal(v.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(v.snapshot,null);assert.equal(v.ownerReadVerified,false);
 assert.equal(v.actionsEnabled,false);assert.equal(v.liveBackendEnabled,false);
 assert.equal(v.view.sourceCandidateOnly,true);
 h.bridge.dispose();
});
test('same bearer recheck retains prior CAS rather than dropping it',async()=>{
 const h=harness();
 await h.bridge.inspect();await h.bridge.inspect();
 assert.equal(h.hits.length,2);
 assert.equal(h.hits[1].expectedRowVersion,2);
 assert.equal(h.hits[1].expectedAuthorizationEpoch,3);
 h.bridge.dispose();
});
test('logout before held getValidSignedSession resolves drops old Work response',async()=>{
 const h=harness(),d=deferred();h.client.held=d;
 const pending=h.bridge.inspect();
 h.client.session=null;h.client.emit('logged-out');
 d.resolve(session());await pending;
 assert.equal(h.hits.length,0);
 assert.equal(h.controller.getState().view,null);
 h.bridge.dispose();
});
test('Work A to B during pending lease blocks old Work read',async()=>{
 const h=harness(),d=deferred();h.client.held=d;
 const pending=h.bridge.inspect();h.bridge.routeChanged(workB);
 d.resolve({...h.client.session});await pending;
 assert.equal(h.hits.length,0);
 assert.equal(h.controller.getState().view,null);
 h.client.held=null;await h.bridge.inspect();
 assert.equal(h.hits.at(-1).workId,workB);h.bridge.dispose();
});
test('Account A to B invalidates candidate and read never reflects A',async()=>{
 const h=harness();
 await h.bridge.inspect();
 h.client.session=session(actorB,'candidate-b');h.client.emit('account-changed');
 assert.equal(h.controller.getState().view,null);
 await h.bridge.inspect();assert.equal(h.client.leases,2);
 assert.equal(h.controller.getState().ownerReadVerified,false);h.bridge.dispose();
});
test('rotated Session event invalidates prior CAS, not a local refresh implementation',async()=>{
 const h=harness();
 await h.bridge.inspect();
 h.client.session=session(actorA,'candidate-a2');h.client.emit('refreshed');
 assert.equal(h.controller.getState().view,null);
 assert.equal(h.hits.length,1);
 await h.bridge.inspect();assert.equal(h.hits.length,2);
 assert.equal(h.hits[1].expectedRowVersion,undefined);
 h.bridge.dispose();
});
test('expired credential fails closed, shared Session function owns renewals',async()=>{
 const h=harness();
 h.client.session.expiresAt=Date.now()+500;
 const v=await h.bridge.inspect();
 assert.equal(h.hits.length,0);
 assert.equal(v.ownerReadVerified,false);
 h.bridge.dispose();
});
test('PR291 explicit Fresh neutral HTTP403 cannot be bypassed by ordinary Inspect',async()=>{
 const client=mockClient(),calls=[];
 const controller=createOwnerReadRevalidation({read:async args=>{
  calls.push({row:args.expectedRowVersion});
  if(calls.length===2)return {status:'BACKEND_UNAVAILABLE',snapshot:null};
  return {status:'SOURCE153_SCHEMA_CANDIDATE_ONLY',kind:'PostEventCreation',
   entryState:'NO_COMPETITION_ENTRY',grantState:'recorded',
   policyScope:'UNVERIFIED',publicDisabled:false,rowVersion:1,authorizationEpoch:1,
   sourceCandidateOnly:true,ownerReadVerified:false,actionsEnabled:false,
   liveBackendEnabled:false,snapshot:null};
 }});
 const b=createOwnerSharedAuthConsumer({client,controller,enabled:true});
 b.attach();b.routeChanged(workA);
 await b.inspect();await b.inspect();
 let s=controller.getState();assert.equal(s.status,'BACKEND_UNAVAILABLE');
 assert.equal(s.canInspect,false);assert.equal(s.canFreshRead,true);
 await b.inspect();assert.equal(calls.length,2);
 await b.inspect({fresh:true});
 assert.equal(calls.length,3);assert.equal(calls[2].row,undefined);
 assert.equal(controller.getState().ownerReadVerified,false);
 b.dispose();
});
test('invalid or unauthenticated Session does not call backend or reveal token',async()=>{
 const h=harness();
 h.client.session=null;
 const v=await h.bridge.inspect();
 assert.equal(h.hits.length,0);assert.equal(v.snapshot,null);
 assert.ok(!JSON.stringify(v).includes('never-shown'));
 h.bridge.dispose();
});
test('actual route explicitly uses shared Consumer, stable UX 8 locales, no auth duplication',()=>{
 const page=readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../src/lib/dreamsnaps/owner-shared-auth-consumer.js',import.meta.url),'utf8');
 assert.ok(page.includes('createOwnerSharedAuthConsumer'));
 assert.ok(page.includes('sharedAuthConsumer.attach()'));
 assert.ok(page.includes('sharedAuthConsumer?.routeChanged(route.workId)'));
 assert.ok(page.includes('sharedAuthConsumer.inspect({fresh})'));
 assert.ok(bridge.includes('getValidSignedSession({signal:requestAbort.signal})'));
 assert.ok(bridge.includes('client.subscribeSession(onSessionEvent)'));
 assert.ok(page.includes('aria-live="polite"'));
 assert.ok(page.includes('data-owner-product-read="disabled"'));
 assert.ok(page.includes('data-owner-preview="local-only"'));
 assert.ok(page.includes('data-owner-action="image-grant"'));
 for(const loc of ['en','fr','it','de',"'es-ES'",'ja',"'zh-CN'","'pt-BR'"])
  assert.ok(page.includes(loc));
 for(const banned of ['loginDisposableGoTrue','signInWithPassword','refresh_token','actorAccountId'])
  assert.ok(!page.includes(banned),banned);
});

test('combined repaired Auth never cold imports signed A from persisted v2 bytes',()=>{
 const auth=readFileSync(new URL('../src/lib/community/staging-http-client.ts',import.meta.url),'utf8');
 const load=auth.match(/function loadSession\(_config: CommunityLabConfig, _scope: string\): CommunitySession \| null \{([\s\S]*?)\n\}/)?.[1];
 assert.ok(load,'MISSING_COLD_SESSION_ENTRY');
 assert.match(load,/return null;/);
 assert.doesNotMatch(load,/sessionStorage\.getItem/);
 assert.ok(auth.includes("throw new Error('SESSION_STORAGE_WRITE_FAILED')"));
 assert.ok(auth.includes("subscribeSession(callback:SessionListener)"));
 assert.ok(auth.includes("async getValidSignedSession"));
 const product=readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
 assert.ok(product.includes('data-owner-session-relogin'));
 assert.ok(product.includes('ownerReadCopy.signInAgain'));
 for(const [loc,phrase] of Object.entries({
  en:'reload or reopening',ja:'再ログイン',
  'fr':'reconnectez-vous','it':'accedi di nuovo','de':'erneut anmelden',
  'es-ES':'vuelve a iniciar','zh-CN':'重新登录','pt-BR':'login novamente'
 }))assert.ok(product.includes(phrase),'RELOGIN_LOCALE_'+loc);
});
