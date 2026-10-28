import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PRIVATE_OWNER_CONSUMER_CONTRACT,PRIVATE_OWNER_BACKEND_ACTIVATED,
  PRIVATE_OWNER_CAPABILITIES,PRIVATE_OWNER_PURGE_STATES,
  decodePrivateOwnerSnapshotCandidate,classifyPrivateOwnerServiceOutcome,
  describePrivateOwnerCas,createPrivateOwnerServiceConsumer
} from '../src/lib/dreamsnaps/private-owner-consumer-contract.js';

const workId='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const creator='33333333-3333-4333-8333-333333333333';
const challenge='44444444-4444-4444-8444-444444444444';
const photo='55555555-5555-4555-8555-555555555555';
const media='66666666-6666-4666-8666-666666666666';
const concept='77777777-7777-4777-8777-777777777777';
const entry='88888888-8888-4888-8888-888888888888';
const ctx={workId,actorAccountId:owner,requestGeneration:9,latestGeneration:9};
const valid=()=>({
  contractVersion:PRIVATE_OWNER_CONSUMER_CONTRACT,
  work:{workId,ownerAccountId:owner,creatorProfileId:creator,kind:'PostEventCreation',
    challengeId:challenge,photoRevisionId:photo,mediaId:media,conceptRevisionId:concept,
    conceptText:'A private concept'},
  authority:{ownerAuthorized:true,accountState:'active',identityState:'active',
    retired:false,privacySuppressed:false,moderationAllowed:true,photoBindingVerified:true,
    mediaOwnershipVerified:true,rowVersion:8,authorizationEpoch:12},
  grant:{state:'accepted',policyIdentifier:'02.0-creator-photo-terms-v7',
    consentEventVersion:4,workId,mediaId,creatorSelfCaptureDeclared:true,
    explicitGrantAccepted:true,scopes:['cdn','display','store','thumbnail']},
  deletion:{controlState:'consented',publicDisabled:false,purgeState:'not_requested',
    providerVerificationAccepted:false,purgeScopeComplete:false,legalHold:false}
});
const decode=(v=valid(),c=ctx)=>decodePrivateOwnerSnapshotCandidate(v,c);
const change=(field,patch)=>{let a=valid();a[field]={...a[field],...patch};return a;};
const testReject=(o,c=ctx)=>assert.equal(decode(o,c),null);

test('typed candidate: opaque SQL policy TEXT remains TEXT and is never parsed as numeric WEB245 version',()=>{
  let projection=decode();
  assert.equal(projection.grantPolicyIdentifier,'02.0-creator-photo-terms-v7');
  assert.equal(typeof projection.grantPolicyIdentifier,'string');
  assert.equal(projection.consentEventVersion,4);
  assert.equal(projection.rowVersion,8);
  assert.equal(projection.authorizationEpoch,12);
  assert.equal(projection.actionsEnabled,false);
  assert.equal(projection.publicDetailEnabled,false);
  assert.equal(projection.mediaSigningEnabled,false);
  assert.equal(projection.isCompetitionEntry,false);
  for(const policy of ['3','00003','policy/2026.10','1.2+draft']){
    let v=change('grant',{policyIdentifier:policy});
    assert.equal(decode(v).grantPolicyIdentifier,policy);
  }
  testReject(change('grant',{policyIdentifier:123}));
  testReject(change('grant',{policyIdentifier:''}));
  testReject(change('grant',{policyIdentifier:'x'.repeat(81)}));
  testReject(change('grant',{consentEventVersion:9}));
  testReject(change('authority',{rowVersion:'8'}));
  testReject(change('authority',{authorizationEpoch:'12'}));
  testReject(change('authority',{rowVersion:Number.MAX_SAFE_INTEGER+1}));
});

test('typed work, owner, Creator, Challenge, photo, immutable Media and no Entry for PostEvent',()=>{
  assert.ok(decode(valid()));
  const original=valid();
  original.work={...original.work,kind:'OriginalCompetition',entryId:entry,
    frozenEntryRevisionId:photo};
  assert.equal(decode(original).isCompetitionEntry,true);
  testReject(change('work',{kind:'OriginalCompetition'}));
  testReject(change('work',{entryId:entry}));
  testReject(change('work',{entryId:undefined}));
  testReject({...original,work:{...original.work,frozenEntryRevisionId:concept}});
  for(const [field,value] of [['workId',entry],['ownerAccountId',creator],
    ['creatorProfileId','invalid'],['challengeId','invalid'],['photoRevisionId','invalid'],
    ['mediaId',entry],['conceptRevisionId',null],['kind','Competition'],
    ['conceptText','x'.repeat(2001)]])
    testReject(change('work',{[field]:value}));
  for(const [field,value] of [['workId',entry],['mediaId',entry],
    ['creatorSelfCaptureDeclared',false],['explicitGrantAccepted',false],
    ['scopes',['display','cdn','store','thumbnail']]])
    testReject(change('grant',{[field]:value}));
  testReject({...valid(),work:{...valid().work,signedUrl:'https://example.invalid/secret'}});
  testReject({...valid(),storageKey:'never'});
});

