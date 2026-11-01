import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SOURCE153_BROWSER_E2_PRODUCTION_ENABLED,safeSource153OwnerView,
  loginDisposableGoTrue,readIsolatedSource153Owner
} from '../src/lib/dreamsnaps/source153-owner-browser-e2.js';
import {SOURCE153_OWNER_V2_LIVE_ENABLED} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
import {OWNER_MANAGEMENT_ENABLED} from '../src/lib/dreamsnaps/owner-management.js';
const workId='11111111-1111-4111-8111-111111111111';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all three production live/action flags remain strictly OFF',()=>{
 assert.equal(SOURCE153_BROWSER_E2_PRODUCTION_ENABLED,false);
 assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
 const page=text('src/routes/dreamsnaps/my/manage/source153-e2/+page.svelte');
 assert.ok(page.includes('import.meta.env.DEV'));
 assert.ok(/VITE_DDVRE_E2_OWNER_READONLY\\s*===\\s*'LOCAL_DISPOSABLE_ONLY'/.test(page));
 assert.ok(page.includes('if(!localOnly || !token'));
 assert.ok(page.includes('afterNavigate'));
 assert.ok(page.includes("token='';email='';password=''"));
 assert.ok(!page.includes('getPublicCommunityMedia'));
 assert.ok(!page.includes('signMedia'));
 assert.ok(!page.includes('window.localStorage'));
});

test('no old @1 mock or caller Account/Media/Storage/JWT promoted in rendering',()=>{
 const view=safeSource153OwnerView({
  status:'SOURCE153_SCHEMA_CANDIDATE_ONLY',ownerReadVerified:false,
  actionsEnabled:false,liveBackendEnabled:false,snapshot:null,
  projectionCandidate:{
   kind:'OriginalCompetition',isCompetitionEntry:true,grantState:'recorded',
   policyReceiptSourceClaim:'UNVERIFIED',localDeletionState:'PUBLIC_DISABLED',
   rowVersion:1,authorizationEpoch:1,publicUsageAuthorized:false,
   actionsEnabled:false,publicDetailEnabled:false,mediaSigningEnabled:false,
   mediaId:'SECRET_MEDIA',ownerAccountId:'SECRET_ACCOUNT',
   storageKey:'SECRET_STORAGE',signedUrl:'SECRET_SIGNER',token:'SECRET_JWT',
   policyVersionText:'000001'
  }
 });
 assert.equal(view.kind,'OriginalCompetition');
 assert.equal(view.entryState,'FROZEN_ORIGINAL_ENTRY');
 assert.equal(view.sourceCandidateOnly,true);
 assert.equal(view.ownerReadVerified,false);
 assert.equal(view.liveBackendEnabled,false);
 assert.equal(view.actionsEnabled,false);
 const serialized=JSON.stringify(view);
 for(const secret of ['SECRET_MEDIA','SECRET_ACCOUNT','SECRET_STORAGE','SECRET_SIGNER','SECRET_JWT','000001'])assert.ok(!serialized.includes(secret));
 const post=safeSource153OwnerView({...view,
  status:'SOURCE153_SCHEMA_CANDIDATE_ONLY',
  projectionCandidate:{...{
    kind:'PostEventCreation',isCompetitionEntry:false,grantState:'withdrawn',
    policyReceiptSourceClaim:'UNVERIFIED',localDeletionState:'PUBLIC_DISABLED',
    rowVersion:2,authorizationEpoch:2,publicUsageAuthorized:false,
    actionsEnabled:false,publicDetailEnabled:false,mediaSigningEnabled:false
  }},sourceCandidateOnly:true});
 assert.equal(post.entryState,'NO_COMPETITION_ENTRY');
 assert.equal(post.publicDisabled,true);
 assert.equal(safeSource153OwnerView({...view,actionsEnabled:true}).sourceCandidateOnly,false);
 assert.equal(safeSource153OwnerView({...view,snapshot:{}}).sourceCandidateOnly,false);
 assert.equal(safeSource153OwnerView({...view,ownerReadVerified:true}).sourceCandidateOnly,false);
});

test('wrong UUID, absent local signed session and invalid action envelope reject without HTTP',async()=>{
 let calls=0;
 const fake=async()=>{++calls;throw Error('unexpected');};
 const args={fetchImpl:fake,token:'token',anonKey:'anon',requestGeneration:3,latestGeneration:3,workId:'invalid'};
 assert.equal((await readIsolatedSource153Owner(args)).status,'SOURCE_CONTRACT_REJECTED');
 assert.equal((await readIsolatedSource153Owner({...args,workId,token:''})).status,'SOURCE_CONTRACT_REJECTED');
 assert.equal((await readIsolatedSource153Owner({...args,workId,token:''})).status,'SOURCE_CONTRACT_REJECTED');
 assert.equal((await readIsolatedSource153Owner({...args,workId,requestGeneration:2})).status,'STALE_RESPONSE');
 assert.equal(calls,0);
 const d=await readIsolatedSource153Owner({...args,workId,requestGeneration:2,latestGeneration:3});
 assert.equal(d.status,'STALE_RESPONSE');
 assert.equal(calls,0);
});

