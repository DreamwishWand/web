import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 OWNER_PRODUCT_READONLY_ENABLED,OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED,
 OWNER_PRODUCT_READONLY_CONTRACT,ownerProductSignedSessionCandidate,
 ownerProductManagedEndpoint,createOwnerProductReadOnlyAdapter
} from '../src/lib/dreamsnaps/owner-product-readonly.js';

const actor='11111111-1111-4111-8111-111111111111';
const config={supabaseUrl:'https://auth.example.test',publishableKey:'sb_publishable_test_fixture'};
const candidate=(session={accessToken:'opaque.jwt.test',userId:actor,
 expiresAt:Date.now()+300_000})=>({config,session:{refreshToken:'secret-not-for-ui',
 email:'user@example.invalid',...session}});

test('Owner product integration is unconditionally OFF and not a verified Snapshot',()=>{
 assert.equal(OWNER_PRODUCT_READONLY_ENABLED,false);
 assert.equal(OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED,false);
 assert.equal(OWNER_PRODUCT_READONLY_CONTRACT,'wand.dreamsnaps.owner-product-readonly@1');
 const ad=createOwnerProductReadOnlyAdapter({
  client:candidate(),endpoint:'https://auth.example.test/functions/v1/community-dreamsnap-owner',
  appOrigin:'https://wand.example.test',sourceOrigin:config.supabaseUrl
 });
 assert.equal(ad.available,false);
 assert.deepEqual(ad.capabilities,{
  ownerReadVerified:false,actionsEnabled:false,liveBackendEnabled:false,snapshot:null
 });
});

test('persisted session is only a short-lived request candidate; expiry, signed subject shape and config fail closed',()=>{
 const now=Date.now();
 assert.equal(ownerProductSignedSessionCandidate(candidate({accessToken:'x',userId:actor,expiresAt:now+120000}),now)?.expiresAt,now+120000);
 assert.equal(ownerProductSignedSessionCandidate(candidate({accessToken:'x',userId:actor,expiresAt:now+59000}),now),null);
 assert.equal(ownerProductSignedSessionCandidate(candidate({accessToken:'',userId:actor,expiresAt:now+300000}),now),null);
 assert.equal(ownerProductSignedSessionCandidate(candidate({accessToken:'x',userId:'ACCOUNT_VIA_QUERY',expiresAt:now+300000}),now),null);
 assert.equal(ownerProductSignedSessionCandidate({config:{...config,supabaseUrl:'http://insecure.invalid'},session:candidate().session},now),null);
 assert.equal(ownerProductSignedSessionCandidate(null,now),null);
 const s=ownerProductSignedSessionCandidate(candidate(),now);
 assert.ok(s && !('email' in s) && !('refreshToken' in s));
});

test('managed endpoint contract has no Vite relay, arbitrary origin, URL query or HTTP downgrade',()=>{
 const args={appOrigin:'https://wand.example.test',sourceOrigin:'https://auth.example.test'};
 assert.equal(ownerProductManagedEndpoint({...args,endpoint:'https://auth.example.test/functions/v1/community-dreamsnap-owner'})?.transport,'MANAGED_CORS');
 assert.equal(ownerProductManagedEndpoint({...args,endpoint:'https://wand.example.test/api/private/dreamsnaps/owner-authority'})?.transport,'SAME_ORIGIN_BFF');
 for(const endpoint of ['http://auth.example.test/functions/v1/community-dreamsnap-owner',
 'http://127.0.0.1:4175/__source153_e2/functions/v1/community-dreamsnap-owner',
 'https://attacker.test/functions/v1/community-dreamsnap-owner',
 'https://auth.example.test/functions/v1/community-dreamsnap-owner?q=actor',
 'https://auth.example.test/functions/v1/community-dreamsnap-owner#hash',
 'https://auth.example.test/functions/v1/community-dreamsnap-action']){
  assert.equal(ownerProductManagedEndpoint({...args,endpoint}),null,endpoint);
 }
});

test('actual Owner adapter never sends HTTP even with caller-supplied token, route and test-looking env',async()=>{
 let hits=0;
 const client=candidate();
 const ad=createOwnerProductReadOnlyAdapter({
  client,
  endpoint:'https://auth.example.test/functions/v1/community-dreamsnap-owner',
  appOrigin:'https://wand.example.test',sourceOrigin:config.supabaseUrl,
  fetchImpl:async()=>{hits++;throw Error('UNSAFE_FETCH');}
 });
 for(const attempt of [undefined,{
  workId:actor,token:client.session.accessToken,anonKey:config.publishableKey,
  requestGeneration:1,latestGeneration:1
 },{workId:actor,token:'other',requestGeneration:1,latestGeneration:1}]){
  const v=await ad.read(attempt);
  assert.equal(v.status,'BACKEND_UNAVAILABLE');
  assert.equal(v.snapshot,null);
  assert.equal(v.ownerReadVerified,false);
  assert.equal(v.actionsEnabled,false);
  assert.equal(v.liveBackendEnabled,false);
 }
 assert.equal(hits,0);
});

test('real /dreamsnaps/my/manage/ screen uses existing Community client and never synthetic test login',()=>{
 const page=readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
 assert.ok(page.includes('createCommunityBrowserClient'));
 assert.ok(page.includes('createOwnerProductReadOnlyAdapter'));
 assert.ok(page.includes('createOwnerReadRevalidation'));
 assert.ok(page.includes('attachOwnerReadBrowserLifecycle'));
 assert.ok(page.includes('data-owner-product-read="disabled"'));
 assert.ok(page.includes('data-owner-product-projection="candidate-only"'));
 assert.ok(page.includes('sharedAuthConsumer?.routeChanged(route.workId)'));
 assert.ok(page.includes('createOwnerSharedAuthConsumer'));
 assert.ok(page.includes('data-owner-preview="local-only"'));
 assert.ok(page.includes('data-owner-capabilities="all-disabled"'));
 for(const forbidden of ['loginDisposableGoTrue','VITE_DDVRE_E2_LOCAL_ANON_KEY',
  'actorAccountId','policyVersion=1','signedUpload','grantOwnerAccess']){
   assert.ok(!page.includes(forbidden),forbidden);
 }
 for(const loc of ['en','fr','it','de',"'es-ES'",'ja',"'zh-CN'","'pt-BR'"])
  assert.ok(page.includes(loc),'LOCALE_MISSING_'+loc);
});

test('strict WEB267 and PR291 controller are reused without mutation or optimistic authority',()=>{
 const source=readFileSync(new URL('../src/lib/dreamsnaps/owner-product-readonly.js',import.meta.url),'utf8');
 assert.ok(source.includes('classifySource153OwnerHttpFixture'));
 assert.ok(source.includes('safeSource153OwnerView'));
 assert.ok(source.includes("['cache-control','cdn-cache-control','surrogate-control','vary']"));
 assert.ok(source.includes("cache:'no-store',credentials:'omit',redirect:'error'"));
 assert.ok(!source.includes("headers['cache-control']='no-store'"));
 assert.ok(!source.includes("ownerReadVerified:true"));
 const page=readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
 assert.ok(page.includes("if(!productReadAvailable || !client || route.status!=='authority-pending'"));
});
