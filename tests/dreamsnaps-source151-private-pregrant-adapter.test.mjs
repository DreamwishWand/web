import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SOURCE151_PREGRANT_DATA_CONTRACT, SOURCE151_PREGRANT_ADAPTER_ENABLED,
  SOURCE151_PREGRANT_CAPABILITIES, SOURCE151_REQUIRED_FIRST_CAS,
  inspectSource151PregrantEnvelope, inspectSource151PregrantHttpFixture,
  createSource151PregrantConsumer
} from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
import { SOURCE150_OWNER_SERVICE_CONTRACT } from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
const work='11111111-1111-4111-8111-111111111111';
const creator='22222222-2222-4222-8222-222222222222';
const challenge='33333333-3333-4333-8333-333333333333';
const photo='44444444-4444-4444-8444-444444444444';
const media='55555555-5555-4555-8555-555555555555';
const entry='66666666-6666-4666-8666-666666666666';
const account='77777777-7777-4777-8777-777777777777';
const context={workId:work,requestGeneration:7,latestGeneration:7};
const policy=()=>({policyVersionText:'v3',policyDigest:'a'.repeat(64),
  scopeId:'wand.dreamsnaps.creator-photo-grant@1',
  canonicalText:'CREATOR GRANT ONLY - synthetic test fixture, not approved.'});
const data=(kind='PostEventCreation')=>({
  contractVersion:SOURCE151_PREGRANT_DATA_CONTRACT,
  state:'NEED_POLICY_ARTIFACT',ownerAuthorized:true,
  workId:work,kind,creatorProfileId:creator,challengeId:challenge,
  photoRevisionId:photo,photoMediaId:media,authenticatedAccountBound:true,
  workPhotoBindingVerified:true,mediaOwnershipVerified:true,
  originalImageImmutable:true,expectedRowVersion:0,expectedAuthorizationEpoch:0,
  grantRecorded:false,publicActivationAllowed:false,
  officialChallengePhaseVerified:false,grantAvailable:false,
  erasure:{state:'NOT_REQUESTED',physicalPurgeVerified:false,publicDisabled:true},
  ...(kind==='OriginalCompetition'?{entryId:entry,frozenEntryRevisionId:photo}:{})
});
const ready=()=>({...data(),state:'PREGRANT_READY',grantAvailable:true,policyReceipt:policy()});
const envelope=(d=data())=>({ok:true,operation:'pregrant',
  contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:d});
const read=(d=data(),c=context)=>inspectSource151PregrantEnvelope(envelope(d),c);
const reject=d=>assert.equal(read(d).status,'SOURCE_CONTRACT_REJECTED');
const http=(body=envelope(),status=200,headers={
  'cache-control':'private, no-store, max-age=0',
  'cdn-cache-control':'no-store','surrogate-control':'no-store',
  vary:'Authorization, Origin'})=>({body,status,headers});

test('Source151 nested PreGrant contract, distinct Source150 wrapper; no owner, grant or policy success',()=>{
  const v=inspectSource151PregrantEnvelope(envelope(),context);
  assert.equal(v.status,'NEED_POLICY_ARTIFACT');
  assert.equal(v.snapshot,null);
  assert.equal(v.policyReceipt,null);
  assert.equal(v.ownerReadVerified,false);
  assert.equal(v.creatorGrantRecorded,false);
  assert.equal(v.firstGrantExecutable,false);
  assert.equal(v.actionsEnabled,false);
  assert.equal(v.autoRetry,false);
  assert.equal(v.policyRegistered,false);
  assert.deepEqual(SOURCE151_REQUIRED_FIRST_CAS,
    {expectedRowVersion:0,expectedAuthorizationEpoch:0});
  assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
  assert.ok(Object.values(SOURCE151_PREGRANT_CAPABILITIES).every(v=>v===false));
  assert.equal(read({...data(),erasure:{...data().erasure,publicDisabled:false}}).status,
    'NEED_POLICY_ARTIFACT'); // Local hidden/read state not remote activation proof.
});

