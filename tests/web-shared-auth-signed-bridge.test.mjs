import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOwnerReadRevalidation} from '../src/lib/dreamsnaps/owner-read-revalidation.js';
import {createOwnerSharedAuthConsumer} from '../src/lib/dreamsnaps/owner-shared-auth-consumer.js';
import {SOURCE153_BROWSER_E2_PRODUCTION_ENABLED} from '../src/lib/dreamsnaps/source153-owner-browser-e2.js';
import {OWNER_PRODUCT_READONLY_ENABLED,OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED} from '../src/lib/dreamsnaps/owner-product-readonly.js';
import {SOURCE153_OWNER_V2_LIVE_ENABLED} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
import {OWNER_REVALIDATION_PRODUCTION_ENABLED} from '../src/lib/dreamsnaps/owner-read-revalidation.js';
import {OWNER_MANAGEMENT_ENABLED} from '../src/lib/dreamsnaps/owner-management.js';

const txt=path=>readFileSync(path,'utf8');
const route=txt('src/routes/dreamsnaps/my/manage/source153-shared-e2/+page.svelte');
const chrome=txt('scripts/web-shared-auth-signed-bridge-chrome.mjs');
const fixture=txt('scripts/web-shared-auth-signed-bridge-fixture.py');

test('all SIX Owner product/Source flags and old developer bridge flag remain OFF',()=>{
  assert.deepEqual([
    OWNER_MANAGEMENT_ENABLED,SOURCE153_OWNER_V2_LIVE_ENABLED,
    SOURCE153_BROWSER_E2_PRODUCTION_ENABLED,OWNER_REVALIDATION_PRODUCTION_ENABLED,
    OWNER_PRODUCT_READONLY_ENABLED,OWNER_PRODUCT_MANAGED_INGRESS_ACCEPTED
  ],[false,false,false,false,false,false]);
  assert.ok(route.includes('import.meta.env.DEV'));
  assert.ok(route.includes("import.meta.env.VITE_DDVRE_SHARED_BRIDGE==='LOCAL_DISPOSABLE_ONLY'"));
  assert.ok(route.includes('data-disposable-owner-bridge="disabled"'));
  assert.ok(route.includes('data-owner-actions="disabled"'));
});

test('disposable route consumes shared browser Auth and accepted Source153/WEB267/PR291 adapters only',()=>{
  for(const value of ['createCommunityBrowserClient','createOwnerSharedAuthConsumer',
    'createOwnerReadRevalidation','readIsolatedSource153Owner',
    'consumer.attach()','consumer?.routeChanged','client.signInWithPassword',
    'client.signOut()','consumer.inspect({fresh})'])assert.ok(route.includes(value),value);
  for(const value of ['ownerReadVerified=true','actionsEnabled=true',
    'SOURCE153_OWNER_V2_LIVE_ENABLED = true','OWNER_PRODUCT_READONLY_ENABLED = true',
    '/api/private/dreamsnaps/owner-authority'])assert.ok(!route.includes(value));
  assert.ok(!route.includes('{view.workId}'));
  assert.ok(!route.includes('{view.photoMediaId}'));
  assert.ok(!route.includes('{view.accountId}'));
});

test('local bridge and browser fixture cannot be mistaken for managed ingress',()=>{
  assert.ok(fixture.includes('tests/comm-e2-source153-signed-positive.py'));
  assert.ok(fixture.includes('https://wand-disposable-e2.invalid'));
  assert.ok(fixture.includes('scripts/vite-source153-e2.config.mjs'));
  assert.ok(chrome.includes('page.addInitScript'));
  assert.ok(chrome.includes("virtual:'https://wand-disposable-e2.invalid'"));
  for(const value of ['cache-control','cdn-cache-control','surrogate-control','vary'])
    assert.ok(chrome.includes(value),value);
  assert.ok(chrome.includes("delete headers['cdn-cache-control']"));
  assert.ok(chrome.includes('data-bridge-projection'));
  assert.ok(chrome.includes('WEB_SHARED_SIGNED_BRIDGE_LOCAL_BROWSER_PASS'));
});

test('session event and Work change fence stale candidate, never enable Owner rights',async()=>{
  const work='11111111-1111-4111-8111-111111111111';
  let listener;
  let calls=0;
  const session={accessToken:'ephemeral.test',userId:'22222222-2222-4222-8222-222222222222',
    expiresAt:Date.now()+600_000};
  const client={
    config:{supabaseUrl:'https://wand-disposable-e2.invalid',publishableKey:'fixture-public-only'},
    session,subscribeSession(fn){listener=fn;return()=>{};},
    async getValidSignedSession(){return {...session};}
  };
  const owner=createOwnerReadRevalidation({read:async()=>{calls++;return {status:'BACKEND_UNAVAILABLE'};}});
  const bridge=createOwnerSharedAuthConsumer({client,controller:owner,enabled:true});
  bridge.attach();bridge.routeChanged(work);
  await bridge.inspect();
  assert.equal(calls,1);
  assert.equal(owner.getState().snapshot,null);
  assert.equal(owner.getState().actionsEnabled,false);
  listener({kind:'logged-out',generation:2,logoutEpoch:1});
  assert.equal(owner.getState().view,null);
  assert.equal(owner.getState().canInspect,false);
  bridge.routeChanged('33333333-3333-4333-8333-333333333333');
  assert.equal(owner.getState().view,null);
  bridge.dispose();
});

test('test-only fixture runs real signer CAS withdrawal, not browser grant/write',()=>{
  assert.ok(fixture.includes('owner("A","action",original,action="withdraw"'));
  assert.ok(fixture.includes('expectedRowVersion=1,expectedAuthorizationEpoch=1'));
  assert.ok(fixture.includes('assert not any(os.getenv(k)'));
  assert.ok(!route.includes('action="withdraw"'));
});