test('GoTrue test browser login requires local user lookup, returns token only in memory',async()=>{
 const history=[];
 const http=async (url,opts)=>{
   history.push({url,options:opts});
   if(url.endsWith('/token?grant_type=password'))
     return {status:200,json:async()=>({access_token:'a.b.c'})};
   return {status:200,json:async()=>({id:workId})};
 };
 const r=await loginDisposableGoTrue({fetchImpl:http,email:'synthetic@example.invalid',password:'synthetic-pass',anonKey:'fake-public'});
 assert.equal(r.status,'SIGNED_LOCAL_SESSION_CANDIDATE');
 assert.equal(r.token,'a.b.c');
 assert.equal(history.length,2);
 assert.equal(history[0].options.cache,'no-store');
 assert.equal(history[1].options.headers.Authorization,'Bearer a.b.c');
 const denied=await loginDisposableGoTrue({fetchImpl:async()=>({status:401}),email:'test',password:'x',anonKey:'public'});
 assert.equal(denied.token,null);
});

test('real HTTP projection through unchanged WEB267 strict decoder fails closed on 401,409, unsafe cache, stale generation',async()=>{
 const headers=new Headers({'Cache-Control':'private, no-store, max-age=0',
  'CDN-Cache-Control':'no-store','Surrogate-Control':'no-store','Vary':'Authorization, Origin'});
 const one=(status)=>async()=>({status,headers,json:async()=>({ok:false})});
 for(const [status,expected] of [[401,'BACKEND_UNAVAILABLE'],[403,'BACKEND_UNAVAILABLE'],[409,'REFRESH_REQUIRED'],[412,'REFRESH_REQUIRED']]){
   const got=await readIsolatedSource153Owner({
     fetchImpl:one(status),workId,token:'signed-opaque',anonKey:'anon',
     requestGeneration:5,latestGeneration:5
   });
   assert.equal(got.status,expected);
   assert.equal(got.sourceCandidateOnly,false);
   assert.equal(got.actionsEnabled,false);
 }
 const bad=await readIsolatedSource153Owner({
  fetchImpl:async()=>({status:200,headers:new Headers(),json:async()=>({ok:true})}),
  workId,token:'signed',anonKey:'public',requestGeneration:1,latestGeneration:1
 });
 assert.equal(bad.status,'UNSAFE_CACHE_POLICY');
});


test('new-only signed browser keeps prior source CAS and rejects stale owner/session navigation',()=>{
 const page=text('src/routes/dreamsnaps/my/manage/source153-e2/+page.svelte');
 const chrome=text('scripts/web-source153-signed-owner-negative-chrome.mjs');
 const fixture=text('scripts/web-source153-signed-owner-negative-fixture.py');
 const controller=text('src/lib/dreamsnaps/owner-read-revalidation.js');
 assert.ok(page.includes('createOwnerReadRevalidation'));
 assert.ok(controller.includes('expectedRowVersion:previousCas?.rowVersion'));
 assert.ok(controller.includes('expectedAuthorizationEpoch:previousCas?.authorizationEpoch'));
 assert.ok(controller.includes('lastCas=Object.freeze({rowVersion:view.rowVersion'));
 assert.ok(page.includes('disabled={working && !token}'));
 assert.ok(page.includes("password='';email=''"));
 for(const token of ['DOM_A11Y','IDENTITY','ACCOUNT','CREATOR','CAS','WITHDRAWN',
   'POLICY','RACE_WORK','RACE_SESSION','RACE_HISTORY']){
   assert.ok(chrome.includes("'"+token+"'"));
   assert.ok(fixture.includes('"'+token+'"'));
 }
 assert.ok(chrome.includes("route.fetch()"));
 assert.ok(chrome.includes('PROJECTION_MUST_BE_POPULATED_DURING_DOM_AUDIT'));
 assert.ok(chrome.includes('JWT_IN_LIVE_DOM'));
 assert.ok(fixture.includes('insert into private.account_privacy_suppressions(account_id)'));
 assert.ok(fixture.includes('len(counts)==11'));
 assert.ok(!chrome.includes('route.fulfill({status:200'));
 assert.ok(!page.includes('localStorage'));
});
