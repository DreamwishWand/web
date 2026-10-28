import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SOURCE153_OWNER_PROJECTION_CONTRACT as SOURCE,
  PRIVATE_OWNER_CONSUMER_V2_CONTRACT as TARGET,
  SOURCE153_OWNER_V2_LIVE_ENABLED, SOURCE153_OWNER_V2_CAPABILITIES,
  decodeSource153OwnerConsumerV2, classifySource153OwnerHttpFixture
} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
const w='11111111-1111-4111-8111-111111111111';
const creator='22222222-2222-4222-8222-222222222222';
const challenge='33333333-3333-4333-8333-333333333333';
const photo='44444444-4444-4444-8444-444444444444';
const media='55555555-5555-4555-8555-555555555555';
const currentRevision='66666666-6666-4666-8666-666666666666';
const entry='77777777-7777-4777-8777-777777777777';
const other='88888888-8888-4888-8888-888888888888';
const ctx=()=>({workId:w,requestGeneration:4,latestGeneration:4});
const data=(kind='PostEventCreation')=>({
  contractVersion:SOURCE,consumerTarget:TARGET,
  work:{workId:w,creatorProfileId:creator,challengeId:challenge,
    kind,photoRevisionId:photo,photoMediaId:media,
    currentWorkRevisionId:currentRevision,
    ...(kind==='OriginalCompetition'?{entryId:entry,frozenEntryRevisionId:photo}:{})},
  authority:{ownerAuthorized:true,authenticatedAccountBound:true,
    activeIdentityVerified:true,creatorOwnerVerified:true,workPhotoBindingVerified:true,
    mediaOwnershipVerified:true,mediaReady:true,rowVersion:1,
    authorizationEpoch:1,controlState:'consented'},
  grant:{mediaId:media,photoRevisionId:photo,creatorSelfCaptureDeclared:true,
    explicitGrantAccepted:true,consentRecorded:true,lastGrantConsentRevision:1,
    policyVersionText:'v1',policyDigest:'a'.repeat(64),state:'recorded',
    policyReceiptVerified:false,scopeStatus:'UNVERIFIED',publicUsageAuthorized:false},
  deletion:{controlState:'consented',localState:'PUBLIC_DISABLED',
    publicDisabled:true,activeAccountLegalHold:false,
    localProviderReceiptVerified:false,localProviderScope:'SINGLE_FROZEN_MEDIA_RECORD',
    providerStatus:'not_requested',globalPurgeScopeComplete:false,
    cloudCdnIssuedBearerStatus:'UNKNOWN'},
  externalEvidence:{signedRuntimeSessionVerified:false,
    storageProviderObjectVerified:false,officialChallengePhaseVerified:false,
    cloudCdnPhysicalPurgeVerified:false,publicActivationAllowed:false},
  capabilities:{ownerActionsEnabled:false,publicDetail:false,publicMedia:false,
    publish:false,mediaSigner:false}
});
const env=(d=data())=>({ok:true,operation:'authority',contractVersion:SOURCE,data:d});
const result=(d=data(),context=ctx())=>decodeSource153OwnerConsumerV2(env(d),context);
const reject=(d)=>assert.equal(result(d).status,'SOURCE_CONTRACT_REJECTED');
const headers=()=>({'cache-control':'private, no-store, max-age=0',
  'cdn-cache-control':'no-store','surrogate-control':'no-store',
  'vary':'Authorization, Origin','x-content-type-options':'nosniff'});
const http=(body=env(),status=200,h=headers())=>({status,body,headers:h});

