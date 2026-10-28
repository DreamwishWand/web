import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 SOURCE150_OWNER_SERVICE_CONTRACT,SOURCE150_OWNER_SOURCE_CONTRACT,
 SOURCE150_OWNER_ADAPTER_ENABLED,SOURCE150_MISSING_AUTHORITY,SOURCE150_FIELD_LINEAGE,
 adaptSource150OwnerEnvelope,classifySource150OwnerHttpFixture
} from '../src/lib/dreamsnaps/source150-owner-service-adapter.js';
import {
 PRIVATE_OWNER_BACKEND_ACTIVATED,PRIVATE_OWNER_CAPABILITIES,
 decodePrivateOwnerSnapshotCandidate
} from '../src/lib/dreamsnaps/private-owner-consumer-contract.js';
const workId='11111111-1111-4111-8111-111111111111';
const creator='22222222-2222-4222-8222-222222222222';
const challenge='33333333-3333-4333-8333-333333333333';
const photo='44444444-4444-4444-8444-444444444444';
const media='55555555-5555-4555-8555-555555555555';
const concept='66666666-6666-4666-8666-666666666666';
const entry='77777777-7777-4777-8777-777777777777';
const account='88888888-8888-4888-8888-888888888888';
const context={workId,requestGeneration:3,latestGeneration:3};
const grant=()=>({
 policyVersionText:'v2',policyVersionOrdinal:2,policyDigest:'a'.repeat(64),
 consentRevision:1,workId,state:'accepted'
});
const erasure=()=>({
 state:'NOT_REQUESTED',revision:1,publicDisabled:false,
 physicalPurgeVerified:false,providerStatus:'not_requested'
});
const caps=()=>({ownerRead:true,grant:true,concept:true,withdraw:true,
 deleteRequest:true,publicDetail:false,publicMedia:false,publish:false,verifyPurge:false});
const flat=()=>({
 contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,
 sourceContractVersion:SOURCE150_OWNER_SOURCE_CONTRACT,
 workId,kind:'PostEventCreation',creatorProfileId:creator,challengeId:challenge,
 photoRevisionId:photo,photoMediaId:media,conceptRevisionId:concept,concept:'Draft only',
 rowVersion:1,authorizationEpoch:1,ownerAuthorized:true,accountState:'active',
 identityState:'active',retired:false,privacySuppressed:false,moderationAllowed:true,
 imageGrant:grant(),erasure:erasure(),capabilities:caps()
});
const read=(owner=flat())=>({ok:true,operation:'read',
 contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:owner});
const action=(owner=flat())=>({ok:true,operation:'action',
 contractVersion:SOURCE150_OWNER_SERVICE_CONTRACT,data:{
 result:{workId,kind:'PostEventCreation',rowVersion:owner.rowVersion},
 owner,publicActivationAllowed:false}});
const convert=(envelope=read(),ctx=context)=>adaptSource150OwnerEnvelope(envelope,ctx);
const reject=(e,ctx=context)=>assert.equal(convert(e,ctx).status,'SOURCE_CONTRACT_REJECTED');
const mockResponse=(status=200,body=read(),headers={
 'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store',
 'surrogate-control':'no-store',vary:'Authorization, Origin'
})=>({status,body,headers});

test('exact Source150 read/action envelopes structurally map but NEVER elevate to WEB248 Owner authority',()=>{
 for(const envelope of [read(),action()]){
   const result=convert(envelope);
   assert.equal(result.status,'NEED_BACKEND_PROJECTION');
   assert.equal(result.snapshot,null);
   assert.equal(result.ownerReadVerified,false);
   assert.equal(result.actionsEnabled,false);
   assert.equal(result.liveBackendEnabled,false);
   assert.equal(result.requiresFreshAuthenticatedRead,envelope.operation==='action');
   assert.ok(result.missingAuthority.includes(
     'work.ownerAccountId [server-verified owner account]'));
   assert.equal('ownerAccountId' in result,false);
   assert.equal('work' in result,false);
 }
 assert.equal(decodePrivateOwnerSnapshotCandidate(read().data,{
   ...context,actorAccountId:account}),null);
 assert.equal(PRIVATE_OWNER_BACKEND_ACTIVATED,false);
 assert.ok(Object.values(PRIVATE_OWNER_CAPABILITIES).every(x=>x===false));
 assert.equal(SOURCE150_OWNER_ADAPTER_ENABLED,false);
});

