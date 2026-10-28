import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  OWNER_MANAGEMENT_CONTRACT, OWNER_MANAGEMENT_ENABLED, OWNER_BACKEND_CAPABILITIES,
  parseOwnerWorkRoute, validateOwnerDraft, createOwnerManagementAdapter,
  decodeOwnerManagementProjection
} from '../src/lib/dreamsnaps/owner-management.js';
import { DREAMSNAPS_OWNER_COPY, dreamsnapOwnerCopy } from '../src/lib/dreamsnaps/owner-management-copy.js';

const id = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
const challenge = '33333333-3333-4333-8333-333333333333';
const creator = '44444444-4444-4444-8444-444444444444';
const photo = '55555555-5555-4555-8555-555555555555';
const media = '66666666-6666-4666-8666-666666666666';
const conceptRevision = '77777777-7777-4777-8777-777777777777';
const entry = '88888888-8888-4888-8888-888888888888';
const context = {workId:id,actorAccountId:actor,generation:7,latestGeneration:7};
const ready = {contractVersion:OWNER_MANAGEMENT_CONTRACT,ownerAuthorized:true,accountState:'active',
  identityState:'active',privacySuppressed:false,retired:false,moderationAllowed:true,
  ownerAccountId:actor,creatorProfileId:creator,workId:id,kind:'PostEventCreation',
  challengeId:challenge,photoRevisionId:photo,photoMediaId:media,
  conceptRevisionId:conceptRevision,rowVersion:4,authorizationEpoch:2,
  concept:'A local caption',imageGrant:{state:'accepted',policyVersion:2,revision:3,workId:id,photoMediaId:media},
  erasure:{state:'NOT_REQUESTED',revision:1,publicDisabled:false,physicalPurgeVerified:false}};

const mutate = (body, patch) => ({...body,...patch});

test('independent owner route is WorkID-only and refuses malformed, duplicate and mixed references', () => {
  assert.deepEqual(parseOwnerWorkRoute(''),{status:'draft',workId:null});
  assert.deepEqual(parseOwnerWorkRoute('?work='+id),{status:'authority-pending',workId:id});
  for(const search of ['?work=garbage','?work=00000000-0000-0000-0000-000000000000',
    '?entry='+entry,'?revision='+conceptRevision,'?media='+media,'?creator='+creator,
    '?work='+id+'&work='+id,'?work='+id+'&entry='+entry,'?work='+id+'&tip='+id,
    '?work='+id+'&revision='+conceptRevision,'?work='+id+'&media='+media,'?foo=bar']) {
      assert.equal(parseOwnerWorkRoute(search).status,'invalid',search);
  }
});

test('local create preview is typed and immutable; it cannot commit or claim competition status for PostEvent', () => {
  for(const kind of ['OriginalCompetition','PostEventCreation']) {
    const preview = validateOwnerDraft({kind,challengeId:challenge,concept:' idea '});
    assert.equal(preview.status,'preview-only');
    assert.equal(preview.value.persisted,false);
    assert.equal(preview.value.publishEnabled,false);
    assert.equal(preview.value.immutableImage,true);
    assert.equal(preview.value.immutableChallenge,true);
    assert.equal(preview.value.isCompetitionEntry,kind==='OriginalCompetition');
  }
  for(const sample of [
    {kind:'PostEventCreation',challengeId:'nope',concept:''},
    {kind:'Competition',challengeId:challenge,concept:''},
    {kind:'OriginalCompetition',challengeId:challenge,concept:'x'.repeat(2001)},
    {kind:'PostEventCreation',challengeId:challenge,concept:null}
  ])assert.equal(validateOwnerDraft(sample).status,'invalid');
});

test('backend adapters remain inert regardless of mocked accepted credentials', async () => {
  assert.equal(OWNER_MANAGEMENT_ENABLED,false);
  assert.ok(Object.values(OWNER_BACKEND_CAPABILITIES).every(x=>x===false));
  const adapter = createOwnerManagementAdapter();
  assert.deepEqual(await adapter.read({workId:id,token:'FAKE_TOKEN'}),{status:'backend-unavailable',work:null});
  assert.deepEqual(await adapter.write({kind:'publish',workId:id}),{status:'backend-unavailable',persisted:false});
});

