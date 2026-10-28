import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SOURCE151_PREGRANT_DATA_CONTRACT,SOURCE151_PREGRANT_ADAPTER_ENABLED,
 SOURCE151_PREGRANT_CAPABILITIES,SOURCE151_REQUIRED_FIRST_CAS,
 inspectSource151PregrantEnvelope,inspectSource151PregrantHttpFixture,createSource151PregrantConsumer
} from '../src/lib/dreamsnaps/source151-private-pregrant-adapter.js';
import {SOURCE150_OWNER_SERVICE_CONTRACT} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
const id=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',
 '77777777-7777-4777-8777-777777777777'];
const [work,creator,challenge,photo,media,entry,account]=id;
const ctx=()=>({workId:work,requestGeneration:59,latestGeneration:59});
const data=()=>({contractVersion:SOURCE151_PREGRANT_DATA_CONTRACT,
 state:'NEED_POLICY_ARTIFACT',ownerAuthorized:true,workId:work,kind:'PostEventCreation',
 creatorProfileId:creator,challengeId:challenge,photoRevisionId:photo,photoMediaId:media,
 authenticatedAccountBound:true,workPhotoBindingVerified:true,mediaOwnershipVerified:true,
 originalImageImmutable:true,expectedRowVersion:0,expectedAuthorizationEpoch:0,
 grantRecorded:false,publicActivationAllowed:false,officialChallengePhaseVerified:false,grantAvailable:false,
 erasure:{state:'NOT_REQUESTED',physicalPurgeVerified:false,publicDisabled:true}});
const policy=()=>({policyVersionText:'v7',policyDigest:'a'.repeat(64),scopeId:'wand.dreamsnaps.creator-photo-grant@1',
 canonicalText:'Synthetic local-only policy, not reviewed or approved for publication.'});
const ready=()=>({...data(),state:'PREGRANT_READY',grantAvailable:true,policyReceipt:policy()});
const wrap=(d=data())=>({ok:true,operation:'pregrant',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:d});
const inspect=(e=wrap(),c=ctx())=>inspectSource151PregrantEnvelope(e,c);
const headers=()=>({'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store',
 'surrogate-control':'no-store',vary:'Authorization, Origin'});