test('retired identity, foreign owner, privacy, moderation, missing verified bindings and stale generations fail closed',()=>{
  for(const [field,value] of [['ownerAuthorized',false],['accountState','deleted'],
    ['identityState','retired'],['retired',true],['privacySuppressed',true],
    ['moderationAllowed',false],['photoBindingVerified',false],
    ['mediaOwnershipVerified',false],['rowVersion',0],['authorizationEpoch',0]])
    testReject(change('authority',{[field]:value}));
  for(const wrong of [
    {...ctx,workId:entry},{...ctx,actorAccountId:creator},{...ctx,requestGeneration:8},
    {...ctx,latestGeneration:10},{...ctx,expectedRowVersion:7},
    {...ctx,expectedAuthorizationEpoch:11},{...ctx,expectedRowVersion:'8'},
    {...ctx,expectedAuthorizationEpoch:Number.MAX_SAFE_INTEGER+1}
  ])testReject(valid(),wrong);
  assert.ok(decode(valid(),{...ctx,expectedRowVersion:8,expectedAuthorizationEpoch:12}));
  testReject({...valid(),contractVersion:'wand.dreamsnaps.private-owner-consumer@0'});
});

test('withdraw revokes access; requested/provider-reported never equals verified media purge',()=>{
  const withdrawn=change('deletion',{controlState:'withdrawn',publicDisabled:true});
  withdrawn.grant.state='withdrawn';
  assert.equal(decode(withdrawn).purgePresentation,'PUBLIC_DISABLED');
  assert.equal(decode(withdrawn).mediaPurgeVerified,false);
  for(const state of ['requested','provider_pending','provider_reported']){
    const work=valid();work.grant.state='withdrawn';
    work.deletion={controlState:'delete_requested',publicDisabled:true,purgeState:state,
      providerVerificationAccepted:false,purgeScopeComplete:false,legalHold:false};
    const got=decode(work);
    assert.equal(got.mediaPurgeVerified,false,state);
    assert.equal(got.purgePresentation,'PUBLIC_DISABLED',state);
    testReject({...work,deletion:{...work.deletion,providerVerificationAccepted:true}});
    testReject({...work,deletion:{...work.deletion,purgeScopeComplete:true}});
  }
  for(const bad of [
    change('deletion',{controlState:'withdrawn'}),
    change('deletion',{controlState:'delete_requested',publicDisabled:true,purgeState:'not_requested'}),
    change('deletion',{purgeState:'provider_pending'}),
    change('deletion',{purgeState:'verified'})
  ])testReject(bad);
  assert.deepEqual(PRIVATE_OWNER_PURGE_STATES,['not_requested','requested','provider_pending','provider_reported','verified']);
  const verified=valid();verified.grant.state='withdrawn';
  verified.deletion={controlState:'delete_requested',publicDisabled:true,purgeState:'verified',
    providerVerificationAccepted:true,purgeScopeComplete:true,legalHold:false};
  assert.equal(decode(verified).mediaPurgeVerified,true); // MOCK ONLY, NOT Source149 proof.
  testReject({...verified,deletion:{...verified.deletion,legalHold:true}});
  testReject({...verified,deletion:{...verified.deletion,providerVerificationAccepted:false}});
});

test('CAS conflict and stale/current epoch are reload-required, never optimistic or automatically retried',()=>{
  const snapshot=decode();
  let plan=describePrivateOwnerCas(snapshot,'withdraw');
  assert.deepEqual(plan,{status:'BACKEND_ACTIVATION_WAIT',workId,
    expectedRowVersion:8,expectedAuthorizationEpoch:12,operation:'withdraw',executable:false});
  for(const status of [409,412])assert.deepEqual(classifyPrivateOwnerServiceOutcome(status),
    {status:'REFRESH_REQUIRED',clearPriorSnapshot:true,autoRetry:false});
  for(const status of [200,201,204])assert.equal(classifyPrivateOwnerServiceOutcome(status).status,
    'AUTHORITATIVE_REREAD_REQUIRED');
  for(const status of [401,403,404,410,500,503])assert.equal(
    classifyPrivateOwnerServiceOutcome(status).status,'BACKEND_UNAVAILABLE');
  assert.equal(describePrivateOwnerCas(snapshot,'publish').status,'BACKEND_UNAVAILABLE');
  assert.equal(describePrivateOwnerCas({...snapshot,actionsEnabled:true},'delete').status,
    'BACKEND_UNAVAILABLE');
});

test('unaccepted owner API cannot be invoked even with fake session or transport',async()=>{
  const adapter=createPrivateOwnerServiceConsumer();
  assert.equal(PRIVATE_OWNER_BACKEND_ACTIVATED,false);
  assert.ok(Object.values(PRIVATE_OWNER_CAPABILITIES).every(x=>x===false));
  let network=0;
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>{network++;throw Error('network not allowed');};
  try {
    assert.deepEqual(await adapter.read({token:'FAKE',workId}),{status:'BACKEND_UNAVAILABLE',snapshot:null});
    assert.deepEqual(await adapter.mutate({action:'grant',token:'FAKE'}),
      {status:'BACKEND_UNAVAILABLE',persisted:false});
    assert.equal(network,0);
  }finally{globalThis.fetch=previous;}
});

test('source-only additive contract does not enable PR245 UI, native SQL, public route or Media signing',()=>{
  const paths=['src/routes/dreamsnaps/my/manage/+page.svelte',
    'src/lib/dreamsnaps/owner-management.js',
    'src/routes/dreamsnaps/community/+page.svelte'];
  const sources=paths.map(path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  assert.match(sources[0],/data-public-detail="disabled"/);
  assert.match(sources[0],/data-media-operations="disabled"/);
  assert.match(sources[1],/OWNER_MANAGEMENT_ENABLED = false/);
  assert.match(sources[2],/data-community-dreamsnaps="fail-closed"/);
  const source=fs.readFileSync(new URL('../src/lib/dreamsnaps/private-owner-consumer-contract.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\(/);
  assert.doesNotMatch(source,/\.command\(/);
  assert.doesNotMatch(source,/\.media\(/);
  assert.doesNotMatch(source,/Storage\.from\(/);
});