test('field lineage maps photoMediaId to consumer mediaId and concept to conceptText without returning private IDs',()=>{
 assert.equal(SOURCE150_FIELD_LINEAGE['data.photoMediaId'],'work.mediaId');
 assert.equal(SOURCE150_FIELD_LINEAGE['data.concept'],'work.conceptText');
 assert.equal(SOURCE150_FIELD_LINEAGE['data.imageGrant.policyVersionText'],
   'grant.policyIdentifier [opaque TEXT]');
 assert.equal(SOURCE150_FIELD_LINEAGE['data.imageGrant.consentRevision'],
   'grant.consentEventVersion [last GRANT event only]');
 assert.equal(SOURCE150_FIELD_LINEAGE['data.rowVersion'],'authority.rowVersion');
 assert.equal(SOURCE150_FIELD_LINEAGE['data.authorizationEpoch'],'authority.authorizationEpoch');
 for(const patch of [{photoMediaId:'bad'}, {photoMediaId:entry,entryId:entry},
   {concept:8},{concept:'x'.repeat(2001)}, {creatorProfileId:null},
   {challengeId:'INVALID'}, {photoRevisionId:media}, {conceptRevisionId:'x'},
   {workId:entry},{kind:'Competition'}]){
   let f={...flat(),...patch};
   if(patch.photoRevisionId===media)f.kind='OriginalCompetition';
   reject(read(f));
 }
});

test('Original requires typed frozen entered Entry; PostEvent forbids Entry fields even null',()=>{
 let f={...flat(),kind:'OriginalCompetition',entryId:entry,frozenEntryRevisionId:photo};
 assert.equal(convert(read(f)).status,'NEED_BACKEND_PROJECTION');
 reject(read({...f,entryId:null}));
 reject(read({...f,frozenEntryRevisionId:concept}));
 reject(read({...flat(),entryId:entry}));
 reject(read({...flat(),entryId:null}));
 reject(read({...flat(),frozenEntryRevisionId:photo}));
});

test('policyVersionText stays opaque, strict vN ordinal optional; last grant revision NEVER rowVersion or epoch',()=>{
 let f={...flat(),imageGrant:{...grant(),policyVersionText:'00003',policyVersionOrdinal:null}};
 assert.equal(convert(read(f)).status,'NEED_BACKEND_PROJECTION');
 let lastGrant=f.imageGrant.consentRevision;
 let withdrawn={...f,rowVersion:2,authorizationEpoch:2,
   imageGrant:{...f.imageGrant,state:'withdrawn'},
   erasure:{...erasure(),state:'PUBLIC_DISABLED',revision:2,publicDisabled:true},
   capabilities:{...caps(),grant:false,concept:false,withdraw:false,deleteRequest:false}};
 assert.equal(convert(read(withdrawn)).status,'NEED_BACKEND_PROJECTION');
 assert.equal(lastGrant,1);
 assert.equal(withdrawn.rowVersion,2);
 assert.equal(withdrawn.authorizationEpoch,2);
 for(const bad of [
   {...flat(),imageGrant:{...grant(),policyVersionText:2}},
   {...flat(),imageGrant:{...grant(),policyVersionText:'v2',policyVersionOrdinal:'2'}},
   {...flat(),imageGrant:{...grant(),policyVersionText:'00003',policyVersionOrdinal:3}},
   {...flat(),imageGrant:{...grant(),consentRevision:0}},
   {...flat(),imageGrant:{...grant(),consentRevision:3}},
   {...flat(),imageGrant:{...grant(),policyDigest:'x'}},
   {...flat(),imageGrant:{...grant(),workId:entry}},
   {...flat(),rowVersion:'1'},
   {...flat(),authorizationEpoch:0}
 ])reject(read(bad));
});