test('synthetic active policy matches schema but cannot become real Policy approval or accepted Grant',()=>{
  const v=read(ready());
  assert.equal(v.status,'PREGRANT_CONTRACT_CANDIDATE_ONLY');
  assert.equal(v.policyRegistered,false);
  assert.equal(v.pendingSource151IndependentQA,true);
  assert.equal(v.requiresLiveOwnerAndPolicyEvidence,true);
  assert.equal(v.ownerReadVerified,false);
  assert.equal(v.snapshot,null);
  assert.equal(v.policyReceipt,null);
  assert.equal(v.firstGrantExecutable,false);
  assert.ok(!JSON.stringify(v).includes('synthetic test fixture'));
  assert.ok(!JSON.stringify(v).includes('aaaaaa'));
  assert.ok(!JSON.stringify(v).includes(media));
  assert.ok(!JSON.stringify(v).includes(account));
});

test('Original immutable entered Entry vs PostEvent has no Entry keys even null',()=>{
  assert.equal(read(data('OriginalCompetition')).status,'NEED_POLICY_ARTIFACT');
  reject({...data('OriginalCompetition'),entryId:null});
  reject({...data('OriginalCompetition'),frozenEntryRevisionId:entry});
  reject({...data(),entryId:entry});
  reject({...data(),entryId:null});
  reject({...data(),frozenEntryRevisionId:photo});
  reject({...data(),kind:'Competition'});
});

test('cannot infer verified JWT, Account binding, legitimate Media, official phase, grant or public activation',()=>{
  for(const patch of [
    {authenticatedAccountBound:false},{ownerAuthorized:false},
    {workPhotoBindingVerified:false},{mediaOwnershipVerified:false},
    {originalImageImmutable:false},{grantRecorded:true},
    {publicActivationAllowed:true},{officialChallengePhaseVerified:true},
    {expectedRowVersion:1},{expectedAuthorizationEpoch:2},
    {photoMediaId:entry},{photoMediaId:'no-media'},
    {photoRevisionId:media},{creatorProfileId:'x'},{challengeId:'x'},
    {workId:entry},{photoMediaId:null},{accountId:account},
    {ownerAccountId:account},{bearer:'FAKE'},{storageKey:'bucket/secret'},
    {signedUrl:'https://example.invalid/image'},
    {erasure:{state:'MEDIA_PURGED',physicalPurgeVerified:true,publicDisabled:true}},
    {erasure:{state:'NOT_REQUESTED',physicalPurgeVerified:true,publicDisabled:true}}
  ])reject({...data(),...patch});
  // Even a correct-looking signed-JWT claim in HTTP fixture cannot activate.
  assert.equal(inspectSource151PregrantHttpFixture(http(),context).ownerReadVerified,false);
});

test('Policy receipt is absent when registry empty; ready state requires exact narrow receipt shape',()=>{
  reject({...data(),policyReceipt:null});
  reject({...data(),grantAvailable:true});
  reject({...ready(),state:'NEED_POLICY_ARTIFACT'});
  reject({...ready(),grantAvailable:false});
  reject({...ready(),policyReceipt:null});
  reject({...ready(),policyReceipt:{...policy(),approved:true}});
  reject({...ready(),policyReceipt:{...policy(),policyVersionText:'00003'}});
  reject({...ready(),policyReceipt:{...policy(),policyVersionText:3}});
  reject({...ready(),policyReceipt:{...policy(),policyDigest:'no'}});
  reject({...ready(),policyReceipt:{...policy(),scopeId:'public-image-license'}});
  reject({...ready(),policyReceipt:{...policy(),canonicalText:'too short'}});
  reject({...ready(),policyReceipt:{...policy(),canonicalText:'x'.repeat(16001)}});
  assert.equal(read({...ready(),policyReceipt:{...policy(),policyVersionText:'v900'}}).status,
    'PREGRANT_CONTRACT_CANDIDATE_ONLY');
});

test('strict envelope distinguishes Source150 outer Service@1 and Source151 inner PreGrant@1',()=>{
  const wrong=[
    {...envelope(),contractVersion:SOURCE151_PREGRANT_DATA_CONTRACT},
    {...envelope(),operation:'read'},
    {...envelope(),operation:'action'},
    {...envelope(),ok:false},
    {...envelope(),ownerAccountId:account},
    {...envelope(),data:{...data(),contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT}},
    {...envelope(),data:{...data(),policyReceipt:policy(),state:'NEED_POLICY_ARTIFACT'}},
    {...envelope(),data:{...data(),photoMediaId:media,signer:'EXTRA'}}
  ];
  for(const v of wrong)assert.equal(inspectSource151PregrantEnvelope(v,context).status,
    'SOURCE_CONTRACT_REJECTED');
});

