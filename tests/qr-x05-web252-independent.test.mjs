import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 adaptSource150OwnerEnvelope,classifySource150OwnerHttpFixture,
 SOURCE150_OWNER_SERVICE_CONTRACT,SOURCE150_OWNER_SOURCE_CONTRACT,
 SOURCE150_OWNER_ADAPTER_ENABLED,SOURCE150_MISSING_AUTHORITY,SOURCE150_FIELD_LINEAGE
} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
const id=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',
 '77777777-7777-4777-8777-777777777777'];
const [work,creator,challenge,photo,media,concept,entry]=id;
const context=()=>({workId:work,requestGeneration:41,latestGeneration:41});
const owner=()=>({contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,
 sourceContractVersion:SOURCE150_OWNER_SOURCE_CONTRACT,workId:work,
 kind:'PostEventCreation',creatorProfileId:creator,challengeId:challenge,photoRevisionId:photo,
 photoMediaId:media,conceptRevisionId:concept,concept:'typed draft',
 rowVersion:2,authorizationEpoch:3,ownerAuthorized:true,accountState:'active',
 identityState:'active',retired:false,privacySuppressed:false,moderationAllowed:true,
 imageGrant:{policyVersionText:'00003',policyVersionOrdinal:null,policyDigest:'b'.repeat(64),
 consentRevision:1,workId:work,state:'accepted'},
 erasure:{state:'NOT_REQUESTED',revision:2,publicDisabled:false,physicalPurgeVerified:false,providerStatus:'not_requested'},
 capabilities:{ownerRead:true,grant:true,concept:true,withdraw:true,deleteRequest:true,
 publicDetail:false,publicMedia:false,publish:false,verifyPurge:false}
});
const env=(o=owner())=>({ok:true,operation:'read',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:o});
const adapt=(e=env(),c=context())=>adaptSource150OwnerEnvelope(e,c);
const patch=(part,modify)=>{const x=owner();x[part]={...x[part],...modify};return x};
const headers=()=>({'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store',
 'surrogate-control':'no-store',vary:'Authorization, Origin'});