test('Owner account, authoritative photo/media provenance, grant scope, hold and deletion proof cannot be fabricated',()=>{
 for(const missing of [
   'work.ownerAccountId [server-verified owner account]',
   'authority.photoBindingVerified [server-attested frozen photo binding]',
   'authority.mediaOwnershipVerified [server-attested owned Media]',
   'grant.mediaId [server-attested consent-to-Media binding]',
   'grant.creatorSelfCaptureDeclared [server-attested explicit declaration]',
   'grant.explicitGrantAccepted [server-attested grant]',
   'grant.scopes [server-attested immutable licence scopes]',
   'deletion.controlState [authoritative Source149 state]',
   'deletion.providerVerificationAccepted [retention/provider verified]',
   'deletion.purgeScopeComplete [Provider+Cloud+CDN verified scope]',
   'deletion.legalHold [explicit authoritative hold state]'
 ])assert.ok(SOURCE150_MISSING_AUTHORITY.includes(missing));
 for(const injection of [
   {ownerAccountId:account},{photoBindingVerified:true},
   {mediaOwnershipVerified:true},{signedUrl:'https://example.invalid/a'},
   {storageKey:'PRIVATE'},{jwt:'FAKE'}, {mediaId:media},
   {retired:true},{privacySuppressed:true},{moderationAllowed:false},
   {ownerAuthorized:false},{accountState:'retired'}, {identityState:'retired'}
 ])reject(read({...flat(),...injection}));
 const safe=convert(read());
 assert.equal(Object.values(safe).includes(account),false);
 assert.equal(Object.values(safe).includes(media),false);
 assert.equal(Object.values(safe).includes('MEDIA_PURGED'),false);
});

test('Source150 erasure: PUBLIC_DISABLED and provider reports never prove Provider+Cloud+CDN physical erasure',()=>{
 for(const [state,providerStatus,verified] of [
   ['PUBLIC_DISABLED','not_requested',false],
   ['MEDIA_PURGE_PENDING','requested',false],
   ['MEDIA_PURGE_PENDING','provider_pending',false],
   ['MEDIA_PURGE_PENDING','provider_reported',false],
   ['MEDIA_PURGE_PENDING','verified',false],
   ['MEDIA_PURGED','verified',true],
   ['LEGAL_HOLD','requested',false]
 ]){
   const f={...flat(),rowVersion:2,authorizationEpoch:2,
     imageGrant:{...grant(),state:'withdrawn'},
     erasure:{state,revision:2,publicDisabled:true,
       physicalPurgeVerified:verified,providerStatus}};
   const got=convert(read(f));
   assert.equal(got.status,'NEED_BACKEND_PROJECTION',state);
   assert.equal(got.snapshot,null,state);
   assert.equal(got.actionsEnabled,false,state);
 }
 for(const [state,providerStatus,verified,publicDisabled] of [
   ['MEDIA_PURGED','requested',true,true],
   ['MEDIA_PURGED','verified',false,true],
   ['MEDIA_PURGED','verified',true,false],
   ['PUBLIC_DISABLED','not_requested',true,true],
   ['MEDIA_PURGE_PENDING','provider_reported',true,true],
   ['LEGAL_HOLD','not_requested',false,true],
   ['NOT_REQUESTED','not_requested',false,true]
 ]){
   const f={...flat(),erasure:{state,revision:1,publicDisabled,
      physicalPurgeVerified:verified,providerStatus}};
   reject(read(f));
 }
});

test('stale SPA generation, control row and authorization epoch are distinct and reject old replies',()=>{
 assert.equal(convert(read(),{...context,requestGeneration:2}).status,'STALE_RESPONSE');
 assert.equal(convert(read(),{...context,latestGeneration:4}).status,'STALE_RESPONSE');
 assert.equal(convert(read(),{...context,expectedRowVersion:2}).status,'REFRESH_REQUIRED');
 assert.equal(convert(read(),{...context,expectedAuthorizationEpoch:2}).status,'REFRESH_REQUIRED');
 assert.equal(convert(read(),{...context,expectedRowVersion:1,expectedAuthorizationEpoch:1}).status,
   'NEED_BACKEND_PROJECTION');
 reject(read(),{...context,requestGeneration:'3'});
 reject(read(),{...context,workId:entry});
});

