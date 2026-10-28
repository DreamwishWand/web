import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalWorkId} from '../src/lib/community/typed-work-route.js';
import {
 OWNER_MANAGEMENT_ENABLED,OWNER_BACKEND_CAPABILITIES,OWNER_MANAGEMENT_CONTRACT,
 parseOwnerWorkRoute,createOwnerManagementAdapter,validateOwnerDraft,
 decodeOwnerManagementProjection
} from '../src/lib/dreamsnaps/owner-management.js';
import {DREAMSNAPS_OWNER_COPY,dreamsnapOwnerCopy} from '../src/lib/dreamsnaps/owner-management-copy.js';
const id=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
'33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444',
'55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',
'77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888'];
const [work,owner,challenge,creator,photo,media,concept,entry]=id;
const ctx={workId:work,actorAccountId:owner,generation:8,latestGeneration:8,
 expectedRowVersion:4,expectedAuthorizationEpoch:7};
const state={contractVersion:OWNER_MANAGEMENT_CONTRACT,ownerAuthorized:true,accountState:'active',
 identityState:'active',privacySuppressed:false,retired:false,moderationAllowed:true,
 ownerAccountId:owner,creatorProfileId:creator,workId:work,kind:'PostEventCreation',
 challengeId:challenge,photoRevisionId:photo,photoMediaId:media,conceptRevisionId:concept,
 rowVersion:4,authorizationEpoch:7,concept:'local only',
 imageGrant:{state:'accepted',workId:work,photoMediaId:media,policyVersion:3,revision:2},
 erasure:{state:'PUBLIC_DISABLED',revision:3,publicDisabled:true,physicalPurgeVerified:false}};