test('future owner-only decoder insists on typed provenance, same actor, same revision and current generation', () => {
  const decoded = decodeOwnerManagementProjection(ready,context);
  assert.equal(decoded.kind,'PostEventCreation');
  assert.equal(decoded.hasCompetitionEntry,false);
  assert.equal(decoded.imageGrantVersion,2);
  assert.equal(decoded.actionsEnabled,false);
  assert.equal('ownerAccountId' in decoded,false);
  assert.equal('photoMediaId' in decoded,false);
  for(const bad of [
    {ownerAuthorized:false},{ownerAccountId:creator},{workId:entry},
    {accountState:'retired'},{identityState:'retired'},{privacySuppressed:true},{retired:true},
    {moderationAllowed:false},{kind:'untrusted'},{rowVersion:0},{authorizationEpoch:0},
    {photoMediaId:'invalid'},{conceptRevisionId:null},{entryId:entry},
    {frozenEntryRevisionId:photo},{hasWandRank:true},{hasCompetitionEntry:true},
    {imageGrant:{...ready.imageGrant,workId:entry}},
    {imageGrant:{...ready.imageGrant,photoMediaId:entry}},
    {imageGrant:{...ready.imageGrant,policyVersion:0}},
    {erasure:{...ready.erasure,state:'MEDIA_PURGED'}},
    {erasure:{...ready.erasure,physicalPurgeVerified:true}},
    {erasure:{...ready.erasure,state:'MYSTERY'}},
    {contractVersion:'wand.dreamsnaps.owner-management@0'}
  ])assert.equal(decodeOwnerManagementProjection(mutate(ready,bad),context),null,JSON.stringify(bad));
  for(const badContext of [
    {...context,generation:6},
    {...context,latestGeneration:8},
    {...context,actorAccountId:creator},
    {...context,workId:entry}
  ])assert.equal(decodeOwnerManagementProjection(ready,badContext),null);
});

test('Original requires actual Entry and frozen photo; PostEvent cannot spoof one', () => {
  const original = {...ready,kind:'OriginalCompetition',entryId:entry,frozenEntryRevisionId:photo};
  const got = decodeOwnerManagementProjection(original,context);
  assert.equal(got.hasCompetitionEntry,true);
  assert.equal(decodeOwnerManagementProjection({...original,entryId:null},context),null);
  assert.equal(decodeOwnerManagementProjection({...original,frozenEntryRevisionId:entry},context),null);
});

test('PUBLIC_DISABLED does not mean MEDIA_PURGED; verifiable purged state is separate', () => {
  let state = decodeOwnerManagementProjection({...ready,erasure:{state:'PUBLIC_DISABLED',revision:3,publicDisabled:true,physicalPurgeVerified:false}},context);
  assert.equal(state.publicDisabled,true);
  assert.equal(state.mediaPurgedVerified,false);
  state = decodeOwnerManagementProjection({...ready,erasure:{state:'MEDIA_PURGED',revision:4,publicDisabled:true,physicalPurgeVerified:true}},context);
  assert.equal(state.mediaPurgedVerified,true);
  state = decodeOwnerManagementProjection({...ready,erasure:{state:'LEGAL_HOLD',revision:5,publicDisabled:true,physicalPurgeVerified:false}},context);
  assert.equal(state.mediaPurgedVerified,false);
});

test('all eight locales have parity, P01–P03 and deletion distinctions; page has no public/media/command calls', () => {
  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  for(const locale of locales){
    const c=dreamsnapOwnerCopy(locale);
    assert.deepEqual(Object.keys(c).sort(),Object.keys(DREAMSNAPS_OWNER_COPY.en).sort());
    for(const [k,v] of Object.entries(c))assert.ok(typeof v==='string' && v.trim().length>0,locale+':'+k);
    for(const k of ['unofficial','noOwnership','limitedGrant','deleteRule','consentPending','deletePending','mediaPurged','publicDisabled'])
      assert.ok(c[k],locale+':'+k);
  }
  const page=fs.readFileSync(new URL('../src/routes/dreamsnaps/my/manage/+page.svelte',import.meta.url),'utf8');
  const layout=fs.readFileSync(new URL('../src/routes/dreamsnaps/my/+layout.svelte',import.meta.url),'utf8');
  assert.match(page,/data-public-detail="disabled"/);
  assert.match(page,/data-media-operations="disabled"/);
  assert.match(page,/data-owner-feature="off"/);
  assert.match(page,/disabled aria-disabled="true" data-owner-action="request-delete"/);
  assert.match(page,/disabled aria-disabled="true" data-owner-action="image-grant"/);
  assert.match(layout,/data-owner-management-link="preview-only"/);
  for(const forbidden of ['client.command(', 'client.media(', 'getPublicCommunityMedia(', 'uploadAndFinalizeImage(', 'community_get_gallery_dreamsnap_public_v1', 'signedUrl'])
    assert.ok(!page.includes(forbidden),'unsafe public/owner operation: '+forbidden);
});