test('outer owner service@1 pregrant and inner source151 data@1 never become Owner read or consent',()=>{
 assert.equal(inspect().status,'NEED_POLICY_ARTIFACT');
 assert.equal(inspect(wrap(ready())).status,'PREGRANT_CONTRACT_CANDIDATE_ONLY');
 for(const r of [inspect(),inspect(wrap(ready()))]){
  assert.equal(r.snapshot,null);assert.equal(r.ownerReadVerified,false);
  assert.equal(r.creatorGrantRecorded,false);assert.equal(r.firstGrantExecutable,false);
  assert.equal(r.actionsEnabled,false);assert.equal(r.autoRetry,false);
  assert.equal(r.policyReceipt,null);
 }
 assert.equal(SOURCE151_PREGRANT_ADAPTER_ENABLED,false);
 assert.ok(Object.values(SOURCE151_PREGRANT_CAPABILITIES).every(v=>v===false));
});
test('first grant CAS(0,0) is independent of SPA generation and post-grant positive CAS',()=>{
 assert.deepEqual(SOURCE151_REQUIRED_FIRST_CAS,{expectedRowVersion:0,expectedAuthorizationEpoch:0});
 for(const p of [{expectedRowVersion:59},{expectedAuthorizationEpoch:59},
  {expectedRowVersion:1},{grantRecorded:true},{publicActivationAllowed:true},
  {officialChallengePhaseVerified:true}])
  assert.equal(inspect(wrap({...data(),...p})).status,'SOURCE_CONTRACT_REJECTED');
 const stale=inspect(wrap(),{...ctx(),latestGeneration:60});
 assert.equal(stale.status,'STALE_RESPONSE');assert.equal(stale.snapshot,null);
});
test('Original requires real Entry/frozen Photo; PostEvent must have NO Entry even explicit null',()=>{
 const original={...data(),kind:'OriginalCompetition',entryId:entry,frozenEntryRevisionId:photo};
 assert.equal(inspect(wrap(original)).status,'NEED_POLICY_ARTIFACT');
 for(const x of [{...original,entryId:null},{...original,frozenEntryRevisionId:media},
  {...data(),entryId:null},{...data(),entryId:entry},{...data(),frozenEntryRevisionId:photo},
  {...data(),kind:'Competition'}])
  assert.equal(inspect(wrap(x)).status,'SOURCE_CONTRACT_REJECTED');
});
test('unseeded policy must not invent receipt; synthetic READY stays contract-only',()=>{
 const missing=inspect();assert.equal(missing.status,'NEED_POLICY_ARTIFACT');
 assert.equal(missing.policyRegistered,false);
 for(const p of [
  {...data(),policyReceipt:null},{...data(),grantAvailable:true},
  {...ready(),state:'NEED_POLICY_ARTIFACT'},{...ready(),grantAvailable:false},
  {...ready(),policyReceipt:{...policy(),approved:true}},
  {...ready(),policyReceipt:{...policy(),policyVersionText:'00003'}},
  {...ready(),policyReceipt:{...policy(),policyDigest:'forged'}},
  {...ready(),policyReceipt:{...policy(),scopeId:'another grant'}},
  {...ready(),policyReceipt:{...policy(),canonicalText:'short'}}
 ])assert.equal(inspect(wrap(p)).status,'SOURCE_CONTRACT_REJECTED');
 const candidate=inspect(wrap(ready()));
 assert.equal(candidate.status,'PREGRANT_CONTRACT_CANDIDATE_ONLY');
 assert.equal(candidate.requiresLiveOwnerAndPolicyEvidence,true);
 assert.equal(JSON.stringify(candidate).includes(policy().canonicalText),false);
});
test('unknown identity/Media/challenge and forged AccountID, JWT, storage and signer keys rejected',()=>{
 for(const p of [{workId:account},{creatorProfileId:account+'broken'},{photoMediaId:'wrong'},
 {challengeId:'wrong'},{photoRevisionId:'wrong'},
 {ownerAuthorized:false},{authenticatedAccountBound:false},{workPhotoBindingVerified:false},
 {mediaOwnershipVerified:false},{originalImageImmutable:false},
 {erasure:{state:'MEDIA_PURGED',physicalPurgeVerified:true,publicDisabled:true}},
 {accountId:account},{ownerAccountId:account},{jwt:'fake'},{storageKey:'secret'},
 {policyVersionText:'fake'},{signedUrl:'https://invalid.example'},{token:'fake'}]){
  assert.equal(inspect(wrap({...data(),...p})).status,'SOURCE_CONTRACT_REJECTED',JSON.stringify(p));
 }
 // Valid-looking MediaID is not evidence of real ownership; decoder can only deny trust.
 const syntactic=inspect(wrap({...data(),photoMediaId:entry}));
 assert.equal(syntactic.status,'NEED_POLICY_ARTIFACT');assert.equal(syntactic.ownerReadVerified,false);
});
test('envelope rejects pregrant as read/action, extra subject and wrong contracts',()=>{
 for(const p of [
  {...wrap(),operation:'read'},{...wrap(),operation:'action'},
  {...wrap(),contractVersion:SOURCE151_PREGRANT_DATA_CONTRACT},
  {...wrap(),ok:false},{...wrap(),actorAccountId:account},
  {...wrap(),data:{...data(),contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT}},
  {...wrap(),data:{...data(),accountId:account}}
 ])assert.equal(inspect(p).status,'SOURCE_CONTRACT_REJECTED');
});
test('synthetic HTTP 401/403/409/412 and cache/no-store reject positives',()=>{
 for(const status of [401,403,404,410,503]){
  const r=inspectSource151PregrantHttpFixture({status,body:wrap(),headers:headers()},ctx());
  assert.equal(r.status,'BACKEND_UNAVAILABLE');assert.equal(r.autoRetry,false);
 }
 for(const status of [409,412]){
  const r=inspectSource151PregrantHttpFixture({status,body:wrap(),headers:headers()},ctx());
  assert.equal(r.status,'REFRESH_REQUIRED');assert.equal(r.refreshRequired,true);assert.equal(r.autoRetry,false);
 }
 assert.equal(inspectSource151PregrantHttpFixture({status:200,body:wrap(),headers:headers()},ctx()).status,'NEED_POLICY_ARTIFACT');
 for(const h of [{...headers(),'cache-control':'public,max-age=10'},
 {...headers(),'cdn-cache-control':'public'},{...headers(),vary:'Origin'}])
  assert.equal(inspectSource151PregrantHttpFixture({status:200,body:wrap(),headers:h},ctx()).status,'UNSAFE_CACHE_POLICY');
});
test('all operations disabled and no network path, even when caller hands a mock approved grant',async()=>{
 const module=readFileSync('src/lib/dreamsnaps/source151-private-pregrant-adapter.js','utf8');
 for(const x of ['fetch(','.rpc(','.upload(','.storage(','.getSignedUrl(','.invoke('])
  assert.equal(module.includes(x),false,x);
 const c=createSource151PregrantConsumer();let n=0;const prev=globalThis.fetch;
 globalThis.fetch=async()=>{n++;throw Error('NETWORK_FORBIDDEN')};
 try{
  assert.equal((await c.pregrant({bearer:'fake'})).status,'BACKEND_UNAVAILABLE');
  assert.equal((await c.acceptGrant({policyReceipt:policy()})).status,'BACKEND_UNAVAILABLE');
 }finally{globalThis.fetch=prev}
 assert.equal(n,0);
});