const decode=(patch={},context=ctx)=>decodeOwnerManagementProjection({...state,...patch},context);
test('Feature and every owner/public/media/physical writer flag are actually disabled',async()=>{
 assert.equal(OWNER_MANAGEMENT_ENABLED,false);
 assert.ok(Object.values(OWNER_BACKEND_CAPABILITIES).every(x=>x===false));
 const adapter=createOwnerManagementAdapter();
 assert.deepEqual(await adapter.read({workId:work,token:'spoof'}),{status:'backend-unavailable',work:null});
 assert.deepEqual(await adapter.write({action:'delete',workId:work}),{status:'backend-unavailable',persisted:false});
});
test('Exactly one Work ID route; reject mixed, duplicates, other query, missing/zero/invalid',()=>{
 assert.deepEqual(parseOwnerWorkRoute(''),{status:'draft',workId:null});
 assert.deepEqual(parseOwnerWorkRoute('?work='+work),{status:'authority-pending',workId:work});
 for(const search of ['?work=x','?work=00000000-0000-0000-0000-000000000000',
  '?work='+work+'&work='+work,'?work='+work+'&entry='+entry,
  '?work='+work+'&media='+media,'?work='+work+'&revision='+photo,
  '?work='+work+'&creator='+creator,'?work='+work+'&challenge='+challenge,
  '?work='+work+'&tip='+work,'?entry='+entry,'?media='+media,'?q=test'])
  assert.equal(parseOwnerWorkRoute(search).status,'invalid',search);
});
test('Typed entry-free PostEvent and frozen original consistency; reject forged mixed provenance',()=>{
 assert.equal(decode()?.hasCompetitionEntry,false,true);
 const original={kind:'OriginalCompetition',entryId:entry,frozenEntryRevisionId:photo};
 assert.equal(decode(original).hasCompetitionEntry,true);
 for(const bad of [{kind:'OriginalCompetition'},{kind:'OriginalCompetition',entryId:entry,frozenEntryRevisionId:entry},
  {entryId:entry},{frozenEntryRevisionId:photo},{hasWandRank:true},{hasWandAward:true},
  {hasCompetitionEntry:true},{kind:'Competition'}])
  assert.equal(decode(bad),null,JSON.stringify(bad));
});
test('Owner, active identity, privacy, moderation, revision/epoch and async generation fences',()=>{
 const blocked=[{ownerAuthorized:false},{ownerAccountId:creator},{workId:entry},
  {accountState:'restricted'},{identityState:'retired'},{retired:true},
  {privacySuppressed:true},{moderationAllowed:false},{rowVersion:3},
  {authorizationEpoch:8},{photoMediaId:entry},{challengeId:entry+'bad'},
  {imageGrant:{...state.imageGrant,photoMediaId:entry}},
  {imageGrant:{...state.imageGrant,workId:entry}},
  {imageGrant:{...state.imageGrant,policyVersion:0}},
  {erasure:{state:'MEDIA_PURGED',revision:4,publicDisabled:true,physicalPurgeVerified:false}},
  {erasure:{state:'PROCESSING',revision:3,publicDisabled:true,physicalPurgeVerified:true}}];
 for(const patch of blocked) assert.equal(decode(patch),null,JSON.stringify(patch));
 for(const change of [{latestGeneration:9},{generation:7},{actorAccountId:entry},
   {workId:entry},{expectedRowVersion:5},{expectedAuthorizationEpoch:8}])
  assert.equal(decode({}, {...ctx,...change}),null,JSON.stringify(change));
});
test('P02/P03 keep limited rights and physical purge separate from PUBLIC_DISABLED',()=>{
 const result=decode();
 assert.equal(result.publicDisabled,true);
 assert.equal(result.mediaPurgedVerified,false);
 assert.equal(result.actionsEnabled,false);
 assert.equal(result.imageGrantVersion,3);
 assert.equal('photoMediaId' in result,false);
 assert.equal('ownerAccountId' in result,false);
 assert.equal(decode({erasure:{state:'MEDIA_PURGED',revision:5,publicDisabled:true,physicalPurgeVerified:true}}).mediaPurgedVerified,true);
 for(const s of ['REQUESTED','QUEUED','PROCESSING','PUBLIC_DISABLED','LEGAL_HOLD']){
  assert.equal(decode({erasure:{state:s,revision:9,publicDisabled:true,physicalPurgeVerified:false}}).mediaPurgedVerified,false);
 }
});
test('Only local drafts may preview; no native competition, publish or persistence',()=>{
 for(const kind of ['OriginalCompetition','PostEventCreation']){
  const got=validateOwnerDraft({kind,challengeId:challenge,concept:' bounded '});
  assert.equal(got.status,'preview-only');
  assert.equal(got.value.isCompetitionEntry,kind==='OriginalCompetition');
  assert.equal(got.value.persisted,false);assert.equal(got.value.publishEnabled,false);
  assert.equal(got.value.immutableImage,true);
 }
 for(const bad of [{kind:'Other',challengeId:challenge,concept:''},
  {kind:'PostEventCreation',challengeId:'nope',concept:''},
  {kind:'PostEventCreation',challengeId:challenge,concept:1},
  {kind:'PostEventCreation',challengeId:challenge,concept:'x'.repeat(2001)}])
  assert.equal(validateOwnerDraft(bad).status,'invalid');
});
test('P01/P02/P03 eight locales, protected route and zero backend/storage/signer calls',()=>{
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const c=dreamsnapOwnerCopy(locale);
  assert.deepEqual(Object.keys(c).sort(),Object.keys(DREAMSNAPS_OWNER_COPY.en).sort());
  for(const key of ['unofficial','noOwnership','limitedGrant','publicDisabled','mediaPurged',
  'legalHold','deleteRule','deletePending','consentPending'])
   assert.equal(typeof c[key],'string',locale+':'+key);
 }
 const page=fs.readFileSync('src/routes/dreamsnaps/my/manage/+page.svelte','utf8');
 const layout=fs.readFileSync('src/routes/dreamsnaps/my/+layout.svelte','utf8');
 assert.match(layout,/data-owner-management-link="preview-only"/);
 for(const x of ['data-public-detail="disabled"','data-media-operations="disabled"',
  'data-owner-feature="off"','data-owner-capabilities="all-disabled"',
  'disabled aria-disabled="true" data-owner-action="request-delete"',
  'disabled aria-disabled="true" data-owner-action="image-grant"'])
  assert.ok(page.includes(x),x);
 for(const v of ['.upload(','.delete(','.storage(','.sign(','.rpc(','.command(',
   'getPublicCommunityMedia(','.getSignedUrl(', 'fetch('])
  assert.equal(page.includes(v),false,v);
});