test('Source153 wrapper and nested @1 -> consumer target @2, no live activation',()=>{
  const got=result();
  assert.equal(got.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(got.snapshot,null);
  assert.equal(got.ownerReadVerified,false);
  assert.equal(got.actionsEnabled,false);
  assert.equal(got.liveBackendEnabled,false);
  assert.equal(got.projectionCandidate.contractVersion,TARGET);
  assert.equal(got.projectionCandidate.workId,w);
  assert.equal(got.projectionCandidate.mediaId,media);
  assert.equal(got.projectionCandidate.currentWorkRevisionId,currentRevision);
  assert.equal(got.projectionCandidate.photoRevisionId,photo);
  assert.equal(got.projectionCandidate.isCompetitionEntry,false);
  assert.equal(got.projectionCandidate.approvedPurposesForPublication.length,0);
  assert.equal(got.projectionCandidate.publicUsageAuthorized,false);
  assert.equal(got.projectionCandidate.globalPurgeScopeComplete,false);
  assert.equal(got.projectionCandidate.externalPurgeStatus,'UNKNOWN');
  assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
  assert.ok(Object.values(SOURCE153_OWNER_V2_CAPABILITIES).every(v=>v===false));
});

test('Original real Entry must match frozen photo; PostEvent has NO Entry keys',()=>{
  assert.equal(result(data('OriginalCompetition')).projectionCandidate.isCompetitionEntry,true);
  reject({...data('OriginalCompetition'),work:{...data('OriginalCompetition').work,entryId:null}});
  reject({...data('OriginalCompetition'),work:{...data('OriginalCompetition').work,
    frozenEntryRevisionId:other}});
  reject({...data(),work:{...data().work,entryId:null}});
  reject({...data(),work:{...data().work,frozenEntryRevisionId:photo}});
  reject({...data(),work:{...data().work,kind:'OfficialCompetition'}});
});

test('Work/Photo/Media/Grant same-work joins: mismatch fails before any claim',()=>{
  reject({...data(),work:{...data().work,workId:other}});
  reject({...data(),grant:{...data().grant,mediaId:other}});
  reject({...data(),grant:{...data().grant,photoRevisionId:other}});
  reject({...data(),work:{...data().work,photoMediaId:other}});
  reject({...data(),work:{...data().work,photoRevisionId:other}});
  reject({...data(),work:{...data().work,currentWorkRevisionId:'invalid'}});
  reject({...data(),work:{...data().work,creatorProfileId:'invalid'}});
  reject({...data(),work:{...data().work,challengeId:'invalid'}});
  const sameOwnerOtherMedia=result({...data(),work:{...data().work,photoMediaId:other},
    grant:{...data().grant,mediaId:other}});
  // Shape alone cannot detect an alternative same-account Media ID;
  // it is a SOURCE claim only, never a remotely verified Owner snapshot.
  assert.equal(sameOwnerOtherMedia.snapshot,null);
  assert.equal(sameOwnerOtherMedia.ownerReadVerified,false);
  assert.equal(sameOwnerOtherMedia.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
});

test('no caller/route actorAccountId or spoofed JWT, storage or public signer in wire',()=>{
  for(const extra of [
    {ownerAccountId:other},{actorAccountId:other},{authSubject:other},
    {storageKey:'private-path'},{signedUrl:'https://example.invalid/'},
    {jwt:'fake-jwt'}, {userRole:'admin'}, {sourceContractVersion:'fake'}
  ])assert.equal(decodeSource153OwnerConsumerV2({...env(),...extra},ctx()).status,
    'SOURCE_CONTRACT_REJECTED');
  for(const extra of [{ownerAccountId:other},{actorAccountId:other},
    {accountState:'active'},{signedUrl:'url'}, {token:'fake'}]){
    reject({...data(),work:{...data().work,...extra}});
  }
  assert.equal(decodeSource153OwnerConsumerV2(env(),
    {...ctx(),actorAccountId:other}).status,'SOURCE_CONTRACT_REJECTED');
});

test('verified-DB boolean claims must all be explicit true; mediaReady is separate',()=>{
  for(const k of ['ownerAuthorized','authenticatedAccountBound','activeIdentityVerified',
    'creatorOwnerVerified','workPhotoBindingVerified','mediaOwnershipVerified']){
    reject({...data(),authority:{...data().authority,[k]:false}});
    const missing={...data().authority};delete missing[k];
    reject({...data(),authority:missing});
  }
  assert.equal(result({...data(),authority:{...data().authority,mediaReady:false}}).status,
    'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  reject({...data(),authority:{...data().authority,mediaReady:'true'}});
  reject({...data(),authority:{...data().authority,ownerAccountId:other}});
});

test('Grant last event revision distinct from Work CAS/authorization epoch after withdrawal',()=>{
  const d=data();
  const withdrawn={...d,
    authority:{...d.authority,rowVersion:2,authorizationEpoch:2,controlState:'withdrawn'},
    grant:{...d.grant,state:'withdrawn',lastGrantConsentRevision:1},
    deletion:{...d.deletion,controlState:'withdrawn'}};
  const got=result(withdrawn);
  assert.equal(got.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(got.projectionCandidate.rowVersion,2);
  assert.equal(got.projectionCandidate.authorizationEpoch,2);
  assert.equal(got.projectionCandidate.lastGrantConsentRevision,1);
  assert.equal(got.projectionCandidate.grantState,'withdrawn');
  reject({...withdrawn,grant:{...withdrawn.grant,lastGrantConsentRevision:3}});
  reject({...withdrawn,grant:{...withdrawn.grant,lastGrantConsentRevision:0}});
  reject({...withdrawn,authority:{...withdrawn.authority,controlState:'consented'}});
  reject({...withdrawn,deletion:{...withdrawn.deletion,controlState:'consented'}});
  reject({...d,grant:{...d.grant,state:'withdrawn'}});
  assert.equal(decodeSource153OwnerConsumerV2(env(withdrawn),
    {...ctx(),expectedRowVersion:1}).status,'REFRESH_REQUIRED');
  assert.equal(decodeSource153OwnerConsumerV2(env(withdrawn),
    {...ctx(),expectedRowVersion:2,expectedAuthorizationEpoch:2}).status,
    'SOURCE153_SCHEMA_CANDIDATE_ONLY');
});

test('OPAQUE TEXT policy identifier never parsed as number, no scopes from unapproved Policy',()=>{
  const d=data();
  const unusual={...d,grant:{...d.grant,policyVersionText:'00003'}};
  const got=result(unusual);
  assert.equal(got.projectionCandidate.policyVersionText,'00003');
  assert.equal(typeof got.projectionCandidate.policyVersionText,'string');
  assert.deepEqual(got.projectionCandidate.approvedPurposesForPublication,[]);
  reject({...d,grant:{...d.grant,policyVersionText:3}});
  reject({...d,grant:{...d.grant,policyVersionText:' x '}});
  reject({...d,grant:{...d.grant,policyDigest:'bad'}});
  reject({...d,grant:{...d.grant,scopeId:'cdn'}});
  reject({...d,grant:{...d.grant,approvedPurposeIds:['display']}});
  reject({...d,grant:{...d.grant,publicUsageAuthorized:true}});
  reject({...d,grant:{...d.grant,scopeStatus:'APPROVED_CANONICAL_RECEIPT'}});
  reject({...d,grant:{...d.grant,policyReceiptVerified:true}});
});

test('even real-shaped active canonical receipt is not automatic public/cdn permission',()=>{
  const d=data();
  const g={...d.grant,scopeStatus:'APPROVED_CANONICAL_RECEIPT',
    policyReceiptVerified:true,scopeId:'wand.dreamsnaps.creator-photo-grant@1',
    approvedPurposeIds:['wand.dreamsnaps.creator-photo-grant@1']};
  const got=result({...d,grant:g});
  assert.equal(got.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(got.projectionCandidate.policyReceiptSourceClaim,'APPROVED_CANONICAL_RECEIPT');
  assert.equal(got.projectionCandidate.approvedPurposesForPublication.length,0);
  assert.equal(got.projectionCandidate.publicUsageAuthorized,false);
  reject({...d,grant:{...g,approvedPurposeIds:['cdn']}});
  reject({...d,grant:{...g,approvedPurposeIds:[]}});
  reject({...d,grant:{...g,scopeId:'display_after_separate_publish'}});
  reject({...d,grant:{...g,publicUsageAuthorized:true}});
  // Current REAL production Source151 registry is UNSEEDED. This is a source-shape fixture.
});

test('local single Media purge is never global Provider/Cloud/CDN completion',()=>{
  const d=data();
  const v={...d,
    authority:{...d.authority,rowVersion:2,authorizationEpoch:2,
      controlState:'withdrawn',mediaReady:false},
    grant:{...d.grant,state:'withdrawn'},
    deletion:{...d.deletion,controlState:'withdrawn',
      localState:'LOCAL_FROZEN_MEDIA_VERIFIED',providerStatus:'verified',
      localProviderReceiptVerified:true}};
  const got=result(v);
  assert.equal(got.status,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  assert.equal(got.projectionCandidate.localDeletionState,'LOCAL_FROZEN_MEDIA_VERIFIED');
  assert.equal(got.projectionCandidate.externalPurgeStatus,'UNKNOWN');
  assert.equal(got.projectionCandidate.globalPurgeScopeComplete,false);
  reject({...v,deletion:{...v.deletion,globalPurgeScopeComplete:true}});
  reject({...v,deletion:{...v.deletion,cloudCdnIssuedBearerStatus:'REVOKED'}});
  reject({...v,authority:{...v.authority,mediaReady:true}});
  reject({...v,deletion:{...v.deletion,localProviderReceiptVerified:false}});
  reject({...v,deletion:{...v.deletion,activeAccountLegalHold:true}});
  const hold={...v,deletion:{...v.deletion,localProviderReceiptVerified:false,
    localState:'LOCAL_LEGAL_HOLD',activeAccountLegalHold:true}};
  assert.equal(result(hold).projectionCandidate.activeAccountLegalHold,true);
  reject({...hold,deletion:{...hold.deletion,activeAccountLegalHold:false}});
});

test('all external evidence, owner actions, public Detail, Signer and Publisher OFF',()=>{
  const d=data();
  for(const key of Object.keys(d.externalEvidence))
    reject({...d,externalEvidence:{...d.externalEvidence,[key]:true}});
  for(const key of Object.keys(d.capabilities))
    reject({...d,capabilities:{...d.capabilities,[key]:true}});
  reject({...d,externalEvidence:{...d.externalEvidence,stage:'live'}});
  reject({...d,capabilities:{...d.capabilities,verifyPurge:true}});
});

test('strict exact outer/nested wire rejects Source150 @1, PreGrant @1, null/unknown keys',()=>{
  for(const e of [
    {...env(),operation:'read'},
    {...env(),operation:'pregrant'},
    {...env(),contractVersion:'wand.dreamsnaps.owner-management-service@1'},
    {...env(),data:{...data(),consumerTarget:'wand.dreamsnaps.private-owner-consumer@1'}},
    {...env(),data:{...data(),contractVersion:'wand.dreamsnaps.pregrant-service@1'}},
    {...env(),data:{...data(),ownerAccountId:other}},
    {...env(),data:{...data(),work:null}}, {...env(),data:{...data(),grant:null}},
    {...env(),data:{...data(),deletion:null}}, {...env(),data:{...data(),capabilities:null}},
    {...env(),data:{...data(),externalEvidence:null}},
    {...env(),ok:false},
    {...env(),rawJWT:'forbidden'}
  ])assert.equal(decodeSource153OwnerConsumerV2(e,ctx()).status,
    'SOURCE_CONTRACT_REJECTED');
});

test('stale SPA generation and stale Work rowVersion/AuthEpoch are independent',()=>{
  assert.equal(decodeSource153OwnerConsumerV2(env(),
    {...ctx(),requestGeneration:3}).status,'STALE_RESPONSE');
  assert.equal(decodeSource153OwnerConsumerV2(env(),
    {...ctx(),latestGeneration:5}).status,'STALE_RESPONSE');
  assert.equal(decodeSource153OwnerConsumerV2(env(),
    {...ctx(),requestGeneration:-1}).status,'SOURCE_CONTRACT_REJECTED');
  assert.equal(decodeSource153OwnerConsumerV2(env(),
    {...ctx(),expectedRowVersion:0}).status,'SOURCE_CONTRACT_REJECTED');
  assert.equal(decodeSource153OwnerConsumerV2(env(),
    {...ctx(),expectedAuthorizationEpoch:2}).status,'REFRESH_REQUIRED');
  const v=decodeSource153OwnerConsumerV2(env(),
    {...ctx(),expectedRowVersion:2});
  assert.equal(v.status,'REFRESH_REQUIRED');
  assert.equal(v.refreshRequired,true);
  assert.equal(v.snapshot,null);
  assert.equal(v.projectionCandidate,null);
  assert.equal(v.autoRetry,false);
});

test('private/no-store, CDN+Surrogate no-store and Vary Authorization+Origin required',()=>{
  assert.equal(classifySource153OwnerHttpFixture(http(),ctx()).status,
    'SOURCE153_SCHEMA_CANDIDATE_ONLY');
  for(const h of [
    {}, {...headers(),'cache-control':'public, max-age=600'},
    {...headers(),'cache-control':'private,no-store'},
    {...headers(),'cache-control':'private,no-store,max-age=10'},
    {...headers(),'cdn-cache-control':'public,max-age=10'},
    {...headers(),'surrogate-control':'max-age=10'},
    {...headers(),vary:'Origin'},
    {...headers(),vary:'Authorization'},
    {...headers(),vary:'*'},
    {...headers(),Vary:'Authorization, Origin'}
  ])assert.equal(classifySource153OwnerHttpFixture(http(env(),200,h),ctx()).status,
    'UNSAFE_CACHE_POLICY');
  assert.equal(classifySource153OwnerHttpFixture(http(env(),200,
    {...headers(), 'cache-control':'private, no-store, max-age=0, public'}),ctx()).status,
    'UNSAFE_CACHE_POLICY');
});

test('401/403/404/410/503 clear old owner Snapshot; 409/412 refresh with no auto retry',()=>{
  for(const status of [401,403,404,410,500,503]){
    const v=classifySource153OwnerHttpFixture(http(env(),status),ctx());
    assert.equal(v.status,'BACKEND_UNAVAILABLE');
    assert.equal(v.snapshot,null); assert.equal(v.projectionCandidate,null);
    assert.equal(v.clearPriorSnapshot,true);
    assert.equal(v.autoRetry,false);
  }
  for(const status of [409,412]){
    const v=classifySource153OwnerHttpFixture(http(env(),status),ctx());
    assert.equal(v.status,'REFRESH_REQUIRED');
    assert.equal(v.refreshRequired,true);
    assert.equal(v.clearPriorSnapshot,true);assert.equal(v.autoRetry,false);
  }
  assert.equal(classifySource153OwnerHttpFixture(http(env(),200,headers()),
    {...ctx(),requestGeneration:3}).status,'STALE_RESPONSE');
  assert.equal(classifySource153OwnerHttpFixture(http(env(),201),ctx()).status,
    'BACKEND_UNAVAILABLE');
});

test('no IO, public UI activation, Source150 @1 schema mutation or URLs in v2 adapter',()=>{
  const src=fs.readFileSync(new URL('../src/lib/dreamsnaps/source153-owner-consumer-v2.js',import.meta.url),'utf8');
  assert.ok(!src.includes('fetch('));
  assert.ok(!src.includes('.rpc('));
  assert.ok(!src.includes('.functions.invoke('));
  assert.ok(!src.includes('https://'));
  assert.ok(!src.includes('signedUrl:'));
  assert.ok(!src.includes('ownerAccountId:'));
  const old=fs.readFileSync(new URL('../src/lib/dreamsnaps/source150-owner-service-adapter.js',import.meta.url),'utf8');
  assert.match(old,/SOURCE150_OWNER_ADAPTER_ENABLED = false/);
  const pre=fs.readFileSync(new URL('../src/lib/dreamsnaps/source151-private-pregrant-adapter.js',import.meta.url),'utf8');
  assert.match(pre,/SOURCE151_PREGRANT_ADAPTER_ENABLED = false/);
  const ui=fs.readFileSync(new URL('../src/lib/dreamsnaps/owner-management.js',import.meta.url),'utf8');
  assert.match(ui,/OWNER_MANAGEMENT_ENABLED = false/);
});