test('strict envelopes reject mismatched versions, public activation, fake source/owner and extra fields',()=>{
 reject({...read(),contractVersion:'wand.dreamsnaps.private-owner-consumer@1'});
 reject({...read(),contractVersion:'wand.dreamsnaps.owner-management@1'});
 reject({...read(),ok:false});
 reject({...read(),operation:'publish'});
 reject({...read(),ownerAccountId:account});
 reject(read({...flat(),contractVersion:'wand.dreamsnaps.owner-management@1'}));
 reject(read({...flat(),sourceContractVersion:'wrong'}));
 reject(action({...flat(),capabilities:{...caps(),publish:true}}));
 reject({...action(),data:{...action().data,publicActivationAllowed:true}});
 reject({...action(),data:{...action().data,result:null}});
 reject({...read(),data:{...flat(),imageGrant:{...grant(),mediaId:media}}});
 reject({...read(),data:{...flat(),erasure:{...erasure(),legalHold:false}}});
 reject({...read(),data:{...flat(),capabilities:{...caps(),publicMedia:true}}});
});

test('HTTP mock error statuses, cache policy, CAS fresh re-read and zero optimistic consent state',()=>{
 for(const code of [401,403,404,410,503,500,201,204]){
   const v=classifySource150OwnerHttpFixture(mockResponse(code),context);
   assert.equal(v.status,'BACKEND_UNAVAILABLE',String(code));
   assert.equal(v.snapshot,null);
   assert.equal(v.autoRetry,false);
 }
 for(const code of [409,412]){
   const v=classifySource150OwnerHttpFixture(mockResponse(code),context);
   assert.equal(v.status,'REFRESH_REQUIRED');
   assert.equal(v.refreshRequired,true);
   assert.equal(v.clearPriorSnapshot,true);
   assert.equal(v.autoRetry,false);
 }
 const accepted=classifySource150OwnerHttpFixture(mockResponse(),context);
 assert.equal(accepted.status,'NEED_BACKEND_PROJECTION');
 assert.equal(accepted.ownerReadVerified,false);
 assert.equal(classifySource150OwnerHttpFixture(mockResponse(200,action()),context).status,
   'NEED_BACKEND_PROJECTION');
 for(const headers of [
   {}, {'cache-control':'public,max-age=30','cdn-cache-control':'no-store','surrogate-control':'no-store',vary:'Authorization'},
   {'cache-control':'private,no-store','cdn-cache-control':'max-age=30','surrogate-control':'no-store',vary:'Authorization'},
   {'cache-control':'private,no-store','cdn-cache-control':'no-store','surrogate-control':'no-store',vary:'Origin'}
 ])assert.equal(classifySource150OwnerHttpFixture(mockResponse(200,read(),headers),context).status,'UNSAFE_CACHE_POLICY');
 assert.equal(classifySource150OwnerHttpFixture(mockResponse(200,read()),{...context,requestGeneration:1}).status,'STALE_RESPONSE');
});

test('byte-preserving, no HTTP or signer transport and flags permanently OFF',()=>{
 const adapter=fs.readFileSync(new URL('../src/lib/dreamsnaps/source150-owner-service-adapter.js',import.meta.url),'utf8');
 for(const forbidden of ['fetch(','.command(','.media(', 'signedUrl:','storageKey:','supabase.functions.invoke(', 'createClient('])
   assert.equal(adapter.includes(forbidden),false,forbidden);
 const owner=fs.readFileSync(new URL('../src/lib/dreamsnaps/owner-management.js',import.meta.url),'utf8');
 assert.match(owner,/OWNER_MANAGEMENT_ENABLED = false/);
 const ui=fs.readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
 assert.match(ui,/data-owner-feature="off"/);
 assert.match(ui,/data-public-detail="disabled"/);
 assert.match(ui,/data-media-operations="disabled"/);
});
