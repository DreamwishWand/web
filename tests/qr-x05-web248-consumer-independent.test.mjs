import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 PRIVATE_OWNER_CONSUMER_CONTRACT,PRIVATE_OWNER_BACKEND_ACTIVATED,PRIVATE_OWNER_CAPABILITIES,
 decodePrivateOwnerSnapshotCandidate,classifyPrivateOwnerServiceOutcome,
 describePrivateOwnerCas,createPrivateOwnerServiceConsumer
} from '../src/lib/dreamsnaps/private-owner-consumer-contract.js';

const ids={
 work:'11111111-1111-4111-8111-111111111111',
 owner:'22222222-2222-4222-8222-222222222222',
 creator:'33333333-3333-4333-8333-333333333333',
 challenge:'44444444-4444-4444-8444-444444444444',
 photo:'55555555-5555-4555-8555-555555555555',
 media:'66666666-6666-4666-8666-666666666666',
 concept:'77777777-7777-4777-8777-777777777777',
 entry:'88888888-8888-4888-8888-888888888888'
};
const ctx=()=>({workId:ids.work,actorAccountId:ids.owner,requestGeneration:19,latestGeneration:19,
 expectedRowVersion:7,expectedAuthorizationEpoch:11});
const dto=()=>({
 contractVersion:PRIVATE_OWNER_CONSUMER_CONTRACT,
 work:{workId:ids.work,ownerAccountId:ids.owner,creatorProfileId:ids.creator,
  kind:'PostEventCreation',challengeId:ids.challenge,photoRevisionId:ids.photo,
  mediaId:ids.media,conceptRevisionId:ids.concept,conceptText:'Private design'},
 authority:{ownerAuthorized:true,accountState:'active',identityState:'active',retired:false,
  privacySuppressed:false,moderationAllowed:true,photoBindingVerified:true,
  mediaOwnershipVerified:true,rowVersion:7,authorizationEpoch:11},
 grant:{state:'accepted',policyIdentifier:'00003',consentEventVersion:3,workId:ids.work,
  mediaId:ids.media,creatorSelfCaptureDeclared:true,explicitGrantAccepted:true,
  scopes:['cdn','display','store','thumbnail']},
 deletion:{controlState:'consented',publicDisabled:false,purgeState:'not_requested',
  providerVerificationAccepted:false,purgeScopeComplete:false,legalHold:false}
});
const patch=(section,change)=>{const x=dto();x[section]={...x[section],...change};return x};
const decode=(x=dto(),c=ctx())=>decodePrivateOwnerSnapshotCandidate(x,c);
test('private mock contract stays independent, inactive, inert and never establishes HTTP authority',async()=>{
 assert.equal(PRIVATE_OWNER_BACKEND_ACTIVATED,false);
 assert.ok(Object.values(PRIVATE_OWNER_CAPABILITIES).every(v=>v===false));
 const a=createPrivateOwnerServiceConsumer();
 const f=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw Error('FORBIDDEN_NETWORK')};
 try{
  assert.deepEqual(await a.read({token:'FORGED',workId:ids.work}),{status:'BACKEND_UNAVAILABLE',snapshot:null});
  assert.deepEqual(await a.mutate({action:'delete',workId:ids.work}),{status:'BACKEND_UNAVAILABLE',persisted:false});
 }finally{globalThis.fetch=f}
 assert.equal(calls,0);
 const src=readFileSync('src/lib/dreamsnaps/private-owner-consumer-contract.js','utf8');
 for(const token of ['fetch(','.rpc(','.storage(','.functions.invoke(','.upload(','.sign('])
  assert.equal(src.includes(token),false,token);
});
test('opaque TEXT grant policy 00003 retained; consent receipt differs from CAS row and epoch',()=>{
 const x=decode();assert.ok(x);
 assert.equal(x.grantPolicyIdentifier,'00003');
 assert.equal(typeof x.grantPolicyIdentifier,'string');
 assert.equal(x.consentEventVersion,3);
 assert.equal(x.rowVersion,7);
 assert.equal(x.authorizationEpoch,11);
 for(const str of ['v2','00003','3','01.1/creator','x'.repeat(80)]){
  assert.equal(decode(patch('grant',{policyIdentifier:str})).grantPolicyIdentifier,str);
 }
 for(const invalid of [3,0,null,'','x'.repeat(81)])
  assert.equal(decode(patch('grant',{policyIdentifier:invalid})),null);
 assert.equal(decode(patch('grant',{consentEventVersion:8})),null);
 assert.equal(decode(patch('grant',{consentEventVersion:'3'})),null);
 assert.equal(decode(patch('authority',{rowVersion:'7'})),null);
});
test('typed Original frozen entry and Photo match; PostEvent must omit entry entirely',()=>{
 assert.equal(decode().isCompetitionEntry,false);
 const o=patch('work',{kind:'OriginalCompetition',entryId:ids.entry,frozenEntryRevisionId:ids.photo});
 assert.equal(decode(o).isCompetitionEntry,true);
 for(const x of [
  patch('work',{kind:'OriginalCompetition'}),
  patch('work',{kind:'OriginalCompetition',entryId:ids.entry,frozenEntryRevisionId:ids.concept}),
  patch('work',{entryId:ids.entry}),patch('work',{frozenEntryRevisionId:ids.photo}),
  patch('work',{kind:'OriginalCompetition',entryId:ids.entry}),
  patch('work',{kind:'OfficialResults',entryId:ids.entry})
 ]) assert.equal(decode(x),null);
});
test('actor work creator challenge media and grant identity are pinned, no token or signer leaks',()=>{
 for(const [f,v] of [['workId',ids.entry],['ownerAccountId',ids.creator],
 ['creatorProfileId','bad'],['challengeId','bad'],['photoRevisionId','bad'],
 ['mediaId','bad'],['conceptRevisionId',null],['conceptText','a'.repeat(2001)]])
  assert.equal(decode(patch('work',{[f]:v})),null,f);
 for(const [f,v] of [['workId',ids.entry],['mediaId',ids.entry],
 ['creatorSelfCaptureDeclared',false],['explicitGrantAccepted',false],
 ['scopes',['store','cdn','display','thumbnail']]])
  assert.equal(decode(patch('grant',{[f]:v})),null,f);
 for(const prop of ['storageKey','signedUrl','token','jwt','bucket','objectPath']){
  assert.equal(decode({...dto(),work:{...dto().work,[prop]:'secret'}}),null,prop);
 }
 assert.equal(decode({...dto(),extra:'x'}),null);
});
test('retired/foreign/privacy/moderation, stale epoch and SPA generation fail closed',()=>{
 for(const [f,v] of [['ownerAuthorized',false],['accountState','restricted'],
 ['identityState','retired'],['retired',true],['privacySuppressed',true],
 ['moderationAllowed',false],['photoBindingVerified',false],['mediaOwnershipVerified',false],
 ['rowVersion',0],['authorizationEpoch',0]])
  assert.equal(decode(patch('authority',{[f]:v})),null,f);
 for(const change of [
 {workId:ids.entry},{actorAccountId:ids.creator},{requestGeneration:18},
 {latestGeneration:20},{expectedRowVersion:8},{expectedAuthorizationEpoch:12},
 {expectedRowVersion:'7'},{expectedAuthorizationEpoch:0}
 ])assert.equal(decode(dto(),{...ctx(),...change}),null,JSON.stringify(change));
});
test('409/412 conflict must require REFRESH; cannot auto replay or consider success authoritative',()=>{
 const x=decode();assert.ok(x);
 for(const n of [409,412])assert.deepEqual(classifyPrivateOwnerServiceOutcome(n),{
  status:'REFRESH_REQUIRED',clearPriorSnapshot:true,autoRetry:false
 });
 for(const n of [200,201,204])assert.deepEqual(classifyPrivateOwnerServiceOutcome(n),{
  status:'AUTHORITATIVE_REREAD_REQUIRED',clearPriorSnapshot:true,autoRetry:false
 });
 const plan=describePrivateOwnerCas(x,'withdraw');
 assert.deepEqual(plan,{status:'BACKEND_ACTIVATION_WAIT',workId:ids.work,
  expectedRowVersion:7,expectedAuthorizationEpoch:11,operation:'withdraw',executable:false});
 for(const action of ['publish','sign','purge'])assert.equal(
  describePrivateOwnerCas(x,action).status,'BACKEND_UNAVAILABLE');
});
test('purge state can never be promoted on requested/provider reported or legal hold',()=>{
 for(const p of ['requested','provider_pending','provider_reported']){
  const x=dto();x.grant.state='withdrawn';
  x.deletion={controlState:'delete_requested',publicDisabled:true,purgeState:p,
   providerVerificationAccepted:false,purgeScopeComplete:false,legalHold:false};
  const d=decode(x);assert.ok(d,p);assert.equal(d.mediaPurgeVerified,false);
  assert.equal(d.purgePresentation,'PUBLIC_DISABLED');
  for(const f of ['providerVerificationAccepted','purgeScopeComplete']){
   assert.equal(decode({...x,deletion:{...x.deletion,[f]:true}}),null);
  }
 }
 const x=dto();x.grant.state='withdrawn';
 x.deletion={controlState:'delete_requested',publicDisabled:true,purgeState:'verified',
  providerVerificationAccepted:true,purgeScopeComplete:true,legalHold:false};
 assert.equal(decode(x).mediaPurgeVerified,true);
 assert.equal(decode({...x,deletion:{...x.deletion,legalHold:true}}),null);
 assert.equal(decode({...x,deletion:{...x.deletion,providerVerificationAccepted:false}}),null);
});
test('Source150 real service@1 and separate WEB248 private consumer@1 must not be silently coerced',()=>{
 const x=dto();x.contractVersion='wand.dreamsnaps.owner-management-service@1';
 assert.equal(decode(x),null);
 const normalized=decode();
 assert.equal(normalized.actionsEnabled,false);
 assert.equal(normalized.publicDetailEnabled,false);
 assert.equal(normalized.mediaSigningEnabled,false);
 assert.equal('ownerAccountId' in normalized,false);
 assert.equal('storageKey' in normalized,false);
});