test('valid flat read/action never fills missing nested ownership or performs a positive read',()=>{
 const o=owner();
 const act={ok:true,operation:'action',contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,
 data:{result:{workId:work},owner:o,publicActivationAllowed:false}};
 for(const [e,reRead] of [[env(),false],[act,true]]){
  const v=adapt(e);
  assert.equal(v.status,'NEED_BACKEND_PROJECTION');
  assert.equal(v.snapshot,null); assert.equal(v.ownerReadVerified,false);
  assert.equal(v.actionsEnabled,false); assert.equal(v.requiresFreshAuthenticatedRead,reRead);
  assert.equal(v.liveBackendEnabled,false);
  assert.ok(v.missingAuthority.includes('work.ownerAccountId [server-verified owner account]'));
 }
 assert.equal(SOURCE150_OWNER_ADAPTER_ENABLED,false);
});
test('exact source-to-consumer lineage is documented but no Media bearer or owner token can be synthesized',()=>{
 for(const [from,to] of [['data.photoMediaId','work.mediaId'],['data.concept','work.conceptText'],
  ['data.imageGrant.policyVersionText','grant.policyIdentifier [opaque TEXT]'],
  ['data.imageGrant.consentRevision','grant.consentEventVersion [last GRANT event only]'],
  ['data.rowVersion','authority.rowVersion'],['data.authorizationEpoch','authority.authorizationEpoch']])
 assert.equal(SOURCE150_FIELD_LINEAGE[from],to);
 assert.ok(SOURCE150_MISSING_AUTHORITY.some(x=>x.includes('Provider+Cloud+CDN')));
 for(const key of ['ownerAccountId','accessToken','storageKey','signedUrl','photoBindingVerified']){
  assert.equal(adapt(env({...owner(),[key]:'FORGED'})).status,'SOURCE_CONTRACT_REJECTED',key);
 }
});
test('original frozen Entry must match photo; PostEvent cannot carry even null Entry fields',()=>{
 const original={...owner(),kind:'OriginalCompetition',entryId:entry,frozenEntryRevisionId:photo};
 assert.equal(adapt(env(original)).status,'NEED_BACKEND_PROJECTION');
 for(const o of [{...original,frozenEntryRevisionId:concept},{...original,entryId:null},
  {...owner(),entryId:entry},{...owner(),entryId:null},{...owner(),frozenEntryRevisionId:photo},
  {...owner(),kind:'Competition'}])assert.equal(adapt(env(o)).status,'SOURCE_CONTRACT_REJECTED');
});
test('Policy Version TEXT 00003 stays opaque, grant receipt 1 is independent of Work CAS row2/epoch3',()=>{
 assert.equal(adapt().status,'NEED_BACKEND_PROJECTION');
 for(const v of ['00003','v2','abc/1.0','3']){
  const obj=patch('imageGrant',{policyVersionText:v,policyVersionOrdinal:null});
  assert.equal(adapt(env(obj)).status,'NEED_BACKEND_PROJECTION',v);
 }
 for(const o of [
  patch('imageGrant',{policyVersionText:'00003',policyVersionOrdinal:3}),
  patch('imageGrant',{consentRevision:4}),
  patch('imageGrant',{policyDigest:'forged'}),
  patch('imageGrant',{workId:entry}),
  {...owner(),rowVersion:1.2},
  {...owner(),authorizationEpoch:0}
 ]) assert.equal(adapt(env(o)).status,'SOURCE_CONTRACT_REJECTED');
});
test('mutating stale epoch or generation is refresh/stale, not any speculative snapshot or action',()=>{
 for(const c of [{...context(),expectedRowVersion:1},{...context(),expectedAuthorizationEpoch:5}]){
  const r=adapt(env(),c); assert.equal(r.status,'REFRESH_REQUIRED');assert.equal(r.refreshRequired,true);
 }
 assert.equal(adapt(env(),{...context(),requestGeneration:40}).status,'STALE_RESPONSE');
 for(const k of ['workId','photoMediaId','photoRevisionId','challengeId','creatorProfileId']){
  const o=owner();o[k]='NOT_UUID';assert.equal(adapt(env(o)).status,'SOURCE_CONTRACT_REJECTED',k);
 }
});
test('withdrawn/public disabled and pending do not imply full Provider+Cloud+CDN purge verification',()=>{
 const o=owner();
 o.imageGrant.state='withdrawn';
 o.erasure={state:'MEDIA_PURGE_PENDING',revision:2,publicDisabled:true,
 physicalPurgeVerified:false,providerStatus:'provider_reported'};
 assert.equal(adapt(env(o)).status,'NEED_BACKEND_PROJECTION');
 for(const e of [{...o.erasure,state:'MEDIA_PURGED'},
  {...o.erasure,physicalPurgeVerified:true},
  {...o.erasure,state:'LEGAL_HOLD',physicalPurgeVerified:true},
  {...o.erasure,publicDisabled:false}])
  assert.equal(adapt(env({...o,erasure:e})).status,'SOURCE_CONTRACT_REJECTED');
});
test('negative/error statuses and untrusted cache headers fail without auto retry',()=>{
 for(const status of [401,403,404,410,503]){
  const o=classifySource150OwnerHttpFixture({status,body:env()},context());
  assert.equal(o.status,'BACKEND_UNAVAILABLE');assert.equal(o.autoRetry,false);
 }
 for(const status of [409,412]){
  const o=classifySource150OwnerHttpFixture({status,body:env()},context());
  assert.equal(o.status,'REFRESH_REQUIRED');assert.equal(o.snapshot,null);assert.equal(o.autoRetry,false);
 }
 assert.equal(classifySource150OwnerHttpFixture({status:200,body:env(),headers:headers()},context()).status,'NEED_BACKEND_PROJECTION');
 for(const h of [{...headers(),'cache-control':'public, max-age=60'},{...headers(),vary:'Origin'},
  {...headers(),'cdn-cache-control':'public'}])
 assert.equal(classifySource150OwnerHttpFixture({status:200,body:env(),headers:h},context()).status,'UNSAFE_CACHE_POLICY');
});
test('no executable HTTP, Storage, Publisher or signer path; prior accepted Consumer remains off',async()=>{
 const s=readFileSync('src/lib/dreamsnaps/source150-owner-service-adapter.js','utf8');
 for(const x of ['fetch(','.rpc(','.upload(','.storage(','.getSignedUrl(','.invoke('])
  assert.equal(s.includes(x),false,x);
 assert.equal(adapt({...env(),jwt:'forged'}).status,'SOURCE_CONTRACT_REJECTED');
 assert.equal(adapt({...env(),operation:'pregrant'}).status,'SOURCE_CONTRACT_REJECTED');
});
