import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SOURCE153_OWNER_PROJECTION_CONTRACT as SOURCE,PRIVATE_OWNER_CONSUMER_V2_CONTRACT as TARGET,SOURCE153_OWNER_V2_LIVE_ENABLED,SOURCE153_OWNER_V2_CAPABILITIES,decodeSource153OwnerConsumerV2 as decode,classifySource153OwnerHttpFixture as http} from '../src/lib/dreamsnaps/source153-owner-consumer-v2.js';
const u=i=>i.toString(16).repeat(8).slice(0,8)+'-2222-4222-8222-'+i.toString(16).repeat(12).slice(0,12);
const ids=Array.from({length:9},(_,i)=>u(i+1));const [work,creator,challenge,photo,media,revision,entry,otherWork,otherMedia]=ids;
const context=(generation=3)=>({workId:work,requestGeneration:generation,latestGeneration:3});
const data=(kind='PostEventCreation')=>({
 contractVersion:SOURCE,consumerTarget:TARGET,
 work:{workId:work,creatorProfileId:creator,challengeId:challenge,kind,photoRevisionId:photo,photoMediaId:media,currentWorkRevisionId:revision,...(kind==='OriginalCompetition'?{entryId:entry,frozenEntryRevisionId:photo}:{})},
 authority:{ownerAuthorized:true,authenticatedAccountBound:true,activeIdentityVerified:true,creatorOwnerVerified:true,workPhotoBindingVerified:true,mediaOwnershipVerified:true,mediaReady:true,rowVersion:2,authorizationEpoch:2,controlState:'withdrawn'},
 grant:{mediaId:media,photoRevisionId:photo,creatorSelfCaptureDeclared:true,explicitGrantAccepted:true,consentRecorded:true,lastGrantConsentRevision:1,policyVersionText:'v1',policyDigest:'c'.repeat(64),state:'withdrawn',policyReceiptVerified:false,scopeStatus:'UNVERIFIED',publicUsageAuthorized:false},
 deletion:{controlState:'withdrawn',localState:'PUBLIC_DISABLED',publicDisabled:true,activeAccountLegalHold:false,localProviderReceiptVerified:false,localProviderScope:'SINGLE_FROZEN_MEDIA_RECORD',providerStatus:'not_requested',globalPurgeScopeComplete:false,cloudCdnIssuedBearerStatus:'UNKNOWN'},
 externalEvidence:{signedRuntimeSessionVerified:false,storageProviderObjectVerified:false,officialChallengePhaseVerified:false,cloudCdnPhysicalPurgeVerified:false,publicActivationAllowed:false},
 capabilities:{ownerActionsEnabled:false,publicDetail:false,publicMedia:false,publish:false,mediaSigner:false}
});
const wrapper=(d=data())=>({ok:true,operation:'authority',contractVersion:SOURCE,data:d});
const run=(d=data(),ctx=context())=>decode(wrapper(d),ctx);
const h=()=>({'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Surrogate-Control':'no-store','Vary':'Authorization, Origin'});
const close=(r,status)=>{assert.equal(r.status,status);assert.equal(r.snapshot,null);assert.equal(r.ownerReadVerified,false);assert.equal(r.actionsEnabled,false);assert.equal(r.liveBackendEnabled,false);assert.equal(r.autoRetry,false);assert.equal(r.clearPriorSnapshot,true);};
const deny=(d)=>close(run(d),'SOURCE_CONTRACT_REJECTED');
test('exact source v2 contract identity frozen + no web source mutations and zero actionable flags',()=>{
 assert.equal(SOURCE,'wand.dreamsnaps.owner-authority-projection@1');assert.equal(TARGET,'wand.dreamsnaps.private-owner-consumer@2');
 assert.equal(SOURCE153_OWNER_V2_LIVE_ENABLED,false);
 assert.ok(Object.values(SOURCE153_OWNER_V2_CAPABILITIES).every(v=>v===false));
 const f=p=>{const b=readFileSync(p);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')};
 assert.equal(f('src/lib/dreamsnaps/source153-owner-consumer-v2.js'),'f981b7596711b47bceb2fa79a2191e79e8f1b459');
 const src=readFileSync('src/lib/dreamsnaps/source153-owner-consumer-v2.js','utf8');
 for(const p of [/\bfetch\s*\(/,/\.rpc\s*\(/,/\.functions\.invoke\s*\(/,/\bAuthorization\s*:\s*bearer/,/\bwrite\s*\(/])assert.doesNotMatch(src,p);
 for(const file of ['src/lib/dreamsnaps/owner-management.js','src/lib/dreamsnaps/source150-owner-service-adapter.js','src/lib/dreamsnaps/source151-private-pregrant-adapter.js']){
  assert.match(readFileSync(file,'utf8'),/ENABLED\s*=\s*false/);
 }
});
test('independent malformed wrapper/context/actor injection leaves no stale Owner snapshot',()=>{
 for(const envelope of [
  null,[],{},{...wrapper(),operation:'read'},{...wrapper(),contractVersion:'wand.dreamsnaps.owner-management-service@1'},
  {...wrapper(),data:{...data(),contractVersion:'wand.dreamsnaps.owner-authority-projection@2'}},
  {...wrapper(),data:{...data(),consumerTarget:'wand.dreamsnaps.private-owner-consumer@1'}},
  {...wrapper(),userAccountId:otherWork},{...wrapper(),ownerAuthorized:true},
  {...wrapper(),data:{...data(),signedUrl:'https://not-authority.invalid'}},
  {...wrapper(),data:{...data(),work:{...data().work,ownerAccountId:otherWork}}}
 ])close(decode(envelope,context()),'SOURCE_CONTRACT_REJECTED');
 for(const c of [
  {...context(),accountId:otherWork},{...context(),actorAccountId:otherWork},
  {...context(),requestGeneration:-1},{...context(),requestGeneration:1.5},
  {...context(),expectedRowVersion:0},{...context(),expectedAuthorizationEpoch:0},
  {...context(),workId:otherWork},{...context(),workId:null}
 ])close(decode(wrapper(),c),'SOURCE_CONTRACT_REJECTED');
 close(decode(wrapper(),{...context(),requestGeneration:2}),'STALE_RESPONSE');
 close(decode(wrapper(),{...context(),latestGeneration:4}),'STALE_RESPONSE');
 close(decode(wrapper(),{...context(),expectedRowVersion:3}),'REFRESH_REQUIRED');
 close(decode(wrapper(),{...context(),expectedAuthorizationEpoch:3}),'REFRESH_REQUIRED');
});
test('Original Entry required and PostEvent Entry keys must be ABSENT, not null',()=>{
 const o=run(data('OriginalCompetition'));close(o,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(o.projectionCandidate.isCompetitionEntry,true);
 for(const w of [{...data().work,entryId:null},{...data().work,frozenEntryRevisionId:photo}])deny({...data(),work:w});
 for(const w of [{...data('OriginalCompetition').work,entryId:null},{...data('OriginalCompetition').work,frozenEntryRevisionId:otherWork}])deny({...data('OriginalCompetition'),work:w});
 for(const kind of ['OriginalCompetition','PostEventCreation']){
  const d=data(kind);
  deny({...d,grant:{...d.grant,mediaId:otherMedia}});
  deny({...d,grant:{...d.grant,photoRevisionId:otherWork}});
  deny({...d,work:{...d.work,workId:otherWork}});
 }
});
test('same-owner different Work Media replacement cannot produce verified authority from browser-shaped DTO',()=>{
 const d=data();const forged={...d,work:{...d.work,photoMediaId:otherMedia},grant:{...d.grant,mediaId:otherMedia}};
 const r=run(forged);close(r,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(r.projectionCandidate.mediaId,otherMedia);
 assert.equal(r.projectionCandidate.authenticatedAccountSourceClaim,true);
 assert.equal(r.projectionCandidate.workPhotoMediaSourceClaim,true);
 assert.deepEqual(r.projectionCandidate.approvedPurposesForPublication,[]);
 assert.equal(r.projectionCandidate.publicUsageAuthorized,false);
 assert.equal(r.projectionCandidate.globalPurgeScopeComplete,false);
 assert.equal(r.projectionCandidate.externalPurgeStatus,'UNKNOWN');
 assert.equal(r.requiresSignedRuntimeAcceptance,true);
 // Source authenticated DB ownership NOT proved by a JSON shape.
 assert.equal(r.snapshot,null);assert.equal(r.ownerReadVerified,false);assert.equal(r.actionsEnabled,false);
});
test('numeric extremes, consent vs version/epoch, opaque policy, invalid policy scope',()=>{
 for(const value of [0,-1,0.5,2**53,NaN,'2',null]){
  const d=data();deny({...d,authority:{...d.authority,rowVersion:value}});
  deny({...d,authority:{...d.authority,authorizationEpoch:value}});
  deny({...d,grant:{...d.grant,lastGrantConsentRevision:value}});
 }
 deny({...data(),grant:{...data().grant,lastGrantConsentRevision:3}});
 for(const v of [2,' 02','', ' '.repeat(81)])deny({...data(),grant:{...data().grant,policyVersionText:v}});
 const strange=run({...data(),grant:{...data().grant,policyVersionText:'00004'}});
 assert.equal(strange.projectionCandidate.policyVersionText,'00004');
 for(const key of ['scopeId','approvedPurposeIds'])deny({...data(),grant:{...data().grant,[key]:key==='scopeId'?'cdn':['cdn']}});
 deny({...data(),grant:{...data().grant,policyReceiptVerified:true}});
 deny({...data(),grant:{...data().grant,scopeStatus:'APPROVED_CANONICAL_RECEIPT'}});
 const acceptedSourceShape={...data(),grant:{...data().grant,policyReceiptVerified:true,scopeStatus:'APPROVED_CANONICAL_RECEIPT',scopeId:'wand.dreamsnaps.creator-photo-grant@1',approvedPurposeIds:['wand.dreamsnaps.creator-photo-grant@1']}};
 const x=run(acceptedSourceShape);close(x,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.deepEqual(x.projectionCandidate.approvedPurposesForPublication,[]);assert.equal(x.projectionCandidate.publicUsageAuthorized,false);
});
test('withdrawn/local hold/false global purge and all capabilities remain untrusted',()=>{
 const d=data();
 for(const key of Object.keys(d.externalEvidence))deny({...d,externalEvidence:{...d.externalEvidence,[key]:true}});
 for(const key of Object.keys(d.capabilities))deny({...d,capabilities:{...d.capabilities,[key]:true}});
 deny({...d,deletion:{...d.deletion,globalPurgeScopeComplete:true}});
 deny({...d,deletion:{...d.deletion,cloudCdnIssuedBearerStatus:'REVOKED'}});
 deny({...d,deletion:{...d.deletion,localProviderScope:'ALL_MEDIA'}});
 const hold={...d,deletion:{...d.deletion,activeAccountLegalHold:true,localState:'LOCAL_LEGAL_HOLD'}};
 const h=run(hold);close(h,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(h.projectionCandidate.activeAccountLegalHold,true);assert.equal(h.projectionCandidate.externalPurgeStatus,'UNKNOWN');
 const purged={...d,authority:{...d.authority,mediaReady:false},deletion:{...d.deletion,localState:'LOCAL_FROZEN_MEDIA_VERIFIED',providerStatus:'verified',localProviderReceiptVerified:true}};
 const p=run(purged);close(p,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal(p.projectionCandidate.globalPurgeScopeComplete,false);assert.equal(p.projectionCandidate.externalPurgeStatus,'UNKNOWN');
});
test('HTTP method-independent fixture: no-store normalized, duplicate headers, cache and status failclosed',()=>{
 const good=http({status:200,headers:h(),body:wrapper()},context());close(good,'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 for(const status of [401,403,404,410,500,503,201,204]){
  close(http({status,headers:h(),body:wrapper()},context()),'BACKEND_UNAVAILABLE');
 }
 for(const status of [409,412]){
  const r=http({status,headers:h(),body:wrapper()},context());close(r,'REFRESH_REQUIRED');assert.equal(r.refreshRequired,true);
 }
 for(const headers of [
  {},{...h(),'Cache-Control':'public, max-age=0'},
  {...h(),'Cache-Control':'private,no-store,max-age=1'},
  {...h(),'Cache-Control':'private,no-store,max-age=0,public'},
  {...h(),'CDN-Cache-Control':'max-age=1'},
  {...h(),'Surrogate-Control':'public'},
  {...h(),Vary:'authorization'},
  {...h(),Vary:'authorization, *'},
  {...h(),'cache-control':'private, no-store, max-age=0'},
  {...h(),'cdn-cache-control':'no-store'}
 ])close(http({status:200,headers,body:wrapper()},context()),'UNSAFE_CACHE_POLICY');
 close(http({status:200,headers:h(),body:wrapper()}, {...context(),requestGeneration:2}),'STALE_RESPONSE');
});