test('SPA generation is not DB authorizationEpoch; first CAS 0/0 is not positive Work rowRevision',()=>{
  assert.equal(inspectSource151PregrantEnvelope(envelope(),
    {...context,requestGeneration:6}).status,'STALE_RESPONSE');
  assert.equal(inspectSource151PregrantEnvelope(envelope(),
    {...context,latestGeneration:9}).status,'STALE_RESPONSE');
  assert.equal(inspectSource151PregrantEnvelope(envelope(),
    {...context,requestGeneration:7,latestGeneration:7,expectedRowVersion:0}).status,
    'SOURCE_CONTRACT_REJECTED');
  assert.equal(inspectSource151PregrantEnvelope(envelope(),
    {...context,requestGeneration:-1}).status,'SOURCE_CONTRACT_REJECTED');
});

test('typed HTTP 401/403/404/409/410/412/503; never cache private success',()=>{
  for(const status of [401,403,404,410,500,503]){
    const v=inspectSource151PregrantHttpFixture(http(envelope(),status),context);
    assert.equal(v.status,'BACKEND_UNAVAILABLE');
    assert.equal(v.snapshot,null);
  }
  for(const status of [409,412]){
    const v=inspectSource151PregrantHttpFixture(http(envelope(),status),context);
    assert.equal(v.status,'REFRESH_REQUIRED');
    assert.equal(v.refreshRequired,true);
    assert.equal(v.autoRetry,false);
  }
  assert.equal(inspectSource151PregrantHttpFixture(http(),context).status,
    'NEED_POLICY_ARTIFACT');
  assert.equal(inspectSource151PregrantHttpFixture(http(envelope(ready())),context).status,
    'PREGRANT_CONTRACT_CANDIDATE_ONLY');
  for(const headers of [
    {},{'cache-control':'public,max-age=30','cdn-cache-control':'no-store',
      'surrogate-control':'no-store',vary:'Authorization'},
    {'cache-control':'private,no-store','cdn-cache-control':'max-age=30',
      'surrogate-control':'no-store',vary:'Authorization'},
    {'cache-control':'private,no-store','cdn-cache-control':'no-store',
      'surrogate-control':'no-store',vary:'Origin'}
  ])assert.equal(inspectSource151PregrantHttpFixture(http(envelope(),200,headers),context).status,
    'UNSAFE_CACHE_POLICY');
  assert.equal(inspectSource151PregrantHttpFixture(http(),{...context,requestGeneration:3}).status,
    'STALE_RESPONSE');
});

test('pregrant adapter is completely inert even with fake Auth and policy mock',async()=>{
  const c=createSource151PregrantConsumer();
  let called=0;
  const old=globalThis.fetch;
  globalThis.fetch=async()=>{called++;throw Error('forbidden network');};
  try{
    const r=await c.pregrant({workId:work,token:'FAKE',policy:policy()});
    assert.equal(r.status,'BACKEND_UNAVAILABLE');
    const g=await c.acceptGrant({workId:work,expectedRowVersion:0,expectedAuthorizationEpoch:0});
    assert.equal(g.status,'BACKEND_UNAVAILABLE');
    assert.equal(g.creatorGrantRecorded,false);
    assert.equal(called,0);
  }finally{globalThis.fetch=old;}
});

test('accepted WEB245/248/252 UI, Source150 adapter, public routes remain disabled/unmodified',()=>{
  const src=fs.readFileSync(new URL('../src/lib/dreamsnaps/source151-private-pregrant-adapter.js',import.meta.url),'utf8');
  for(const forbidden of ['fetch(','.command(','.media(','.functions.invoke(', 'signedUrl:', 'storageKey:'])
    assert.ok(!src.includes(forbidden),forbidden);
  const owner=fs.readFileSync(new URL('../src/lib/dreamsnaps/owner-management.js',import.meta.url),'utf8');
  assert.match(owner,/OWNER_MANAGEMENT_ENABLED = false/);
  const source150=fs.readFileSync(new URL('../src/lib/dreamsnaps/source150-owner-service-adapter.js',import.meta.url),'utf8');
  assert.match(source150,/SOURCE150_OWNER_ADAPTER_ENABLED = false/);
  const ui=fs.readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
  assert.match(ui,/data-owner-feature="off"/);
  assert.match(ui,/data-public-detail="disabled"/);
});
