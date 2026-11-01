import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED, localOwnerTestOrigin,
  safeSignedOwnerCandidate, disposableGoTrueLogin, readDisposableSignedOwner
} from '../src/lib/dreamsnaps/disposable-signed-owner-browser.js';
import {
  OWNER_MANAGEMENT_ENABLED, parseOwnerWorkRoute
} from '../src/lib/dreamsnaps/owner-management.js';
import {
  SOURCE153_OWNER_V2_LIVE_ENABLED,
  SOURCE153_OWNER_PROJECTION_CONTRACT,
  PRIVATE_OWNER_CONSUMER_V2_CONTRACT
} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
import {DISPOSABLE_OWNER_READ_COPY} from '../src/lib/dreamsnaps/disposable-owner-read-copy.js';

const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const work='11111111-1111-4111-8111-111111111111';
test('all production Owner and v2 flags remain disabled; only dev-loopback seam',()=>{
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
 assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
 assert.equal(DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED,false);
 for(const bad of ['https://127.0.0.1:54321/','http://external.invalid/','http://127.0.0.1.evil.invalid/',
    'http://user:pw@127.0.0.1/','http://127.0.0.1:54321/path','http://localhost:54321/?key=x']){
   assert.equal(localOwnerTestOrigin(bad,'localhost'),null,bad);
 }
 assert.equal(localOwnerTestOrigin('http://127.0.0.1:54321/','127.0.0.1'),
  'http://127.0.0.1:54321');
 assert.equal(localOwnerTestOrigin('http://127.0.0.1:54321/','example.org'),null);
 assert.deepEqual(parseOwnerWorkRoute('?work='+work),{status:'authority-pending',workId:work});
 for(const invalid of ['?work='+work+'&work='+work,'?work='+work+'&tip='+work,
    '?work=broken','?work=00000000-0000-0000-0000-000000000000'])
  assert.equal(parseOwnerWorkRoute(invalid).status,'invalid');
});
test('all eight developer-only locales use same private-safe labels',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(Object.keys(DISPOSABLE_OWNER_READ_COPY).sort(),locales.sort());
 for(const l of locales){
  const c=DISPOSABLE_OWNER_READ_COPY[l];
  for(const k of ['heading','intro','email','password','login','logout','refresh',
     'candidate','unavailable','original','post','recorded','withdrawn','unverified',
     'synthetic','purge','actionsDisabled'])assert.equal(typeof c[k],'string',l+k);
 }
});
test('safe projection is strictly redacted and never grants authority',()=>{
 const c={
  contractVersion:PRIVATE_OWNER_CONSUMER_V2_CONTRACT,
  workId:work,mediaId:'22222222-2222-4222-8222-222222222222',
  creatorProfileId:'33333333-3333-4333-8333-333333333333',
  kind:'OriginalCompetition',isCompetitionEntry:true,policyVersionText:'v1',
  rowVersion:1,authorizationEpoch:1,publicUsageAuthorized:false,
  actionsEnabled:false,mediaSigningEnabled:false,globalPurgeScopeComplete:false,
  grantState:'recorded',policyReceiptSourceClaim:'UNVERIFIED',localDeletionState:'NOT_REQUESTED'
 };
 const result={status:'SOURCE153_SCHEMA_CANDIDATE_ONLY',
  snapshot:null,ownerReadVerified:false,actionsEnabled:false,
  liveBackendEnabled:false,projectionCandidate:c};
 const safe=safeSignedOwnerCandidate(result);
 assert.equal(safe?.entryStatus,'frozen-entry-present');
 assert.equal(safe?.policyStatus,'unverified');
 const str=JSON.stringify(safe);
 for(const value of [work,c.mediaId,c.creatorProfileId,'sourceContractVersion','photoRevisionId','signedUrl'])
  assert.ok(!str.includes(value),value);
 assert.equal(safeSignedOwnerCandidate({...result,ownerReadVerified:true}),null);
 assert.equal(safeSignedOwnerCandidate({...result,snapshot:{}}),null);
 assert.equal(safeSignedOwnerCandidate({...result,projectionCandidate:{...c,publicUsageAuthorized:true}}),null);
 assert.equal(safeSignedOwnerCandidate({...result,projectionCandidate:{...c,mediaSigningEnabled:true}}),null);
 const post=safeSignedOwnerCandidate({...result,projectionCandidate:{...c,
  kind:'PostEventCreation',isCompetitionEntry:false,grantState:'withdrawn',
  localDeletionState:'PUBLIC_DISABLED',policyReceiptSourceClaim:'APPROVED_CANONICAL_RECEIPT'}});
 assert.equal(post?.entryStatus,'post-event-no-entry');
 assert.equal(post?.grantStatus,'withdrawn');
 assert.equal(post?.publicDisabled,true);
 assert.equal(post?.policyStatus,'test-only-receipt');
});
test('source strict v2 contract and @1 mock are never coerced into one another',()=>{
 assert.equal(SOURCE153_OWNER_PROJECTION_CONTRACT,'wand.dreamsnaps.owner-authority-projection@1');
 const mock=load('src/lib/dreamsnaps/owner-management.js');
 const real=load('src/lib/dreamsnaps/source153-owner-consumer-v2.js');
 const adapter=load('src/lib/dreamsnaps/disposable-signed-owner-browser.js');
 const ui=load('src/lib/dreamsnaps/DisposableSignedOwnerRead.svelte');
 const page=load('src/routes/dreamsnaps/my/manage/+page.svelte');
 assert.match(mock,/ownerRead: false/);
 assert.match(mock,/positiveSafe\(grant\.policyVersion\)/);
 assert.match(real,/policyVersionText:g.policyVersionText/);
 assert.match(adapter,/classifySource153OwnerHttpFixture/);
 assert.ok(!adapter.includes('actorAccountId'));
 assert.ok(!adapter.includes('decodeOwnerManagementProjection'));
 assert.ok(!adapter.includes('localStorage'));
 assert.ok(!adapter.includes('sessionStorage'));
 assert.ok(!ui.includes('localStorage'));
 assert.ok(!ui.includes('sessionStorage'));
 assert.match(ui,/getLatestGeneration:\(\)=>generation/);
 assert.match(ui,/data-local-owner-entry/);
 assert.match(page,/\{#if DISPOSABLE_SIGNED_OWNER_BROWSER_ENABLED\}/);
 assert.match(ui,/data-owner-actions-enabled="false"/);
 assert.match(ui,/data-owner-operations="all-disabled"/);
});
test('Node/production cannot call GoTrue or Owner backend even with fake token',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('SHOULD_NOT_FETCH')};
 assert.equal(await disposableGoTrueLogin({
  origin:'http://127.0.0.1:54321',publishableKey:'sb_publishable_TEST',
  email:'user@example.invalid',password:'fake',fetchImpl
 }),null);
 const x=await readDisposableSignedOwner({
  origin:'http://127.0.0.1:54321',publishableKey:'sb_publishable_TEST',
  accessToken:'x'.repeat(80),workId:work,requestGeneration:1,
  latestGeneration:1,fetchImpl
 });
 assert.equal(x.status,'BACKEND_UNAVAILABLE');
 assert.equal(x.snapshot,null);
 assert.equal(x.actionsEnabled,false);
 assert.equal(calls,0);
});
